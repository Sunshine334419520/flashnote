import type { AIProviderConfig, SmartParseResult } from '../../../shared/types'

/**
 * Smart Parse heuristic — used when no AI provider is configured.
 * Does basic pattern matching to extract intent from natural language input.
 */
export function heuristicParse(rawInput: string): SmartParseResult {
  const trimmed = rawInput.trim()
  const firstLine = trimmed.split(/[\n\r]+/)[0]

  // API Key detection
  const apiKeyPrefixes = ['sk-', 'api-', 'key-', 'token-', 'ghp_', 'gho_', 'github_pat_']
  for (const prefix of apiKeyPrefixes) {
    if (trimmed.startsWith(prefix) || trimmed.includes(prefix)) {
      return {
        cleanedContent: firstLine,
        type: 'apikey',
        category: 'API Keys & Credentials',
        tags: ['api-key'],
        title: firstLine.slice(0, 80),
        sensitive: true,
        typedData: { prefix, service: '' },
        structuredData: {}
      }
    }
  }

  // URL / bookmark detection
  if (/^https?:\/\//.test(firstLine)) {
    const domain = new URL(firstLine).hostname
    return {
      cleanedContent: trimmed,
      type: 'bookmark',
      category: 'Bookmarks & Links',
      tags: ['link', domain.split('.').slice(-2).join('.')],
      title: firstLine.slice(0, 80),
      sensitive: false,
      typedData: { url: firstLine, domain },
      structuredData: {}
    }
  }

  // Command detection: common CLI patterns
  const cmdIndicators = [
    'docker ', 'npm ', 'pnpm ', 'yarn ', 'kubectl ', 'git ',
    'pip ', 'brew ', 'curl ', 'wget ', 'ssh ', 'scp ',
    'apt ', 'apt-get ', 'yum ', 'dnf ', 'pacman '
  ]
  for (const indicator of cmdIndicators) {
    if (trimmed.startsWith(indicator)) {
      const cmd = trimmed.split(' ')[0]
      return {
        cleanedContent: trimmed,
        type: 'command',
        category: 'Code Snippets',
        tags: ['command', cmd],
        title: firstLine.slice(0, 80),
        sensitive: false,
        typedData: { shell: cmd, executable: firstLine },
        structuredData: {}
      }
    }
  }

  // Code detection
  const codeIndicators = [
    'import ', 'function ', 'def ', 'class ',
    'const ', 'let ', 'var ', 'package ', 'require(', 'from ', 'export '
  ]
  for (const indicator of codeIndicators) {
    if (trimmed.includes(indicator)) {
      return {
        cleanedContent: trimmed,
        type: 'command',
        category: 'Code Snippets',
        tags: ['code'],
        title: firstLine.slice(0, 80),
        sensitive: false,
        typedData: {},
        structuredData: {}
      }
    }
  }

  // Credential detection: bank card, ID card patterns, passwords
  const bankCardPattern = /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/
  const idCardPattern = /\b\d{18}\b|\b\d{17}[\dXx]\b/
  if (bankCardPattern.test(trimmed) || idCardPattern.test(trimmed) || /银行卡|密码|账号|身份证/.test(trimmed)) {
    return {
      cleanedContent: trimmed,
      type: 'credential',
      category: 'API Keys & Credentials',
      tags: ['credential'],
      title: firstLine.slice(0, 80),
      sensitive: true,
      typedData: { kind: 'other' },
      structuredData: {}
    }
  }

  // Default text
  return {
    cleanedContent: trimmed,
    type: 'text',
    category: 'Other',
    tags: [],
    title: firstLine.slice(0, 80),
    sensitive: false,
    typedData: {},
    structuredData: {}
  }
}

/**
 * A generic single-turn completion request. Used by command execution
 * (search rerank, delete/edit locate, intent) — distinct from `parse`.
 */
export interface AICompletionRequest {
  system: string
  user: string
  /** When true: OpenAI-compatible uses response_format=json_object; Anthropic appends a JSON-only instruction. */
  json?: boolean
  /** Override the provider's default max output tokens (parse defaults are small). */
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
  /** Command requestId — correlates every step of one command in the logs. */
  traceId?: string
  /** Step label for logs, e.g. 'add.parse', 'search.rerank', 'edit.propose'. */
  label?: string
}

/** Result of a completion. `finishReason` distinguishes truncation ('length') from a clean stop. */
export interface AICompletionResult {
  content: string
  finishReason?: string
  /** Raw provider usage object (token counts, incl. DeepSeek reasoning_tokens). */
  usage?: Record<string, unknown>
}

/**
 * Abstract interface for AI providers.
 */
export interface AIProvider {
  readonly config: AIProviderConfig

  /** Smart-parse natural language input into structured note data */
  parse(rawInput: string, signal?: AbortSignal): Promise<SmartParseResult>

  /** Generic completion (JSON parsing is the caller's job) */
  complete(req: AICompletionRequest): Promise<AICompletionResult>

  /** Test API connectivity */
  testConnection(): Promise<boolean>
}
