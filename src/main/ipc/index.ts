import { registerNotesIpc } from './notes.ipc'
import { registerAIIpc } from './ai.ipc'
import { registerAICommandIpc } from './ai-command.ipc'
import { registerSearchIpc } from './search.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerCloudSyncIpc } from './cloud-sync.ipc'
import type { SettingsCallbacks } from './settings.ipc'
import { registerWindowIpc } from './window.ipc'
import { registerShellIpc } from './shell.ipc'
import type { AIService } from '../services/ai'
import type { AICommandService } from '../services/ai/command.service'
import type { TaskManager } from '../services/task-manager'
import type { CloudSyncService } from '../services/cloud/cloud-sync.service'

export interface ServiceContext {
  storagePath: string
  aiService: AIService
  aiCommandService: AICommandService
  taskManager: TaskManager
  cloudSyncService: CloudSyncService
  showQuickCaptureWindow: () => void
  hideQuickCaptureWindow: () => void
  showSettingsWindow: () => void
  showMainWindow: () => void
  settingsCallbacks: SettingsCallbacks
}

export function registerAllIpcHandlers(ctx: ServiceContext): void {
  registerNotesIpc(ctx.aiService, ctx.taskManager, ctx.cloudSyncService)
  registerAIIpc(ctx.aiService)
  registerAICommandIpc(ctx.aiCommandService)
  registerSearchIpc()
  registerSettingsIpc(ctx.settingsCallbacks)
  registerCloudSyncIpc(ctx.cloudSyncService)
  registerShellIpc()
  registerWindowIpc({
    showQuickCaptureWindow: ctx.showQuickCaptureWindow,
    hideQuickCaptureWindow: ctx.hideQuickCaptureWindow,
    showSettingsWindow: ctx.showSettingsWindow,
    showMainWindow: ctx.showMainWindow
  })
}
