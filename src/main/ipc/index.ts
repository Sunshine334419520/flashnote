import { registerNotesIpc } from './notes.ipc'
import { registerAIIpc } from './ai.ipc'
import { registerSearchIpc } from './search.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerWindowIpc } from './window.ipc'
import type { AIService } from '../services/ai'

export interface ServiceContext {
  storagePath: string
  aiService: AIService
  showQuickCaptureWindow: () => void
  hideQuickCaptureWindow: () => void
}

export function registerAllIpcHandlers(ctx: ServiceContext): void {
  registerNotesIpc(ctx.aiService)
  registerAIIpc(ctx.aiService)
  registerSearchIpc()
  registerSettingsIpc()
  registerWindowIpc({
    showQuickCaptureWindow: ctx.showQuickCaptureWindow,
    hideQuickCaptureWindow: ctx.hideQuickCaptureWindow
  })
}
