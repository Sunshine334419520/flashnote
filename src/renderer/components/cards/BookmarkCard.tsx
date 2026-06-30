import type { ReactElement } from 'react'
import type { Note } from '../../../shared/types'
import { Copy, ExternalLink, Globe } from 'lucide-react'

interface Props { note: Note }

export function BookmarkCard({ note }: Props): ReactElement {
  const url = (note.typedData as Record<string, string>)?.url ?? note.content
  const domain = (note.typedData as Record<string, string>)?.domain ?? ''

  const handleOpen = () => {
    // Use shell.openExternal via IPC... but for now, just copy
    navigator.clipboard.writeText(url)
  }

  const handleCopyLink = () => navigator.clipboard.writeText(url)

  return (
    <div className="rounded-xl border p-4 space-y-2 bg-card hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-2">
        <Globe size={16} className="text-blue-500 shrink-0" />
        <span className="text-sm font-medium truncate">{note.title}</span>
      </div>
      {domain && <p className="text-[11px] text-muted-foreground truncate">{domain}</p>}
      <p className="text-xs text-muted-foreground/70 truncate">{url}</p>
      <div className="flex items-center gap-3">
        <button onClick={handleOpen} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <ExternalLink size={12} /> Open
        </button>
        <button onClick={handleCopyLink} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <Copy size={12} /> Copy link
        </button>
      </div>
    </div>
  )
}
