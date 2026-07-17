import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { createNote, readNote, modifyNote, removeNote, getNotes } from '../services/storage.service'
import type { AIService } from '../services/ai'
import type { TaskManager } from '../services/task-manager'
import type { CloudSyncService } from '../services/cloud/cloud-sync.service'
import type { NoteCreateRequest, NoteUpdateRequest, SearchQuery, TaskInfo } from '../../shared/types'
import { safeHandler } from '../utils/safeHandler'
import { logger } from '../utils/logger'
import { broadcast } from '../utils/broadcast'
import { heuristicParse } from '../services/ai/base'

export function registerNotesIpc(aiService: AIService, taskManager: TaskManager, cloudSyncService: CloudSyncService): void {
  ipcMain.handle(
    IPC_CHANNELS.NOTE_CREATE,
    safeHandler('note:create', async (_event, request: NoteCreateRequest) => {
      // 1. Heuristic parse for immediate classification (no API call)
      const heuristic = heuristicParse(request.content)

      // 2. Save as draft — NOT published yet
      const note = createNote(
        { content: heuristic.cleanedContent, sourceHint: undefined },
        {
          type: heuristic.type,
          category: heuristic.category,
          tags: heuristic.tags,
          title: heuristic.title,
          sensitive: heuristic.sensitive,
          typedData: heuristic.typedData
        }
      )
      // note.status is 'draft' by default — do NOT broadcast to main list

      // 3. Create processing task
      const task = taskManager.enqueue(note.id, request.content)
      broadcast(IPC_CHANNELS.EVENT_TASK_CREATED, task)

      // 4. AI parse in background
      const aiStart = Date.now()
      aiService
        .parse(request.content)
        .then((parsed) => {
          const elapsed = Date.now() - aiStart
          logger.info('ai:parse', `AI parse completed in ${elapsed}ms`, {
            category: parsed.category,
            tags: parsed.tags
          })

          // Mark task done
          const updated = taskManager.markDone(task.id, parsed, elapsed)
          if (updated) broadcast(IPC_CHANNELS.EVENT_TASK_COMPLETED, updated)

          // Update note with AI result and publish
          const published = modifyNote({
            id: note.id,
            title: parsed.title,
            content: parsed.cleanedContent,
            category: parsed.category,
            tags: parsed.tags,
            status: 'published'
          })
          published.type = parsed.type
          published.sensitive = parsed.sensitive
          published.typedData = parsed.typedData
          // Override status to published
          published.status = 'published'

          // Now broadcast to main list
          broadcast(IPC_CHANNELS.EVENT_NOTE_CREATED, published)
          cloudSyncService.schedulePush(published.id, 'create')
        })
        .catch((err) => {
          const elapsed = Date.now() - aiStart
          const errMsg = (err as Error).message ?? 'Unknown error'
          logger.warn('ai:parse', `AI parse failed after ${elapsed}ms`, { error: errMsg })

          // Mark task failed
          const failed = taskManager.markFailed(task.id, errMsg)
          if (failed) broadcast(IPC_CHANNELS.EVENT_TASK_FAILED, failed)

          // Publish note anyway so user can see raw content
          modifyNote({ id: note.id, title: note.title, content: note.content })
          const published = readNote(note.id)
          if (published) {
            published.status = 'published'
            broadcast(IPC_CHANNELS.EVENT_NOTE_CREATED, published)
            cloudSyncService.schedulePush(published.id, 'create')
          }
        })

      // Return draft note to QuickCapture (for closing the window)
      return note
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTE_UPDATE,
    safeHandler('note:update', async (_event, request: NoteUpdateRequest) => {
      const note = modifyNote(request)
      broadcast(IPC_CHANNELS.EVENT_NOTE_UPDATED, note)
      cloudSyncService.schedulePush(note.id, 'update')
      return note
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTE_DELETE,
    safeHandler('note:delete', async (_event, id: string) => {
      removeNote(id)
      broadcast(IPC_CHANNELS.EVENT_NOTE_DELETED, id)
      cloudSyncService.schedulePush(id, 'delete')
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTE_GET,
    safeHandler('note:get', async (_event, id: string) => readNote(id))
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTE_LIST,
    safeHandler('note:list', async (_event, query: SearchQuery | undefined) => getNotes(query))
  )

  // Task listing
  ipcMain.handle(
    IPC_CHANNELS.TASK_LIST,
    safeHandler('task:list', async () => taskManager.listTasks())
  )
}
