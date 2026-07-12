import { type ReactElement, type ChangeEvent, useState, useRef, useCallback, useEffect } from 'react'
import { useNoteStore } from '../../stores/noteStore'
import { Search, CornerDownLeft } from 'lucide-react'
import type { Note } from '../../../shared/types'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  notes?: Note[]
}

export function SearchBar({ value, onChange, notes: externalNotes }: SearchBarProps): ReactElement {
  const [showAtMenu, setShowAtMenu] = useState(false)
  const [atFilter, setAtFilter] = useState('')
  const [highlightedIdx, setHighlightedIdx] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const storeNotes = useNoteStore((s) => s.notes)
  const fetchNotes = useNoteStore((s) => s.fetchNotes)
  const setActiveCategory = useNoteStore((s) => s.setActiveCategory)

  const notes = (externalNotes ?? storeNotes) as Note[]

  const suggestions = getAtSuggestions(notes, atFilter)

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (showAtMenu && itemRefs.current[highlightedIdx]) {
      itemRefs.current[highlightedIdx]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIdx, showAtMenu])

  const resetMenu = useCallback(() => {
    setShowAtMenu(false)
    setHighlightedIdx(0)
  }, [])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    onChange(v)

    const atMatch = v.match(/@(\S*)$/)
    if (atMatch) {
      setAtFilter(atMatch[1])
      setShowAtMenu(true)
      setHighlightedIdx(0)
      setHint(null)
    } else {
      resetMenu()
    }

    if (v.includes(' ') && v.length > 5) {
      setHint('按 Enter 使用 AI 搜索')
    } else if (v.length > 0 && !v.includes(' ')) {
      setHint('实时过滤中...')
    } else {
      setHint(null)
    }
  }

  const handleSelectAt = (item: string) => {
    // Replace the @query with the selected item + space
    const newValue = value.replace(/@\S*$/, `@${item} `)
    onChange(newValue)
    resetMenu()
    setHint(null)

    // If it's a category, activate the category filter
    const categories = new Set(notes.map((n) => n.category))
    if (categories.has(item)) {
      setActiveCategory(item)
    }

    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showAtMenu && suggestions.length > 0) {
      // Arrow down → next item
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIdx((prev) => (prev + 1) % suggestions.length)
        return
      }
      // Arrow up → previous item
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length)
        return
      }
      // Enter → select highlighted
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSelectAt(suggestions[highlightedIdx])
        return
      }
      // Escape → close menu
      if (e.key === 'Escape') {
        e.preventDefault()
        resetMenu()
        setHint(null)
        return
      }
      return
    }

    // No menu open
    if (e.key === 'Enter') {
      const trimmed = value.trim()
      if (!trimmed) return
      if (trimmed.includes(' ')) {
        setHint('AI 搜索中...')
        fetchNotes({ text: trimmed })
      }
    }
    if (e.key === 'Escape') {
      resetMenu()
      setHint(null)
    }
  }

  const handleFocus = () => {
    if (value.trim().length > 0) {
      if (value.includes(' ') && value.length > 5) setHint('按 Enter 使用 AI 搜索')
      else if (!value.includes(' ')) setHint('实时过滤中...')
    }
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative rounded-xl border border-border bg-card glow-amber">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={() => setHint(null)}
          placeholder="搜索笔记、输入指令或直接记录..."
          className="w-full bg-transparent pl-10 pr-16 py-3 text-body outline-none placeholder:text-muted-foreground/35"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {hint && (
            <span className="text-micro text-muted-foreground/50 hidden sm:inline">{hint}</span>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-micro px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground/50 font-mono">
            <CornerDownLeft size={12} />
          </kbd>
        </div>
      </div>

      {/* Hint bar */}
      <div className="flex items-center justify-center gap-4 mt-2 text-micro text-muted-foreground/35">
        <span>输入关键词实时过滤</span>
        <span>·</span>
        <span>输入完整句子 + Enter = AI 搜索</span>
        <span>·</span>
        <span>@ 分类筛选</span>
      </div>

      {/* @ dropdown */}
      {showAtMenu && suggestions.length > 0 && (
        <div ref={menuRef} className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl border border-border shadow-lg z-50 max-h-56 overflow-y-auto py-1">
          {suggestions.map((s, i) => (
            <button
              key={i}
              ref={(el) => { itemRefs.current[i] = el }}
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelectAt(s)
              }}
              onMouseEnter={() => setHighlightedIdx(i)}
              className={`w-full text-left px-4 py-2 text-body transition-colors flex items-center gap-2 ${
                i === highlightedIdx ? 'bg-muted' : 'hover:bg-muted/50'
              }`}
            >
              <span className="text-caption text-muted-foreground shrink-0">
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

function getAtSuggestions(notes: { category: string; title: string }[], filter: string): string[] {
  const items = new Set<string>()
  for (const n of notes) {
    items.add(n.category)
    if (n.title.length <= 20) items.add(n.title)
  }
  const filtered = Array.from(items).filter((i) => i.toLowerCase().includes(filter.toLowerCase()))
  return filtered.slice(0, 8)
}
