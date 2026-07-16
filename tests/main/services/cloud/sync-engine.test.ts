import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncEngine } from '../../../../src/main/services/cloud/sync-engine'
import type { CloudSyncAdapter, NoteForSync, RemoteNote, NoteMeta } from '../../../../src/main/services/cloud/adapter'
import type { Note, SyncResult } from '../../../../src/shared/types'

// ── Mocks ──────────────────────────────────────────────────────────────

const mockStorage = {
  getNotes: vi.fn(),
  createNote: vi.fn(),
  modifyNote: vi.fn(),
  removeNote: vi.fn(),
  readNote: vi.fn()
}

vi.mock('../../../../src/main/services/storage.service', () => ({
  getNotes: (...args: unknown[]) => mockStorage.getNotes(...args),
  createNote: (...args: unknown[]) => mockStorage.createNote(...args),
  modifyNote: (...args: unknown[]) => mockStorage.modifyNote(...args),
  removeNote: (...args: unknown[]) => mockStorage.removeNote(...args),
  readNote: (...args: unknown[]) => mockStorage.readNote(...args)
}))

// ── Helpers ────────────────────────────────────────────────────────────

function makeNote(overrides: Partial<Note> & { id: string }): Note {
  return {
    type: 'text', title: 'Test Note', content: 'test content', category: 'Other',
    tags: [], sensitive: false, status: 'published', sourceHint: undefined,
    metadata: {}, typedData: undefined, isClassified: false, isManuallyEdited: false,
    createdAt: '2025-07-01T00:00:00.000Z', updatedAt: '2025-07-01T00:00:00.000Z',
    syncRev: 0,
    ...overrides
  }
}

function makeRemoteNote(overrides: Partial<RemoteNote>): RemoteNote {
  return {
    pageId: 'page-1', flashnoteId: 'note-1', title: 'Test Note', content: 'test content',
    type: 'text', category: 'Other', tags: [], sensitive: false, status: 'published',
    meta: { v: 1, id: 'note-1', rev: 1, ca: '2025-07-01T00:00:00.000Z', ic: false, me: false, sh: '', td: {} },
    lastEditedAt: '2025-07-01T00:00:00.000Z',
    ...overrides
  }
}

function makeMockAdapter(overrides?: Partial<CloudSyncAdapter>): CloudSyncAdapter {
  return {
    service: 'notion',
    getAuthUrl: vi.fn().mockReturnValue('https://notion.example.com/auth'),
    exchangeCode: vi.fn(), getUserInfo: vi.fn(), ensureDatabase: vi.fn(),
    listNotes: vi.fn().mockResolvedValue([]),
    createNote: vi.fn().mockResolvedValue('new-page-id'),
    updateNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
    ...overrides
  }
}

const conn = { accessToken: 'test-token', databaseId: 'db-1' }

beforeEach(() => { vi.clearAllMocks() })

// ============================================================
// Static helpers — pure functions
// ============================================================

describe('SyncEngine.buildMeta', () => {
  it('builds a NoteMeta with rev from syncRev', () => {
    const note = makeNote({
      id: 'abc-123', syncRev: 5,
      type: 'bookmark', title: 'My Bookmark', content: 'https://example.com',
      category: 'Bookmarks & Links', tags: ['web'],
      isClassified: true, sourceHint: 'web', typedData: { url: 'https://example.com' }
    })

    const meta = SyncEngine.buildMeta(note)
    expect(meta).toEqual({
      v: 1, id: 'abc-123', rev: 5,
      ca: '2025-07-01T00:00:00.000Z',
      ic: true, me: false, sh: 'web', td: { url: 'https://example.com' }
    })
  })

  it('defaults rev to 0 for un-synced notes', () => {
    const note = makeNote({ id: 'minimal', syncRev: 0 })
    const meta = SyncEngine.buildMeta(note)
    expect(meta.rev).toBe(0)
  })
})

describe('SyncEngine.toSyncPayload', () => {
  it('converts a Note to NoteForSync with JSON meta including rev', () => {
    const note = makeNote({ id: 'note-x', syncRev: 3, title: 'API Key', type: 'apikey', tags: ['api-key'], sensitive: true })
    const payload = SyncEngine.toSyncPayload(note)
    expect(payload.type).toBe('apikey')
    expect(payload.sensitive).toBe(true)
    const parsed = JSON.parse(payload.meta)
    expect(parsed.rev).toBe(3)
  })
})

