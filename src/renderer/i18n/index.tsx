import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import zhCN from './zh-CN'
import en from './en'
import type { Translations } from './zh-CN'

export type Language = 'zh-CN' | 'en' | 'system'

const translations: Record<string, Translations> = { 'zh-CN': zhCN, en }

function resolveLanguage(lang: Language): 'zh-CN' | 'en' {
  if (lang === 'zh-CN' || lang === 'en') return lang
  // system → detect from navigator
  if (typeof navigator !== 'undefined' && navigator.language?.startsWith('zh')) {
    return 'zh-CN'
  }
  return 'en'
}

function format(msg: string, params?: Record<string, string | number>): string {
  if (!params) return msg
  return msg.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))
}

// ── Context ──────────────────────────────────────────────────────────

interface I18nContextValue {
  language: Language
  setLanguage: (l: Language) => void
  t: (key: keyof Translations, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue>({
  language: 'system',
  setLanguage: () => {},
  t: (k: keyof Translations) => k,
})

export function useT(): Pick<I18nContextValue, 't' | 'language' | 'setLanguage'> {
  return useContext(I18nContext)
}

// ── Provider ─────────────────────────────────────────────────────────

interface Props {
  children: ReactNode
}

export function I18nProvider({ children }: Props): ReactNode {
  const [language, setLanguageState] = useState<Language>('system')

  // Init from localStorage (sync), then IPC (async)
  useEffect(() => {
    // 1. Sync fallback from localStorage
    const cached = localStorage.getItem('flashnote-language')
    if (cached === 'zh-CN' || cached === 'en' || cached === 'system') {
      setLanguageState(cached)
    }

    // 2. Async read from config (authoritative)
    window.electronAPI.settings.get('language').then((saved) => {
      const l = (typeof saved === 'string' && ['zh-CN', 'en', 'system'].includes(saved)
        ? saved
        : 'system') as Language
      setLanguageState(l)
      localStorage.setItem('flashnote-language', l)
    }).catch((err) => console.error('Failed to load language from settings:', err))

    // 3. Listen for cross-window changes
    const unsub = window.electronAPI.on('event:settings-changed', (data: unknown) => {
      const d = data as { key: string; value: unknown }
      if (d.key === 'language') {
        const l = (typeof d.value === 'string' && ['zh-CN', 'en', 'system'].includes(d.value)
          ? d.value
          : 'system') as Language
        setLanguageState(l)
        localStorage.setItem('flashnote-language', l)
      }
    })
    return unsub
  }, [])

  const setLanguage = useCallback((l: Language) => {
    setLanguageState(l)
    localStorage.setItem('flashnote-language', l)
    window.electronAPI.settings.set('language', l).catch((err) => console.error('Failed to save language:', err))
  }, [])

  const resolved = resolveLanguage(language)
  const messages = translations[resolved]

  const t = useCallback(
    (key: keyof Translations, params?: Record<string, string | number>) =>
      format(messages[key] ?? zhCN[key] ?? String(key), params),
    [messages]
  )

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}
