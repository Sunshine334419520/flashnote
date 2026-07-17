import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotionAdapter } from '../../../../src/main/services/cloud/notion.adapter'
import type { NoteForSync } from '../../../../src/main/services/cloud/adapter'

// ── NoteForSync helper ─────────────────────────────────────────────────

function makeSyncNote(overrides?: Partial<NoteForSync>): NoteForSync {
  return {
    title: 'Test Note',
    content: 'test content',
    type: 'text',
    category: 'Other',
    tags: [],
    sensitive: false,
    status: 'published',
    meta: JSON.stringify({
      v: 1,
      id: 'test-id',
      ca: '2025-07-01T00:00:00.000Z',
      rev: 1,
      ca: '2025-07-01T00:00:00.000Z',
      ic: true,
      me: false,
      sh: 'cli',
      td: {}
    }),
    ...overrides
  }
}

// ── Mock fetch ─────────────────────────────────────────────────────────

const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

beforeEach(() => {
  vi.clearAllMocks()
})

function mockFetchRes(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  })
}

// ============================================================
// getAuthUrl
// ============================================================

describe('NotionAdapter.getAuthUrl', () => {
  it('constructs correct OAuth URL with all parameters', () => {
    const adapter = new NotionAdapter()
    const url = adapter.getAuthUrl('csrf-state-42', 'http://localhost:18923/callback')

    expect(url).toContain('https://api.notion.com/v1/oauth/authorize')
    expect(url).toContain('response_type=code')
    expect(url).toContain('state=csrf-state-42')
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A18923%2Fcallback')
    expect(url).toContain('owner=user')
  })
})

// ============================================================
// exchangeCode
// ============================================================

describe('NotionAdapter.exchangeCode', () => {
  it('exchanges code for token and returns AuthResult', async () => {
    mockFetchRes({
      access_token: 'secret-token-123',
      workspace_id: 'ws-1',
      workspace_name: 'My Workspace',
      owner: {
        user: {
          name: 'Test User',
          person: { email: 'test@example.com' }
        }
      }
    })

    const adapter = new NotionAdapter()
    const result = await adapter.exchangeCode('auth-code', 'http://localhost:18923/callback')

    expect(result.accessToken).toBe('secret-token-123')
    expect(result.workspaceId).toBe('ws-1')
    expect(result.workspaceName).toBe('My Workspace')
    expect(result.accountName).toBe('Test User')
    expect(result.accountEmail).toBe('test@example.com')

    // Verify the fetch call
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.notion.com/v1/oauth/token')
    expect(opts.method).toBe('POST')
    expect(opts.headers).toHaveProperty('Authorization')
    expect(opts.headers).toHaveProperty('Notion-Version')
  })

  it('throws on error response', async () => {
    mockFetchRes({ error: 'invalid_grant' }, 400)

    const adapter = new NotionAdapter()
    await expect(adapter.exchangeCode('bad-code', 'http://localhost/callback'))
      .rejects.toThrow('Notion token exchange failed')
  })
})

// ============================================================
// getUserInfo
// ============================================================

describe('NotionAdapter.getUserInfo', () => {
  it('returns user info from /v1/users/me', async () => {
    mockFetchRes({
      name: 'Alice',
      person: { email: 'alice@example.com' },
      avatar_url: 'https://example.com/avatar.png'
    })

    const adapter = new NotionAdapter()
    const user = await adapter.getUserInfo('token-xyz')

    expect(user.name).toBe('Alice')
    expect(user.email).toBe('alice@example.com')
    expect(user.avatarUrl).toBe('https://example.com/avatar.png')
  })

  it('handles missing optional fields', async () => {
    mockFetchRes({ name: 'Bob' })

    const adapter = new NotionAdapter()
    const user = await adapter.getUserInfo('token-xyz')

    expect(user.name).toBe('Bob')
    expect(user.email).toBeUndefined()
  })

  it('throws on API error', async () => {
    mockFetchRes({}, 401)

    const adapter = new NotionAdapter()
    await expect(adapter.getUserInfo('bad-token'))
      .rejects.toThrow('Failed to get user info')
  })
})

// ============================================================
// ensureDatabase — search + create
// ============================================================

