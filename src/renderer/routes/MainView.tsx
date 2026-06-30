import { type ReactElement, useEffect } from 'react'
import { useNoteStore } from '../stores/noteStore'
import { useTaskStore } from '../stores/taskStore'
import { CardWall } from '../components/cards/CardWall'
import { SearchBar } from '../components/search/SearchBar'
import { CategoryList } from '../components/categories/CategoryList'
import { TaskBar } from '../components/task/TaskBar'
import type { Note, TaskInfo } from '../../shared/types'

export function MainView(): ReactElement {
  const fetchNotes = useNoteStore((s) => s.fetchNotes)
  const searchQuery = useNoteStore((s) => s.searchQuery)
  const setSearchQuery = useNoteStore((s) => s.setSearchQuery)
  const activeCategory = useNoteStore((s) => s.activeCategory)
  const setActiveCategory = useNoteStore((s) => s.setActiveCategory)
  const addTask = useTaskStore((s) => s.addTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)

  useEffect(() => {
    fetchNotes()
    fetchTasks()
  }, [])

  useEffect(() => {
    const c1 = window.electronAPI.on('event:note-created', (n: unknown) => {
      if ((n as Note).status === 'published') fetchNotes()
    })
    const c2 = window.electronAPI.on('event:note-updated', () => fetchNotes())
    const c3 = window.electronAPI.on('event:task-created', (t: unknown) => addTask(t as TaskInfo))
    const c4 = window.electronAPI.on('event:task-completed', (t: unknown) => updateTask(t as TaskInfo))
    const c5 = window.electronAPI.on('event:task-failed', (t: unknown) => updateTask(t as TaskInfo))
    return () => { c1(); c2(); c3(); c4(); c5() }
  }, [fetchNotes, addTask, updateTask])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar: search + quick capture hint */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="flex-1 max-w-xl">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
        <span className="text-[11px] text-muted-foreground/50 hidden sm:inline">
          Alt+Space to capture
        </span>
      </div>

      {/* Content: sidebar + card wall */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-48 shrink-0 border-r border-border bg-card/30 overflow-y-auto px-2 py-3">
          <CategoryList activeCategory={activeCategory} onSelect={setActiveCategory} />
        </aside>
        <main className="flex-1 overflow-y-auto">
          <CardWall />
        </main>
      </div>

      {/* Bottom task bar */}
      <TaskBar />
    </div>
  )
}
