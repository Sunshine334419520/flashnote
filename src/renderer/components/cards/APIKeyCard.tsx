import { type ReactElement, useState } from 'react'
import type { Note } from '../../../shared/types'
import { Copy, Key, Eye, EyeOff } from 'lucide-react'
import { cn } from '../../lib/cn'

interface Props { note: Note }

export function APIKeyCard({ note }: Props): ReactElement {
  const [revealed, setRevealed] = useState(false)
  const service = (note.typedData as Record<string, string>)?.service ?? ''

  const masked = note.content.length > 8
    ? note.content.slice(0, 6) + '...' + note.content.slice(-4)
    : note.content

  const handleCopy = () => {
    navigator.clipboard.writeText(note.content)
  }

  return (
    <div className={cn('rounded-xl border p-4 space-y-2 bg-card hover:border-primary/30 transition-colors', note.sensitive && 'border-amber-200 dark:border-amber-800')}>
      <div className="flex items-center gap-2">
        <Key size={16} className="text-amber-500 shrink-0" />
        <span className="text-sm font-medium truncate">{note.title}</span>
        {service && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{service}</span>}
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[13px] font-mono text-muted-foreground bg-muted/30 rounded-lg px-2 py-1.5 truncate select-all">
          {note.sensitive && !revealed ? masked : note.content}
        </code>
        <button onClick={() => setRevealed(!revealed)} className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title={revealed ? 'Hide' : 'Reveal'}>
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <button onClick={handleCopy} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
        <Copy size={12} /> Copy key
      </button>
    </div>
  )
}
