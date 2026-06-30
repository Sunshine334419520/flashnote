import type { TaskInfo, SmartParseResult } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'

/**
 * In-memory task queue for AI processing.
 * Tasks do NOT persist across app restarts.
 */
export class TaskManager {
  private tasks: Map<string, TaskInfo> = new Map()
  private order: string[] = [] // maintain insertion order

  enqueue(noteId: string, rawInput: string): TaskInfo {
    const task: TaskInfo = {
      id: uuidv4(),
      noteId,
      rawInput: rawInput.length > 100 ? rawInput.slice(0, 100) + '...' : rawInput,
      status: 'processing',
      createdAt: new Date().toISOString()
    }

    this.tasks.set(task.id, task)
    this.order.push(task.id)
    return { ...task }
  }

  markDone(
    taskId: string,
    result: SmartParseResult,
    elapsedMs: number
  ): TaskInfo | null {
    const task = this.tasks.get(taskId)
    if (!task) return null

    task.status = 'done'
    task.result = {
      category: result.category,
      tags: result.tags,
      title: result.title,
      elapsedMs
    }
    task.completedAt = new Date().toISOString()
    return { ...task }
  }

  markFailed(taskId: string, error: string): TaskInfo | null {
    const task = this.tasks.get(taskId)
    if (!task) return null

    task.status = 'failed'
    task.error = error
    task.completedAt = new Date().toISOString()
    return { ...task }
  }

  getTask(taskId: string): TaskInfo | null {
    const task = this.tasks.get(taskId)
    return task ? { ...task } : null
  }

  listTasks(): TaskInfo[] {
    return this.order.map((id) => ({ ...this.tasks.get(id)! })).filter(Boolean)
  }
}
