import { type ReactElement, type ChangeEvent, useState, useRef, useCallback, useEffect } from 'react'
import { useNoteStore } from '../../stores/noteStore'
import { CornerDownLeft, Loader2, Square } from 'lucide-react'
import { ICONS } from '../../assets/iconAssets'
import { useT } from '../../i18n'
import { IME_COMPOSING_KEYCODE } from '../../../shared/constants'
import type { Note } from '../../../shared/types'

// ── / command definitions ──────────────────────────────────────────────

interface CommandDef {
  /** Full command name, e.g. '/search'. Empty string for the natural-language entry. */
  name: string
  /** Short alias, e.g. '/s'. Empty for the natural-language entry. */
  alias: string
  /** Chinese label */
  label: string
}

const COMMANDS: CommandDef[] = [
  { name: '', alias: '', label: 'cmd.natural' },
  { name: '/search', alias: '/s', label: 'cmd.search' },
  { name: '/add', alias: '/a', label: 'cmd.add' },
  { name: '/delete', alias: '/d', label: 'cmd.delete' },
  { name: '/edit', alias: '/e', label: 'cmd.edit' },
]

export interface AICommand {
  type: 'search' | 'add' | 'delete' | 'edit'
  raw: string
  explicit: boolean
}

// ── Props ──────────────────────────────────────────────────────────────

interface Props {
  mode: 'local' | 'ai'
  value: string
  onChange: (value: string) => void
  notes?: Note[]
  onCommit?: (cmd: AICommand) => void
  /** True while an async `/` command is running: locks input and shows the abort/processing UI. */
  processing?: boolean
  /** Called when the user aborts a running command (stop icon or Esc). */
  onAbort?: () => void
}

// ── Component ──────────────────────────────────────────────────────────

