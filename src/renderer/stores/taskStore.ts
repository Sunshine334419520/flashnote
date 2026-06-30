import { create } from 'zustand'
import type { TaskInfo } from '../../shared/types'

interface TaskState {
  tasks: TaskInfo[]
  isPanelOpen: boolean

  fetchTasks: () => Promise<void>
  addTask: (task: TaskInfo) => void
  updateTask: (task: TaskInfo) => void
  togglePanel: () => void

  getActiveCount: () => number
  getFailedCount: () => number
  getSummary: () => string
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isPanelOpen: false,

  fetchTasks: async () => {
    try {
      const tasks = await window.electronAPI.tasks.list()
      set({ tasks })
    } catch {
      // silently ignore
    }
  },

  addTask: (task) => {
    set((s) => ({ tasks: [task, ...s.tasks] }))
  },

  updateTask: (task) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === task.id ? task : t))
    }))
  },

  togglePanel: () => {
    set((s) => ({ isPanelOpen: !s.isPanelOpen }))
  },

  getActiveCount: () => {
    return get().tasks.filter((t) => t.status === 'processing').length
  },

  getFailedCount: () => {
    return get().tasks.filter((t) => t.status === 'failed').length
  },

  getSummary: () => {
    const active = get().getActiveCount()
    const failed = get().getFailedCount()
    const done = get().tasks.filter((t) => t.status === 'done').length

    if (active > 0) return `${active} processing...`
    if (failed > 0) return `${failed} failed, ${done} completed`
    if (done > 0) return 'All completed'
    return ''
  }
}))