describe('NotionAdapter.ensureDatabase', () => {
  it('returns existing database when found', async () => {
    // search response: found
    mockFetchRes({
      results: [
        {
          id: 'existing-db-id',
          url: 'https://notion.so/existing-db',
          title: [{ plain_text: '📝 FlashNote Notes' }]
        }
      ]
    })

    const adapter = new NotionAdapter()
    const db = await adapter.ensureDatabase('token')

    expect(db.id).toBe('existing-db-id')
    expect(db.url).toBe('https://notion.so/existing-db')
    expect(mockFetch).toHaveBeenCalledTimes(1) // only search, no create
  })

  it('creates database when not found', async () => {
    // search response: not found
    mockFetchRes({ results: [] })
    // create parent page response
    mockFetchRes({ id: 'parent-page-id' })
    // create database response
    mockFetchRes({ id: 'new-db-id', url: 'https://notion.so/new-db' })

    const adapter = new NotionAdapter()
    const db = await adapter.ensureDatabase('token')

    expect(db.id).toBe('new-db-id')
    expect(db.url).toBe('https://notion.so/new-db')
    expect(mockFetch).toHaveBeenCalledTimes(3) // search + page + db
  })
})

// ============================================================
// listNotes — parsePage tests come through this
// ============================================================

describe('NotionAdapter.listNotes', () => {
  function makePage(overrides: Record<string, unknown>): Record<string, unknown> {
    return {
      id: 'page-1',
      last_edited_time: '2025-07-14T12:00:00.000Z',
      properties: {
        '标题': { title: [{ plain_text: 'My Title' }] },
        '内容': { rich_text: [{ plain_text: 'my content' }] },
        '类型': { select: { name: 'API Key' } },
        '分类': { select: { name: 'API Keys & Credentials' } },
        '标签': { multi_select: [{ name: 'api-key' }, { name: 'openai' }] },
        '敏感': { checkbox: true },
        '状态': { select: { name: '已发布' } },
        '_meta': {
          rich_text: [{
            plain_text: JSON.stringify({
              v: 1,
              id: 'note-1',
              ca: '2025-07-01T00:00:00.000Z',
              rev: 1,
              ic: true,
              me: false,
              sh: 'cli',
              td: { url: 'https://example.com' }
            })
          }]
        }
      },
      ...overrides
    }
  }

  it('parses a Notion page into RemoteNote', async () => {
    mockFetchRes({
      results: [makePage({})],
      has_more: false,
      next_cursor: null
    })

    const adapter = new NotionAdapter()
    const notes = await adapter.listNotes('token', 'db-id')

    expect(notes).toHaveLength(1)
    const n = notes[0]
    expect(n.pageId).toBe('page-1')
    expect(n.flashnoteId).toBe('note-1')
    expect(n.title).toBe('My Title')
    expect(n.content).toBe('my content')
    expect(n.type).toBe('apikey') // mapped from 'API Key'
    expect(n.category).toBe('API Keys & Credentials')
    expect(n.tags).toEqual(['api-key', 'openai'])
    expect(n.sensitive).toBe(true)
    expect(n.status).toBe('published')
    expect(n.meta.v).toBe(1)
    expect(n.meta.sh).toBe('cli')
    expect(n.meta.td).toEqual({ url: 'https://example.com' })
  })

  it('skips pages without _meta', async () => {
    mockFetchRes({
      results: [
        {
          id: 'no-meta-page',
          last_edited_time: '2025-07-14T00:00:00.000Z',
          properties: {
            '标题': { title: [{ plain_text: 'Not Ours' }] }
            // no _meta
          }
        }
      ],
      has_more: false,
      next_cursor: null
    })

    const adapter = new NotionAdapter()
    const notes = await adapter.listNotes('token', 'db-id')

    expect(notes).toHaveLength(0)
  })

  it('skips pages with corrupted _meta (invalid JSON)', async () => {
    mockFetchRes({
      results: [{
        id: 'bad-meta',
        last_edited_time: '2025-07-14T00:00:00.000Z',
        properties: {
          '_meta': { rich_text: [{ plain_text: 'not-valid-json' }] }
        }
      }],
      has_more: false,
      next_cursor: null
    })

    const adapter = new NotionAdapter()
    const notes = await adapter.listNotes('token', 'db-id')

    expect(notes).toHaveLength(0)
  })

  it('handles pagination (has_more + next_cursor)', async () => {
    // Page 1
    mockFetchRes({
      results: [makePage({ id: 'page-1' })],
      has_more: true,
      next_cursor: 'cursor-2'
    })
    // Page 2
    mockFetchRes({
      results: [makePage({ id: 'page-2' })],
      has_more: false,
      next_cursor: null
    })

    const adapter = new NotionAdapter()
    const notes = await adapter.listNotes('token', 'db-id')

    expect(notes).toHaveLength(2)
    expect(notes[0].pageId).toBe('page-1')
    expect(notes[1].pageId).toBe('page-2')
  })

  it('filters by since timestamp when provided', async () => {
    mockFetchRes({ results: [], has_more: false, next_cursor: null })

    const adapter = new NotionAdapter()
    await adapter.listNotes('token', 'db-id', '2025-07-14T00:00:00.000Z')

    const [url, opts] = mockFetch.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.filter).toBeDefined()
    expect(body.filter.timestamp).toBe('last_edited_time')
    expect(body.filter.last_edited_time.on_or_after).toBe('2025-07-14T00:00:00.000Z')
  })
})

