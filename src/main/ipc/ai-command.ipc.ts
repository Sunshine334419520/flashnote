import { ipcMain, webContents } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { safeHandler } from '../utils/safeHandler'
import { logger } from '../utils/logger'
import type { AICommandService } from '../services/ai/command.service'
import type { AICommandRequest, AICommandConfirmRequest } from '../../shared/types'

function broadcast(channel: string, data: unknown): void {
  for (const wc of webContents.getAllWebContents()) {
    wc.send(channel, data)
  }
}

/**
 * Command-bar AI execution: run (invoke) + cancel (by requestId) + confirm
 * (apply an approved delete/edit). In-flight runs are tracked by an
 * AbortController map so cancel() can abort the underlying AI call.
 */
export function registerAICommandIpc(commandService: AICommandService): void {
  const inflight = new Map<string, AbortController>()

  ipcMain.handle(
    IPC_CHANNELS.AI_COMMAND_RUN,
    safeHandler('ai:command:run', async (_event, req: AICommandRequest) => {
      const controller = new AbortController()
      inflight.set(req.id, controller)
      const start = Date.now()
      try {
        const result = await commandService.run(req, controller.signal)
        logger.info('ai:command', 'done', { id: req.id, kind: result.kind, elapsedMs: Date.now() - start })
        // Only /add mutates during run — surface it to all windows.
        if (result.kind === 'add') broadcast(IPC_CHANNELS.EVENT_NOTE_CREATED, result.note)
        return result
      } catch (err) {
        logger.warn('ai:command', 'run failed', {
          id: req.id,
          aborted: controller.signal.aborted,
          elapsedMs: Date.now() - start,
          error: (err as Error).message
        })
        throw err
      } finally {
        inflight.delete(req.id)
      }
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_COMMAND_CANCEL,
    safeHandler('ai:command:cancel', async (_event, requestId: string) => {
      logger.info('ai:command', 'cancel', { id: requestId, found: inflight.has(requestId) })
      inflight.get(requestId)?.abort()
      inflight.delete(requestId)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_COMMAND_CONFIRM,
    safeHandler('ai:command:confirm', async (_event, req: AICommandConfirmRequest) => {
      const result = commandService.confirm(req)
      if (req.type === 'delete') {
        for (const id of req.noteIds) broadcast(IPC_CHANNELS.EVENT_NOTE_DELETED, id)
      } else if (result.kind === 'edited') {
        broadcast(IPC_CHANNELS.EVENT_NOTE_UPDATED, result.note)
      }
      return result
    })
  )
}
