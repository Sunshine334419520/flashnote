import { randomBytes, createHash } from 'crypto'
import { marked } from 'marked'
import TurndownService from 'turndown'
import {
  ONENOTE_AUTH_URL,
  ONENOTE_TOKEN_URL,
  ONENOTE_GRAPH_BASE,
  ONENOTE_CLIENT_ID,
  ONENOTE_SCOPES,
  ONENOTE_NOTEBOOK_TITLE,
  ONENOTE_SECTION_TITLE
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

const GRAPH = ONENOTE_GRAPH_BASE
const HEADERS_JSON = { 'Content-Type': 'application/json' }
const HEADERS_HTML = { 'Content-Type': 'text/html' }

const META_DIV_ID = 'flashnote-meta'

// ── PKCE helpers ──────────────────────────────────────────────

/** Generate a cryptographically random PKCE code_verifier (43-128 chars). */
function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url').slice(0, 43)
}

/** Compute the S256 code_challenge from a code_verifier. */
function computeCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

// ── Meta div helpers ──────────────────────────────────────────

/** Encode a NoteMeta object as a hidden HTML div for OneNote page embedding. */
function buildMetaDiv(meta: NoteMeta): string {
  const json = JSON.stringify(meta)
  const encoded = Buffer.from(json, 'utf-8').toString('base64url')
  return `<div data-id="${META_DIV_ID}">${encoded}</div>`
}

/** Extract and decode the NoteMeta from a OneNote page's HTML body. */
function parseMetaFromHtml(html: string): { meta: NoteMeta; bodyWithoutMeta: string } | null {
  const re = new RegExp(`<div[^>]*data-id="${META_DIV_ID}"[^>]*>([\\s\\S]*?)<\\/div>`)
  const match = html.match(re)
  if (!match) return null

  try {
    const raw = match[1].trim()
    const json = Buffer.from(raw, 'base64url').toString('utf-8')
    const meta = JSON.parse(json) as NoteMeta
    const bodyWithoutMeta = html.replace(match[0], '')
    return { meta, bodyWithoutMeta }
  } catch {
    logger.warn('cloud:onenote', 'Failed to parse meta div')
    return null
  }
}

// ── Markdown ↔ HTML ───────────────────────────────────────────

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
})

function mdToHtml(markdown: string): string {
  return marked.parse(markdown) as string
}

function htmlToMd(html: string): string {
  return turndownService.turndown(html)
}

// ── Graph API helpers ─────────────────────────────────────────

async function graphGet(accessToken: string, path: string): Promise<unknown> {
  const url = `${GRAPH}${path}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Graph GET ${path} (${res.status}): ${errText}`)
  }
  return res.json()
}

async function graphPost(accessToken: string, path: string, body: unknown, contentType?: string): Promise<unknown> {
  const url = `${GRAPH}${path}`
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` }
  if (contentType) headers['Content-Type'] = contentType
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: contentType === 'application/json' ? JSON.stringify(body) : body as string
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Graph POST ${path} (${res.status}): ${errText}`)
  }
  return res.json()
}

