import type { Note, SyncResult } from '../../../shared/types'
import type { CloudSyncAdapter, NoteMeta, NoteForSync, RemoteNote } from './adapter'
import { getNotes, createNote, modifyNote, removeNote, readNote } from '../storage.service'
import { logger } from '../../utils/logger'
import { LOG_TAGS } from '../../../shared/logTags'

export interface ConnectionConfig {
  accessToken: string
  databaseId: string
}

/**
 * Core sync engine: compares local notes against remote using a two-rev model.
 *
 * syncRev — local version (incremented on each local edit).
 * baseRev — the remote version this note was last synced to (0 = never synced).
 *
 * After sync, baseRev == remoteRev (we're caught up). Edits bump syncRev only.
 *
 * Pull phase:  remoteRev > baseRev              → pull update
 *              syncRev > baseRev && pull needed  → conflict (both edited)
 *              local has baseRev>0, not in remote→ remote deleted
 *
 * Push phase:  baseRev == 0, not in remote      → create (new note)
 *              syncRev > baseRev                 → push update (safe after pull)
 *              else                              → skip (in sync)
 */
export class SyncEngine {
  constructor(private adapter: CloudSyncAdapter) {}

  /** Build a NoteMeta object from a local Note. rev = syncRev. */
  static buildMeta(note: Note): NoteMeta {
    return {
      v: 1,
      id: note.id,
      rev: note.syncRev,
      ca: note.createdAt,
      ua: note.updatedAt,
      ic: note.isClassified,
      me: note.isManuallyEdited,
      sh: note.sourceHint ?? '',
      td: note.typedData ?? {}
    }
  }

  /** Build a NoteForSync payload from a local Note. */
  static toSyncPayload(note: Note): NoteForSync {
    return {
      title: note.title,
      content: note.content,
      type: note.type,
      category: note.category,
      tags: note.tags,
      sensitive: note.sensitive,
      status: note.status,
      meta: JSON.stringify(SyncEngine.buildMeta(note))
    }
  }

  /** Convert a RemoteNote back into a local Note (for upsert). */
  static remoteToLocalNote(remote: RemoteNote): Note {
    return {
      id: remote.flashnoteId,
      type: remote.type as Note['type'],
      title: remote.title,
      content: remote.content,
      category: remote.category,
      tags: remote.tags,
      sensitive: remote.sensitive,
      typedData: remote.meta.td,
      createdAt: remote.meta.ca,
      updatedAt: remote.meta.ua || remote.lastEditedAt,
      isClassified: remote.meta.ic,
      isManuallyEdited: remote.meta.me,
      status: remote.status as Note['status'],
      sourceHint: remote.meta.sh || undefined,
      metadata: {},
      syncRev: remote.meta.rev,
      baseRev: remote.meta.rev
    }
  }

  // ── Full sync (push + pull) ───────────────────────────────

