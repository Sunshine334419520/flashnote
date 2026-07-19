/**
 * Centralized log tag constants.
 * Every logger.info/warn/error call in the main process should use these.
 */
export const LOG_TAGS = {
  MAIN: {
    INIT: 'main:init',
    THEME: 'main:theme',
    HOTKEY: 'main:hotkey',
    MENU: 'main:menu',
    UNCAUGHT: 'main:uncaughtException',
    UNHANDLED: 'main:unhandledRejection',
    TRAY: 'main:tray',
    IPC: 'ipc',
  },
  AI: {
    COMMAND: 'ai:command',
    PARSE: 'ai:parse',
    CMD: 'ai:cmd',
    ADD: 'ai:add',
    DELETE: 'ai:delete',
    EDIT: 'ai:edit',
    SEARCH: 'ai:search',
    INTENT: 'ai:intent',
    LOCATE: 'ai:locate',
    COMPLETE: 'ai:complete',
  },
  CLOUD: {
    SERVICE: 'cloud:service',
    SYNC: 'cloud:sync',
    AUTH_SERVER: 'cloud:auth-server',
    NOTION: 'cloud:notion',
    ONENOTE: 'cloud:onenote',
  },
} as const
