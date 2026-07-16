import { create } from 'zustand'
import type { CloudConnection, CloudServiceType, SyncProgress, SyncResult } from '../../shared/types'

export interface SyncRecord {
  id: string
  status: 'success' | 'failed'
  message: string
  createdAt: string
}

const MAX_RECORDS = 60

interface CloudSyncState {
  connection: CloudConnection | null
  syncProgress: SyncProgress | null
  isLoading: boolean
  syncRecords: SyncRecord[]

  fetchStatus: () => Promise<void>
  connect: (service: CloudServiceType) => Promise<void>
  disconnect: () => Promise<void>
  sync: () => Promise<SyncResult | null>
  pull: () => Promise<number>

  setConnection: (connection: CloudConnection | null) => void
  setSyncProgress: (progress: SyncProgress | null) => void
  addSyncRecord: (record: SyncRecord) => void
}

export const useCloudSyncStore = create<CloudSyncState>((set, get) => ({
  connection: null,
  syncProgress: null,
  isLoading: false,
  syncRecords: [],

  fetchStatus: async () => {
    set({ isLoading: true })
    try {
      const connection = await window.electronAPI.cloud.getStatus()
      set({ connection, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  connect: async (service) => {
    set({ isLoading: true })
    try {
      const { connection, authUrl } = await window.electronAPI.cloud.connect(service)
      set({ connection, isLoading: false })

      // Open the browser for OAuth
      if (authUrl) {
        await window.electronAPI.shell.openExternal(authUrl)
      }
    } catch (err) {
      console.error('Failed to connect cloud:', err)
      set({ isLoading: false })
      throw err
    }
  },

  disconnect: async () => {
    set({ isLoading: true })
    try {
      await window.electronAPI.cloud.disconnect()
      set({ connection: null, syncProgress: null })
    } catch (err) {
      console.error('Failed to disconnect cloud:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  sync: async () => {
    try {
      const result = await window.electronAPI.cloud.sync()
      get().addSyncRecord({
        id: crypto.randomUUID(),
        status: result.errors.length === 0 ? 'success' : 'failed',
        message: result.errors.length === 0
          ? `${result.pushed} up, ${result.pulled} down`
          : result.errors[0],
        createdAt: new Date().toISOString()
      })
      return result
    } catch (err) {
      console.error('Sync failed:', err)
      get().addSyncRecord({
        id: crypto.randomUUID(),
        status: 'failed',
        message: (err as Error).message,
        createdAt: new Date().toISOString()
      })
      return null
    }
  },

  pull: async () => {
    try {
      const result = await window.electronAPI.cloud.pull()
      return result.imported
    } catch (err) {
      console.error('Pull failed:', err)
      return 0
    }
  },

  setConnection: (connection) => set({ connection }),

  setSyncProgress: (progress) => set({ syncProgress: progress }),

  addSyncRecord: (record) => {
    set((s) => ({
      syncRecords: [record, ...s.syncRecords].slice(0, MAX_RECORDS)
    }))
  }
}))
