import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getConfig, setConfig, getAllConfig } from '../services/config.service'

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
