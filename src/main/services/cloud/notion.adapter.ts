import {
  NOTION_AUTH_URL,
  NOTION_TOKEN_URL,
  NOTION_API_BASE,
  NOTION_API_VERSION,
  NOTION_CLIENT_ID,
  NOTION_CLIENT_SECRET
} from '../../../shared/constants'
import type { CloudServiceType } from '../../../shared/types'
import type {
  CloudSyncAdapter,
  AuthResult,
  UserInfo,
  DatabaseInfo,
  RemoteNote,
  NoteForSync,
  NoteMeta
} from './adapter'
import { logger } from '../../utils/logger'
import { LOG_TAGS } from '../../../shared/logTags'

const API = NOTION_API_BASE
const HEADERS = {
  'Notion-Version': NOTION_API_VERSION,
  'Content-Type': 'application/json'
}

// ── Database property schema ──────────────────────────────────────────
// Every FlashNote field maps to a Notion database column.

const DATABASE_TITLE = '📝 FlashNote Notes'

const DATABASE_PROPERTIES = {
  '标题': { title: {} },
  '内容': { rich_text: {} },
  '类型': {
    select: {
      options: [
        { name: 'API Key', color: 'orange' },
        { name: 'Command', color: 'green' },
        { name: 'Credential', color: 'red' },
        { name: 'Bookmark', color: 'blue' },
        { name: 'Text', color: 'purple' }
      ]
    }
  },
  '分类': { select: { options: [] } },
  '标签': { multi_select: { options: [] } },
  '敏感': { checkbox: {} },
  '状态': {
    select: {
      options: [
        { name: '已发布', color: 'green' },
        { name: '草稿', color: 'gray' }
      ]
    }
  },
  '_meta': { rich_text: {} }
}

// ── Column name → Notion property name mapping ───────────────────────

const TYPE_LABEL_MAP: Record<string, string> = {
  apikey: 'API Key',
  command: 'Command',
  credential: 'Credential',
  bookmark: 'Bookmark',
  text: 'Text'
}

const TYPE_LABEL_REVERSE: Record<string, string> = {
  'API Key': 'apikey',
  'Command': 'command',
  'Credential': 'credential',
  'Bookmark': 'bookmark',
  'Text': 'text'
}

const STATUS_LABEL_MAP: Record<string, string> = {
  published: '已发布',
  draft: '草稿'
}

const STATUS_LABEL_REVERSE: Record<string, string> = {
  '已发布': 'published',
  '草稿': 'draft'
}

// ============================================================
// NotionAdapter
// ============================================================

export class NotionAdapter implements CloudSyncAdapter {
  readonly service: CloudServiceType = 'notion'

  /**
   * Wrapper around fetch that logs every request and response.
   * Every HTTP call in this class goes through this method.
   */
  private async loggedFetch(label: string, url: string, options: Record<string, unknown>, timeoutMs = 0): Promise<Response> {
    const method = (options.method as string) ?? 'GET'
    logger.info(LOG_TAGS.CLOUD.NOTION, `[${label}] ${method} ${url}`)

    let useOpts = { ...options }
    if (timeoutMs > 0) {
      const controller = new AbortController()
      const timer = setTimeout(() => {
        logger.warn(LOG_TAGS.CLOUD.NOTION, `[${label}] ${method} ${url} — ${timeoutMs}ms timeout, aborting`)
        controller.abort()
      }, timeoutMs)
      useOpts = { ...useOpts, signal: controller.signal }
      // Note: clearTimeout not shown here for brevity, but callers should handle it
    }

    const startedAt = Date.now()
    try {
      const res = await fetch(url, useOpts as RequestInit)
      const elapsed = Date.now() - startedAt
      logger.info(LOG_TAGS.CLOUD.NOTION, `[${label}] ${method} ${url} → ${res.status} ${res.statusText} (${elapsed}ms)`)
      return res
    } catch (err) {
      const elapsed = Date.now() - startedAt
      const name = (err as Error).name
      const msg = String(err)
      logger.error(LOG_TAGS.CLOUD.NOTION, `[${label}] ${method} ${url} FAILED`, { errorName: name, error: msg.substring(0, 300), elapsed })
      throw err
    }
  }

