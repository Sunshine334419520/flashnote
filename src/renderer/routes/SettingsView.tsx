import type { ReactElement } from 'react'
import { AIProviderSettings } from '../components/settings/AIProviderSettings'
import { ThemeSelector } from '../components/settings/ThemeSelector'
import { useTheme } from '../hooks/useTheme'

export function SettingsView(): ReactElement {
  const { theme, setTheme } = useTheme()

  return (
    <div className="h-screen bg-background overflow-y-auto">
      <div className="pt-8 pb-4 px-8 border-b border-border">
        <h1 className="text-base font-semibold text-foreground">Settings</h1>
      </div>
      <ThemeSelector theme={theme} onChange={setTheme} />
      <div className="border-t border-border" />
      <AIProviderSettings />
    </div>
  )
}
