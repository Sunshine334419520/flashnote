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

  if (!summary) return <div className="h-7 bg-muted/30 border-t border-border" />

  return (
    <div className="shrink-0">
      {isPanelOpen && <TaskPanel />}
      <button
        onClick={togglePanel}
        className={cn(
          'w-full h-7 flex items-center gap-2 px-3 text-[11px] font-medium transition-colors border-t border-border',
          activeCount > 0
            ? 'bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400'
            : failedCount > 0
              ? 'bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
              : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
        )}
      >
        {activeCount > 0 && <Loader2 size={12} className="animate-spin" />}
        {activeCount === 0 && failedCount > 0 && <X size={12} />}
        {activeCount === 0 && failedCount === 0 && <Check size={12} className="text-green-500" />}

        <span className="flex-1 text-left">{summary}</span>

        <ChevronUp
          size={12}
          className={cn(
            'transition-transform',
            isPanelOpen ? 'rotate-0' : 'rotate-180'
          )}
        />
      </button>
    </div>
  )
}
