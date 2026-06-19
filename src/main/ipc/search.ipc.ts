import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getNotes } from '../services/storage.service'
import type { SearchQuery } from '../../shared/types'

export function registerSearchIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SEARCH_QUERY, async (_event, query: SearchQuery) => {
    return getNotes(query)
  })
}
