import type { ReactElement } from 'react'
import { useTaskStore } from '../../stores/taskStore'
import { TaskItem } from './TaskItem'
import { ListChecks } from 'lucide-react'

export function TaskPanel(): ReactElement {
  const tasks = useTaskStore((s) => s.tasks)

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground/50 text-label">
        <ListChecks size={16} className="mr-2 opacity-40" />
        No tasks yet
      </div>
    )
  }

  return (
    <div className="max-h-48 overflow-y-auto bg-card border-t border-border">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  )
}
