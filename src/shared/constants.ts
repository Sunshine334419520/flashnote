import type { AppConfig, AIProviderConfig } from './types'

export const APP_NAME = 'FlashNote'

export const DEFAULT_CATEGORIES = [
  'API Keys & Credentials',
  'Meeting Notes',
  'Code Snippets',
  'Ideas & Brainstorms',
  'Tasks & Todos',
  'Reference Material',
  'Bookmarks & Links',
  'Personal Journal',
  'Contacts & People',
  'Financial',
  'Other'
] as const

export const DEFAULT_HOTKEY = 'Alt+Space'

export const MAX_CONTENT_LENGTH_FOR_AI = 8000

export const MAX_TAGS_PER_NOTE = 10

export const DEFAULT_CONFIG: AppConfig = {
  storagePath: '', // resolved at runtime
  hotkey: DEFAULT_HOTKEY,
  theme: 'system'
}

// ============================================================
// AI Provider presets
// ============================================================

export type ProviderPreset = Omit<AIProviderConfig, 'id' | 'apiKey' | 'name' | 'isActive' | 'createdAt'>

export const BUILTIN_PROVIDER_PRESETS: ProviderPreset[] = [
  {
    type: 'anthropic',
    baseURL: 'https://api.anthropic.com',
    model: 'claude-haiku-4-5',
    maxTokens: 300
  },
  {
    type: 'openai',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    maxTokens: 300
  },
  {
    type: 'deepseek',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    maxTokens: 300
  },
  {
    type: 'moonshot',
    baseURL: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    maxTokens: 300
  },
  {
    type: 'zhipu',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    maxTokens: 300
  }
]
