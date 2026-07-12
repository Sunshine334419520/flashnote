import type { ReactElement } from 'react'
import { cn } from '../../lib/cn'

interface CategoryItemProps {
  name: string
  count: number
  isActive: boolean
  onClick: () => void
}

export function CategoryItem({ name, count, isActive, onClick }: CategoryItemProps): ReactElement {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-body transition-colors text-left',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-foreground/80 hover:bg-muted/50'
      )}
    >
      <span className="truncate">{name}</span>
      <span
        className={cn(
          'text-caption rounded-full px-1.5 py-0.5 min-w-[20px] text-center',
          isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
        )}
      >
        {count}
      </span>
    </button>
  )
}
