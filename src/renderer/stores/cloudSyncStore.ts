import { create } from 'zustand'
import type { CloudConnection, CloudServiceType, SyncProgress, SyncResult } from '../../shared/types'

export interface LastSyncResult {
  status: 'success' | 'failed'
  message: string
  at: string
}

interface CloudSyncState {
  connection: CloudConnection | null
  syncProgress: SyncProgress | null
  isLoading: boolean
  lastSyncResult: LastSyncResult | null

  fetchStatus: () => Promise<void>
  connect: (service: CloudServiceType) => Promise<void>
  disconnect: () => Promise<void>
  sync: () => Promise<SyncResult | null>
  pull: () => Promise<number>

  setConnection: (connection: CloudConnection | null) => void
  setSyncProgress: (progress: SyncProgress | null) => void
  setLastSyncResult: (result: LastSyncResult | null) => void
}

export const useCloudSyncStore = create<CloudSyncState>((set, get) => ({
  connection: null,
  syncProgress: null,
  isLoading: false,
  lastSyncResult: null,

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
      set({ connection: null, syncProgress: null, lastSyncResult: null })
    } catch (err) {
      console.error('Failed to disconnect cloud:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  sync: async () => {
    try {
      const result = await window.electronAPI.cloud.sync()
      const outcome: LastSyncResult = {
        status: result.errors.length === 0 ? 'success' : 'failed',
        message: result.errors.length === 0
          ? `${result.pushed} up, ${result.pulled} down`
          : result.errors[0],
        at: new Date().toISOString()
      }
      set({ lastSyncResult: outcome })
      return result
    } catch (err) {
      const outcome: LastSyncResult = {
        status: 'failed',
        message: (err as Error).message,
        at: new Date().toISOString()
      }
      set({ lastSyncResult: outcome })
      console.error('Sync failed:', err)
      return null
    }
  },

  pull: async () => {
    try {
      const result = await window.electronAPI.cloud.pull()
      const outcome: LastSyncResult = {
        status: 'success',
        message: `${result.imported} imported`,
        at: new Date().toISOString()
      }
      set({ lastSyncResult: outcome })
      return result.imported
    } catch (err) {
      console.error('Pull failed:', err)
      return 0
    }
  },

  setConnection: (connection) => set({ connection }),

  setSyncProgress: (progress) => set({ syncProgress: progress }),

  setLastSyncResult: (result) => set({ lastSyncResult: result })
}))
