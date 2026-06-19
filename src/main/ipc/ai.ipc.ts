import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { AIService } from '../services/ai'
import type { AIProviderConfig } from '../../shared/types'

export function registerAIIpc(aiService: AIService): void {
  // Provider management
  ipcMain.handle(IPC_CHANNELS.AI_PROVIDER_LIST, async () => {
    return aiService.listProviders()
  })

  ipcMain.handle(
    IPC_CHANNELS.AI_PROVIDER_ADD,
    async (_event, config: Omit<AIProviderConfig, 'id' | 'createdAt' | 'isActive'>) => {
      return aiService.addProvider(config)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_PROVIDER_UPDATE,
    async (_event, args: { id: string; updates: Partial<AIProviderConfig> }) => {
      return aiService.updateProvider(args.id, args.updates)
    }
  )

  ipcMain.handle(IPC_CHANNELS.AI_PROVIDER_DELETE, async (_event, id: string) => {
    aiService.deleteProvider(id)
  })

  ipcMain.handle(IPC_CHANNELS.AI_PROVIDER_SET_ACTIVE, async (_event, id: string) => {
    aiService.setActiveProvider(id)
  })

  ipcMain.handle(IPC_CHANNELS.AI_PROVIDER_TEST, async (_event, id: string) => {
    return aiService.testProvider(id)
  })

  // Classification
  ipcMain.handle(
    IPC_CHANNELS.AI_CLASSIFY,
    async (_event, args: { content: string; hint?: string }) => {
      return aiService.classify(args.content, args.hint)
    }
  )

  ipcMain.handle(IPC_CHANNELS.AI_RECLASSIFY, async (_event, _noteId: string) => {
    // TODO: re-read note content and re-classify
    throw new Error('ai:reclassify not yet implemented')
  })
}
