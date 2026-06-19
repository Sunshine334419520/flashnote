import matter from 'gray-matter'
import type { Note } from '../../shared/types'

/**
 * YAML frontmatter shape stored in .md files.
 * Property names use snake_case for YAML convention.
 */
interface NoteFrontmatter {
  id: string
  title: string
  category: string
  tags: string[]
  source_hint?: string
  created_at: string
  updated_at: string
  is_classified: boolean
  is_manually_edited: boolean
  // biome-ignore lint/suspicious/noExplicitAny: structured data is arbitrary
  structured_data?: Record<string, any>
}

/**
 * Convert a Note domain object to frontmatter + body Markdown string.
 */
export function serializeNote(note: Note): string {
  const frontmatter: NoteFrontmatter = {
    id: note.id,
    title: note.title,
    category: note.category,
    tags: note.tags,
    source_hint: note.sourceHint,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    is_classified: note.isClassified,
    is_manually_edited: note.isManuallyEdited,
    structured_data: note.metadata as Record<string, unknown>
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
    title: fm.title ?? 'Untitled',
    content: content.trim(),
    category: fm.category ?? 'Other',
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    sourceHint: fm.source_hint,
    metadata: (fm.structured_data as Record<string, unknown>) ?? {},
    createdAt: fm.created_at ?? new Date().toISOString(),
    updatedAt: fm.updated_at ?? new Date().toISOString(),
    isClassified: fm.is_classified ?? false,
    isManuallyEdited: fm.is_manually_edited ?? false
  }
}
