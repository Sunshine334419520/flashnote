import { type ReactElement, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export function StatusBar({ children }: Props): ReactElement {
  return (
    <div className="shrink-0 h-8 flex items-center border-t border-border/40 bg-background/80 backdrop-blur-sm overflow-visible pl-2">
      {children}
      <div className="flex-1" />
    </div>
  )
}
