import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../../database/connection'
import { broadcast } from '../../utils/broadcast'
import { logger } from '../../utils/logger'
import {
  NOTION_CLIENT_ID,
  NOTION_CLIENT_SECRET,
  NOTION_REDIRECT_PORT
} from '../../../shared/constants'
import type { CloudConnection, SyncProgress, SyncResult, CloudServiceType } from '../../../shared/types'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type { CloudConnectionRow } from '../../database/schema'
import { OAuthServer } from './auth-server'
import { NotionAdapter } from './notion.adapter'
import { SyncEngine } from './sync-engine'
import type { CloudSyncAdapter } from './adapter'

/**
 * Central orchestrator for cloud sync. Owns the full lifecycle:
 * connect (OAuth) → sync engine → auto-sync debounce → polling → disconnect.
 *
 * IPC handlers call this service; the service never imports Electron.
 */
export class CloudSyncService {
  private adapter: CloudSyncAdapter
  private syncEngine: SyncEngine
  private pollTimer: ReturnType<typeof setInterval> | null = null

  // Debounce queue for auto-sync after note changes
  private pushQueue = new Map<string, 'create' | 'update' | 'delete'>()
  private pushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    adapter?: CloudSyncAdapter,
    syncEngine?: SyncEngine
  ) {
    this.adapter = adapter ?? new NotionAdapter()
    this.syncEngine = syncEngine ?? new SyncEngine(this.adapter)
  }

  // ==========================================================
  // Connection lifecycle
  // ==========================================================

  /**
   * Start the OAuth flow for a given service.
   * Only one service can be connected at a time. If another service is
   * already connected, disconnect it first (resets baseRev → clean state).
   *
   * 1. Disconnect any existing connection (baseRev=0 + delete old rows)
   * 2. Start local HTTP server
   * 3. Open browser to provider's auth URL
   * 4. Wait for callback
   * 5. Exchange code for token
   * 6. Ensure remote database exists
   * 7. Save connection to SQLite
   * 8. Full sync
   */
  async connect(service: CloudServiceType): Promise<CloudConnection> {
    if (service !== 'notion') {
      throw new Error(`Unsupported service: ${service}`)
    }

    if (!NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET) {
      throw new Error('Notion OAuth credentials not configured. Set NOTION_CLIENT_ID and NOTION_CLIENT_SECRET.')
    }

    // 0. If already connected to another service, disconnect first.
    //    This stops polling, resets all notes' baseRev to 0, and
    //    removes the old connection row so the new service sees a
    //    clean slate (no stale remote-delete detection, no version skew).
    await this.disconnect()

    const authServer = new OAuthServer()

    try {
      // 1. Start local HTTP server on a random port
      const { port } = await authServer.start()
      const redirectUri = `http://localhost:${port}/callback`

      // 2. Build auth URL
      const state = uuidv4()
      const authUrl = this.adapter.getAuthUrl(state, redirectUri)

      logger.info('cloud:service', `OAuth URL ready at port ${port}`)

      // 3. Delete any lingering rows (disconnect only removes active one; be safe)
      const db = getDatabase()
      db.prepare('DELETE FROM cloud_connections').run()

      // 4. Create temporary connection row (status: connecting)
      const tempId = uuidv4()
      const now = new Date().toISOString()
      this.upsertConnection({
        id: tempId,
        service,
        access_token: '',
        workspace_id: null,
        workspace_name: null,
        account_name: null,
        account_email: null,
        database_id: null,
        database_url: null,
        last_sync_at: null,
        status: 'connecting',
        error: null,
        created_at: now,
        updated_at: now
      })

      broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, {
        id: tempId,
        service,
        status: 'connecting'
      })

      // 5. Store pending auth state + start background wait for callback
      this.pendingAuth = { server: authServer, state, redirectUri, tempId, authUrl, service }

      // Fire-and-forget: wait for the browser callback, then complete auth
      authServer.waitForCallback()
        .then(({ code }) => this.completeAuth(code))
        .catch((err) => {
          logger.error('cloud:service', 'OAuth callback failed', { error: String(err) })
          this.updateConnectionStatus(tempId, 'error', String(err))
          broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, this.getConnection(tempId))
          authServer.stop()
        })

      // 6. Return immediately — renderer opens the browser with authUrl
      return {
        id: tempId,
        service,
        status: 'connecting',
        createdAt: now
      }
    } catch (err) {
      await authServer.stop()
      throw err
    }
  }

  /**
   * Complete the OAuth flow after the browser callback arrives.
   * Called internally when the OAuth server receives the callback.
   */
  private async completeAuth(code: string): Promise<void> {
    const pending = this.pendingAuth
    if (!pending) return

    this.pendingAuth = null
    const { server, redirectUri, tempId, service } = pending

    try {
      // Exchange code for token
      const authResult = await this.adapter.exchangeCode(code, redirectUri)

      // Ensure database exists
      const dbInfo = await this.adapter.ensureDatabase(authResult.accessToken)

      const now = new Date().toISOString()
      const connRow: CloudConnectionRow = {
        id: tempId,
        service,
        access_token: authResult.accessToken,
        workspace_id: authResult.workspaceId,
        workspace_name: authResult.workspaceName,
        account_name: authResult.accountName ?? null,
        account_email: authResult.accountEmail ?? null,
        database_id: dbInfo.id,
        database_url: dbInfo.url,
        last_sync_at: null,
        status: 'connected',
        error: null,
        created_at: now,
        updated_at: now
      }

      this.upsertConnection(connRow)

      const connection = this.rowToConnection(connRow)
      broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, connection)

      // Full upload — run async, don't block status update
      try {
        const conn = this.getActiveConnection()
        if (conn) {
          const result = await this.syncEngine.syncAll({
            accessToken: conn.access_token,
            databaseId: conn.database_id!
          })
          logger.info('cloud:service', 'Initial full upload complete', {
            pushed: result.pushed,
            errors: result.errors.length
          })
          // Update last_sync_at
          this.updateLastSync(conn.id)
        }
      } catch (err) {
        logger.error('cloud:service', 'Initial full upload failed', { error: String(err) })
      }

      // Start polling
      this.startPolling()

      await server.stop()
    } catch (err) {
      logger.error('cloud:service', 'Auth completion failed', { error: String(err) })

      // Mark connection as error
      const errorMsg = (err as Error).message
      this.updateConnectionStatus(tempId, 'error', errorMsg)

      const conn = this.getConnection(tempId)
      broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, conn)

      await server.stop()
    }
  }

  /**
   * Called by the auth-server when the OAuth callback is received.
   * Public so IPC handler can wire the auth server's callback to this.
   */
  async onOAuthCallback(code: string): Promise<void> {
    await this.completeAuth(code)
  }

  /** Disconnect and clean up. */
  async disconnect(): Promise<void> {
    this.stopPolling()
    this.clearPushQueue()

    const db = getDatabase()

    // Reset all notes' baseRev to 0 — old remote version numbers are
    // meaningless after switching to a different cloud service.
    db.prepare('UPDATE notes SET base_rev = 0').run()

    const conn = this.getActiveConnection()
    if (conn) {
      db.prepare('DELETE FROM cloud_connections WHERE id = ?').run(conn.id)
      broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, null)
    }
  }

  /** Get the current connection status (or null if not connected). */
  getStatus(): CloudConnection | null {
    const row = this.getActiveConnection()
    return row ? this.rowToConnection(row) : null
  }

  // ==========================================================
  // Sync operations
  // ==========================================================

  /** Manual full sync. */
  async syncNow(): Promise<SyncResult> {
    const conn = this.getActiveConnection()
    if (!conn || conn.status !== 'connected') {
      throw new Error('Not connected to cloud')
    }

    this.broadcastProgress('comparing', 0, 0)
    const startedAt = Date.now()

    const result = await this.syncEngine.syncAll({
      accessToken: conn.access_token,
      databaseId: conn.database_id!
    })

    this.updateLastSync(conn.id)
    this.finishPollSync(startedAt, () => {
      broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, this.getStatus())
    })

    return result
  }

  /** Full pull for device recovery. */
  async pullAll(): Promise<{ imported: number }> {
    const conn = this.getActiveConnection()
    if (!conn || conn.status !== 'connected') {
      throw new Error('Not connected to cloud')
    }

    this.broadcastProgress('pulling', 0, 0)

    const result = await this.syncEngine.pullAll({
      accessToken: conn.access_token,
      databaseId: conn.database_id!
    })

    this.updateLastSync(conn.id)
    this.broadcastProgress('idle', 0, 0)

    return result
  }

  // ==========================================================
  // Auto-sync (debounced push queue)
  // ==========================================================

  /**
   * Schedule a push for a note that was just created/updated/deleted locally.
   * Debounces: collects changes over 3s, then flushes in batch.
   */
  schedulePush(noteId: string, action: 'create' | 'update' | 'delete'): void {
    const conn = this.getActiveConnection()
    if (!conn || conn.status !== 'connected') return

    // Merge consecutive operations on the same note
    const existing = this.pushQueue.get(noteId)
    if (existing === 'create' && action === 'delete') {
      this.pushQueue.delete(noteId) // created then immediately deleted → nothing to sync
      return
    }
    this.pushQueue.set(noteId, action)

    // Reset debounce timer
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => this.flushPushQueue(), 3000)
  }

  private async flushPushQueue(): Promise<void> {
    const conn = this.getActiveConnection()
    if (!conn || conn.status !== 'connected' || this.pushQueue.size === 0) return

    const queue = new Map(this.pushQueue)
    this.pushQueue.clear()

    this.broadcastProgress('pushing', 0, queue.size)

    let done = 0
    for (const [noteId, action] of queue) {
      try {
        if (action === 'delete') {
          await this.syncEngine.deleteRemoteNote(
            { accessToken: conn.access_token, databaseId: conn.database_id! },
            noteId
          )
        } else {
          await this.syncEngine.pushNote(
            { accessToken: conn.access_token, databaseId: conn.database_id! },
            noteId
          )
        }
      } catch (err) {
        logger.error('cloud:service', `Auto-sync failed for ${noteId}`, { error: String(err) })
      }
      done++
      this.broadcastProgress('pushing', done, queue.size)
    }

    this.updateLastSync(conn.id)
    this.broadcastProgress('idle', 0, 0)
    broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, this.getStatus())
  }

  private clearPushQueue(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.pushQueue.clear()
  }

  // ==========================================================
  // Polling
  // ==========================================================

  startPolling(): void {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => {
      this.pollSyncOnce()
    }, 60 * 60 * 1000) // 1 hour

    // Run an immediate sync on startup if already connected
    this.pollSyncOnce()
  }

  private pollSyncOnce(): void {
    const conn = this.getActiveConnection()
    if (!conn || conn.status !== 'connected') {
      logger.info('cloud:service', 'Poll skipped: not connected')
      return
    }

    logger.info('cloud:service', 'Poll sync started')
    this.broadcastProgress('comparing', 0, 0)
    const startedAt = Date.now()

    this.syncEngine.syncAll({
      accessToken: conn.access_token,
      databaseId: conn.database_id!
    }).then((result) => {
      this.updateLastSync(conn.id)
      this.finishPollSync(startedAt, () => {
        broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, this.getStatus())
      })
      logger.info('cloud:service', `Poll sync done: +${result.pushed} -${result.pulled} =${result.skipped}`)
    }).catch((err) => {
      logger.error('cloud:service', 'Poll sync failed', { error: String(err) })
      this.finishPollSync(startedAt)
    })
  }

  /** Broadcast 'idle' after a minimum of 1s so the user sees the spinner. */
  private finishPollSync(startedAt: number, after?: () => void): void {
    const elapsed = Date.now() - startedAt
    const delay = Math.max(0, 1000 - elapsed)
    const finish = () => {
      this.broadcastProgress('idle', 0, 0)
      after?.()
    }
    if (delay > 0) {
      setTimeout(finish, delay)
    } else {
      finish()
    }
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  // ==========================================================
  // Auth server wiring
  // ==========================================================

  /** Active pending auth state. Set by connect(), consumed by completeAuth(). */
  private pendingAuth: {
    server: OAuthServer
    state: string
    redirectUri: string
    tempId: string
    authUrl: string
    service: CloudServiceType
  } | null = null

  /**
   * Called by IPC when the renderer requests the OAuth URL to open.
   * The renderer makes a second call after getting the connection.
   */
  getPendingAuthUrl(): { authUrl: string; port: number } | null {
    if (!this.pendingAuth) return null
    const authUrl = this.adapter.getAuthUrl(this.pendingAuth.state, this.pendingAuth.redirectUri)
    return { authUrl, port: this.pendingAuth.server['port'] ?? NOTION_REDIRECT_PORT }
  }

  // ==========================================================
  // SQLite helpers
  // ==========================================================

  private getActiveConnection(): CloudConnectionRow | null {
    const db = getDatabase()
    try {
      const row = db.prepare(
        "SELECT * FROM cloud_connections WHERE status = 'connected' LIMIT 1"
      ).get() as CloudConnectionRow | undefined
      return row ?? null
    } catch {
      return null
    }
  }

  private getConnection(id: string): CloudConnection | null {
    const db = getDatabase()
    try {
      const row = db.prepare(
        'SELECT * FROM cloud_connections WHERE id = ?'
      ).get(id) as CloudConnectionRow | undefined
      return row ? this.rowToConnection(row) : null
    } catch {
      return null
    }
  }

  private upsertConnection(row: CloudConnectionRow): void {
    const db = getDatabase()
    db.prepare(`
      INSERT INTO cloud_connections (id, service, access_token, workspace_id, workspace_name,
        account_name, account_email, database_id, database_url, last_sync_at, status, error,
        created_at, updated_at)
      VALUES (@id, @service, @access_token, @workspace_id, @workspace_name,
        @account_name, @account_email, @database_id, @database_url, @last_sync_at, @status, @error,
        @created_at, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        access_token = @access_token,
        workspace_id = @workspace_id,
        workspace_name = @workspace_name,
        account_name = @account_name,
        account_email = @account_email,
        database_id = @database_id,
        database_url = @database_url,
        last_sync_at = @last_sync_at,
        status = @status,
        error = @error,
        updated_at = @updated_at
    `).run(row)
  }

  private updateLastSync(id: string): void {
    const db = getDatabase()
    db.prepare(
      "UPDATE cloud_connections SET last_sync_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?"
    ).run(id)
  }

  private updateConnectionStatus(id: string, status: string, error?: string): void {
    const db = getDatabase()
    db.prepare(
      "UPDATE cloud_connections SET status = ?, error = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, error ?? null, id)
  }

  private rowToConnection(row: CloudConnectionRow): CloudConnection {
    return {
      id: row.id,
      service: row.service as CloudServiceType,
      status: row.status as CloudConnection['status'],
      workspaceName: row.workspace_name ?? undefined,
      accountEmail: row.account_email ?? undefined,
      databaseUrl: row.database_url ?? undefined,
      lastSyncAt: row.last_sync_at ?? undefined,
      error: row.error ?? undefined,
      createdAt: row.created_at
    }
  }

  // ==========================================================
  // Helpers
  // ==========================================================

  private broadcastProgress(phase: SyncProgress['phase'], current: number, total: number): void {
    broadcast(IPC_CHANNELS.EVENT_CLOUD_SYNC_PROGRESS, { phase, current, total })
  }
}
