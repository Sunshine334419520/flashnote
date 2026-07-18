import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getConfig, setConfig, getAllConfig } from '../services/config.service'
import { safeHandler } from '../utils/safeHandler'
import { broadcast } from '../utils/broadcast'
import { CONFIG_KEYS } from '../../shared/constants'

export interface SettingsCallbacks {
  onHotkeyChange: (hotkey: string) => boolean
}

export function registerSettingsIpc(callbacks: SettingsCallbacks): void {
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_GET,
    safeHandler(IPC_CHANNELS.SETTINGS_GET, async (_event, key: string) => {
      try {
        return (getAllConfig() as Record<string, unknown>)[key] ?? null
      } catch {
        return null
      }
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    safeHandler(IPC_CHANNELS.SETTINGS_SET, async (_event, args: { key: string; value: unknown }) => {
      setConfig(args.key as never, args.value as never)
      broadcast(IPC_CHANNELS.EVENT_SETTINGS_CHANGED, { key: args.key, value: args.value })
      return true
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET_HOTKEY,
    safeHandler(IPC_CHANNELS.SETTINGS_SET_HOTKEY, async (_event, hotkey: string) => {
      const ok = callbacks.onHotkeyChange(hotkey)
      if (!ok) return false
      setConfig(CONFIG_KEYS.HOTKEY as never, hotkey as never)
      broadcast(IPC_CHANNELS.EVENT_SETTINGS_CHANGED, { key: CONFIG_KEYS.HOTKEY, value: hotkey })
      return true
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_GET_ALL,
    safeHandler(IPC_CHANNELS.SETTINGS_GET_ALL, async () => {
      return getAllConfig()
    })
  )
}
