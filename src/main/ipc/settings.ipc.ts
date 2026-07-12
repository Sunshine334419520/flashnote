import { ipcMain, webContents } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getConfig, setConfig, getAllConfig } from '../services/config.service'

function broadcast(channel: string, data: unknown): void {
  for (const wc of webContents.getAllWebContents()) {
    wc.send(channel, data)
  }
}

export interface SettingsCallbacks {
  onHotkeyChange: (hotkey: string) => boolean
}

export function registerSettingsIpc(callbacks: SettingsCallbacks): void {
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

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_HOTKEY, async (_event, hotkey: string) => {
    try {
      const ok = callbacks.onHotkeyChange(hotkey)
      if (!ok) return false
      setConfig('hotkey', hotkey)
      broadcast(IPC_CHANNELS.EVENT_SETTINGS_CHANGED, { key: 'hotkey', value: hotkey })
      return true
    } catch (err) {
      console.error('Failed to set hotkey:', err)
      return false
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, async () => {
    return getAllConfig()
  })
}
