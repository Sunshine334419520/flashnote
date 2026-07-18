import { readFileSync, writeFileSync, existsSync } from 'fs'
import { getConfigPath } from '../utils/paths'
import { DEFAULT_CONFIG } from '../../shared/constants'
import type { AppConfig } from '../../shared/types'
import { logger } from '../utils/logger'
import { LOG_TAGS } from '../../shared/logTags'

let config: AppConfig | null = null

/**
 * Load config from disk, falling back to defaults on first run.
 */
export function loadConfig(storagePath: string): AppConfig {
  if (config) return config

  const configPath = getConfigPath(storagePath)

  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppConfig>
      config = { ...DEFAULT_CONFIG, ...parsed, storagePath }
    } catch {
      logger.warn(LOG_TAGS.MAIN.THEME, 'Failed to parse config.json, using defaults')
      config = { ...DEFAULT_CONFIG, storagePath }
    }
  } else {
    config = { ...DEFAULT_CONFIG, storagePath }
  }

  return config
}

/**
 * Persist current config to disk.
 */
export function saveConfig(): void {
  if (!config) throw new Error('Config not loaded. Call loadConfig() first.')

  // Don't persist API key in config.json — it goes to system keychain
  const toPersist = { ...config }
  delete (toPersist as Record<string, unknown>).aiConfig

  writeFileSync(getConfigPath(config.storagePath), JSON.stringify(toPersist, null, 2), 'utf-8')
}

/**
 * Get a typed config value by key.
 */
export function getConfig<K extends keyof AppConfig>(key: K): AppConfig[K] {
  if (!config) throw new Error('Config not loaded. Call loadConfig() first.')
  return config[key]
}

/**
 * Set a config value and persist.
 */
export function setConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  if (!config) throw new Error('Config not loaded. Call loadConfig() first.')
  config[key] = value
  saveConfig()
}

/**
 * Get the full config object (read-only copy).
 */
export function getAllConfig(): Readonly<AppConfig> {
  if (!config) throw new Error('Config not loaded. Call loadConfig() first.')
  return { ...config }
}
