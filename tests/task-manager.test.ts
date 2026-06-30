import { describe, it, expect } from 'vitest'
import { TaskManager } from '@services/task-manager'

describe('TaskManager', () => {
  it('enqueues a task with processing status', () => {
    const tm = new TaskManager()
    const task = tm.enqueue('note-1', 'sk-xxx my api key')
    expect(task.status).toBe('processing')
    expect(task.noteId).toBe('note-1')
    expect(task.rawInput).toContain('sk-xxx')
  })

  it('marks task as done', () => {
    const tm = new TaskManager()
    const task = tm.enqueue('note-1', 'test input')
    const done = tm.markDone(task.id, {
      cleanedContent: 'test',
      type: 'apikey',
      category: 'API Keys',
      tags: ['api-key'],
      title: 'Test Key',
      sensitive: true
    }, 1500)

    expect(done).not.toBeNull()
    expect(done!.status).toBe('done')
    expect(done!.result!.elapsedMs).toBe(1500)
    expect(done!.result!.category).toBe('API Keys')
    expect(done!.completedAt).toBeDefined()
  })

  it('marks task as failed', () => {
    const tm = new TaskManager()
    const task = tm.enqueue('note-1', 'test input')
    const failed = tm.markFailed(task.id, 'API timeout')

    expect(failed).not.toBeNull()
    expect(failed!.status).toBe('failed')
    expect(failed!.error).toBe('API timeout')
  })

  it('lists tasks in insertion order', () => {
    const tm = new TaskManager()
    const t1 = tm.enqueue('n1', 'first')
    const t2 = tm.enqueue('n2', 'second')
    const list = tm.listTasks()
    expect(list).toHaveLength(2)
    expect(list[0].id).toBe(t1.id)
    expect(list[1].id).toBe(t2.id)
  })

  it('returns null for non-existent task', () => {
    const tm = new TaskManager()
    expect(tm.getTask('nonexistent')).toBeNull()
    expect(tm.markDone('nonexistent', {} as never, 0)).toBeNull()
    expect(tm.markFailed('nonexistent', '')).toBeNull()
  })

  it('truncates long input for display', () => {
    const tm = new TaskManager()
    const task = tm.enqueue('note-1', 'a'.repeat(200))
    expect(task.rawInput).toHaveLength(103) // 100 + '...'
  })
})
