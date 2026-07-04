// ============================================================
// Core Note entity
// ============================================================

export type NoteType = 'apikey' | 'credential' | 'command' | 'bookmark' | 'text'

export interface Note {
  id: string
  type: NoteType
  title: string
  content: string
  description?: string
  category: string
  tags: string[]
  sourceHint?: string
  metadata: Record<string, unknown>
  sensitive: boolean
  typedData?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  isClassified: boolean
  isManuallyEdited: boolean
  status: 'draft' | 'published'
}

// ============================================================
// Task types
// ============================================================

export interface TaskInfo {
  id: string
  noteId: string
  rawInput: string
  status: 'processing' | 'done' | 'failed'
  result?: {
    category: string
    tags: string[]
    title: string
    elapsedMs: number
  }
  error?: string
  createdAt: string
  completedAt?: string
}

// ============================================================
// IPC request/response types
// ============================================================

export interface NoteCreateRequest {
  content: string
  sourceHint?: string
}

export interface NoteUpdateRequest {
  id: string
  title?: string
  content?: string
  category?: string
  tags?: string[]
  status?: 'draft' | 'published'
}

// ============================================================
// AI types
// ============================================================

export type AIProviderType = 'anthropic' | 'openai' | 'deepseek' | 'moonshot' | 'zhipu' | 'custom'

export interface AIProviderConfig {
  id: string
  name: string
  type: AIProviderType
  apiKey: string
  baseURL: string
  model: string
  maxTokens: number
  thinking?: 'enabled' | 'disabled'
  isActive: boolean
  createdAt: string
}

export interface SmartParseResult {
  cleanedContent: string
  type: NoteType
  category: string
  tags: string[]
  title: string
  sensitive: boolean
  typedData?: Record<string, unknown>
  structuredData?: Record<string, unknown>
  appendToNoteId?: string  // @ reference → append to existing note
}

// ============================================================
// Search types
// ============================================================

export interface SearchQuery {
  text?: string
  tags?: string[]
  category?: string
  sortBy: 'createdAt' | 'updatedAt' | 'title'
  sortOrder: 'asc' | 'desc'
  limit: number
  offset: number
}

export interface SearchResult {
  notes: Note[]
  total: number
  hasMore: boolean
}

// ============================================================
// App configuration
// ============================================================

export interface AppConfig {
  storagePath: string
  hotkey: string
  theme: 'light' | 'dark' | 'system'
  language: 'zh-CN' | 'en' | 'system'
  windowBounds?: { x: number; y: number; width: number; height: number }
}
