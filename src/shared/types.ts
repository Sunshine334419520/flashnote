// ============================================================
// Core Note entity
// ============================================================

export interface Note {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  sourceHint?: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  isClassified: boolean
  isManuallyEdited: boolean
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
  isActive: boolean
  createdAt: string
}

export interface ClassificationResult {
  category: string
  tags: string[]
  title: string
  structuredData?: Record<string, unknown>
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
  windowBounds?: { x: number; y: number; width: number; height: number }
}
