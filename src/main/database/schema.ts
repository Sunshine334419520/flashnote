/**
 * TypeScript interfaces matching SQLite row shapes.
 */

export interface NoteRow {
  id: string
  type: string
  title: string
  content: string
  category: string
  source_hint: string | null
  status: string
  sensitive: number
  typed_data: string | null
  created_at: string
  updated_at: string
  is_classified: number // 0 | 1
  is_manually_edited: number // 0 | 1
  content_hash: string
  word_count: number
  sync_rev: number
  base_rev: number
}

export interface TagRow {
  id: number
  name: string
  usage_count: number
}

export interface NoteTagRow {
  note_id: string
  tag_id: number
}

export interface CategoryRow {
  id: number
  name: string
  note_count: number
  created_at: string
}

export interface SettingRow {
  key: string
  value: string
  updated_at: string
}

export interface CloudConnectionRow {
  id: string
  service: string
  access_token: string
  workspace_id: string | null
  workspace_name: string | null
  account_name: string | null
  account_email: string | null
  database_id: string | null
  database_url: string | null
  last_sync_at: string | null
  status: string
  error: string | null
  created_at: string
  updated_at: string
}
