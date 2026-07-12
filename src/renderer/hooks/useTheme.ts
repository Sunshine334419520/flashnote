import { useState, useEffect, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    // system — follow OS preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  }
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>('system')

  // Read saved theme on mount
  useEffect(() => {
    window.electronAPI.settings.get('theme').then((saved) => {
      const t = (typeof saved === 'string' && ['light', 'dark', 'system'].includes(saved)
        ? saved
        : 'system') as Theme
      setThemeState(t)
      applyTheme(t)
      localStorage.setItem('flashnote-theme', t)
    }).catch((err) => {
      console.error('Failed to load theme from settings:', err)
      applyTheme('system')
    })
  }, [])

  // Listen for cross-window settings changes
  useEffect(() => {
    const unsub = window.electronAPI.on('event:settings-changed', (data: unknown) => {
      const d = data as { key: string; value: unknown }
      if (d.key === 'theme') {
        const t = (typeof d.value === 'string' && ['light', 'dark', 'system'].includes(d.value)
          ? d.value
          : 'system') as Theme
        setThemeState(t)
        applyTheme(t)
        localStorage.setItem('flashnote-theme', t)
      }
    })
    return unsub
  }, [])

  // Listen for OS theme changes (for 'system' mode)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (theme === 'system') applyTheme('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    applyTheme(t)
    localStorage.setItem('flashnote-theme', t)
    window.electronAPI.settings.set('theme', t).catch((err) => console.error('Failed to save theme:', err))
  }, [])

  return { theme, setTheme }
}
