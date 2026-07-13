import { type ReactElement, type ReactNode, useEffect, useRef } from 'react'
import { useStatusBarStore } from '../../stores/statusBarStore'
import { cn } from '../../lib/cn'

interface Props {
  id: string
  icon: ReactElement
  label: string
  text?: string
  badge?: number
  badgeColor?: string
  /** Show a simple colored dot instead of a numbered badge. */
  dot?: boolean
  children: ReactNode
}

export function StatusBarItem({ id, icon, label, text, badge, badgeColor = 'bg-type-credential', dot = false, children }: Props): ReactElement {
  const activePanel = useStatusBarStore((s) => s.activePanel)
  const togglePanel = useStatusBarStore((s) => s.togglePanel)
  const closePanel = useStatusBarStore((s) => s.closePanel)
  const isActive = activePanel === id
  const ref = useRef<HTMLDivElement>(null)

  // Close panel on click outside
  useEffect(() => {
    if (!isActive) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closePanel()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isActive, closePanel])

  return (
    <div ref={ref} className="relative">
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
        {dot ? (
          <span className="relative inline-flex">
            {icon}
            {badge != null && badge > 0 && (
              <span className={cn(
                'absolute -top-0.5 -right-0.5 w-[6px] h-[6px] rounded-full',
                badgeColor
              )} />
            )}
          </span>
        ) : (
          <>
            {icon}
            {badge != null && badge > 0 && (
              <span className={cn(
                'absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-[8px] font-bold text-white',
                badgeColor
              )}>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </>
        )}
        {text && (
          <span className="truncate max-w-[80px]">{text}</span>
        )}
      </button>

      {/* Floating panel — positioned above the icon, left-aligned */}
      {isActive && (
        <div className="absolute bottom-full left-0 ml-2 mb-1 w-[300px] bg-card rounded-lg border border-border shadow-lg z-50 flex flex-col overflow-hidden" style={{ maxHeight: '280px' }}>
          {children}
        </div>
      )}
    </div>
  )
}
