import { registerNotesIpc } from './notes.ipc'
import { registerAIIpc } from './ai.ipc'
import { registerSearchIpc } from './search.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerWindowIpc } from './window.ipc'
import { registerShellIpc } from './shell.ipc'
import type { AIService } from '../services/ai'
import type { TaskManager } from '../services/task-manager'

export interface ServiceContext {
  storagePath: string
  aiService: AIService
  taskManager: TaskManager
  showQuickCaptureWindow: () => void
  hideQuickCaptureWindow: () => void
  showSettingsWindow: () => void
  showMainWindow: () => void
}

export function registerAllIpcHandlers(ctx: ServiceContext): void {
  registerNotesIpc(ctx.aiService, ctx.taskManager)
  registerAIIpc(ctx.aiService)
  registerSearchIpc()
  registerSettingsIpc()
  registerShellIpc()
  registerWindowIpc({
    showQuickCaptureWindow: ctx.showQuickCaptureWindow,
    hideQuickCaptureWindow: ctx.hideQuickCaptureWindow,
    showSettingsWindow: ctx.showSettingsWindow,
    showMainWindow: ctx.showMainWindow
  })
}
