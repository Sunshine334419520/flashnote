import { type ReactElement, useEffect, useState, useCallback } from 'react'
import { useNoteStore } from '../stores/noteStore'
import { useTaskStore } from '../stores/taskStore'
import { Settings } from 'lucide-react'
import { CardWall } from '../components/cards/CardWall'
import { CommandInput } from '../components/command/CommandInput'
import type { AICommand } from '../components/command/CommandInput'
import { TaskBar } from '../components/task/TaskBar'
import type { Note, TaskInfo } from '../../shared/types'
import { mockNotes } from '../data/mockNotes'

/** Toggle this to switch between mock data and real store data */
const USE_MOCK = true

export function MainView(): ReactElement {
  const fetchNotes = useNoteStore((s) => s.fetchNotes)
  const searchQuery = useNoteStore((s) => s.searchQuery)
  const setSearchQuery = useNoteStore((s) => s.setSearchQuery)
  const addTask = useTaskStore((s) => s.addTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)

  // Mock data state (for demo: CRUD on local notes array)
  const [notes, setNotes] = useState<Note[]>(mockNotes)

  // Fetch real data on mount (for when mock is disabled)
  useEffect(() => {
    if (!USE_MOCK) {
      fetchNotes()
      fetchTasks()
    }
  }, [])

  // Real-time IPC events
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

  // ---- Mock CRUD handlers ----
  const handleUpdate = useCallback((id: string, title: string, content: string) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, title, content, updatedAt: new Date().toISOString(), isManuallyEdited: true }
          : n
      )
    )
  }, [])

  const handleDelete = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const handleAICommand = useCallback((cmd: AICommand) => {
    if (cmd.type === 'search') {
      // AI search: set search query to trigger fetchNotes
      setSearchQuery(cmd.raw)
      // TODO: send to AI service for semantic search
    } else if (cmd.type === 'add') {
      // AI create: treat as if user typed it for capture
      const newNote: Note = {
        id: `mock-${Date.now()}`,
        type: 'text',
        title: cmd.raw.length > 50 ? cmd.raw.slice(0, 50) + '...' : cmd.raw,
        content: cmd.raw,
        category: 'Notes',
        tags: [],
        sensitive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isClassified: false,
        isManuallyEdited: false,
        status: 'published',
        metadata: {},
      }
      setNotes((prev) => [newNote, ...prev])
    } else if (cmd.type === 'delete' || cmd.type === 'edit') {
      // TODO: send to AI to locate target note, then execute
      console.log(`AI ${cmd.type}: "${cmd.raw}" (not yet implemented)`)
    }
  }, [setSearchQuery])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* AI Command Bar — draggable region on macOS hiddenInset */}
      <div className="shrink-0 px-24 pt-[32px] pb-[6px] drag-region">
        <div className="no-drag flex items-start gap-3">
          <div className="flex-1">
            <CommandInput
              mode="local"
              value={searchQuery}
              onChange={setSearchQuery}
              notes={USE_MOCK ? notes : undefined}
              onCommit={handleAICommand}
            />
          </div>
          <button
            onClick={() => window.electronAPI.window.showSettings()}
            className="shrink-0 mt-1 p-2 rounded-xl text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Card canvas */}
      <div className="flex-1 overflow-y-auto">
        <CardWall
          notes={USE_MOCK ? notes : undefined}
          onUpdate={USE_MOCK ? handleUpdate : undefined}
          onDelete={USE_MOCK ? handleDelete : undefined}
        />
      </div>

      {/* Status bar */}
      <TaskBar />
    </div>
  )
}
