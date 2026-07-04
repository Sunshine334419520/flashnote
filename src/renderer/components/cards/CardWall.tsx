import { type ReactElement, useMemo, useState, useEffect } from 'react'
import { useNoteStore } from '../../stores/noteStore'
import { CardFactory } from './CardFactory'
import { FileText } from 'lucide-react'
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

export function CardWall({ notes: externalNotes, onUpdate, onDelete }: CardWallProps): ReactElement {
  const storeNotes = useNoteStore((s) => s.notes)
  const activeCategory = useNoteStore((s) => s.activeCategory)
  const searchQuery = useNoteStore((s) => s.searchQuery)
  const isLoading = useNoteStore((s) => s.isLoading)

  const notes = externalNotes ?? (storeNotes as Note[])
  const columnCount = useColumnCount()

  const filtered = useMemo(() => {
    let result = notes as Note[]
    if (activeCategory) result = result.filter((n) => n.category === activeCategory)
    if (searchQuery.trim() && !searchQuery.trim().startsWith('@')) {
      const q = searchQuery.toLowerCase()
      if (!q.includes(' ')) {
        result = result.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.tags.some((t) => t.toLowerCase().includes(q))
        )
      }
    }
    return [...result].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [notes, activeCategory, searchQuery])

  const timeGroups = useMemo(() => groupNotesByTime(filtered), [filtered])

  if (isLoading && !externalNotes) {
    return (
      <div className="flex gap-4 p-6">
        {Array.from({ length: columnCount }).map((_, ci) => (
          <div key={ci} className="flex-1 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground/40">
        <FileText size={48} className="mb-4 opacity-20" />
        <p className="text-sm font-medium text-muted-foreground/50">没有笔记</p>
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
              {TIME_GROUP_LABELS[group]}
              <span className="ml-1.5 text-muted-foreground/25">{groupNotes.length}</span>
            </h3>
            <div className="flex gap-4">
              {cols.map((colNotes, ci) => (
                <div key={ci} className="flex-1 space-y-4">
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
