import type { ReactElement } from 'react'
import type { Note } from '../../../shared/types'
import { FileText } from 'lucide-react'

interface Props { note: Note }

export function TextCard({ note }: Props): ReactElement {
  const preview = note.content.length > 120 ? note.content.slice(0, 120) + '...' : note.content

  return (
    <div className="rounded-xl border p-4 space-y-2 bg-card hover:border-primary/30 transition-colors cursor-pointer">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{note.title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{preview}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {note.tags.slice(0, 3).map((t) => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{t}</span>
        ))}
      </div>
    </div>
  )
}
