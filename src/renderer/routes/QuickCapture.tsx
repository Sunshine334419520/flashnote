import {
  type ReactElement,
  useState,
  useRef,
  useEffect,
  useCallback
} from 'react'
import {
  Key,
  Globe,
  Terminal,
  Shield,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  CornerDownLeft
} from 'lucide-react'
import { useT } from '../i18n'
import { cn } from '../lib/cn'
import { ICONS } from '../assets/iconAssets'
import type { Note, NoteType, AICommandResult } from '../../shared/types'

// ── Type metadata ─────────────────────────────────────────────────────────

const TYPE_META: Record<NoteType, { icon: typeof Key; color: string; badge: string; labelKey: string }> = {
  apikey: { icon: Key, color: 'text-type-apikey', badge: 'bg-type-apikey/10 text-type-apikey', labelKey: 'type.apikey' },
  bookmark: { icon: Globe, color: 'text-type-bookmark', badge: 'bg-type-bookmark/10 text-type-bookmark', labelKey: 'type.bookmark' },
  command: { icon: Terminal, color: 'text-type-command', badge: 'bg-type-command/10 text-type-command', labelKey: 'type.command' },
  credential: { icon: Shield, color: 'text-type-credential', badge: 'bg-type-credential/10 text-type-credential', labelKey: 'type.credential' },
  text: { icon: FileText, color: 'text-type-text', badge: 'bg-type-text/10 text-type-text', labelKey: 'type.text' }
}

/** Snippet for the result row subtitle. */
function snippet(note: Note): string {
  if (note.type === 'bookmark') {
    const url = (note.typedData as Record<string, string>)?.url ?? note.content
    try {
      return new URL(url).hostname
    } catch {
      return url.slice(0, 60)
    }
  }
  if (note.sensitive) return '●'.repeat(12)
  return note.content.length > 60 ? note.content.slice(0, 60) + '…' : note.content
}

// ── Component ─────────────────────────────────────────────────────────────

