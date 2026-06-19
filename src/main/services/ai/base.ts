import type { AIProviderConfig, ClassificationResult } from '../../../shared/types'

/**
 * Abstract interface for AI classification providers.
 * Each implementation handles a specific API format.
 */
export interface AIProvider {
  readonly config: AIProviderConfig

  /** Classify note content, returning category/tags/title */
  classify(content: string, hint?: string): Promise<ClassificationResult>

  /** Test API connectivity — sends a minimal request to verify credentials */
  testConnection(): Promise<boolean>
}