// ============================================================
// createNote — tests toNotionProperties through public API
// ============================================================

describe('NotionAdapter.createNote', () => {
  it('sends correctly formatted Notion page properties', async () => {
    let requestBody: Record<string, unknown> = {}

    mockFetch.mockImplementationOnce(async (url: string, opts: { body?: string }) => {
      requestBody = JSON.parse(opts.body ?? '{}')
      return { ok: true, json: async () => ({ id: 'new-page-id' }), text: async () => '' }
    })

    const adapter = new NotionAdapter()
    const note = makeSyncNote({
      title: 'API Key',
      content: 'sk-secret123',
      type: 'apikey',
      category: 'API Keys & Credentials',
      tags: ['api-key'],
      sensitive: true,
      status: 'published'
    })

    const pageId = await adapter.createNote('token', 'db-id', note)

    expect(pageId).toBe('new-page-id')
    expect(requestBody.parent).toEqual({ database_id: 'db-id' })

    const props = requestBody.properties as Record<string, unknown>

    // Title
    expect((props['标题'] as any).title[0].text.content).toBe('API Key')

    // Content
    expect((props['内容'] as any).rich_text[0].text.content).toBe('sk-secret123')

    // Type (mapped)
    expect((props['类型'] as any).select.name).toBe('API Key')

    // Category
    expect((props['分类'] as any).select.name).toBe('API Keys & Credentials')

    // Tags
    expect((props['标签'] as any).multi_select).toEqual([{ name: 'api-key' }])

    // Sensitive
    expect((props['敏感'] as any).checkbox).toBe(true)

    // Status
    expect((props['状态'] as any).select.name).toBe('已发布')

    // _meta
    const metaText = (props['_meta'] as any).rich_text[0].text.content
    const meta = JSON.parse(metaText)
    expect(meta.v).toBe(1)
    expect(meta.id).toBe('test-id')
  })

  it('handles unknown type by defaulting to Text', async () => {
    let requestBody: Record<string, unknown> = {}

    mockFetch.mockImplementationOnce(async (url: string, opts: { body?: string }) => {
      requestBody = JSON.parse(opts.body ?? '{}')
      return { ok: true, json: async () => ({ id: 'page-id' }), text: async () => '' }
    })

    const adapter = new NotionAdapter()
    await adapter.createNote('token', 'db-id', makeSyncNote({ type: 'text' }))

    const props = requestBody.properties as Record<string, unknown>
    expect((props['类型'] as any).select.name).toBe('Text')
  })

  it('throws on API error', async () => {
    mockFetchRes({ message: 'Bad request' }, 400)

    const adapter = new NotionAdapter()
    await expect(adapter.createNote('token', 'db-id', makeSyncNote()))
      .rejects.toThrow('Failed to create page')
  })
})

// ============================================================
// updateNote
// ============================================================

describe('NotionAdapter.updateNote', () => {
  it('PATCHes page properties', async () => {
    mockFetchRes({ id: 'page-1' })

    const adapter = new NotionAdapter()
    await adapter.updateNote('token', 'page-1', makeSyncNote({ title: 'Updated' }))

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/pages/page-1')
    expect(opts.method).toBe('PATCH')
  })

  it('throws on API error', async () => {
    mockFetchRes({}, 404)

    const adapter = new NotionAdapter()
    await expect(adapter.updateNote('token', 'not-found', makeSyncNote()))
      .rejects.toThrow('Failed to update page')
  })
})

// ============================================================
// deleteNote (archive)
// ============================================================

describe('NotionAdapter.deleteNote', () => {
  it('archives the page', async () => {
    mockFetchRes({ id: 'page-1', archived: true })

    const adapter = new NotionAdapter()
    await adapter.deleteNote('token', 'page-1')

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/blocks/page-1')
    expect(opts.method).toBe('PATCH')
    expect(JSON.parse(opts.body as string)).toEqual({ archived: true })
  })

  it('throws on API error', async () => {
    mockFetchRes({}, 404)

    const adapter = new NotionAdapter()
    await expect(adapter.deleteNote('token', 'not-found'))
      .rejects.toThrow('Failed to archive page')
  })
})

// ============================================================
// service property
// ============================================================

describe('NotionAdapter.service', () => {
  it('returns "notion"', () => {
    const adapter = new NotionAdapter()
    expect(adapter.service).toBe('notion')
  })
})