export function CommandInput({ mode, value, onChange, notes: externalNotes, onCommit, processing = false, onAbort }: Props): ReactElement {
  // Dropdown state: null = none, 'at' = @ mention, 'slash' = / command
  const [dropdown, setDropdown] = useState<'at' | 'slash' | null>(null)
  const [filter, setFilter] = useState('')
  const [highlightedIdx, setHighlightedIdx] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const storeNotes = useNoteStore((s) => s.notes)
  const setActiveCategory = useNoteStore((s) => s.setActiveCategory)
  const { t } = useT()

  const notes = (externalNotes ?? storeNotes) as Note[]
  const isAiMode = mode === 'ai' || value.startsWith('/')

  // ── Suggestions ──────────────────────────────────────────────────

  const atSuggestions = getAtSuggestions(notes, filter)
  const slashCommands = filterCommands(filter)

  const suggestions = dropdown === 'at' ? atSuggestions : dropdown === 'slash' ? slashCommands : []

  // ── Scroll highlighted into view ──────────────────────────────────

  useEffect(() => {
    if (dropdown && itemRefs.current[highlightedIdx]) {
      itemRefs.current[highlightedIdx]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIdx, dropdown])

  // ── Reset helpers ─────────────────────────────────────────────────

  const resetDropdown = useCallback(() => {
    setDropdown(null)
    setHighlightedIdx(0)
    setFilter('')
  }, [])

  // ── Input change ─────────────────────────────────────────────────

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    onChange(v)

    // / trigger
    const slashMatch = v.match(/^\/(\S*)$/)
    if (slashMatch) {
      setFilter(slashMatch[1])
      setDropdown('slash')
      setHighlightedIdx(0)
      setHint(null)
      return
    }

    // @ trigger (only when NOT preceded by /command)
    if (!v.match(/^\/\S+\s/)) {
      const atMatch = v.match(/@(\S*)$/)
      if (atMatch) {
        setFilter(atMatch[1])
        setDropdown('at')
        setHighlightedIdx(0)
        setHint(null)
        return
      }
    }

    resetDropdown()
    updateHint(v)
  }

  // ── Select item ──────────────────────────────────────────────────

  const handleSelectAt = (item: string) => {
    const newValue = value.replace(/@\S*$/, `@${item} `)
    onChange(newValue)
    resetDropdown()
    setHint(null)

    const categories = new Set(notes.map((n) => n.category))
    if (categories.has(item)) {
      setActiveCategory(item)
    }

    inputRef.current?.focus()
  }

  const handleSelectSlash = (cmd: CommandDef) => {
    // Natural language: replace / with '/ ' to let user type naturally
    // Explicit command: replace with '/search ' etc.
    const replacement = cmd.name ? `${cmd.name} ` : '/ '
    const newValue = value.replace(/^\/\S*$/, replacement)
    onChange(newValue)
    resetDropdown()
    setHint(null)
    inputRef.current?.focus()
  }

  // ── Keyboard ─────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Processing: input is locked. Only Esc (abort) is honored.
    if (processing) {
      e.preventDefault()
      if (e.key === 'Escape') onAbort?.()
      return
    }

    // IME composition (e.g. confirming a pinyin candidate with Enter): let the
    // input method own the key — never treat it as submit/select/navigate.
    if (e.nativeEvent.isComposing || e.keyCode === IME_COMPOSING_KEYCODE) return

    // Dropdown open: arrow keys + enter
    if (dropdown && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIdx((prev) => (prev + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (dropdown === 'at') {
          handleSelectAt(suggestions[highlightedIdx] as string)
        } else {
          handleSelectSlash(slashCommands[highlightedIdx])
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        resetDropdown()
        setHint(null)
        return
      }
      return
    }

    // No dropdown — Enter behavior
    if (e.key === 'Enter') {
      const trimmed = value.trim()
      if (!trimmed) return

      if (trimmed.startsWith('/')) {
        // AI mode — extract type from command
        const cmd = parseCommand(trimmed)
        if (cmd && onCommit) {
          onCommit(cmd)
          setHint(null)
        }
      }
      // single keyword — already handled by live filter; no Enter action needed
    }

    if (e.key === 'Escape') {
      resetDropdown()
      setHint(null)
    }
  }

  // ── Hint ─────────────────────────────────────────────────────────

  const updateHint = (v: string) => {
    if (v.startsWith('/') && v.includes(' ') && v.length > 3) {
      setHint(t('search.aiMode'))
    } else if (v.length > 0 && !v.includes(' ')) {
      setHint(t('search.filtering'))
    } else {
      setHint(null)
    }
  }

  const handleFocus = () => updateHint(value)

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative rounded-xl border border-border bg-card glow-amber">
        <img src={ICONS.icon64} className="absolute left-4 top-1/2 -translate-y-1/2 w-[15px] h-[15px] opacity-40 pointer-events-none" alt="" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={() => setHint(null)}
          readOnly={processing}
          placeholder={t('search.placeholder')}
          className={`w-full bg-transparent pl-10 pr-16 py-3 text-body outline-none placeholder:text-muted-foreground/35 ${
            processing ? 'cursor-not-allowed text-muted-foreground' : ''
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {processing ? (
            <button
              type="button"
              onClick={onAbort}
              aria-label={t('search.abort')}
              className="group relative inline-flex items-center justify-center w-7 h-7 rounded-md text-primary hover:bg-primary/10 transition-colors"
            >
              <Square size={14} className="fill-current" />
              <span className="pointer-events-none absolute top-full right-0 mt-2.5 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-micro font-medium text-background opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                {t('search.abort')}
              </span>
            </button>
          ) : (
            <>
              {hint && (
                <span className="text-micro text-muted-foreground/50 hidden sm:inline">{hint}</span>
              )}
              <kbd className="hidden sm:inline-flex items-center gap-0.5 text-micro px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground/50 font-mono">
                <CornerDownLeft size={12} />
              </kbd>
            </>
          )}
        </div>
      </div>

      {/* Below-box status: processing indicator vs. hint bar */}
      {processing ? (
        <div className="flex items-center gap-2 mt-2 pl-[6px] text-caption font-medium text-primary">
          <Loader2 size={12} className="animate-spin" />
          <span>{t('search.processing')}</span>
          <span className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1 h-1 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1 h-1 rounded-full bg-primary/60 animate-bounce" />
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mt-2 pl-[6px] text-micro text-muted-foreground/35">
          <span>{t('search.hint.keyword')}</span>
          <span>·</span>
          <span>{t('search.hint.category')}</span>
          <span>·</span>
          <span>{t('search.hint.ai')}</span>
        </div>
      )}

      {/* Dropdown (shared for @ and /) */}
      {dropdown && suggestions.length > 0 && (
        <div ref={menuRef} className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl border border-border shadow-lg z-50 max-h-56 overflow-y-auto py-1">
          {suggestions.map((s, i) => (
            <button
              key={i}
              ref={(el) => { itemRefs.current[i] = el }}
              onMouseDown={(e) => {
                e.preventDefault()
                if (dropdown === 'at') handleSelectAt(s as string)
                else handleSelectSlash(s as CommandDef)
              }}
              onMouseEnter={() => setHighlightedIdx(i)}
              className={`w-full text-left px-4 py-2 text-body transition-colors flex items-center gap-2 ${
                i === highlightedIdx ? 'bg-muted' : 'hover:bg-muted/50'
              }`}
            >
              {dropdown === 'slash' ? (
                <>
                  <span className="font-medium text-body shrink-0 w-20">
                    {(s as CommandDef).name || '/'}
                  </span>
                  <span className="text-label text-muted-foreground flex-1">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t((s as CommandDef).label as any)}
                  </span>
                  {(s as CommandDef).alias && (
                    <span className="text-micro text-muted-foreground/40 font-mono shrink-0">
                      {(s as CommandDef).alias}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-caption text-muted-foreground shrink-0">
                    {(s as string).length > 20 ? '📝' : '📁'}
                  </span>
                  <span className="truncate">{s as string}</span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

function getAtSuggestions(notes: { category: string; title: string }[], filter: string): string[] {
  const items = new Set<string>()
  for (const n of notes) {
    items.add(n.category)
    if (n.title.length <= 20) items.add(n.title)
  }
  const filtered = Array.from(items).filter((i) => i.toLowerCase().includes(filter.toLowerCase()))
  return filtered.slice(0, 8)
}

function filterCommands(filter: string): CommandDef[] {
  if (!filter) return COMMANDS
  const f = filter.toLowerCase()
  return COMMANDS.filter(
    (c) => c.name.includes(f) || c.alias.includes(f)
  )
}

function parseCommand(trimmed: string): AICommand | null {
  // Explicit command: /search <query>, /add <content>, etc.
  const explicitMatch = trimmed.match(/^\/(\S+)\s+(.+)/)
  if (explicitMatch) {
    const cmd = explicitMatch[1].toLowerCase()
    const raw = explicitMatch[2]
    if (cmd === 'search' || cmd === 's') return { type: 'search', raw, explicit: true }
    if (cmd === 'add' || cmd === 'a') return { type: 'add', raw, explicit: true }
    if (cmd === 'delete' || cmd === 'd') return { type: 'delete', raw, explicit: true }
    if (cmd === 'edit' || cmd === 'e') return { type: 'edit', raw, explicit: true }
    return null
  }

  // Natural language: / <question> — AI identifies intent
  const naturalMatch = trimmed.match(/^\/\s+(.+)/)
  if (naturalMatch) {
    return { type: 'search', raw: naturalMatch[1], explicit: false }
  }

  return null
}
