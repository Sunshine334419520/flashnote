import { type ReactElement, useMemo } from 'react'
import { useNoteStore } from '../../stores/noteStore'
import { CardFactory } from './CardFactory'
import { FileText } from 'lucide-react'
import type { Note } from '../../../shared/types'

export function CardWall(): ReactElement {
  const notes = useNoteStore((s) => s.notes)
  const activeCategory = useNoteStore((s) => s.activeCategory)
  const searchQuery = useNoteStore((s) => s.searchQuery)
  const isLoading = useNoteStore((s) => s.isLoading)
  const selectNote = useNoteStore((s) => s.selectNote)

  const filtered = useMemo(() => {
    let result = notes as Note[]
    if (activeCategory) result = result.filter((n) => n.category === activeCategory)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      // Short keyword = local filter
      if (!q.includes(' ')) {
        result = result.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.tags.some((t) => t.toLowerCase().includes(q))
        )
      }
    }
    // Sort by updatedAt desc
    return [...result].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [notes, activeCategory, searchQuery])

  if (isLoading) {
    return <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />)}</div>
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50">
        <FileText size={40} className="mb-3 opacity-30" />
        <p className="text-sm font-medium">No notes yet</p>
        <p className="text-xs mt-1">Press Alt+Space to capture your first note</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4 content-start">
      {filtered.map((note) => (
        <div key={note.id} onClick={() => selectNote(note.id)}>
          <CardFactory note={note} />
        </div>
      ))}
    </div>
  )
}