  async syncAll(conn: ConnectionConfig): Promise<SyncResult> {
    const result: SyncResult = { pushed: 0, pulled: 0, skipped: 0, errors: [] }

    // 1. Get local notes
    const localResult = getNotes({
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      limit: 10_000,
      offset: 0
    })
    const localNotes = localResult.notes

    // 2. Get remote notes
    let remoteNotes: RemoteNote[]
    try {
      remoteNotes = await this.adapter.listNotes(conn.accessToken, conn.databaseId)
    } catch (err) {
      logger.error(LOG_TAGS.CLOUD.SYNC, 'Failed to list remote notes', { error: String(err) })
      result.errors.push(`list remote: ${String(err)}`)
      return result
    }

    // 3. Index
    logger.info(LOG_TAGS.CLOUD.SYNC, `Comparing: ${localNotes.length} local, ${remoteNotes.length} remote`)

    // Log local notes
    for (const n of localNotes) logger.info(LOG_TAGS.CLOUD.SYNC, `  local: ${n.id} syncRev=${n.syncRev} baseRev=${n.baseRev}`)

    const localMap = new Map<string, Note>()
    for (const n of localNotes) localMap.set(n.id, n)

    const remoteMap = new Map<string, RemoteNote>()
    for (const r of remoteNotes) remoteMap.set(r.flashnoteId, r)

    const deletedLocally = new Set<string>()  // track notes deleted during pull phase

    // ═══ 4. Pull phase: remote → local ════════════════════════════

    for (const remote of remoteNotes) {
      const local = localMap.get(remote.flashnoteId)

      if (!local) {
        // Remote note doesn't exist locally → import
        try {
          this.upsertLocalNote(SyncEngine.remoteToLocalNote(remote))
          result.pulled++
        } catch (err) {
          result.errors.push(`pull ${remote.flashnoteId}: ${String(err)}`)
        }
      } else if (remote.meta.rev > local.baseRev) {
        // Remote has changes since our last sync
        if (local.syncRev > local.baseRev) {
          if (local.syncRev === remote.meta.rev) {
            // Both sides agree on version — baseRev was just not tracked
            // (e.g., migration 008 initialized it to 0). Catch up silently.
            this.updateBaseRev(local.id, remote.meta.rev)
          } else {
            // Real conflict: both local and remote have diverged
            const msg = `conflict: "${local.title}" edited on both sides`
            logger.warn(LOG_TAGS.CLOUD.SYNC, msg, { noteId: local.id, localRev: local.syncRev, remoteRev: remote.meta.rev, baseRev: local.baseRev })
            result.errors.push(msg)
          }
        } else {
          // Safe pull: local hasn't changed, just outdated
          try {
            this.upsertLocalNote(SyncEngine.remoteToLocalNote(remote))
            result.pulled++
          } catch (err) {
            result.errors.push(`pull ${remote.flashnoteId}: ${String(err)}`)
          }
        }
      }
      // else: remoteRev <= baseRev → remote hasn't changed since our last sync
    }

    // ── Detect remote deletes: local notes not in remoteMap with baseRev > 0
    for (const local of localNotes) {
      if (!remoteMap.has(local.id) && local.baseRev > 0) {
        try {
          removeNote(local.id)
          deletedLocally.add(local.id)
          logger.info(LOG_TAGS.CLOUD.SYNC, `Remote delete: "${local.title}"`, { noteId: local.id })
        } catch (err) {
          result.errors.push(`delete ${local.id}: ${String(err)}`)
        }
      }
    }

    // ═══ 5. Push phase: local → remote ═══════════════════════════

    for (const local of localNotes) {
      // Skip notes that were deleted during the pull phase (remote delete)
      if (deletedLocally.has(local.id)) continue

      const remote = remoteMap.get(local.id)

      if (!remote) {
        // Not on remote. baseRev > 0 means it WAS there → deleted remotely (already handled above).
        // baseRev == 0 means never synced → create.
        if (local.baseRev === 0) {
          try {
            await this.adapter.createNote(conn.accessToken, conn.databaseId, SyncEngine.toSyncPayload(local))
            this.updateBaseRev(local.id, local.syncRev)
            result.pushed++
            logger.info(LOG_TAGS.CLOUD.SYNC, `Pushed new: "${local.title}"`, { noteId: local.id, syncRev: local.syncRev })
          } catch (err) {
            result.errors.push(`push ${local.id}: ${String(err)}`)
          }
        }
        // else: baseRev > 0 and !remote → was deleted remotely → already handled
      } else if (local.syncRev > local.baseRev) {
        // Local has changes since last sync
        if (local.baseRev < remote.meta.rev) {
          // Conflict: remote also changed since our last sync (pull phase already detected this)
          // Skip here — already reported in pull phase
          result.skipped++
        } else {
          // Safe push
          try {
            await this.adapter.updateNote(conn.accessToken, remote.pageId, SyncEngine.toSyncPayload(local))
            this.updateBaseRev(local.id, local.syncRev)
            result.pushed++
          } catch (err) {
            result.errors.push(`push ${local.id}: ${String(err)}`)
          }
        }
      } else {
        result.skipped++
      }
    }

    logger.info(LOG_TAGS.CLOUD.SYNC, `Sync done: +${result.pushed} -${result.pulled} =${result.skipped} (${localNotes.length}L/${remoteNotes.length}R)`, {
      errors: result.errors.length
    })

    return result
  }

  // ── Single-note push (for auto-sync) ──────────────────────

