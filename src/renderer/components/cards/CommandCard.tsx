import type { ReactElement } from 'react'
import type { Note } from '../../../shared/types'
import { Copy, Terminal } from 'lucide-react'

interface Props { note: Note }

export function CommandCard({ note }: Props): ReactElement {
  const handleCopy = () => navigator.clipboard.writeText(note.content)

  return (
    <div className="rounded-xl border p-4 space-y-2 bg-card hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-2">
        <Terminal size={16} className="text-green-500 shrink-0" />
        <span className="text-sm font-medium truncate">{note.title}</span>
      </div>
      <pre className="text-[13px] font-mono text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap max-h-24 overflow-y-auto select-all">
        {note.content}
      </pre>
      <button onClick={handleCopy} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
        <Copy size={12} /> Copy command
      </button>
    </div>
  )
}
