import { ipcMain, webContents } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getConfig, setConfig, getAllConfig } from '../services/config.service'

function broadcast(channel: string, data: unknown): void {
  for (const wc of webContents.getAllWebContents()) {
    wc.send(channel, data)
  }
}

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_event, key: string) => {
    try {
      return (getAllConfig() as Record<string, unknown>)[key] ?? null
    } catch {
      return null
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, args: { key: string; value: unknown }) => {
    try {
      setConfig(args.key as never, args.value as never)
      broadcast(IPC_CHANNELS.EVENT_SETTINGS_CHANGED, { key: args.key, value: args.value })
      return true
    } catch (err) {
      console.error('Failed to save setting:', err)
      return false
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, async () => {
    return getAllConfig()
  })
}
