import type { ReactElement } from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { Note } from '../../../shared/types'
import { cn } from '../../lib/cn'

interface NoteCardProps {
  note: Note
  isSelected: boolean
  onClick: () => void
}

export function NoteCard({ note, isSelected, onClick }: NoteCardProps): ReactElement {
  const preview =
    note.content.slice(0, 150).replace(/\n/g, ' ') + (note.content.length > 150 ? '...' : '')

  const timeAgo = formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-border/50 transition-colors',
        isSelected ? 'bg-accent/50 border-l-2 border-l-primary' : 'hover:bg-muted/30'
      )}
    >
      <h3 className="text-body font-medium truncate mb-0.5">{note.title}</h3>
      <p className="text-label text-muted-foreground line-clamp-2 leading-relaxed mb-2">
        {preview}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {note.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="text-micro px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground"
          >
            {tag}
          </span>
        ))}
        <span className="text-micro text-muted-foreground/50 ml-auto">{timeAgo}</span>
      </div>
    </button>
  )
}
