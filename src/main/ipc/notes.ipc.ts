import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import {
  createNote,
  readNote,
  modifyNote,
  removeNote,
  getNotes
} from '../services/storage.service'
import type { AIService } from '../services/ai'
import type { NoteCreateRequest, NoteUpdateRequest, SearchQuery, ClassificationResult } from '../../shared/types'

export function registerNotesIpc(aiService: AIService): void {
  ipcMain.handle(IPC_CHANNELS.NOTE_CREATE, async (event, request: NoteCreateRequest) => {
    // Try AI classification first (fallback to defaults on failure)
    let classification: ClassificationResult | undefined
    try {
      classification = await aiService.classify(request.content, request.sourceHint)
    } catch (err) {
      console.warn('AI classification failed, using defaults:', err)
    }

    const note = createNote(request, classification)
    event.sender.send(IPC_CHANNELS.EVENT_NOTE_CREATED, note)

    if (classification) {
      event.sender.send(IPC_CHANNELS.EVENT_AI_COMPLETE, { noteId: note.id, classification })
    }

    return note
  })

  ipcMain.handle(IPC_CHANNELS.NOTE_UPDATE, async (event, request: NoteUpdateRequest) => {
    const note = modifyNote(request)
    event.sender.send(IPC_CHANNELS.EVENT_NOTE_UPDATED, note)
    return note
  })

  ipcMain.handle(IPC_CHANNELS.NOTE_DELETE, async (event, id: string) => {
    removeNote(id)
    event.sender.send(IPC_CHANNELS.EVENT_NOTE_DELETED, id)
  })

  ipcMain.handle(IPC_CHANNELS.NOTE_GET, async (_event, id: string) => {
    return readNote(id)
  })

  ipcMain.handle(IPC_CHANNELS.NOTE_LIST, async (_event, query: SearchQuery | undefined) => {
    return getNotes(query)
  })
}
