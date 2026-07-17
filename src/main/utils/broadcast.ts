import { webContents } from 'electron'

/**
 * Send an event to all open renderer windows.
 * Use this shared utility — do NOT redefine locally in each IPC file.
 */
export function broadcast(channel: string, data: unknown): void {
  for (const wc of webContents.getAllWebContents()) {
    wc.send(channel, data)
  }
}
