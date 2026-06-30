import { type ReactElement, type ChangeEvent, useState, useRef, useEffect, useCallback } from 'react'
import { useNoteStore } from '../../stores/noteStore'
import { Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps): ReactElement {
  const [showAtMenu, setShowAtMenu] = useState(false)
  const [atFilter, setAtFilter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const notes = useNoteStore((s) => s.notes)
  const fetchNotes = useNoteStore((s) => s.fetchNotes)

  // Build @ suggestions from categories + note titles
  const suggestions = getAtSuggestions(notes, atFilter)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    onChange(v)

    // Check for @ trigger
    const atMatch = v.match(/@(\S*)$/)
    if (atMatch) {
      setAtFilter(atMatch[1])
      setShowAtMenu(true)
    } else {
      setShowAtMenu(false)
    }
  }

  const handleSelectAt = (item: string) => {
    const newValue = value.replace(/@\S*$/, `@${item} `)
    onChange(newValue)
    setShowAtMenu(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const trimmed = value.trim()
      if (!trimmed) return
      // Full sentence → AI search
      if (trimmed.includes(' ')) {
        fetchNotes({ text: trimmed })
      }
      // Short keyword → already handled by local filter in CardWall
    }
    if (e.key === 'Escape') setShowAtMenu(false)
  }

  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search notes or ask AI..."
        className="w-full bg-muted/50 rounded-xl pl-9 pr-3 py-2 text-sm outline-none border border-transparent focus:border-primary/20 focus:bg-muted transition-all placeholder:text-muted-foreground/50"
      />

      {/* @ dropdown */}
      {showAtMenu && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card rounded-xl border shadow-xl z-50 max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSelectAt(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
            >
              <span className="text-[10px] text-muted-foreground">
                {s.length > 20 ? '📝' : '📁'}
              </span>
              <span className="truncate">{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Collect unique categories + note titles for @ suggestions */
function getAtSuggestions(notes: { category: string; title: string }[], filter: string): string[] {
  const items = new Set<string>()
  for (const n of notes) {
    items.add(n.category)
    if (n.title.length <= 20) items.add(n.title)
  }
  const filtered = Array.from(items).filter((i) => i.toLowerCase().includes(filter.toLowerCase()))
  return filtered.slice(0, 8)
}