  async pushNote(conn: ConnectionConfig, noteId: string): Promise<void> {
    const note = readNote(noteId)
    if (!note) return

    const payload = SyncEngine.toSyncPayload(note)

    let remotePageId: string | null = null
    try {
      const remoteNotes = await this.adapter.listNotes(conn.accessToken, conn.databaseId)
      const remote = remoteNotes.find((r) => r.flashnoteId === noteId)
      remotePageId = remote?.pageId ?? null
    } catch { /* try creating */ }

    try {
      if (remotePageId) {
        await this.adapter.updateNote(conn.accessToken, remotePageId, payload)
      } else {
        await this.adapter.createNote(conn.accessToken, conn.databaseId, payload)
      }
    } catch (err) {
      logger.error(LOG_TAGS.CLOUD.SYNC, `pushNote failed for ${noteId}`, { error: String(err) })
    }
  }

  async deleteRemoteNote(conn: ConnectionConfig, noteId: string): Promise<void> {
    try {
      const remoteNotes = await this.adapter.listNotes(conn.accessToken, conn.databaseId)
      const remote = remoteNotes.find((r) => r.flashnoteId === noteId)
      if (remote) {
        await this.adapter.deleteNote(conn.accessToken, remote.pageId)
      }
    } catch (err) {
      logger.error(LOG_TAGS.CLOUD.SYNC, `deleteRemoteNote failed for ${noteId}`, { error: String(err) })
    }
  }

  // ── Full pull (device recovery) ───────────────────────────

  async pullAll(conn: ConnectionConfig): Promise<{ imported: number }> {
    const remoteNotes = await this.adapter.listNotes(conn.accessToken, conn.databaseId)
    let imported = 0

    for (const remote of remoteNotes) {
      const existing = readNote(remote.flashnoteId)
      if (!existing || remote.meta.rev > existing.syncRev) {
        try {
          this.upsertLocalNote(SyncEngine.remoteToLocalNote(remote))
          imported++
        } catch (err) {
          logger.error(LOG_TAGS.CLOUD.SYNC, `pullAll: failed to import ${remote.flashnoteId}`, { error: String(err) })
        }
      }
    }

    return { imported }
  }

  // ── Helpers ───────────────────────────────────────────────

  /**
   * After a successful push, update baseRev to match the synced version.
   * Must NOT increment syncRev — this is a metadata update, not a user edit.
   */
  private updateBaseRev(noteId: string, newBaseRev: number): void {
    try {
      const existing = readNote(noteId)
      if (existing) {
        modifyNote({
          id: noteId,
          baseRev: newBaseRev,
          syncRev: existing.syncRev,
          isManuallyEdited: existing.isManuallyEdited
        })
      }
    } catch (err) {
      logger.error(LOG_TAGS.CLOUD.SYNC, `updateBaseRev failed for ${noteId}`, { error: String(err) })
    }
  }

  private upsertLocalNote(note: Note): void {
    const existing = readNote(note.id)
    if (existing) {
      // Markdown file exists. Try to update SQLite index. If that fails
      // (e.g. DB was recreated and SQLite row is missing), fall back to
      // createNote which re-indexes from scratch.
      try {
        modifyNote({
          id: note.id,
          title: note.title,
          content: note.content,
          category: note.category,
          tags: note.tags,
          status: note.status,
          syncRev: note.syncRev,
          baseRev: note.baseRev
        })
      } catch {
        logger.warn(LOG_TAGS.CLOUD.SYNC, `upsertLocalNote: modifyNote failed for ${note.id}, falling back to createNote`)
        createNote(
          { content: note.content },
          {
            id: note.id,
            type: note.type,
            category: note.category,
            tags: note.tags,
            title: note.title,
            sensitive: note.sensitive,
            typedData: note.typedData,
            status: note.status,
            syncRev: note.syncRev,
            baseRev: note.baseRev
          }
        )
      }
    } else {
      createNote(
        { content: note.content },
        {
          id: note.id,
          type: note.type,
          category: note.category,
          tags: note.tags,
          title: note.title,
          sensitive: note.sensitive,
          typedData: note.typedData,
          status: note.status,
          syncRev: note.syncRev,
          baseRev: note.baseRev
        }
      )
    }
  }
}
