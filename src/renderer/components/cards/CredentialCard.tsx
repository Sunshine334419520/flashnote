import { type ReactElement, useState } from 'react'
import type { Note } from '../../../shared/types'
import { Copy, Lock, Eye, EyeOff } from 'lucide-react'

interface Props { note: Note }

export function CredentialCard({ note }: Props): ReactElement {
  const [revealed, setRevealed] = useState(false)

  // Mask numbers, show last 4
  const masked = note.content.replace(/\d/g, '*').replace(/(\*{4})$/, (m: string) => note.content.slice(-4))

  const handleCopyFull = () => navigator.clipboard.writeText(note.content)

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 p-4 space-y-2 bg-card hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-2">
        <Lock size={16} className="text-amber-500 shrink-0" />
        <span className="text-sm font-medium truncate">{note.title}</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[13px] font-mono text-muted-foreground bg-muted/30 rounded-lg px-2 py-1.5">
          {revealed ? note.content : masked}
        </code>
        <button onClick={() => setRevealed(!revealed)} className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title={revealed ? 'Hide' : 'Reveal'}>
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <button onClick={handleCopyFull} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
        <Copy size={12} /> Copy full
      </button>
    </div>
  )
}
