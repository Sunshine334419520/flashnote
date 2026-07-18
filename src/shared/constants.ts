import type { AppConfig, AIProviderConfig } from './types'

export const APP_NAME = 'FlashNote'

export const IS_MAC = process.platform === 'darwin'
export const IS_WIN = process.platform === 'win32'
export const IS_LINUX = process.platform === 'linux'

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

// ============================================================
// Cloud sync — Notion OAuth
// ============================================================

/** Notion Public Integration OAuth client ID. Public — injected at build time. */
export const NOTION_CLIENT_ID: string =
  typeof process !== 'undefined' && process.env != null
    ? process.env.FLASHNOTE_NOTION_CLIENT_ID ?? ''
    : ''

/**
 * Notion Public Integration OAuth client secret.
 * NEVER committed — set via FLASHNOTE_NOTION_CLIENT_SECRET env var.
 * In CI/bundled builds, injected at build time via GitHub Secrets.
 * Each dev creates their own Notion integration for local testing.
 */
/**
 * Main process: replaced by electron-vite define at build time.
 * Renderer: process.env may not exist — guarded.
 */
export const NOTION_CLIENT_SECRET: string =
  typeof process !== 'undefined' && process.env != null
    ? process.env.FLASHNOTE_NOTION_CLIENT_SECRET ?? ''
    : ''

/** Local HTTP server port for OAuth redirect callback. */
export const NOTION_REDIRECT_PORT = 18923

/** Notion OAuth authorize URL. */
export const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize'

/** Notion OAuth token exchange URL. */
export const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token'

/** Notion API base URL. */
export const NOTION_API_BASE = 'https://api.notion.com/v1'

/** Notion API version header value. */
export const NOTION_API_VERSION = '2022-06-28'

// ============================================================
// Cloud sync — OneNote / Microsoft Graph OAuth (public client, PKCE)
// ============================================================

/**
 * OneNote / Microsoft Graph Application (client) ID.
 * Public value — Azure registered public client. Injected at build time.
 * No client_secret needed — this is a public client using PKCE.
 */
export const ONENOTE_CLIENT_ID: string =
  typeof process !== 'undefined' && process.env != null
    ? process.env.FLASHNOTE_ONENOTE_CLIENT_ID ?? ''
    : ''

/** Microsoft OAuth2 authorize URL (consumers tenant for personal Microsoft accounts). */
export const ONENOTE_AUTH_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize'

/** Microsoft OAuth2 token URL. */
export const ONENOTE_TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'

/** Microsoft Graph API base URL. */
export const ONENOTE_GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

/** Local HTTP server port for OneNote OAuth redirect callback. */
export const ONENOTE_REDIRECT_PORT = 18924

/** Scopes for OneNote Graph access (Notes.ReadWrite + offline_access for refresh_token). */
export const ONENOTE_SCOPES = 'Notes.ReadWrite offline_access openid profile'

/** OneNote notebook title created by ensureDatabase. */
export const ONENOTE_NOTEBOOK_TITLE = 'FlashNote'

/** OneNote section title within the notebook. */
export const ONENOTE_SECTION_TITLE = 'Notes'

export const MAX_CONTENT_LENGTH_FOR_AI = 8000

export const MAX_TAGS_PER_NOTE = 10

/**
 * Tuning knobs for AI command execution (search/add/delete/edit).
 * Centralized so behavior is adjustable without hunting magic numbers in code.
 */
export const AI_COMMAND = {
  /** Max FTS candidates handed to the LLM for rerank/locate. */
  CANDIDATE_LIMIT: 40,
  /** Below this candidate count, top up recall with recent notes. */
  RECALL_TOPUP_THRESHOLD: 8,
  /** Per-candidate content snippet length sent to the model (chars). */
  SNIPPET_LENGTH: 160,
  /** Minimum rerank score (0–1) for a note to appear in search results. */
  RELEVANCE_THRESHOLD: 0.3,
  /** Target note content sent to the edit-propose prompt (chars). */
  EDIT_CONTENT_LENGTH: 4000,
  /** Natural-language input length for intent classification (chars). */
  INTENT_INPUT_LENGTH: 2000,
  /** AI call timeout in milliseconds. */
  TIMEOUT_MS: 30_000,
  /** Per-operation max output tokens. Generous headroom so structured JSON
   *  answers are never truncated (models may spend tokens reasoning first). */
  MAX_TOKENS: {
    PARSE: 2048,
    RERANK: 2048,
    LOCATE: 2048,
    EDIT: 2048,
    INTENT: 256
  }
} as const

/** Max chars of AI request/response recorded in logs (previews are masked, then truncated). */
export const AI_LOG_PREVIEW_LENGTH = 4000

/** Config keys — avoids hardcoded strings throughout the codebase. */
export const CONFIG_KEYS = {
  HOTKEY: 'hotkey',
  THEME: 'theme',
  LANGUAGE: 'language',
  ONBOARDING_COMPLETED: 'onboardingCompleted',
} as const

/** DOM keyCode reported while an IME composition is active (e.g. a pinyin candidate). */
export const IME_COMPOSING_KEYCODE = 229

export const DEFAULT_CONFIG: AppConfig = {
  storagePath: '', // resolved at runtime
  hotkey: DEFAULT_HOTKEY,
  theme: 'system',
  language: 'system',
  onboardingCompleted: false
}

// ============================================================
// AI Provider presets
// ============================================================

export type ProviderPreset = Omit<AIProviderConfig, 'id' | 'apiKey' | 'name' | 'isActive' | 'createdAt'>

export const BUILTIN_PROVIDER_PRESETS: ProviderPreset[] = [
  {
    type: 'deepseek',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-v4-flash',
    maxTokens: 300
  },
  {
    type: 'moonshot',
    baseURL: 'https://api.moonshot.cn/v1',
    model: 'kimi-k3',
    maxTokens: 300
  },
  {
    type: 'anthropic',
    baseURL: 'https://api.anthropic.com',
    model: 'claude-haiku-4-5',
    maxTokens: 300
  },
  {
    type: 'openai',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-5.4-mini',
    maxTokens: 300
  },
  {
    type: 'zhipu',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4.7-flash',
    maxTokens: 300
  }
]
