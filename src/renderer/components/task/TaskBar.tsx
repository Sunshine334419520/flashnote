import type { ReactElement } from 'react'
import { useTaskStore } from '../../stores/taskStore'
import { TaskPanel } from './TaskPanel'
import { Loader2, Check, X, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/cn'

export function TaskBar(): ReactElement {
  const summary = useTaskStore((s) => s.getSummary())
  const activeCount = useTaskStore((s) => s.getActiveCount())
  const failedCount = useTaskStore((s) => s.getFailedCount())
  const isPanelOpen = useTaskStore((s) => s.isPanelOpen)
  const togglePanel = useTaskStore((s) => s.togglePanel)

  if (!summary) {
    return (
      <div className="shrink-0 h-8 flex items-center px-6 border-t border-border/40 bg-background/80 backdrop-blur-sm">
        <span className="text-micro text-muted-foreground/35">就绪</span>
      </div>
    )
  }

  return (
    <div className="shrink-0 border-t border-border/40 bg-background/80 backdrop-blur-sm">
      {isPanelOpen && <TaskPanel />}
      <button
        onClick={togglePanel}
        className={cn(
          'w-full h-8 flex items-center gap-2 px-6 text-caption transition-colors',
          activeCount > 0
            ? 'bg-primary/5 text-primary'
            : failedCount > 0
              ? 'bg-red-50/50 dark:bg-red-950/20 text-red-500'
              : 'text-muted-foreground/50 hover:bg-muted/30'
        )}
      >
        {activeCount > 0 && <Loader2 size={12} className="animate-spin" />}
        {activeCount === 0 && failedCount > 0 && <X size={12} />}
        {activeCount === 0 && failedCount === 0 && <Check size={12} className="text-emerald-500" />}

        <span className="flex-1 text-left">{summary}</span>

        <ChevronUp
          size={12}
          className={cn('transition-transform text-muted-foreground/40', isPanelOpen ? 'rotate-0' : 'rotate-180')}
        />
      </button>
    </div>
  )
}
