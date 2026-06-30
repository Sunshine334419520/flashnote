import type { ReactElement } from 'react'
import { AIProviderSettings } from '../components/settings/AIProviderSettings'

export function SettingsView(): ReactElement {
  return (
    <div className="h-screen bg-background overflow-y-auto">
      <AIProviderSettings />
    </div>
  )
}
