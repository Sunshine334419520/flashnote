import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../../database/connection'
import { broadcast } from '../../utils/broadcast'
import { logger } from '../../utils/logger'
import { LOG_TAGS } from '../../../shared/logTags'
import {
  NOTION_REDIRECT_PORT,
  ONENOTE_REDIRECT_PORT
} from '../../../shared/constants'
import { SYNC_PHASES, CLOUD_STATUS } from '../../../shared/types'
import type { CloudConnection, SyncProgress, SyncResult, CloudServiceType, SyncPhase } from '../../../shared/types'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type { CloudConnectionRow } from '../../database/schema'
import { OAuthServer } from './auth-server'
import { NotionAdapter } from './notion.adapter'
import { OnenoteAdapter } from './onenote.adapter'
import { SyncEngine } from './sync-engine'
import type { CloudSyncAdapter } from './adapter'
import type { ConnectionConfig } from './sync-engine'

/**
 * Central orchestrator for cloud sync. Owns the full lifecycle:
 * connect (OAuth) → sync engine → auto-sync debounce → polling → disconnect.
 *
 * IPC handlers call this service; the service never imports Electron.
 */
export class CloudSyncService {
  private adapter: CloudSyncAdapter | null = null
  private syncEngine: SyncEngine | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null

  // Debounce queue for auto-sync after note changes
  private pushQueue = new Map<string, 'create' | 'update' | 'delete'>()
  private pushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    adapter?: CloudSyncAdapter,
    syncEngine?: SyncEngine
  ) {
    if (adapter) this.adapter = adapter
    if (syncEngine) this.syncEngine = syncEngine
    // No default — adapter is set on connect() or initFromConnection()
  }

  /** Resolve the right adapter for a given cloud service. */
  private adapterFor(service: CloudServiceType): CloudSyncAdapter {
    switch (service) {
      case 'notion': return new NotionAdapter()
      case 'onenote': return new OnenoteAdapter()
      default: throw new Error(`Unsupported cloud service: ${service}`)
    }
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
    // 0. If already connected to another service, disconnect first.
    //    This stops polling, resets all notes' baseRev to 0, and
    //    removes the old connection row so the new service sees a
    //    clean slate (no stale remote-delete detection, no version skew).
    await this.disconnect()

    // 0.3. Stop any previous pending auth server (e.g. user closed browser
    //    without completing OAuth last time, leaving port occupied).
    if (this.pendingAuth) {
      await this.pendingAuth.server.stop()
      this.pendingAuth = null
    }

    // 0.5. Select the right adapter for this service
    this.adapter = this.adapterFor(service)
    this.syncEngine = new SyncEngine(this.adapter)

    const authServer = new OAuthServer()

    try {
      // 1. Start local HTTP server on the correct port for this service
      const oauthPort = service === 'onenote' ? ONENOTE_REDIRECT_PORT : NOTION_REDIRECT_PORT
      const { port } = await authServer.start(oauthPort)
      const redirectUri = `http://localhost:${port}/callback`

      // 2. Build auth URL
      const state = uuidv4()
      const authUrl = this.adapter!.getAuthUrl(state, redirectUri)

      logger.info(LOG_TAGS.CLOUD.SERVICE, `OAuth URL ready at port ${port}`)

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
        refresh_token: null,
        token_expires_at: null,
        status: CLOUD_STATUS.CONNECTING,
        error: null,
        created_at: now,
        updated_at: now
      })

      broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, {
        id: tempId,
        service,
        status: CLOUD_STATUS.CONNECTING
      })

      // 5. Store pending auth state + start background wait for callback
      this.pendingAuth = { server: authServer, state, redirectUri, tempId, authUrl, service }
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'connect: pendingAuth set', { tempId, service })

      // Fire-and-forget: wait for the browser callback, then complete auth
      authServer.waitForCallback()
        .then(({ code }) => this.completeAuth(code))
        .catch((err) => {
          logger.error(LOG_TAGS.CLOUD.SERVICE, 'OAuth callback failed', { error: String(err) })
          this.updateConnectionStatus(tempId, CLOUD_STATUS.ERROR, String(err))
          broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, this.getConnection(tempId))
          authServer.stop()
        })

      // 6. Return immediately — renderer opens the browser with authUrl
      return {
        id: tempId,
        service,
        status: CLOUD_STATUS.CONNECTING,
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
    logger.info(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: called', { hasPending: !!this.pendingAuth })

    const pending = this.pendingAuth
    if (!pending) {
      logger.error(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: NO PENDING AUTH — callback arrived but state was lost')
      return
    }

    this.pendingAuth = null
    const { server, redirectUri, tempId, service } = pending
    logger.info(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: start', { service, tempId })

    try {
      // 1. Exchange code for token
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: exchanging code...')
      const authResult = await this.adapter!.exchangeCode(code, redirectUri)
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: token obtained')

      // Stop server in background — don't await. server.close()
      // waits for HTTP keep-alive connections which can hang.
      server.stop().catch(() => { /* ignore */ })

      // 2. Save as 'initializing' — broadcast immediately so UI updates
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: saving initializing...')
      const now = new Date().toISOString()
      this.upsertConnection({
        id: tempId, service,
        access_token: authResult.accessToken,
        workspace_id: authResult.workspaceId, workspace_name: authResult.workspaceName,
        account_name: authResult.accountName ?? null, account_email: authResult.accountEmail ?? null,
        database_id: null, database_url: null, last_sync_at: null,
        refresh_token: authResult.refreshToken ?? null,
        token_expires_at: authResult.expiresAt ? String(authResult.expiresAt) : null,
        status: CLOUD_STATUS.INITIALIZING, error: null, created_at: now, updated_at: now
      })
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: saved, broadcasting initializing...')
      const initConn = this.getConnection(tempId)
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: getConnection returned', { hasConn: !!initConn, status: initConn?.status })
      broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, initConn)
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: broadcast done, status → initializing')

      // 3. Init remote + initial sync. AWAITED — guarantees database_id
      //    is set before 'connected'. B machine finds A's existing DB here.
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: calling initRemote...')
      await this.initRemote(tempId, authResult.accessToken)
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: initRemote done')

      // 4. All ready
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: marking connected...')
      this.updateConnectionStatus(tempId, CLOUD_STATUS.CONNECTED)
      broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, this.getStatus())
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: status → connected, broadcast done')
      this.startPolling()
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: polling started, DONE')
    } catch (err) {
      logger.error(LOG_TAGS.CLOUD.SERVICE, 'completeAuth: FAILED', { error: String(err) })
      this.updateConnectionStatus(tempId, CLOUD_STATUS.ERROR, String(err))
      broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, this.getConnection(tempId))
      server.stop().catch(() => { /* ignore */ })
    }
  }

  /**
   * Initialize the remote side: find or create the cloud database,
   * run initial sync. After this, the connection is ready for normal sync.
   * Also used by ensureFreshToken to recover a missing database_id.
   */
  async initRemote(connId: string, accessToken: string): Promise<void> {
    logger.info(LOG_TAGS.CLOUD.SERVICE, 'initRemote: start')
    this.broadcastProgress(SYNC_PHASES.COMPARING, 0, 0)

    logger.info(LOG_TAGS.CLOUD.SERVICE, 'initRemote: calling ensureDatabase...')
    const dbInfo = await this.adapter!.ensureDatabase(accessToken)
    logger.info(LOG_TAGS.CLOUD.SERVICE, 'initRemote: db ready', { id: dbInfo.id })

    const db = getDatabase()
    db.prepare(
      "UPDATE cloud_connections SET database_id = ?, database_url = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(dbInfo.id, dbInfo.url, connId)
    logger.info(LOG_TAGS.CLOUD.SERVICE, 'initRemote: database_id saved')

    logger.info(LOG_TAGS.CLOUD.SERVICE, 'initRemote: running sync...')
    const result = await this.syncEngine!.syncAll({
      accessToken,
      databaseId: dbInfo.id
    })
    logger.info(LOG_TAGS.CLOUD.SERVICE, 'initRemote: sync done', {
      pushed: result.pushed, pulled: result.pulled, errors: result.errors.length
    })

    this.updateLastSync(connId)
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

    // Stop any pending OAuth auth server (port cleanup)
    if (this.pendingAuth) {
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'disconnect: clearing pendingAuth')
      this.pendingAuth.server.stop()
      this.pendingAuth = null
    }

    const db = getDatabase()

    // Reset all notes' baseRev to 0 — old remote version numbers are
    // meaningless after switching to a different cloud service.
    db.prepare('UPDATE notes SET base_rev = 0').run()

    // Delete ALL cloud connection rows (connected / error / connecting).
    // Only filtering for 'connected' would leave stale rows behind when
    // the user disconnects after a failed OAuth.
    db.prepare('DELETE FROM cloud_connections').run()

    broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, null)
  }

  /** Get the current connection status (or null if not connected). */
  getStatus(): CloudConnection | null {
    const row = this.getActiveConnection()
    return row ? this.rowToConnection(row) : null
  }

  // ==========================================================
  // Sync operations
  // ==========================================================

  /**
   * Ensure the access token is fresh. For OAuth providers with expiring
   * tokens (OneNote), refresh it via the adapter before returning.
   * For Notion (non-expiring), just return the stored token.
   */
  private async ensureFreshToken(): Promise<ConnectionConfig> {
    let conn = this.getActiveConnection()
    if (!conn || conn.status !== CLOUD_STATUS.CONNECTED) {
      throw new Error('Not connected to cloud')
    }

    // If database_id is missing (e.g. app crashed before initRemote finished,
    // or B machine connects to an A-machine-created database), recover by
    // searching the remote side for the existing database.
    if (!conn.database_id) {
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'database_id missing — searching remote for existing database')
      await this.recoverDatabase(conn)
      conn = this.getActiveConnection()
      if (!conn?.database_id) {
        throw new Error('Cloud database not found — the remote database may have been deleted. Try reconnecting.')
      }
    }

    return this.resolveToken(conn)
  }

  /** Return token config, refreshing if needed (OneNote). */
  private async resolveToken(conn: CloudConnectionRow): Promise<ConnectionConfig> {
    // Notion: no refresh_token → token is long-lived.
    if (!conn.refresh_token) {
      return { accessToken: conn.access_token, databaseId: conn.database_id! }
    }

    // OneNote: check expiry, refresh if near
    const expiresAt = conn.token_expires_at ? Number(conn.token_expires_at) : 0
    if (Date.now() + 5 * 60 * 1000 < expiresAt) {
      return { accessToken: conn.access_token, databaseId: conn.database_id! }
    }

    if (!this.adapter?.refreshAccessToken) {
      return { accessToken: conn.access_token, databaseId: conn.database_id! }
    }

    try {
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'Refreshing access token')
      const fresh = await this.adapter.refreshAccessToken(conn.refresh_token)
      const db = getDatabase()
      db.prepare(
        `UPDATE cloud_connections SET access_token = ?, refresh_token = ?,
          token_expires_at = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(fresh.accessToken, fresh.refreshToken ?? null, fresh.expiresAt ? String(fresh.expiresAt) : null, conn.id)
      return { accessToken: fresh.accessToken, databaseId: conn.database_id! }
    } catch (err) {
      logger.error(LOG_TAGS.CLOUD.SERVICE, 'Token refresh failed', { error: String(err) })
      return { accessToken: conn.access_token, databaseId: conn.database_id! }
    }
  }

  /**
   * Recover a missing database_id by searching the remote service for the
   * existing database (created by another machine or a previous session).
   * This handles the B-machine scenario: A created the database, B just
   * needs to find it and link up.
   */
  private async recoverDatabase(conn: CloudConnectionRow): Promise<void> {
    const service = conn.service as CloudServiceType

    if (!this.adapter) {
      this.adapter = this.adapterFor(service)
      this.syncEngine = new SyncEngine(this.adapter)
    }

    // Reuse initRemote logic: it searches for existing DB and syncs
    await this.initRemote(conn.id, conn.access_token)
    logger.info(LOG_TAGS.CLOUD.SERVICE, `Recovered database`)
  }

  /** Manual full sync. */
  async syncNow(): Promise<SyncResult> {
    const config = await this.ensureFreshToken()

    this.broadcastProgress(SYNC_PHASES.COMPARING, 0, 0)
    const startedAt = Date.now()

    const result = await this.syncEngine!.syncAll(config)

    const conn = this.getActiveConnection()
    if (conn) this.updateLastSync(conn.id)
    this.finishPollSync(startedAt, () => {
      broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, this.getStatus())
    })

    return result
  }

  /** Full pull for device recovery. */
  async pullAll(): Promise<{ imported: number }> {
    const config = await this.ensureFreshToken()

    this.broadcastProgress(SYNC_PHASES.PULLING, 0, 0)

    const result = await this.syncEngine!.pullAll(config)

    const conn = this.getActiveConnection()
    if (conn) this.updateLastSync(conn.id)
    this.broadcastProgress(SYNC_PHASES.IDLE, 0, 0)

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
    if (!conn || conn.status !== CLOUD_STATUS.CONNECTED) return

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
    if (this.pushQueue.size === 0) return

    let config: ConnectionConfig
    try {
      config = await this.ensureFreshToken()
    } catch {
      return // Not connected
    }

    const queue = new Map(this.pushQueue)
    this.pushQueue.clear()

    this.broadcastProgress(SYNC_PHASES.PUSHING, 0, queue.size)

    let done = 0
    for (const [noteId, action] of queue) {
      try {
        if (action === 'delete') {
          await this.syncEngine!.deleteRemoteNote(config, noteId)
        } else {
          await this.syncEngine!.pushNote(config, noteId)
        }
      } catch (err) {
        logger.error(LOG_TAGS.CLOUD.SERVICE, `Auto-sync failed for ${noteId}`, { error: String(err) })
      }
      done++
      this.broadcastProgress(SYNC_PHASES.PUSHING, done, queue.size)
    }

    const conn = this.getActiveConnection()
    if (conn) this.updateLastSync(conn.id)
    this.broadcastProgress(SYNC_PHASES.IDLE, 0, 0)
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

    // Init adapter from existing connection (for app restart, no connect() called)
    if (!this.adapter) {
      const conn = this.getActiveConnection()
      if (conn) {
        const service = conn.service as CloudServiceType
        this.adapter = this.adapterFor(service)
        this.syncEngine = new SyncEngine(this.adapter)
        // Restore OneNote sectionId from stored connection
        if (service === 'onenote' && conn.database_id) {
          (this.adapter as OnenoteAdapter).sectionId = conn.database_id
        }
      }
    }

    this.pollTimer = setInterval(() => {
      this.pollSyncOnce()
    }, 60 * 60 * 1000) // 1 hour

    // Run an immediate sync on startup if already connected
    this.pollSyncOnce()
  }

  private async pollSyncOnce(): Promise<void> {
    let config: ConnectionConfig
    try {
      config = await this.ensureFreshToken()
    } catch {
      logger.info(LOG_TAGS.CLOUD.SERVICE, 'Poll skipped: not connected')
      return
    }

    logger.info(LOG_TAGS.CLOUD.SERVICE, 'Poll sync started')
    this.broadcastProgress(SYNC_PHASES.COMPARING, 0, 0)
    const startedAt = Date.now()

    const conn = this.getActiveConnection()
    this.syncEngine!.syncAll(config).then((result) => {
      if (conn) this.updateLastSync(conn.id)
      this.finishPollSync(startedAt, () => {
        broadcast(IPC_CHANNELS.EVENT_CLOUD_STATUS_CHANGED, this.getStatus())
      })
      logger.info(LOG_TAGS.CLOUD.SERVICE, `Poll sync done: +${result.pushed} -${result.pulled} =${result.skipped}`)
    }).catch((err) => {
      logger.error(LOG_TAGS.CLOUD.SERVICE, 'Poll sync failed', { error: String(err) })
      this.finishPollSync(startedAt)
    })
  }

  /** Broadcast 'idle' after a minimum of 1s so the user sees the spinner. */
  private finishPollSync(startedAt: number, after?: () => void): void {
    const elapsed = Date.now() - startedAt
    const delay = Math.max(0, 1000 - elapsed)
    const finish = () => {
      this.broadcastProgress(SYNC_PHASES.IDLE, 0, 0)
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
    return { authUrl: this.pendingAuth.authUrl, port: this.pendingAuth.server['port'] ?? 0 }
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
        account_name, account_email, database_id, database_url, last_sync_at,
        refresh_token, token_expires_at, status, error, created_at, updated_at)
      VALUES (@id, @service, @access_token, @workspace_id, @workspace_name,
        @account_name, @account_email, @database_id, @database_url, @last_sync_at,
        @refresh_token, @token_expires_at, @status, @error, @created_at, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        access_token = @access_token,
        workspace_id = @workspace_id,
        workspace_name = @workspace_name,
        account_name = @account_name,
        account_email = @account_email,
        database_id = @database_id,
        database_url = @database_url,
        last_sync_at = @last_sync_at,
        refresh_token = @refresh_token,
        token_expires_at = @token_expires_at,
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

  private broadcastProgress(phase: SyncPhase, current: number, total: number): void {
    broadcast(IPC_CHANNELS.EVENT_CLOUD_SYNC_PROGRESS, { phase, current, total })
  }
}
