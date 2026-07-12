import { type ReactElement, useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { useNoteStore } from '../../stores/noteStore'
import { NoteCard } from './NoteCard'
import { FileText } from 'lucide-react'

export function NoteListPanel(): ReactElement {
  const notes = useNoteStore((s) => s.notes)
  const activeCategory = useNoteStore((s) => s.activeCategory)
  const searchQuery = useNoteStore((s) => s.searchQuery)
  const selectedNoteId = useNoteStore((s) => s.selectedNoteId)
  const selectNote = useNoteStore((s) => s.selectNote)
  const isLoading = useNoteStore((s) => s.isLoading)

  const filteredNotes = useMemo(() => {
    let filtered = notes
    if (activeCategory) {
      filtered = filtered.filter((n) => n.category === activeCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    return filtered
  }, [notes, activeCategory, searchQuery])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="space-y-3 w-full px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-3/4 bg-muted/50 rounded animate-pulse" />
              <div className="h-3 w-full bg-muted/30 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-muted/30 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (filteredNotes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 px-4">
        <FileText size={32} className="mb-2 opacity-40" />
        <p className="text-body">No notes</p>
        <p className="text-label mt-1 text-center">Press Alt+Space to capture your first note</p>
      </div>
    )
  }

  return (
    <div className="h-full">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-label text-muted-foreground">
          {filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''}
        </p>
      </div>
      <Virtuoso
        totalCount={filteredNotes.length}
        itemContent={(index) => (
          <NoteCard
            key={filteredNotes[index].id}
            note={filteredNotes[index]}
            isSelected={filteredNotes[index].id === selectedNoteId}
            onClick={() => selectNote(filteredNotes[index].id)}
          />
        )}
        style={{ height: 'calc(100% - 41px)' }}
      />
    </div>
  )
}
