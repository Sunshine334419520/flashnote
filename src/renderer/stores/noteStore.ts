import { create } from 'zustand'
import type { Note, NoteCreateRequest, NoteUpdateRequest, SearchQuery } from '../../shared/types'

interface NoteState {
  notes: Note[]
  selectedNoteId: string | null
  isLoading: boolean
  activeCategory: string | null
  searchQuery: string

  // Actions
  fetchNotes: (query?: Partial<SearchQuery>) => Promise<void>
  createNote: (req: NoteCreateRequest) => Promise<Note>
  updateNote: (req: NoteUpdateRequest) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  selectNote: (id: string | null) => void
  setActiveCategory: (category: string | null) => void
  setSearchQuery: (query: string) => void

  // Derived helpers
  getSelectedNote: () => Note | undefined
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  selectedNoteId: null,
  isLoading: false,
  activeCategory: null,
  searchQuery: '',

  fetchNotes: async (query) => {
    set({ isLoading: true })
    try {
      const result = await window.electronAPI.notes.list({
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: 200,
        offset: 0,
        category: query?.category ?? get().activeCategory ?? undefined,
        text: query?.text ?? (get().searchQuery || undefined),
        tags: query?.tags,
        ...query
      })
      set({ notes: result.notes, isLoading: false })
    } catch (err) {
      console.error('Failed to fetch notes:', err)
      set({ isLoading: false })
    }
  },

  createNote: async (req) => {
    const note = await window.electronAPI.notes.create(req)
    set((state) => ({ notes: [note, ...state.notes] }))
    return note
  },

  updateNote: async (req) => {
    const note = await window.electronAPI.notes.update(req)
    set((state) => ({
      notes: state.notes.map((n) => (n.id === note.id ? note : n))
    }))
  },

  deleteNote: async (id) => {
    await window.electronAPI.notes.delete(id)
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
      selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId
    }))
  },

  selectNote: (id) => set({ selectedNoteId: id }),

  setActiveCategory: (category) => {
    set({ activeCategory: category })
    get().fetchNotes({ category: category ?? undefined })
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  getSelectedNote: () => {
    const { notes, selectedNoteId } = get()
    return notes.find((n) => n.id === selectedNoteId)
  },

}))
