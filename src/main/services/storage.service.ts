import { v4 as uuidv4 } from 'uuid'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { resolveNotePath } from '../utils/paths'
import { serializeNote, parseNote } from '../utils/markdown'
import {
  initIndexService,
  insertNote,
  updateNote,
  deleteNoteById,
  getNoteById,
  listNotes,
  searchNotes
} from './index.service'
import type { Note, NoteCreateRequest, NoteUpdateRequest, SearchQuery, SearchResult } from '../../shared/types'

// ============================================================
// Module state — initialized on first use
// ============================================================

let storageRoot: string | null = null

export function initStorageService(storagePath: string): void {
  storageRoot = storagePath
  initIndexService(storagePath)
}

function getStorageRoot(): string {
  if (!storageRoot) throw new Error('StorageService not initialized. Call initStorageService() first.')
  return storageRoot
}

// ============================================================
// CRUD
// ============================================================

export function createNote(request: NoteCreateRequest, classification?: {
  id?: string
  type?: string
  category: string
  tags: string[]
  title: string
  sensitive?: boolean
  typedData?: Record<string, unknown>
  status?: 'draft' | 'published'
  syncRev?: number
  baseRev?: number
}): Note {
  const root = getStorageRoot()
  const now = new Date().toISOString()

  const note: Note = {
    id: classification?.id ?? uuidv4(),
    type: (classification?.type as Note['type']) ?? 'text',
    title: classification?.title ?? 'Untitled Note',
    content: request.content,
    category: classification?.category ?? 'Other',
    tags: classification?.tags ?? [],
    sourceHint: request.sourceHint,
    metadata: {},
    sensitive: classification?.sensitive ?? false,
    typedData: classification?.typedData,
    createdAt: now,
    updatedAt: now,
    isClassified: !!classification,
    isManuallyEdited: false,
    status: classification?.status ?? 'draft',
    syncRev: classification?.syncRev ?? 0,
    baseRev: classification?.baseRev ?? 0
  }

  // Write to disk
  const filePath = resolveNotePath(root, note.id)
  const markdown = serializeNote(note)
  writeFileSync(filePath, markdown, 'utf-8')

  // Write to index
  insertNote(note)

  return note
}

export function readNote(noteId: string): Note | null {
  const root = getStorageRoot()
  const filePath = resolveNotePath(root, noteId)

  if (!existsSync(filePath)) {
    return null
  }

  const rawContent = readFileSync(filePath, 'utf-8')
  const note = parseNote(rawContent)

  // Verify the ID in frontmatter matches the filename
  if (note.id !== noteId) {
    console.warn(`Note ID mismatch: file ${noteId} contains note ${note.id}`)
  }

  return note
}

export function modifyNote(request: NoteUpdateRequest): Note {
  const root = getStorageRoot()
  const existing = readNote(request.id)
  if (!existing) throw new Error(`Note not found: ${request.id}`)

  const now = new Date().toISOString()

  const updated: Note = {
    ...existing,
    title: request.title ?? existing.title,
    content: request.content ?? existing.content,
    category: request.category ?? existing.category,
    tags: request.tags ?? existing.tags,
    status: request.status ?? existing.status,
    updatedAt: now,
    isManuallyEdited: request.isManuallyEdited ?? true,
    syncRev: request.syncRev ?? (existing.syncRev ?? 0) + 1,
    baseRev: request.baseRev ?? existing.baseRev ?? 0
  }

  // Write to disk
  const filePath = resolveNotePath(root, updated.id)
  const markdown = serializeNote(updated)
  writeFileSync(filePath, markdown, 'utf-8')

  // Update index
  updateNote(updated)

  return updated
}

export function removeNote(noteId: string): void {
  const root = getStorageRoot()
  const filePath = resolveNotePath(root, noteId)

  // Delete from disk
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }

  // Delete from index
  deleteNoteById(noteId)
}

export function getNotes(query?: SearchQuery): SearchResult {
  if (query?.text) {
    return searchNotes(query)
  }
  return listNotes(query)
}
