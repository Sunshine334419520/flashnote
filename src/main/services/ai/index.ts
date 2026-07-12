import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../../database/connection'
import { join } from 'path'
import { AICache } from './cache'
import { AnthropicProvider } from './anthropic.provider'
import { OpenAICompatibleProvider } from './openai-compat.provider'
import { heuristicParse } from './base'
import type { AIProvider, AICompletionRequest } from './base'
import type { AIProviderConfig, AIProviderType, SmartParseResult } from '../../../shared/types'
import type { SettingRow } from '../../database/schema'
import { logger } from '../../utils/logger'
import { maskSecrets } from '../../utils/mask'
import { AI_COMMAND, AI_LOG_PREVIEW_LENGTH } from '../../../shared/constants'

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
  // Provider management (unchanged)
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
    const isActive = this.providers.size === 0
    const fullConfig: AIProviderConfig = { ...config, id, createdAt: now, isActive }
    if (isActive) this.activeProviderId = id
    this.providers.set(id, this.createProvider(fullConfig))
    this.saveToDisk()
    return fullConfig
  }

  updateProvider(id: string, updates: Partial<AIProviderConfig>): AIProviderConfig {
    const existing = this.providers.get(id)
    if (!existing) throw new Error(`Provider not found: ${id}`)
    const updated: AIProviderConfig = { ...existing.config, ...updates, id }
    this.providers.set(id, this.createProvider(updated))
    this.saveToDisk()
    return updated
  }

  deleteProvider(id: string): void {
    this.providers.delete(id)
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
    if (this.activeProviderId) {
      const current = this.providers.get(this.activeProviderId)
      if (current) current.config.isActive = false
    }
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
  // Smart Parse
  // ============================================================

  async parse(rawInput: string, signal?: AbortSignal): Promise<SmartParseResult> {
    // 1. Cache check
    const cached = this.cache.get(rawInput)
    if (cached) return cached

    // 2. Fallback: no active provider → heuristic
    const provider = this.getActiveProvider()
    if (!provider) {
      return heuristicParse(rawInput)
    }

    // 3. AI parse
    try {
      const result = await provider.parse(rawInput, signal)
      this.cache.set(rawInput, result)
      return result
    } catch (err) {
      if (signal?.aborted) throw err  // user cancelled — don't mask with heuristic
      console.warn('AI parse failed, falling back to heuristic:', err)
      return heuristicParse(rawInput)
    }
  }

  /**
   * Generic completion for command execution (search/delete/edit/intent).
   * Unlike parse(), there is no heuristic fallback — throws when no provider
   * is configured, and enforces a 30s timeout merged with the caller's signal.
   */
  async complete(req: AICompletionRequest): Promise<string> {
    const provider = this.getActiveProvider()
    if (!provider) throw new Error('NO_ACTIVE_PROVIDER')

    const timeout = AbortSignal.timeout(AI_COMMAND.TIMEOUT_MS)
    const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout

    const start = Date.now()
    logger.info('ai:complete', 'request', {
      req: req.traceId,
      step: req.label,
      model: provider.config.model,
      maxTokens: req.maxTokens,
      json: req.json === true,
      user: maskSecrets(req.user).slice(0, AI_LOG_PREVIEW_LENGTH)
    })
    try {
      const res = await provider.complete({ ...req, signal })
      const usage = res.usage as
        | {
            prompt_tokens?: number
            completion_tokens?: number
            total_tokens?: number
            completion_tokens_details?: { reasoning_tokens?: number }
          }
        | undefined
      logger.info('ai:complete', 'response', {
        req: req.traceId,
        step: req.label,
        elapsedMs: Date.now() - start,
        finishReason: res.finishReason,
        // reasoningTokens > 0 means thinking mode actually ran; 0 / undefined = off.
        reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        chars: res.content.length,
        preview: maskSecrets(res.content).slice(0, AI_LOG_PREVIEW_LENGTH)
      })
      if (res.finishReason === 'length') {
        logger.warn('ai:complete', 'response truncated by max_tokens', {
          req: req.traceId,
          step: req.label,
          maxTokens: req.maxTokens
        })
      }
      return res.content
    } catch (err) {
      logger.warn('ai:complete', 'failed', {
        req: req.traceId,
        step: req.label,
        elapsedMs: Date.now() - start,
        aborted: signal.aborted,
        error: (err as Error).message
      })
      throw err
    }
  }

  // ============================================================
  // Persistence
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
        this.providers.set(config.id, this.createProvider(config))
        if (config.isActive) this.activeProviderId = config.id
      }
    } catch (err) {
      console.warn('Failed to load AI providers:', err)
    }
  }

  private saveToDisk(): void {
    try {
      const db = getDatabase(join(this.storagePath, 'index.db'))
      const configs = Array.from(this.providers.values()).map((p) => ({ ...p.config }))
      const now = new Date().toISOString()
      db.prepare(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('ai_providers', ?, ?)"
      ).run(JSON.stringify(configs), now)
    } catch (err) {
      console.error('Failed to save AI providers:', err)
    }
  }

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

  close(): void {
    this.cache.close()
  }
}