export function QuickCapture(): ReactElement {
  const { t } = useT()
  const [input, setInput] = useState('')
  const [results, setResults] = useState<Note[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isComposing = useRef(false)
  const pendingRef = useRef(false) // true when an async op is still running after close

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [])

  // ── Local search while typing ─────────────────────────────────────────

  useEffect(() => {
    const trimmed = input.trim()
    if (!trimmed) {
      setResults([])
      setSelectedIdx(0)
      setStatusMsg(null)
      return
    }

    let cancelled = false
    const doSearch = async () => {
      try {
        const r = await window.electronAPI.search.query({
          text: trimmed,
          sortBy: 'updatedAt',
          sortOrder: 'desc',
          limit: 6,
          offset: 0
        })
        if (!cancelled) {
          setResults(r.notes)
          setSelectedIdx(0)
          setStatusMsg(null)
        }
      } catch {
        // Ignore search errors during typing
      }
    }
    doSearch()
    return () => { cancelled = true }
  }, [input])

  // ── Reset selected index when results change ───────────────────────────

  useEffect(() => {
    setSelectedIdx(0)
  }, [results.length])

  // ── Primary action per type ────────────────────────────────────────────

  const executeAction = useCallback(async (note: Note) => {
    if (note.type === 'bookmark') {
      const url = (note.typedData as Record<string, string>)?.url ?? note.content
      try {
        new URL(url)
        await window.electronAPI.shell.openExternal(url)
      } catch {
        // Invalid URL, fall through to copy
        await navigator.clipboard.writeText(note.content)
      }
    } else {
      await navigator.clipboard.writeText(note.content)
      setCopiedId(note.id)
      setTimeout(() => setCopiedId(null), 1500)
    }
  }, [])

  // ── Enter: AI intent → search or add ──────────────────────────────────

  const handleEnter = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || processing) return

    // If results exist and user hasn't modified input much, treat as selection
    // of the highlighted result rather than a new AI query.
    if (results.length > 0 && selectedIdx < results.length) {
      const selected = results[selectedIdx]
      await executeAction(selected)
      window.electronAPI.window.hideQuickCapture()
      return
    }

    // No results or empty results → AI pipeline
    setProcessing(true)
    setStatusMsg(null)
    pendingRef.current = true

    try {
      const result: AICommandResult = await window.electronAPI.aiCommand.run({
        id: crypto.randomUUID(),
        type: 'search',
        raw: trimmed,
        explicit: false
      })

      if (result.kind === 'search') {
        if (result.notes.length > 0) {
          setResults(result.notes)
          setSelectedIdx(0)
        } else {
          setStatusMsg(t('search.noResults'))
        }
      } else if (result.kind === 'add') {
        // Note created successfully
        setStatusMsg(t('quickcapture.created'))
        setInput('')
        setResults([])
        setTimeout(() => window.electronAPI.window.hideQuickCapture(), 800)
      }
      // delete/edit intents are ignored — QuickCapture only does search+add
    } catch (err) {
      console.error('AI command failed:', err)
      setStatusMsg(t('search.failed'))
    } finally {
      setProcessing(false)
      pendingRef.current = false
    }
  }, [input, processing, results, selectedIdx, executeAction, t])

  // ── Keyboard ───────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // IME composition
    if (e.nativeEvent.isComposing || isComposing.current) return

    if (e.key === 'Enter') {
      e.preventDefault()
      handleEnter()
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      if (results.length > 0 || input.trim()) {
        // First Esc: clear input/results
        setInput('')
        setResults([])
        setStatusMsg(null)
      } else {
        // Second Esc: close window
        // Don't abort pending operations — they continue in background
        window.electronAPI.window.hideQuickCapture()
      }
      return
    }

    // Arrow navigation when results are visible
    if (results.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((prev) => (prev + 1) % results.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((prev) => (prev - 1 + results.length) % results.length)
        return
      }
    }
  }

  // ── Click outside → close ──────────────────────────────────────────────

  const handleBackdropClick = () => {
    // Don't abort pending AI operations
    window.electronAPI.window.hideQuickCapture()
  }

  const showResults = results.length > 0 && !processing
  const showHint = !input.trim() && !processing && !statusMsg

  return (
    <div
      className="h-full bg-transparent flex items-start justify-center pt-[18vh]"
      onMouseDown={handleBackdropClick}
    >
      <div
        className="w-full max-w-[680px] mx-4 bg-card rounded-xl shadow-2xl border border-border/60 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Input bar ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 h-[52px]">
          <img
            src={ICONS.icon64}
            className="w-[18px] h-[18px] opacity-40 shrink-0"
            alt=""
          />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => { isComposing.current = true }}
            onCompositionEnd={() => { isComposing.current = false }}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground/35 text-foreground"
            autoFocus
            spellCheck={false}
          />
          {processing ? (
            <Loader2 size={16} className="animate-spin text-primary shrink-0" />
          ) : input.trim() ? (
            <kbd className="shrink-0 inline-flex items-center gap-0.5 text-micro px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground/40 font-mono">
              <CornerDownLeft size={12} />
            </kbd>
          ) : null}
        </div>

        {/* ── Divider ────────────────────────────────────────────────── */}
        {(showResults || processing || statusMsg) && (
          <div className="border-t border-border/50" />
        )}

        {/* ── Processing / status ────────────────────────────────────── */}
        {processing && (
          <div className="flex items-center gap-2 px-4 py-6 text-caption text-muted-foreground">
            <Loader2 size={14} className="animate-spin text-primary" />
            <span>{t('search.processing')}</span>
          </div>
        )}

        {statusMsg && !processing && (
          <div className="flex items-center gap-2 px-4 py-5 text-body text-muted-foreground/60 justify-center">
            {statusMsg === t('quickcapture.created') && (
              <Check size={16} className="text-type-command" />
            )}
            <span>{statusMsg}</span>
          </div>
        )}

        {/* ── Result list ────────────────────────────────────────────── */}
        {showResults && (
          <div className="pb-2">
            {results.map((note, i) => {
              const meta = TYPE_META[note.type]
              const Icon = meta.icon
              const isSelected = i === selectedIdx
              const isCopied = copiedId === note.id

              return (
                <div
                  key={note.id}
                  className={cn(
                    'flex items-center gap-3 px-4 h-[48px] cursor-pointer transition-colors',
                    isSelected ? 'bg-muted/70' : 'hover:bg-muted/40'
                  )}
                  onClick={() => { executeAction(note); window.electronAPI.window.hideQuickCapture() }}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  {/* Type icon */}
                  <Icon size={16} className={cn(meta.color, 'shrink-0', isSelected ? 'opacity-100' : 'opacity-70')} />

                  {/* Title + snippet */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-body font-medium truncate">{note.title}</span>
                    <span className="text-caption text-muted-foreground/50 truncate hidden sm:inline">
                      {snippet(note)}
                    </span>
                  </div>

                  {/* Type badge (small screens hide) */}
                  <span
                    className={cn(
                      'hidden sm:inline shrink-0 text-micro px-1.5 py-0.5 rounded font-medium',
                      meta.badge
                    )}
                  >
                    {t(meta.labelKey as never)}
                  </span>

                  {/* Primary action */}
                  <span
                    className={cn(
                      'shrink-0 text-caption transition-colors',
                      isCopied
                        ? 'text-type-command'
                        : isSelected
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/40'
                    )}
                  >
                    {isCopied ? (
                      <span className="inline-flex items-center gap-1">
                        <Check size={12} />
                        {t('card.copied')}
                      </span>
                    ) : note.type === 'bookmark' ? (
                      <span className="inline-flex items-center gap-1">
                        <ExternalLink size={12} />
                        {t('card.open')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Copy size={12} />
                        {t('card.copy')}
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Bottom hint bar ────────────────────────────────────────── */}
        {showHint && (
          <div className="border-t border-border/50 flex items-center gap-1.5 px-4 py-2.5 text-micro text-muted-foreground/30">
            <span>{t('search.hint.keyword')}</span>
            <span>·</span>
            <span>{t('search.hint.ai')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
