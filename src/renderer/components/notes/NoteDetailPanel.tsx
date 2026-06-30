import { type ReactElement, useState, useEffect, useCallback } from 'react'
import { useNoteStore } from '../../stores/noteStore'
import { NoteContent } from './NoteContent'
import { TagEditor } from './TagEditor'
import { format } from 'date-fns'
import { Trash2 } from 'lucide-react'
import type { Note } from '../../../shared/types'

export function NoteDetailPanel(): ReactElement {
  const selectedNoteId = useNoteStore((s) => s.selectedNoteId)
  const getSelectedNote = useNoteStore((s) => s.getSelectedNote)
  const updateNote = useNoteStore((s) => s.updateNote)
  const deleteNote = useNoteStore((s) => s.deleteNote)
  const selectNote = useNoteStore((s) => s.selectNote)

  const note = getSelectedNote()
  const [fullNote, setFullNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)

  // Fetch full note with content when selected (list endpoint omits content)
  useEffect(() => {
    if (selectedNoteId) {
      window.electronAPI.notes.get(selectedNoteId).then((n) => {
        if (n) setFullNote(n)
      })
    } else {
      setFullNote(null)
    }
  }, [selectedNoteId])

  useEffect(() => {
    if (note) {
      setTitle(note.title)
      setIsEditingTitle(false)
    }
  }, [note?.id])

  // Subscribe to note updates (e.g. AI background classification)
  useEffect(() => {
    const cleanup = window.electronAPI.on('event:note-updated', (_updated: unknown) => {
      const updated = _updated as Note
      if (fullNote && updated.id === fullNote.id) {
        window.electronAPI.notes.get(updated.id).then((n) => {
          if (n) setFullNote(n)
        })
      }
    })
    return cleanup
  }, [fullNote])

  const displayNote = fullNote ?? note

  const handleTitleSave = useCallback(() => {
    if (displayNote && title.trim() && title !== displayNote.title) {
      updateNote({ id: displayNote.id, title: title.trim() })
    }
    setIsEditingTitle(false)
  }, [displayNote, title, updateNote])

  const handleTagsChange = useCallback(
    (tags: string[]) => {
      if (displayNote) {
        updateNote({ id: displayNote.id, tags })
      }
    },
    [displayNote, updateNote]
  )

  const handleDelete = useCallback(() => {
    if (displayNote) {
      deleteNote(displayNote.id)
    }
  }, [displayNote, deleteNote])

  if (!displayNote) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground/40">
        <p className="text-sm">Select a note to view</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border space-y-2">
        <div className="flex items-start justify-between gap-2">
          {isEditingTitle ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave()
                if (e.key === 'Escape') {
                  setTitle(displayNote.title)
                  setIsEditingTitle(false)
                }
              }}
              className="flex-1 text-lg font-bold bg-transparent outline-none border-b-2 border-primary"
              autoFocus
            />
          ) : (
            <h2
              className="text-lg font-bold cursor-text hover:text-primary/80 transition-colors"
              onClick={() => setIsEditingTitle(true)}
            >
              {displayNote.title}
            </h2>
          )}
          <button
            onClick={handleDelete}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            title="Delete note"
          >
            <Trash2 size={15} />
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="px-2 py-0.5 rounded-md bg-muted/50">{displayNote.category}</span>
          <span>Created {format(new Date(displayNote.createdAt), 'MMM d, yyyy HH:mm')}</span>
          {displayNote.updatedAt !== displayNote.createdAt && (
            <span>· Updated {format(new Date(displayNote.updatedAt), 'MMM d, yyyy HH:mm')}</span>
          )}
        </div>

        <TagEditor tags={displayNote.tags} onChange={handleTagsChange} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <NoteContent content={displayNote.content} />
      </div>
    </div>
  )
}
