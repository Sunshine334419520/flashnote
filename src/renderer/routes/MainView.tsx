import type { ReactElement } from 'react'

export function MainView(): ReactElement {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">FlashNote</h1>
        <p className="text-lg text-muted-foreground">
          AI-native smart note-taking. Press <kbd className="px-2 py-1 rounded bg-muted text-sm font-mono">Alt+Space</kbd> to capture.
        </p>
        <p className="text-sm text-muted-foreground">
          Main interface coming in Phase 4
        </p>
      </div>
    </div>
  )
}
