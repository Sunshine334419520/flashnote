import { type ReactElement, type ReactNode } from 'react'
import { useStatusBarStore } from '../../stores/statusBarStore'
import { cn } from '../../lib/cn'

interface Props {
  id: string
  icon: ReactElement
  label: string
  badge?: number
  badgeColor?: string
  children: ReactNode
}

export function StatusBarItem({ id, icon, label, badge, badgeColor = 'bg-type-credential', children: _children }: Props): ReactElement {
  const activePanel = useStatusBarStore((s) => s.activePanel)
  const togglePanel = useStatusBarStore((s) => s.togglePanel)
  const isActive = activePanel === id

  return (
    <button
      onClick={() => togglePanel(id)}
      title={label}
      className={cn(
        'relative flex items-center gap-1.5 px-2.5 h-8 text-micro transition-colors',
        isActive
          ? 'bg-muted/70 text-foreground'
          : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30'
      )}
    >
      {icon}
      {badge != null && badge > 0 && (
        <span className={cn(
          'absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-[8px] font-bold text-white',
          badgeColor
        )}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}