async function graphDelete(accessToken: string, path: string): Promise<void> {
  const url = `${GRAPH}${path}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!res.ok && res.status !== 204) {
    const errText = await res.text()
    throw new Error(`Graph DELETE ${path} (${res.status}): ${errText}`)
  }
}

// ============================================================
// OnenoteAdapter
// ============================================================

export class OnenoteAdapter implements CloudSyncAdapter {
  readonly service: CloudServiceType = 'onenote'

  /** PKCE code_verifier held between getAuthUrl and exchangeCode. */
  private pendingCodeVerifier: string | null = null

  /**
   * Active OneNote section ID — populated by ensureDatabase() and set by
   * CloudSyncService when restoring from a stored connection.
   * Needed because updateNote (delete+recreate) requires sectionId for
   * the POST call, but the adapter interface only provides pageId.
   */
  public sectionId: string | null = null

  // ── OAuth (PKCE, public client — no client_secret) ──────────

  getAuthUrl(state: string, redirectUri: string): string {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = computeCodeChallenge(codeVerifier)
    this.pendingCodeVerifier = codeVerifier

    const params = new URLSearchParams({
      client_id: ONENOTE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: ONENOTE_SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    })
    return `${ONENOTE_AUTH_URL}?${params.toString()}`
  }

  async exchangeCode(code: string, redirectUri: string): Promise<AuthResult> {
    const codeVerifier = this.pendingCodeVerifier
    this.pendingCodeVerifier = null

    if (!codeVerifier) {
      throw new Error('PKCE code_verifier missing — ensure getAuthUrl was called first')
    }

    const body = new URLSearchParams({
      client_id: ONENOTE_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })

    const res = await fetch(ONENOTE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OneNote token exchange failed (${res.status}): ${text}`)
    }

    const data = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      token_type?: string
    }

    const now = Date.now()
    const expiresIn = data.expires_in ?? 3600

    return {
      accessToken: data.access_token,
      workspaceId: 'personal',
      workspaceName: 'OneNote',
      refreshToken: data.refresh_token,
      expiresAt: now + expiresIn * 1000
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthResult> {
    const body = new URLSearchParams({
      client_id: ONENOTE_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })

    const res = await fetch(ONENOTE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OneNote token refresh failed (${res.status}): ${text}`)
    }

    const data = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    const now = Date.now()
    const expiresIn = data.expires_in ?? 3600

    return {
      accessToken: data.access_token,
      workspaceId: 'personal',
      workspaceName: 'OneNote',
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: now + expiresIn * 1000
    }
  }

  // ── User info ───────────────────────────────────────────────

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const data = await graphGet(accessToken, '/me') as {
      displayName?: string
      mail?: string
      userPrincipalName?: string
    }
    return {
      name: data.displayName ?? 'Unknown',
      email: data.mail ?? data.userPrincipalName
    }
  }

  // ── Database management (notebook + section) ────────────────

  async ensureDatabase(accessToken: string): Promise<DatabaseInfo> {
    // 1. Find or create the FlashNote notebook
    const notebooks = await graphGet(accessToken, '/me/onenote/notebooks') as {
      value: Array<{ id: string; displayName: string; links?: { oneNoteWebUrl?: { href?: string } } }>
    }

    let notebook = notebooks.value.find((n) => n.displayName === ONENOTE_NOTEBOOK_TITLE)

    if (!notebook) {
      const created = await graphPost(accessToken, '/me/onenote/notebooks', {
        displayName: ONENOTE_NOTEBOOK_TITLE
      }, 'application/json') as { id: string; displayName: string; links?: { oneNoteWebUrl?: { href?: string } } }
      notebook = created
      logger.info('cloud:onenote', `Created notebook: ${ONENOTE_NOTEBOOK_TITLE}`)
    } else {
      logger.info('cloud:onenote', `Found existing notebook: ${notebook.id}`)
    }

    // 2. Find or create the Notes section
    const sections = await graphGet(accessToken, `/me/onenote/notebooks/${notebook.id}/sections`) as {
      value: Array<{ id: string; displayName: string }>
    }

    let section = sections.value.find((s) => s.displayName === ONENOTE_SECTION_TITLE)
    if (!section) {
      const created = await graphPost(accessToken, `/me/onenote/notebooks/${notebook.id}/sections`, {
        displayName: ONENOTE_SECTION_TITLE
      }, 'application/json') as { id: string; displayName: string }
      section = created
      logger.info('cloud:onenote', `Created section: ${ONENOTE_SECTION_TITLE}`)
    } else {
      logger.info('cloud:onenote', `Found existing section: ${section.id}`)
    }

    this.sectionId = section.id

    return {
      id: section.id,
      url: notebook.links?.oneNoteWebUrl?.href ?? ''
    }
  }

  // ── CRUD ────────────────────────────────────────────────────

  async listNotes(accessToken: string, sectionId: string): Promise<RemoteNote[]> {
    const pages = await graphGet(accessToken, `/me/onenote/sections/${sectionId}/pages`) as {
      value: Array<{
        id: string
        title?: string
        contentUrl?: string
        lastModifiedDateTime?: string
      }>
    }

    const results: RemoteNote[] = []

    for (const page of pages.value) {
      try {
        // OneNote /content endpoint returns HTML, not JSON — fetch as text
        const res = await fetch(`${GRAPH}/me/onenote/pages/${page.id}/content`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (!res.ok) {
          logger.warn('cloud:onenote', `Failed to fetch page content ${page.id} (${res.status})`)
          continue
        }
        const html = await res.text()
        const parsed = parseMetaFromHtml(html)
        if (!parsed) continue

        const { meta, bodyWithoutMeta } = parsed
        const content = htmlToMd(bodyWithoutMeta)

        // Extract title from meta or page metadata
        const title = page.title ?? meta.sh ?? 'Untitled'

        // Extract note-type metadata from meta.td
        const td = (meta.td ?? {}) as Record<string, unknown>

        results.push({
          pageId: page.id,
          flashnoteId: meta.id,
          title,
          content,
          type: (td.type as string) ?? 'text',
          category: (td.category as string) ?? 'Other',
          tags: (td.tags as string[]) ?? [],
          sensitive: (td.sensitive as boolean) ?? false,
          status: (td.status as string) ?? 'published',
          meta,
          lastEditedAt: page.lastModifiedDateTime ?? new Date().toISOString()
        })
      } catch (err) {
        logger.error('cloud:onenote', `Failed to parse page ${page.id}`, { error: String(err) })
      }
    }

    return results
  }

  async createNote(accessToken: string, sectionId: string, note: NoteForSync): Promise<string> {
    const meta = JSON.parse(note.meta) as NoteMeta
    const htmlBody = mdToHtml(note.content)
    const pageHtml = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      `<title>${escapeHtml(note.title)}</title>`,
      '<meta charset="utf-8" />',
      '</head>',
      '<body>',
      htmlBody,
      buildMetaDiv(meta),
      '</body>',
      '</html>'
    ].join('\n')

    const data = await graphPost(accessToken, `/me/onenote/sections/${sectionId}/pages`, pageHtml, 'text/html') as {
      id: string
    }
    return data.id
  }

  async updateNote(accessToken: string, pageId: string, note: NoteForSync): Promise<void> {
    // OneNote PATCH can't replace the whole body — delete + recreate instead.
    // Requires sectionId; stored from ensureDatabase() or set by CloudSyncService.
    if (!this.sectionId) {
      throw new Error('sectionId not set — ensureDatabase must be called before updateNote')
    }

    // Delete the old page
    try {
      await graphDelete(accessToken, `/me/onenote/pages/${pageId}`)
    } catch (err) {
      logger.warn('cloud:onenote', `Delete before update failed for ${pageId}`, { error: String(err) })
    }

    // Recreate with new content (reuse createNote logic but return void)
    await this.createNote(accessToken, this.sectionId, note)
  }

  async deleteNote(accessToken: string, pageId: string): Promise<void> {
    await graphDelete(accessToken, `/me/onenote/pages/${pageId}`)
    logger.info('cloud:onenote', `Deleted page: ${pageId}`)
  }
}

// ── HTML escape helper ────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
