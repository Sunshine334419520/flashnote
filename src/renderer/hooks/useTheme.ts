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
    }).catch(() => {
      // settings not available (mock mode) — use system default
      applyTheme('system')
    })
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
    window.electronAPI.settings.set('theme', t).catch(() => {})
  }, [])

  return { theme, setTheme }
}
