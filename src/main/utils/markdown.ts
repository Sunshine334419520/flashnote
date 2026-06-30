import matter from 'gray-matter'
import type { Note } from '../../shared/types'

/**
 * YAML frontmatter shape stored in .md files.
 * Property names use snake_case for YAML convention.
 */
interface NoteFrontmatter {
  id: string
  type?: string
  title: string
  category: string
  tags: string[]
  description?: string
  source_hint?: string
  sensitive?: boolean
  typed_data?: Record<string, unknown>
  status?: string
  created_at: string
  updated_at: string
  is_classified: boolean
  is_manually_edited: boolean
  structured_data?: Record<string, unknown>
}

/**
 * Convert a Note domain object to frontmatter + body Markdown string.
 */
export function serializeNote(note: Note): string {
  const frontmatter: Record<string, unknown> = {
    id: note.id,
    type: note.type,
    title: note.title,
    category: note.category,
    tags: note.tags,
    status: note.status,
    sensitive: note.sensitive,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    is_classified: note.isClassified,
    is_manually_edited: note.isManuallyEdited
  }

  if (note.description) frontmatter.description = note.description
  if (note.sourceHint) frontmatter.source_hint = note.sourceHint
  if (note.typedData && Object.keys(note.typedData).length > 0) {
    frontmatter.typed_data = note.typedData
  }
  if (note.metadata && Object.keys(note.metadata).length > 0) {
    frontmatter.structured_data = note.metadata
  }

  return matter.stringify(note.content, frontmatter)
}

/**
 * Parse a Markdown file's raw content into a Note domain object.
 */
export function parseNote(rawContent: string): Note {
  const { data, content } = matter(rawContent)
  const fm = data as Partial<NoteFrontmatter>

  return {
    id: fm.id ?? '',
    type: (fm.type as Note['type']) ?? 'text',
    title: fm.title ?? 'Untitled',
    content: content.trim(),
    description: fm.description,
    category: fm.category ?? 'Other',
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    sourceHint: fm.source_hint,
    metadata: (fm.structured_data as Record<string, unknown>) ?? {},
    sensitive: fm.sensitive ?? false,
    typedData: fm.typed_data,
    createdAt: fm.created_at ?? new Date().toISOString(),
    updatedAt: fm.updated_at ?? new Date().toISOString(),
    isClassified: fm.is_classified ?? false,
    isManuallyEdited: fm.is_manually_edited ?? false,
    status: (fm.status as 'draft' | 'published') ?? 'draft'
  }
}
