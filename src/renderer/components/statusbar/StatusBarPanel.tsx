import { type ReactElement, type ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
}

export function StatusBarPanel({ title, children }: Props): ReactElement {
  return (
    <>
      {/* Header */}
      <div className="shrink-0 flex items-center px-3 h-8">
        <span className="text-micro font-medium text-muted-foreground/70">{title}</span>
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

