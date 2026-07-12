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
    <>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 h-8">
        <span className="text-micro font-medium text-muted-foreground/70">{title}</span>
        <button
          onClick={closePanel}
          className="p-0.5 rounded text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-border/40" />

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </>
  )
}
