import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../../database/connection'
import { join } from 'path'
import { AICache } from './cache'
import { AnthropicProvider } from './anthropic.provider'
import { OpenAICompatibleProvider } from './openai-compat.provider'
import type { AIProvider } from './base'
import type { AIProviderConfig, AIProviderType, ClassificationResult } from '../../../shared/types'
import type { SettingRow } from '../../database/schema'

export class AIService {
  private providers: Map<string, AIProvider> = new Map()
  private activeProviderId: string | null = null
  private cache: AICache
  private storagePath: string

  constructor(storagePath: string) {
    this.storagePath = storagePath
    this.cache = new AICache(storagePath)
    this.loadFromDisk()
  }

  // ============================================================
  // Provider management
  // ============================================================

  listProviders(): AIProviderConfig[] {
    return Array.from(this.providers.values()).map((p) => ({ ...p.config }))
  }

  getActiveProvider(): AIProvider | null {
    if (!this.activeProviderId) return null
    return this.providers.get(this.activeProviderId) ?? null
  }

  addProvider(config: Omit<AIProviderConfig, 'id' | 'createdAt' | 'isActive'>): AIProviderConfig {
    const id = uuidv4()
    const now = new Date().toISOString()

    // If this is the first provider, make it active
    const isActive = this.providers.size === 0

    const fullConfig: AIProviderConfig = {
      ...config,
      id,
      createdAt: now,
      isActive
    }

    if (isActive) {
      this.activeProviderId = id
    }

    const provider = this.createProvider(fullConfig)
    this.providers.set(id, provider)
    this.saveToDisk()

    return fullConfig
  }

  updateProvider(id: string, updates: Partial<AIProviderConfig>): AIProviderConfig {
    const existing = this.providers.get(id)
    if (!existing) throw new Error(`Provider not found: ${id}`)

    const updated: AIProviderConfig = { ...existing.config, ...updates, id }

    // Re-create provider instance with new config
    const provider = this.createProvider(updated)
    this.providers.set(id, provider)
    this.saveToDisk()

    return updated
  }

  deleteProvider(id: string): void {
    this.providers.delete(id)

    // If deleted the active provider, activate the first remaining one
    if (this.activeProviderId === id) {
      const first = this.providers.values().next().value
      if (first) {
        this.activeProviderId = first.config.id
        first.config.isActive = true
      } else {
        this.activeProviderId = null
      }
    }

    this.saveToDisk()
  }

  setActiveProvider(id: string): void {
    if (!this.providers.has(id)) throw new Error(`Provider not found: ${id}`)

    // Deactivate current
    if (this.activeProviderId) {
      const current = this.providers.get(this.activeProviderId)
      if (current) current.config.isActive = false
    }

    // Activate new
    const next = this.providers.get(id)!
    next.config.isActive = true
    this.activeProviderId = id

    this.saveToDisk()
  }

  async testProvider(id: string): Promise<boolean> {
    const provider = this.providers.get(id)
    if (!provider) throw new Error(`Provider not found: ${id}`)
    return provider.testConnection()
  }

  // ============================================================
  // Classification
  // ============================================================

  async classify(content: string, hint?: string): Promise<ClassificationResult> {
    // Check cache first (cross-provider)
    const cached = this.cache.get(content, hint)
    if (cached) return cached

    const provider = this.getActiveProvider()
    if (!provider) {
      throw new Error('No active AI provider configured. Add a provider in Settings.')
    }

    const result = await provider.classify(content, hint)
    this.cache.set(content, hint, result)
    return result
  }

  // ============================================================
  // Persistence (SQLite settings table)
  // ============================================================

  private loadFromDisk(): void {
    try {
      const db = getDatabase(join(this.storagePath, 'index.db'))
      const row = db.prepare("SELECT value FROM settings WHERE key = 'ai_providers'").get() as
        | SettingRow
        | undefined

      if (!row) return

      const configs: AIProviderConfig[] = JSON.parse(row.value)
      for (const config of configs) {
        const provider = this.createProvider(config)
        this.providers.set(config.id, provider)
        if (config.isActive) {
          this.activeProviderId = config.id
        }
      }
    } catch (err) {
      console.warn('Failed to load AI providers from disk:', err)
    }
  }

  private saveToDisk(): void {
    try {
      const db = getDatabase(join(this.storagePath, 'index.db'))
      const configs = Array.from(this.providers.values()).map((p) => ({ ...p.config }))
      const json = JSON.stringify(configs)
      const now = new Date().toISOString()

      db.prepare(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('ai_providers', ?, ?)"
      ).run(json, now)
    } catch (err) {
      console.error('Failed to save AI providers to disk:', err)
    }
  }

  // ============================================================
  // Factory
  // ============================================================

  private createProvider(config: AIProviderConfig): AIProvider {
    switch (config.type) {
      case 'anthropic':
        return new AnthropicProvider(config)
      case 'openai':
      case 'deepseek':
      case 'moonshot':
      case 'zhipu':
      case 'custom':
        return new OpenAICompatibleProvider(config)
      default:
        throw new Error(`Unknown provider type: ${config.type}`)
    }
  }
}
