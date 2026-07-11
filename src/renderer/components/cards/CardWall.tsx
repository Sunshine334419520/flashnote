import { type ReactElement, useMemo, useState, useEffect } from 'react'
import { useNoteStore } from '../../stores/noteStore'
import { CardFactory } from './CardFactory'
import { FileText, Search, X } from 'lucide-react'
import { useT } from '../../i18n'
import type { Note } from '../../../shared/types'
import { groupNotesByTime, TIME_GROUP_LABELS } from '../../data/mockNotes'

interface CardWallProps {
  notes?: Note[]
  onUpdate?: (id: string, title: string, content: string) => void
  onDelete?: (id: string) => void
}

/**
 * Distribute notes into N columns round-robin (left to right, then next row).
 * This guarantees col[0] ≥ col[1] ≥ ... in card count, and columns are
 * visually balanced since consecutive cards tend to have similar heights.
 */
function distributeColumns(notes: Note[], numCols: number): Note[][] {
  const cols: Note[][] = Array.from({ length: numCols }, () => [])
  notes.forEach((note, i) => {
    cols[i % numCols].push(note)
  })
  return cols
}

/** Resolve column count from viewport width. */
function useColumnCount(): number {
  const [cols, setCols] = useState(() => getCols(window.innerWidth))
  useEffect(() => {
    const onResize = () => setCols(getCols(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return cols
}

function getCols(width: number): number {
  if (width < 540) return 1
  if (width < 900) return 2
  if (width < 1200) return 3
  return 4
}

/** A plain keyword drives live filtering; `/` and `@` are handled elsewhere. */
function isPlainKeyword(query: string): boolean {
  const q = query.trim()
  return q.length > 0 && !q.startsWith('/') && !q.startsWith('@')
}

/** Multi-word AND match across title, content, and tags (case-insensitive). */
function matchesQuery(note: Note, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const haystack = `${note.title} ${note.content} ${note.tags.join(' ')}`.toLowerCase()
  return tokens.every((tk) => haystack.includes(tk))
}

export function CardWall({ notes: externalNotes, onUpdate, onDelete }: CardWallProps): ReactElement {
  const storeNotes = useNoteStore((s) => s.notes)
  const activeCategory = useNoteStore((s) => s.activeCategory)
  const searchQuery = useNoteStore((s) => s.searchQuery)
  const searchResult = useNoteStore((s) => s.searchResult)
  const setSearchResult = useNoteStore((s) => s.setSearchResult)
  const setSearchQuery = useNoteStore((s) => s.setSearchQuery)
  const isLoading = useNoteStore((s) => s.isLoading)

  const notes = externalNotes ?? (storeNotes as Note[])
  const columnCount = useColumnCount()
  const { t } = useT()

  // AI search result: preserve relevance order (only category filter applies on top).
  const aiResults = useMemo(() => {
    if (!searchResult) return null
    return activeCategory
      ? searchResult.notes.filter((n) => n.category === activeCategory)
      : searchResult.notes
  }, [searchResult, activeCategory])

  // Live keyword filter (plain typing, no `/`), time-sorted.
  const filtered = useMemo(() => {
    let result = notes as Note[]
    if (activeCategory) result = result.filter((n) => n.category === activeCategory)
    if (isPlainKeyword(searchQuery)) {
      result = result.filter((n) => matchesQuery(n, searchQuery))
    }
    return [...result].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [notes, activeCategory, searchQuery])

  const timeGroups = useMemo(() => groupNotesByTime(filtered), [filtered])

  const clearSearch = (): void => {
    setSearchResult(null)
    setSearchQuery('')
  }

  if (isLoading && !externalNotes && !searchResult) {
    return (
      <div className="flex gap-4 p-6">
        {Array.from({ length: columnCount }).map((_, ci) => (
          <div key={ci} className="flex-1 min-w-0 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  // ── AI search result view (relevance-ordered, flat, with header) ──────
  if (aiResults) {
    const cols = distributeColumns(aiResults, columnCount)
    return (
      <div className="px-6 pt-2 pb-6 space-y-3">
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground/60">
          <Search size={13} className="text-primary shrink-0" />
          <span className="font-medium text-foreground/70 truncate max-w-[50%]">{searchResult!.query}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{t('search.resultCount', { n: aiResults.length })}</span>
          <button
            onClick={clearSearch}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={12} />
            {t('search.clear')}
          </button>
        </div>
        {aiResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-muted-foreground/40">
            <FileText size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-medium text-muted-foreground/50">{t('search.noResults')}</p>
          </div>
        ) : (
          <div className="flex gap-4">
            {cols.map((colNotes, ci) => (
              <div key={ci} className="flex-1 min-w-0 space-y-4">
                {colNotes.map((note) => (
                  <CardFactory key={note.id} note={note} onUpdate={onUpdate} onDelete={onDelete} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground/40">
        <FileText size={48} className="mb-4 opacity-20" />
        <p className="text-sm font-medium text-muted-foreground/50">{t('empty.title')}</p>
        <p className="text-xs mt-1 text-muted-foreground/30">使用 ⌥Space 快速记录，或在顶部搜索框输入内容</p>
      </div>
    )
  }

  return (
    <div className="px-6 pt-2 pb-6 space-y-8">
      {timeGroups.map(({ group, notes: groupNotes }) => {
        const cols = distributeColumns(groupNotes, columnCount)
        return (
          <section key={group}>
            <h3 className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-3 px-1">
              {t(TIME_GROUP_LABELS[group] as any)}
              <span className="ml-1.5 text-muted-foreground/25">{groupNotes.length}</span>
            </h3>
            <div className="flex gap-4">
              {cols.map((colNotes, ci) => (
                <div key={ci} className="flex-1 min-w-0 space-y-4">
                  {colNotes.map((note) => (
                    <CardFactory key={note.id} note={note} onUpdate={onUpdate} onDelete={onDelete} />
                  ))}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
