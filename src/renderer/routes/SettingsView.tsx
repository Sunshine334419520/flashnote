import type { ReactElement } from 'react'
import { AIProviderSettings } from '../components/settings/AIProviderSettings'
import { ThemeSelector } from '../components/settings/ThemeSelector'
import { LanguageSelector } from '../components/settings/LanguageSelector'
import { useTheme } from '../hooks/useTheme'
import { useT } from '../i18n'

export function SettingsView(): ReactElement {
  const { theme, setTheme } = useTheme()
  const { t } = useT()

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Fixed, draggable header — reserves space for the macOS traffic lights so
          scrolling content never slides under the window buttons. */}
      <div className="shrink-0 drag-region pt-10 pb-4 px-8 border-b border-border">
        <h1 className="text-title font-semibold text-foreground">{t('settings.title')}</h1>
      </div>
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <ThemeSelector theme={theme} onChange={setTheme} />
        <div className="border-t border-border" />
        <LanguageSelector />
        <div className="border-t border-border" />
        <AIProviderSettings />
      </div>
    </div>
  )
}
