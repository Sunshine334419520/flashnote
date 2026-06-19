import type { ReactElement } from 'react'

export function SettingsView(): ReactElement {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Coming in Phase 5</p>
      </div>
    </div>
  )
}