describe('SyncEngine.remoteToLocalNote', () => {
  it('converts RemoteNote to local Note with syncRev', () => {
    const remote = makeRemoteNote({
      flashnoteId: 'note-42', title: 'Remote Note', type: 'command',
      meta: { v: 1, id: 'note-42', rev: 7, ca: '2025-06-01T00:00:00.000Z', ic: true, me: false, sh: 'cli', td: { shell: 'bash' } }
    })
    const note = SyncEngine.remoteToLocalNote(remote)
    expect(note.id).toBe('note-42')
    expect(note.type).toBe('command')
    expect(note.syncRev).toBe(7)
    expect(note.isClassified).toBe(true)
    expect(note.sourceHint).toBe('cli')
  })
})

// ============================================================
// syncAll — rev-based comparison
// ============================================================

describe('SyncEngine.syncAll', () => {
  it('pushes local notes never synced (syncRev=0)', async () => {
    const adapter = makeMockAdapter()
    const engine = new SyncEngine(adapter)
    mockStorage.getNotes.mockReturnValue({ notes: [makeNote({ id: 'local-1', syncRev: 0 })], total: 1, hasMore: false })
    const result = await engine.syncAll(conn)
    expect(result.pushed).toBe(1)
    expect(adapter.createNote).toHaveBeenCalledTimes(1)
  })

  it('pushes local notes with syncRev > remote.rev', async () => {
    const adapter = makeMockAdapter()
    const engine = new SyncEngine(adapter)
    const localNote = makeNote({ id: 'note-1', syncRev: 5 })
    const remoteNote = makeRemoteNote({ flashnoteId: 'note-1', pageId: 'page-1', meta: { v: 1, id: 'note-1', rev: 3, ca: '', ic: false, me: false, sh: '', td: {} } })

    mockStorage.getNotes.mockReturnValue({ notes: [localNote], total: 1, hasMore: false })
    adapter.listNotes = vi.fn().mockResolvedValue([remoteNote])

    const result = await engine.syncAll(conn)
    expect(result.pushed).toBe(1)
    expect(adapter.updateNote).toHaveBeenCalled()
  })

  it('pulls remote notes that do not exist locally', async () => {
    const adapter = makeMockAdapter()
    const engine = new SyncEngine(adapter)
    mockStorage.getNotes.mockReturnValue({ notes: [], total: 0, hasMore: false })
    adapter.listNotes = vi.fn().mockResolvedValue([makeRemoteNote({ flashnoteId: 'remote-only', title: 'R1' })])
    mockStorage.readNote.mockReturnValue(null)

    const result = await engine.syncAll(conn)
    expect(result.pulled).toBe(1)
    expect(mockStorage.createNote).toHaveBeenCalled()
  })

  it('pulls when remote.rev > local.syncRev', async () => {
    const adapter = makeMockAdapter()
    const engine = new SyncEngine(adapter)
    mockStorage.getNotes.mockReturnValue({ notes: [makeNote({ id: 'note-1', syncRev: 1 })], total: 1, hasMore: false })
    adapter.listNotes = vi.fn().mockResolvedValue([makeRemoteNote({ flashnoteId: 'note-1', pageId: 'page-1', meta: { v: 1, id: 'note-1', rev: 5, ca: '', ic: false, me: false, sh: '', td: {} } })])
    mockStorage.readNote.mockReturnValue(makeNote({ id: 'note-1', syncRev: 1 }))

    const result = await engine.syncAll(conn)
    expect(result.pulled).toBe(1)
  })

  it('skips when local.syncRev equals remote.rev', async () => {
    const adapter = makeMockAdapter()
    const engine = new SyncEngine(adapter)
    mockStorage.getNotes.mockReturnValue({ notes: [makeNote({ id: 'note-1', syncRev: 3 })], total: 1, hasMore: false })
    adapter.listNotes = vi.fn().mockResolvedValue([makeRemoteNote({ flashnoteId: 'note-1', pageId: 'page-1', meta: { v: 1, id: 'note-1', rev: 3, ca: '', ic: false, me: false, sh: '', td: {} } })])

    const result = await engine.syncAll(conn)
    expect(result.pushed).toBe(0)
    expect(result.pulled).toBe(0)
    expect(result.skipped).toBe(1)
  })

  it('handles adapter errors gracefully', async () => {
    const adapter = makeMockAdapter({ listNotes: vi.fn().mockRejectedValue(new Error('Network error')) })
    const engine = new SyncEngine(adapter)
    mockStorage.getNotes.mockReturnValue({ notes: [], total: 0, hasMore: false })
    const result = await engine.syncAll(conn)
    expect(result.errors).toHaveLength(1)
  })
})

