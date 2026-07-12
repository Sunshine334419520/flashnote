import { type ReactElement, useState, useEffect } from 'react'
import type { TaskInfo } from '../../../shared/types'
import { cn } from '../../lib/cn'
import { Check, Loader2, X, RotateCcw } from 'lucide-react'

interface TaskItemProps {
  task: TaskInfo
}

export function TaskItem({ task }: TaskItemProps): ReactElement {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    if (task.status !== 'processing') return
    const start = new Date(task.createdAt).getTime()
    const tick = () => {
      const ms = Date.now() - start
      setElapsed(ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`)
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [task.status, task.createdAt])

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2 text-body border-b border-border/50 last:border-0',
        task.status === 'failed' && 'bg-red-50/50 dark:bg-red-950/20'
      )}
    >
      {/* Status icon */}
      {task.status === 'processing' && (
        <Loader2 size={14} className="text-blue-500 animate-spin shrink-0" />
      )}
      {task.status === 'done' && (
        <Check size={14} className="text-green-500 shrink-0" />
      )}
      {task.status === 'failed' && (
        <X size={14} className="text-red-500 shrink-0" />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <span className="text-foreground/80 truncate block">{task.rawInput}</span>
        {task.result && (
          <span className="text-caption text-muted-foreground">
            {task.result.category} · {task.result.tags.join(', ')}
          </span>
        )}
        {task.error && (
          <span className="text-caption text-red-500 truncate block">{task.error}</span>
        )}
      </div>

      {/* Time */}
      <span className="text-caption text-muted-foreground/60 shrink-0">
        {task.status === 'processing'
          ? elapsed
          : task.result
            ? `${task.result.elapsedMs >= 1000 ? `${(task.result.elapsedMs / 1000).toFixed(1)}s` : `${task.result.elapsedMs}ms`}`
            : ''}
      </span>
    </div>
  )
}
