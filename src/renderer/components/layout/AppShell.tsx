import type { ReactElement, ReactNode } from 'react'
import { TaskBar } from '../task/TaskBar'

interface AppShellProps {
  sidebar: ReactNode
  noteList: ReactNode
  noteDetail: ReactNode
}

export function AppShell({ sidebar, noteList, noteDetail }: AppShellProps): ReactElement {
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 3-panel content */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-60 shrink-0 border-r border-border bg-card/50 flex flex-col overflow-hidden">
          {sidebar}
        </aside>
        <main className="w-80 shrink-0 border-r border-border bg-background overflow-hidden">
          {noteList}
        </main>
        <section className="flex-1 bg-card overflow-hidden">{noteDetail}</section>
      </div>

      {/* Bottom task bar (VSCode-style) */}
      <TaskBar />
    </div>
  )
}
