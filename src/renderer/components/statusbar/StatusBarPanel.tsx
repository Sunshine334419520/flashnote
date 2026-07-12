import { type ReactElement, type ReactNode } from 'react'
import { useStatusBarStore } from '../../stores/statusBarStore'
import { X } from 'lucide-react'

interface Props {
  title: string
  children: ReactNode
}

export function StatusBarPanel({ title, children }: Props): ReactElement {
  const closePanel = useStatusBarStore((s) => s.closePanel)

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-30 flex flex-col" style={{ maxHeight: '40vh' }}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 h-9 border-b border-border/50">
        <span className="text-caption font-medium text-muted-foreground">{title}</span>
        <button
          onClick={closePanel}
          className="p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
