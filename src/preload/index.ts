import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type {
  AIProviderConfig,
  SmartParseResult,
  Note,
  NoteCreateRequest,
  NoteUpdateRequest,
  SearchQuery,
  SearchResult,
  TaskInfo,
  AICommandRequest,
  AICommandResult,
  AICommandConfirmRequest,
  AICommandConfirmResult
} from '../shared/types'

// Apply theme BEFORE page renders — reads config.json synchronously (no flash)
try {
  const configPath = join(homedir(), 'FlashNote', 'config.json')
  const raw = readFileSync(configPath, 'utf-8')
  const config = JSON.parse(raw) as { theme?: string }
  const t = config.theme ?? 'system'
  const shouldBeDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  // Log for debugging — check terminal output
  console.log('[preload:theme] configPath:', configPath)
  console.log('[preload:theme] theme:', t, 'shouldBeDark:', shouldBeDark)
  console.log('[preload:theme] html.classList before:', document.documentElement.className)

  if (shouldBeDark) {
    document.documentElement.classList.add('dark')
    // Also set inline bg as immediate fallback (before CSS loads)
    document.documentElement.style.backgroundColor = '#141312'
  }

  console.log('[preload:theme] html.classList after:', document.documentElement.className)
} catch (err) {
  console.log('[preload:theme] ERROR:', err)
}

const electronAPI = {
  notes: {
    create: (args: NoteCreateRequest): Promise<Note> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTE_CREATE, args),
    update: (args: NoteUpdateRequest): Promise<Note> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTE_UPDATE, args),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTE_DELETE, id),
    get: (id: string): Promise<Note | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTE_GET, id),
    list: (query?: SearchQuery): Promise<SearchResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTE_LIST, query ?? {})
  },

  ai: {
    providers: {
      list: (): Promise<AIProviderConfig[]> =>
        ipcRenderer.invoke(IPC_CHANNELS.AI_PROVIDER_LIST),
      add: (
        config: Omit<AIProviderConfig, 'id' | 'createdAt' | 'isActive'>
      ): Promise<AIProviderConfig> =>
        ipcRenderer.invoke(IPC_CHANNELS.AI_PROVIDER_ADD, config),
      update: (
        id: string,
        updates: Partial<AIProviderConfig>
      ): Promise<AIProviderConfig> =>
        ipcRenderer.invoke(IPC_CHANNELS.AI_PROVIDER_UPDATE, { id, updates }),
      delete: (id: string): Promise<void> =>
        ipcRenderer.invoke(IPC_CHANNELS.AI_PROVIDER_DELETE, id),
      setActive: (id: string): Promise<void> =>
        ipcRenderer.invoke(IPC_CHANNELS.AI_PROVIDER_SET_ACTIVE, id),
      test: (id: string): Promise<boolean> =>
        ipcRenderer.invoke(IPC_CHANNELS.AI_PROVIDER_TEST, id)
    },
    parse: (rawInput: string): Promise<SmartParseResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_PARSE, { rawInput })
  },

  aiCommand: {
    run: (req: AICommandRequest): Promise<AICommandResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_COMMAND_RUN, req),
    cancel: (requestId: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_COMMAND_CANCEL, requestId),
    confirm: (req: AICommandConfirmRequest): Promise<AICommandConfirmResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_COMMAND_CONFIRM, req)
  },

  search: {
    query: (q: SearchQuery): Promise<SearchResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.SEARCH_QUERY, q)
  },

  settings: {
    get: (key: string): Promise<unknown> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
    set: (key: string, value: unknown): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, { key, value }),
    getAll: (): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL)
  },

  tasks: {
    list: (): Promise<TaskInfo[]> => ipcRenderer.invoke(IPC_CHANNELS.TASK_LIST)
  },

  window: {
    showQuickCapture: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SHOW_QUICK_CAPTURE),
    hideQuickCapture: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_HIDE_QUICK_CAPTURE),
    showMain: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SHOW_MAIN),
    showSettings: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SHOW_SETTINGS)
  },

  shell: {
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url)
  },

  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const validEvents: readonly string[] = [
      IPC_CHANNELS.EVENT_NOTE_CREATED,
      IPC_CHANNELS.EVENT_NOTE_UPDATED,
      IPC_CHANNELS.EVENT_NOTE_DELETED,
      IPC_CHANNELS.EVENT_AI_COMPLETE,
      IPC_CHANNELS.EVENT_SETTINGS_CHANGED,
      IPC_CHANNELS.EVENT_TASK_CREATED,
      IPC_CHANNELS.EVENT_TASK_COMPLETED,
      IPC_CHANNELS.EVENT_TASK_FAILED
    ]

    if (!validEvents.includes(channel)) {
      return () => {}
    }

    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
      callback(...args)
    }
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
