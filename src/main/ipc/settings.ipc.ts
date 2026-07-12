import { ipcMain, webContents } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getConfig, setConfig, getAllConfig } from '../services/config.service'
import { safeHandler } from '../utils/safeHandler'

function broadcast(channel: string, data: unknown): void {
  for (const wc of webContents.getAllWebContents()) {
    wc.send(channel, data)
  }
}

export interface SettingsCallbacks {
  onHotkeyChange: (hotkey: string) => boolean
}

export function registerSettingsIpc(callbacks: SettingsCallbacks): void {
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_GET,
    safeHandler('settings:get', async (_event, key: string) => {
      try {
        return (getAllConfig() as Record<string, unknown>)[key] ?? null
      } catch {
        return null
      }
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    safeHandler('settings:set', async (_event, args: { key: string; value: unknown }) => {
      setConfig(args.key as never, args.value as never)
      broadcast(IPC_CHANNELS.EVENT_SETTINGS_CHANGED, { key: args.key, value: args.value })
      return true
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET_HOTKEY,
    safeHandler('settings:set-hotkey', async (_event, hotkey: string) => {
      const ok = callbacks.onHotkeyChange(hotkey)
      if (!ok) return false
      setConfig('hotkey', hotkey)
      broadcast(IPC_CHANNELS.EVENT_SETTINGS_CHANGED, { key: 'hotkey', value: hotkey })
      return true
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_GET_ALL,
    safeHandler('settings:getAll', async () => {
      return getAllConfig()
    })
  )
}
