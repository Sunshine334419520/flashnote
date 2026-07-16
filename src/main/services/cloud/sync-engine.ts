import type { Note, SyncResult } from '../../../shared/types'
import type { CloudSyncAdapter, NoteMeta, NoteForSync, RemoteNote } from './adapter'
import { getNotes, createNote, modifyNote, removeNote, readNote } from '../storage.service'
import { logger } from '../../utils/logger'

export interface ConnectionConfig {
  accessToken: string
  databaseId: string
}

/**
 * Core sync engine: compares local notes against remote by version number (rev),
 * pushes local changes, pulls remote updates.
 *
 * syncRev semantics (git-like):
 *   0          — never synced
 *   N          — last version that was pushed/pulled
 *   edit       — syncRev++ (local version bumps)
 *
 * Comparison:
 *   syncRev == 0            → push (new note)
 *   remote.rev > local.rev  → pull (remote is newer)
 *   local.rev  > remote.rev → push (local is newer)
 *   equal                   → skip
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
      updatedAt: remote.lastEditedAt,
      isClassified: remote.meta.ic,
      isManuallyEdited: remote.meta.me,
      status: remote.status as Note['status'],
      sourceHint: remote.meta.sh || undefined,
      metadata: {},
      syncRev: remote.meta.rev
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
      logger.error('cloud:sync', 'Failed to list remote notes', { error: String(err) })
      result.errors.push(`list remote: ${String(err)}`)
      return result
    }

    // 3. Index by flashnoteId
    const localMap = new Map<string, Note>()
    for (const n of localNotes) localMap.set(n.id, n)

    const remoteMap = new Map<string, RemoteNote>()
    for (const r of remoteNotes) remoteMap.set(r.flashnoteId, r)

    // 4. Pull remote updates first (get latest state)
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
      } else if (remote.meta.rev > local.syncRev) {
        // Remote has newer version → update local
        try {
          this.upsertLocalNote(SyncEngine.remoteToLocalNote(remote))
          result.pulled++
        } catch (err) {
          result.errors.push(`pull ${remote.flashnoteId}: ${String(err)}`)
        }
      }
      // else: local.syncRev >= remote.rev → local is same or ahead, skip
    }

    // 5. Push local changes
    for (const local of localNotes) {
      const remote = remoteMap.get(local.id)

      if (!remote) {
        // Local note doesn't exist remotely → create
        try {
          await this.adapter.createNote(conn.accessToken, conn.databaseId, SyncEngine.toSyncPayload(local))
          result.pushed++
        } catch (err) {
          result.errors.push(`push ${local.id}: ${String(err)}`)
        }
      } else if (local.syncRev > remote.meta.rev) {
        // Local has been edited since last sync → update remote
        try {
          await this.adapter.updateNote(conn.accessToken, remote.pageId, SyncEngine.toSyncPayload(local))
          result.pushed++
        } catch (err) {
          result.errors.push(`push ${local.id}: ${String(err)}`)
        }
      } else {
        result.skipped++
      }
    }

    logger.info('cloud:sync', `Sync done: +${result.pushed} -${result.pulled} =${result.skipped}`, {
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
      logger.error('cloud:sync', `pushNote failed for ${noteId}`, { error: String(err) })
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
      logger.error('cloud:sync', `deleteRemoteNote failed for ${noteId}`, { error: String(err) })
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
          logger.error('cloud:sync', `pullAll: failed to import ${remote.flashnoteId}`, { error: String(err) })
        }
      }
    }

    return { imported }
  }

  // ── Helpers ───────────────────────────────────────────────

  private upsertLocalNote(note: Note): void {
    const existing = readNote(note.id)
    if (existing) {
      modifyNote({
        id: note.id,
        title: note.title,
        content: note.content,
        category: note.category,
        tags: note.tags,
        status: note.status
      })
    } else {
      createNote(
        { content: note.content },
        {
          type: note.type,
          category: note.category,
          tags: note.tags,
          title: note.title,
          sensitive: note.sensitive,
          typedData: note.typedData,
          status: note.status
        }
      )
    }
  }
}
