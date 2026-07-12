import { create } from 'zustand'
import type { AIOperationRecord } from '../../shared/types'

const STORAGE_KEY = 'flashnote.aiRecords'
const MAX_RECORDS = 60

function loadRecords(): AIOperationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AIOperationRecord[]) : []
  } catch {
    return []
  }
}

function persistRecords(records: AIOperationRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

interface StatusBarState {
  activePanel: string | null
  aiRecords: AIOperationRecord[]

  togglePanel: (id: string) => void
  closePanel: () => void
  addRecord: (record: AIOperationRecord) => void
  removeRecord: (id: string) => void
  clearRecords: () => void

  getFailedCount: () => number
  getActiveCount: () => number
}

export const useStatusBarStore = create<StatusBarState>((set, get) => ({
  activePanel: null,
  aiRecords: loadRecords(),

  togglePanel: (id) => {
    set((s) => ({ activePanel: s.activePanel === id ? null : id }))
  },

  closePanel: () => {
    set({ activePanel: null })
  },

  addRecord: (record) => {
    set((s) => {
      const next = [record, ...s.aiRecords].slice(0, MAX_RECORDS)
      persistRecords(next)
      return { aiRecords: next }
    })
  },

  removeRecord: (id) => {
    set((s) => {
      const next = s.aiRecords.filter((r) => r.id !== id)
      persistRecords(next)
      return { aiRecords: next }
    })
  },

  clearRecords: () => {
    persistRecords([])
    set({ aiRecords: [] })
  },

  getFailedCount: () => get().aiRecords.filter((r) => r.status === 'failed').length,

  getActiveCount: () => get().aiRecords.filter((r) => r.status === 'processing').length
}))
