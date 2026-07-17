/* v8 ignore start */ // Types-only file, no executable code to cover
import type { CloudServiceType } from '../../../shared/types'

// ============================================================
// Adapter interface — each cloud provider implements this
// ============================================================

export interface CloudSyncAdapter {
  readonly service: CloudServiceType

  /** Construct the OAuth authorization URL. */
  getAuthUrl(state: string, redirectUri: string): string

  /** Exchange an OAuth authorization code for an access token. */
  exchangeCode(code: string, redirectUri: string): Promise<AuthResult>

  /** Get the authenticated user's profile info. */
  getUserInfo(accessToken: string): Promise<UserInfo>

  /** Ensure the FlashNote database exists in the provider, creating it if needed. */
  ensureDatabase(accessToken: string): Promise<DatabaseInfo>

  /** List all remote note rows, optionally filtered by last-edited time. */
  listNotes(accessToken: string, databaseId: string, since?: string): Promise<RemoteNote[]>

  /** Create a new note row in the remote database. Returns the remote page ID. */
  createNote(accessToken: string, databaseId: string, note: NoteForSync): Promise<string>

  /** Update an existing note row. */
  updateNote(accessToken: string, pageId: string, note: NoteForSync): Promise<void>

  /** Delete (archive) a note row. */
  deleteNote(accessToken: string, pageId: string): Promise<void>
}

// ============================================================
// Shared types
// ============================================================

export interface AuthResult {
  accessToken: string
  workspaceId: string
  workspaceName: string
  accountName?: string
  accountEmail?: string
}

export interface UserInfo {
  name: string
  email?: string
  avatarUrl?: string
}

export interface DatabaseInfo {
  id: string
  url: string
}

export interface RemoteNote {
  pageId: string
  flashnoteId: string
  title: string
  content: string
  type: string
  category: string
  tags: string[]
  sensitive: boolean
  status: string
  meta: NoteMeta
  lastEditedAt: string
}

export interface NoteMeta {
  v: number
  id: string
  rev: number
  ca: string
  ua: string
  ic: boolean
  me: boolean
  sh: string
  td: Record<string, unknown>
}

export interface NoteForSync {
  title: string
  content: string
  type: string
  category: string
  tags: string[]
  sensitive: boolean
  status: string
  meta: string // JSON.stringify(NoteMeta)
}
/* v8 ignore stop */
