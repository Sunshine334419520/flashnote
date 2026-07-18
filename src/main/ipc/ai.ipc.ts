import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { AIService } from '../services/ai'
import type { AIProviderConfig } from '../../shared/types'
import { safeHandler } from '../utils/safeHandler'

export function registerAIIpc(aiService: AIService): void {
  ipcMain.handle(
    IPC_CHANNELS.AI_PROVIDER_LIST,
    safeHandler(IPC_CHANNELS.AI_PROVIDER_LIST, async () => aiService.listProviders())
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_PROVIDER_ADD,
    safeHandler(IPC_CHANNELS.AI_PROVIDER_ADD, async (_event, config) => aiService.addProvider(config as Omit<AIProviderConfig, 'id' | 'createdAt' | 'isActive'>))
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_PROVIDER_UPDATE,
    safeHandler(IPC_CHANNELS.AI_PROVIDER_UPDATE, async (_event, args) =>
      aiService.updateProvider((args as { id: string }).id, (args as { updates: Partial<AIProviderConfig> }).updates)
    )
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_PROVIDER_DELETE,
    safeHandler(IPC_CHANNELS.AI_PROVIDER_DELETE, async (_event, id: string) => aiService.deleteProvider(id))
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_PROVIDER_SET_ACTIVE,
    safeHandler(IPC_CHANNELS.AI_PROVIDER_SET_ACTIVE, async (_event, id: string) => aiService.setActiveProvider(id))
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_PROVIDER_TEST,
    safeHandler(IPC_CHANNELS.AI_PROVIDER_TEST, async (_event, id: string) => aiService.testProvider(id))
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_PARSE,
    safeHandler(IPC_CHANNELS.AI_PARSE, async (_event, args) =>
      aiService.parse((args as { rawInput: string }).rawInput)
    )
  )
}
