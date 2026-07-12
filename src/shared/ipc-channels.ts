/**
 * Single source of truth for all IPC channel names.
 * Used by main process handlers, preload script, and renderer type definitions.
 */
export const IPC_CHANNELS = {
  // Notes CRUD
  NOTE_CREATE: 'note:create',
  NOTE_UPDATE: 'note:update',
  NOTE_DELETE: 'note:delete',
  NOTE_GET: 'note:get',
  NOTE_LIST: 'note:list',

  // AI — Provider management
  AI_PROVIDER_LIST: 'ai:provider:list',
  AI_PROVIDER_ADD: 'ai:provider:add',
  AI_PROVIDER_UPDATE: 'ai:provider:update',
  AI_PROVIDER_DELETE: 'ai:provider:delete',
  AI_PROVIDER_SET_ACTIVE: 'ai:provider:set-active',
  AI_PROVIDER_TEST: 'ai:provider:test',

  // AI — Classification
  AI_PARSE: 'ai:parse',

  // AI — Command execution (search/add/delete/edit)
  AI_COMMAND_RUN: 'ai:command:run',
  AI_COMMAND_CANCEL: 'ai:command:cancel',
  AI_COMMAND_CONFIRM: 'ai:command:confirm',

  // Search
  SEARCH_QUERY: 'search:query',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:getAll',

  // Window management
  WINDOW_SHOW_QUICK_CAPTURE: 'window:show-quick-capture',
  WINDOW_HIDE_QUICK_CAPTURE: 'window:hide-quick-capture',
  WINDOW_SET_SIZE: 'window:set-size',
  WINDOW_SHOW_MAIN: 'window:show-main',
  WINDOW_SHOW_SETTINGS: 'window:show-settings',

  // Shell (renderer → main, privileged operations)
  SHELL_OPEN_EXTERNAL: 'shell:open-external',

  // Task
  TASK_LIST: 'task:list',

  // Events (main → renderer push)
  EVENT_NOTE_CREATED: 'event:note-created',
  EVENT_NOTE_UPDATED: 'event:note-updated',
  EVENT_NOTE_DELETED: 'event:note-deleted',
  EVENT_AI_COMPLETE: 'event:ai-classification-complete',
  EVENT_SETTINGS_CHANGED: 'event:settings-changed',
  EVENT_TASK_CREATED: 'event:task-created',
  EVENT_TASK_COMPLETED: 'event:task-completed',
  EVENT_TASK_FAILED: 'event:task-failed'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
