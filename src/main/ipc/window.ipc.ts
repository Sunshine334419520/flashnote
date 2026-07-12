import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

interface WindowCallbacks {
  showQuickCaptureWindow: () => void
  hideQuickCaptureWindow: () => void
  showSettingsWindow: () => void
  showMainWindow: () => void
}

export function registerWindowIpc(callbacks: WindowCallbacks): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW_SHOW_QUICK_CAPTURE, () => {
    callbacks.showQuickCaptureWindow()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_HIDE_QUICK_CAPTURE, () => {
    callbacks.hideQuickCaptureWindow()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_SET_SIZE, (event, width: number, height: number) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.setBounds({ width, height })
      win.center()
    }
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_SHOW_MAIN, () => {
    callbacks.showMainWindow()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_SHOW_SETTINGS, () => {
    callbacks.showSettingsWindow()
  })
}