// ============================================================
// pushNote / deleteRemoteNote / pullAll
// ============================================================

describe('SyncEngine.pushNote', () => {
  it('creates new remote note when not found', async () => {
    const adapter = makeMockAdapter()
    const engine = new SyncEngine(adapter)
    mockStorage.readNote.mockReturnValue(makeNote({ id: 'new-note', syncRev: 1 }))
    await engine.pushNote(conn, 'new-note')
    expect(adapter.createNote).toHaveBeenCalled()
  })

  it('updates existing remote note when page found', async () => {
    const adapter = makeMockAdapter({
      listNotes: vi.fn().mockResolvedValue([makeRemoteNote({ flashnoteId: 'existing', pageId: 'page-existing' })])
    })
    const engine = new SyncEngine(adapter)
    mockStorage.readNote.mockReturnValue(makeNote({ id: 'existing', syncRev: 3 }))
    await engine.pushNote(conn, 'existing')
    expect(adapter.updateNote).toHaveBeenCalled()
  })

  it('does nothing when note deleted locally', async () => {
    const engine = new SyncEngine(makeMockAdapter())
    mockStorage.readNote.mockReturnValue(null)
    await engine.pushNote(conn, 'gone')
    // no calls to create/update
  })
})

describe('SyncEngine.deleteRemoteNote', () => {
  it('archives remote note when found', async () => {
    const adapter = makeMockAdapter({
      listNotes: vi.fn().mockResolvedValue([makeRemoteNote({ flashnoteId: 'del', pageId: 'page-del' })])
    })
    const engine = new SyncEngine(adapter)
    await engine.deleteRemoteNote(conn, 'del')
    expect(adapter.deleteNote).toHaveBeenCalledWith('test-token', 'page-del')
  })
})

describe('SyncEngine.pullAll', () => {
  it('imports remote notes not existing locally', async () => {
    const adapter = makeMockAdapter({
      listNotes: vi.fn().mockResolvedValue([
        makeRemoteNote({ flashnoteId: 'r1' }), makeRemoteNote({ flashnoteId: 'r2' })
      ])
    })
    const engine = new SyncEngine(adapter)
    mockStorage.readNote.mockReturnValue(null)
    const result = await engine.pullAll(conn)
    expect(result.imported).toBe(2)
  })

  it('updates when remote.rev > local.syncRev', async () => {
    const adapter = makeMockAdapter({
      listNotes: vi.fn().mockResolvedValue([makeRemoteNote({ flashnoteId: 'r1', meta: { v: 1, id: 'r1', rev: 5, ca: '', ic: false, me: false, sh: '', td: {} } })])
    })
    const engine = new SyncEngine(adapter)
    mockStorage.readNote.mockReturnValue(makeNote({ id: 'r1', syncRev: 1 }))
    const result = await engine.pullAll(conn)
    expect(result.imported).toBe(1)
  })

  it('skips when local is already up to date', async () => {
    const adapter = makeMockAdapter({
      listNotes: vi.fn().mockResolvedValue([makeRemoteNote({ flashnoteId: 'r1', meta: { v: 1, id: 'r1', rev: 3, ca: '', ic: false, me: false, sh: '', td: {} } })])
    })
    const engine = new SyncEngine(adapter)
    mockStorage.readNote.mockReturnValue(makeNote({ id: 'r1', syncRev: 5 })) // local is ahead
    const result = await engine.pullAll(conn)
    expect(result.imported).toBe(0)
  })
})
