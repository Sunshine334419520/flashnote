import { homedir } from 'os'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'

/**
 * Resolve and create the FlashNote storage directory.
 * Default: ~/FlashNote
 * Can be overridden via FLASHNOTE_HOME env var or user config.
 */
export function getDefaultStoragePath(): string {
  return join(process.env.FLASHNOTE_HOME ?? homedir(), 'FlashNote')
}

export function getNotesPath(storagePath: string): string {
  return join(storagePath, 'notes')
}

export function getIndexDbPath(storagePath: string): string {
  return join(storagePath, 'index.db')
}

export function getAICacheDbPath(storagePath: string): string {
  return join(storagePath, 'ai-cache.db')
}

export function getConfigPath(storagePath: string): string {
  return join(storagePath, 'config.json')
}

export function getLogsPath(storagePath: string): string {
  return join(storagePath, 'logs')
}

/**
 * Ensure all required directories exist under the storage root.
 */
export function ensureStorageDirectories(storagePath: string): void {
  const dirs = [storagePath, getNotesPath(storagePath), getLogsPath(storagePath)]

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }
}

/**
 * Resolve the path to a note .md file by its ID.
 */
export function resolveNotePath(storagePath: string, noteId: string): string {
  return join(getNotesPath(storagePath), `${noteId}.md`)
}
