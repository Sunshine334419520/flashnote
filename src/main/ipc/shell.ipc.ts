import { ipcMain, shell } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

/**
 * Shell IPC — privileged operations the renderer cannot perform directly
 * (contextBridge / contextIsolation boundary). Only http(s) URLs are allowed.
 */
export function registerShellIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, (_event, url: unknown) => {
    if (typeof url !== 'string') return
    // Restrict to http(s) to prevent arbitrary scheme/file URIs from the renderer.
    if (!/^https?:\/\//i.test(url)) return
    void shell.openExternal(url)
  })
}