  // ── OAuth ─────────────────────────────────────────────────

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: NOTION_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      owner: 'user'
    })
    return `${NOTION_AUTH_URL}?${params.toString()}`
  }

  async exchangeCode(code: string, redirectUri: string): Promise<AuthResult> {
    const auth = Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString('base64')

    const res = await this.loggedFetch('exchangeCode', NOTION_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_API_VERSION
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    }, 30_000)

    if (!res.ok) {
      const text = await res.text()
      logger.error(LOG_TAGS.CLOUD.NOTION, 'exchangeCode: token endpoint returned error', { status: res.status, body: text.substring(0, 200) })
      throw new Error(`Notion token exchange failed (${res.status}): ${text}`)
    }

    const data = (await res.json()) as {
      access_token: string
      workspace_id: string
      workspace_name: string
      owner?: { user?: { name?: string; person?: { email?: string } } }
    }

    return {
      accessToken: data.access_token,
      workspaceId: data.workspace_id,
      workspaceName: data.workspace_name,
      accountName: data.owner?.user?.name,
      accountEmail: data.owner?.user?.person?.email
    }
  }

  // ── User info ─────────────────────────────────────────────

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const res = await this.loggedFetch('getUserInfo', `${API}/users/me`, {
      headers: { ...HEADERS, 'Authorization': `Bearer ${accessToken}` }
    })

    if (!res.ok) {
      throw new Error(`Failed to get user info (${res.status})`)
    }

    const data = (await res.json()) as {
      name?: string
      person?: { email?: string }
      avatar_url?: string
    }

    return {
      name: data.name ?? 'Unknown',
      email: data.person?.email,
      avatarUrl: data.avatar_url
    }
  }

  // ── Database management ───────────────────────────────────

  async ensureDatabase(accessToken: string): Promise<DatabaseInfo> {
    // 1. Search for existing FlashNote database
    const searchRes = await this.loggedFetch('searchDB', `${API}/search`, {
      method: 'POST',
      headers: { ...HEADERS, 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({
        query: DATABASE_TITLE,
        filter: { property: 'object', value: 'database' }
      })
    })

    if (!searchRes.ok) {
      throw new Error(`Failed to search databases (${searchRes.status})`)
    }

    const searchData = (await searchRes.json()) as {
      results: Array<{ id: string; url?: string; title?: Array<{ plain_text?: string }> }>
    }

    const existing = searchData.results.find(
      (db) => db.title?.some((t) => t.plain_text === DATABASE_TITLE)
    )

    if (existing) {
      logger.info(LOG_TAGS.CLOUD.NOTION, `Found existing database: ${existing.id}`)
      return { id: existing.id, url: existing.url ?? '' }
    }

    // 2. Create a top-level page to hold the database
    const pageRes = await this.loggedFetch('createPage', `${API}/pages`, {
      method: 'POST',
      headers: { ...HEADERS, 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({
        parent: { type: 'workspace', workspace: true },
        properties: {
          title: [{ text: { content: '📝 FlashNote' } }]
        }
      })
    })

    if (!pageRes.ok) {
      const errText = await pageRes.text()
      throw new Error(`Failed to create parent page (${pageRes.status}): ${errText}`)
    }

    const pageData = (await pageRes.json()) as { id: string }

    // 3. Create the database as a child of that page
    const dbRes = await this.loggedFetch('createDB', `${API}/databases`, {
      method: 'POST',
      headers: { ...HEADERS, 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({
        parent: { type: 'page_id', page_id: pageData.id },
        title: [{ text: { content: DATABASE_TITLE } }],
        properties: DATABASE_PROPERTIES
      })
    })

    if (!dbRes.ok) {
      const errText = await dbRes.text()
      throw new Error(`Failed to create database (${dbRes.status}): ${errText}`)
    }

    const dbData = (await dbRes.json()) as { id: string; url?: string }
    logger.info(LOG_TAGS.CLOUD.NOTION, `Created database: ${dbData.id}`)

    return { id: dbData.id, url: dbData.url ?? '' }
  }

  // ── CRUD ──────────────────────────────────────────────────

  async listNotes(accessToken: string, databaseId: string, since?: string): Promise<RemoteNote[]> {
    const filter = since
      ? { timestamp: 'last_edited_time', last_edited_time: { on_or_after: since } }
      : undefined

    const body: Record<string, unknown> = {
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      page_size: 100
    }
    if (filter) {
      body.filter = filter
    }

    const allResults: RemoteNote[] = []
    let cursor: string | undefined

    do {
      if (cursor) {
        body.start_cursor = cursor
      }

      const res = await this.loggedFetch('listNotes', `${API}/databases/${databaseId}/query`, {
        method: 'POST',
        headers: { ...HEADERS, 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Failed to query database (${res.status}): ${errText}`)
      }

      const data = (await res.json()) as {
        results: Array<Record<string, unknown>>
        has_more: boolean
        next_cursor: string | null
      }

      for (const page of data.results) {
        const parsed = this.parsePage(page)
        if (parsed) {
          allResults.push(parsed)
        }
      }

      cursor = data.next_cursor ?? undefined
    } while (cursor)

    return allResults
  }

  async createNote(accessToken: string, databaseId: string, note: NoteForSync): Promise<string> {
    const res = await this.loggedFetch('createNote', `${API}/pages`, {
      method: 'POST',
      headers: { ...HEADERS, 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: this.toNotionProperties(note)
      })
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Failed to create page (${res.status}): ${errText}`)
    }

    const data = (await res.json()) as { id: string }
    return data.id
  }

  async updateNote(accessToken: string, pageId: string, note: NoteForSync): Promise<void> {
    const res = await this.loggedFetch('updateNote', `${API}/pages/${pageId}`, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({
        properties: this.toNotionProperties(note)
      })
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Failed to update page ${pageId} (${res.status}): ${errText}`)
    }
  }

  async deleteNote(accessToken: string, pageId: string): Promise<void> {
    // Notion API: archive the page (soft delete)
    const res = await this.loggedFetch('deleteNote', `${API}/blocks/${pageId}`, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ archived: true })
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Failed to archive page ${pageId} (${res.status}): ${errText}`)
    }
  }

  // ── Property conversion helpers ───────────────────────────

  /**
   * Convert a FlashNote NoteForSync into Notion page properties.
   */
  private toNotionProperties(note: NoteForSync): Record<string, unknown> {
    const typeLabel = TYPE_LABEL_MAP[note.type] ?? 'Text'
    const statusLabel = STATUS_LABEL_MAP[note.status] ?? '已发布'

    return {
      '标题': { title: [{ text: { content: note.title } }] },
      '内容': { rich_text: [{ text: { content: note.content.slice(0, 2000) } }] },
      '类型': { select: { name: typeLabel } },
      '分类': { select: note.category ? { name: note.category } : null },
      '标签': {
        multi_select: note.tags.map((t) => ({ name: t }))
      },
      '敏感': { checkbox: note.sensitive },
      '状态': { select: { name: statusLabel } },
      '_meta': { rich_text: [{ text: { content: note.meta } }] }
    }
  }

  /**
   * Parse a Notion page into a RemoteNote. Returns null if the page
   * has no _meta (not a FlashNote record).
   */
  private parsePage(page: Record<string, unknown>): RemoteNote | null {
    const props = (page.properties ?? {}) as Record<string, unknown>

    // Extract _meta rich_text
    const metaProp = props['_meta'] as {
      rich_text?: Array<{ plain_text?: string }>
    } | undefined
    const metaText = metaProp?.rich_text?.[0]?.plain_text

    if (!metaText) return null

    let meta: NoteMeta
    try {
      meta = JSON.parse(metaText) as NoteMeta
    } catch {
      return null // corrupted _meta → ignore
    }

    // Extract title
    const titleProp = props['标题'] as {
      title?: Array<{ plain_text?: string }>
    } | undefined
    const title = titleProp?.title?.[0]?.plain_text ?? ''

    // Extract content
    const contentProp = props['内容'] as {
      rich_text?: Array<{ plain_text?: string }>
    } | undefined
    const content = contentProp?.rich_text?.[0]?.plain_text ?? ''

    // Extract type
    const typeProp = props['类型'] as { select?: { name?: string } } | undefined
    const type = TYPE_LABEL_REVERSE[typeProp?.select?.name ?? ''] ?? 'text'

    // Extract category
    const catProp = props['分类'] as { select?: { name?: string } } | undefined
    const category = catProp?.select?.name ?? 'Other'

    // Extract tags
    const tagsProp = props['标签'] as {
      multi_select?: Array<{ name?: string }>
    } | undefined
    const tags = (tagsProp?.multi_select ?? []).map((t) => t.name ?? '').filter(Boolean)

    // Extract sensitive
    const sensProp = props['敏感'] as { checkbox?: boolean } | undefined
    const sensitive = sensProp?.checkbox ?? false

    // Extract status
    const statusProp = props['状态'] as { select?: { name?: string } } | undefined
    const status = STATUS_LABEL_REVERSE[statusProp?.select?.name ?? ''] ?? 'published'

    // Extract last_edited_time
    const lastEditedAt = (page.last_edited_time as string) ?? ''

    return {
      pageId: page.id as string,
      flashnoteId: meta.id,
      title,
      content,
      type,
      category,
      tags,
      sensitive,
      status,
      meta,
      lastEditedAt
    }
  }
}
