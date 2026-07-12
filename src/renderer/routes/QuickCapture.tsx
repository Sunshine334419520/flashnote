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

function snippet(note: Note): string {
  if (note.type === 'bookmark') {
    const url = (note.typedData as Record<string, string>)?.url ?? note.content
    try { return new URL(url).hostname } catch { return url.slice(0, 60) }
  }
  if (note.sensitive) return '●'.repeat(12)
  return note.content.length > 60 ? note.content.slice(0, 60) + '…' : note.content
}

// ── Layout constants ─────────────────────────────────────────────────────

const INPUT_HEIGHT = 52   // input bar height in px
const ROW_HEIGHT = 48     // result row height
const HINT_HEIGHT = 36    // bottom hint bar height
const MAX_ROWS = 6

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
  const cardRef = useRef<HTMLDivElement>(null)
  const isComposing = useRef(false)

  // Body transparent (frameless window), focus input, set initial size
  useEffect(() => {
    const orig = document.body.style.backgroundColor
    document.body.style.backgroundColor = 'transparent'
    const timer = setTimeout(() => {
      inputRef.current?.focus()
      window.electronAPI.window.setSize(680, INPUT_HEIGHT)
    }, 100)
    return () => {
      document.body.style.backgroundColor = orig
      clearTimeout(timer)
    }
  }, [])

  // ── Close on blur (click outside) ────────────────────────────────────

  useEffect(() => {
    const onBlur = () => window.electronAPI.window.hideQuickCapture()
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [])

  // ── Sync window height to content ────────────────────────────────────

  useEffect(() => {
    if (!cardRef.current) return
    const ro = new ResizeObserver(() => {
      const h = cardRef.current!.getBoundingClientRect().height
      window.electronAPI.window.setSize(680, Math.ceil(h))
    })
    ro.observe(cardRef.current)
    return () => ro.disconnect()
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
          limit: MAX_ROWS,
          offset: 0
        })
        if (!cancelled) {
          setResults(r.notes)
          setSelectedIdx(0)
          setStatusMsg(null)
        }
      } catch { /* ignore */ }
    }
    doSearch()
    return () => { cancelled = true }
  }, [input])

  // ── Primary action per type ────────────────────────────────────────────

  const executeAction = useCallback(async (note: Note) => {
    if (note.type === 'bookmark') {
      const url = (note.typedData as Record<string, string>)?.url ?? note.content
      try {
        new URL(url)
        await window.electronAPI.shell.openExternal(url)
      } catch {
        await navigator.clipboard.writeText(note.content)
      }
    } else {
      await navigator.clipboard.writeText(note.content)
      setCopiedId(note.id)
      setTimeout(() => setCopiedId(null), 1500)
    }
  }, [])

  // ── Enter: select result or AI pipeline ───────────────────────────────

  const handleEnter = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || processing) return

    // Local results showing → execute action on selected item
    if (results.length > 0 && selectedIdx < results.length) {
      const selected = results[selectedIdx]
      await executeAction(selected)
      return
    }

    // No results → AI intent recognition
    setProcessing(true)
    setStatusMsg(null)

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
        setStatusMsg(t('quickcapture.created'))
        setInput('')
        setResults([])
      }
    } catch (err) {
      console.error('AI command failed:', err)
      setStatusMsg(t('search.failed'))
    } finally {
      setProcessing(false)
    }
  }, [input, processing, results, selectedIdx, executeAction, t])

  // ── Keyboard ───────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing || isComposing.current) return

    if (e.key === 'Enter') {
      e.preventDefault()
      handleEnter()
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      if (results.length > 0 || input.trim()) {
        setInput('')
        setResults([])
        setStatusMsg(null)
      } else {
        window.electronAPI.window.hideQuickCapture()
      }
      return
    }

    if (results.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((prev) => (prev + 1) % results.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((prev) => (prev - 1 + results.length) % results.length)
      }
    }
  }

  const showResults = results.length > 0 && !processing
  const showHint = !input.trim() && !processing && !statusMsg

  return (
    <div
      ref={cardRef}
      className="bg-card rounded-xl shadow-2xl border border-border/60 overflow-hidden"
    >
      {/* ── Input bar ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4" style={{ height: INPUT_HEIGHT }}>
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

      {/* ── Divider ──────────────────────────────────────────────────── */}
      {(showResults || processing || statusMsg) && (
        <div className="border-t border-border/50" />
      )}

      {/* ── Processing ───────────────────────────────────────────────── */}
      {processing && (
        <div className="flex items-center gap-2 px-4 py-6 text-caption text-muted-foreground">
          <Loader2 size={14} className="animate-spin text-primary" />
          <span>{t('search.processing')}</span>
        </div>
      )}

      {/* ── Status message ───────────────────────────────────────────── */}
      {statusMsg && !processing && (
        <div className="flex items-center gap-2 px-4 py-5 text-body text-muted-foreground/60 justify-center">
          {statusMsg === t('quickcapture.created') && (
            <Check size={16} className="text-type-command" />
          )}
          <span>{statusMsg}</span>
        </div>
      )}

      {/* ── Result list ──────────────────────────────────────────────── */}
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
                  'flex items-center gap-3 px-4 cursor-pointer transition-colors',
                  isSelected ? 'bg-muted/70' : 'hover:bg-muted/40'
                )}
                style={{ height: ROW_HEIGHT }}
                onClick={() => executeAction(note)}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <Icon size={16} className={cn(meta.color, 'shrink-0', isSelected ? 'opacity-100' : 'opacity-70')} />

                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-body font-medium truncate">{note.title}</span>
                  <span className="text-caption text-muted-foreground/50 truncate hidden sm:inline">
                    {snippet(note)}
                  </span>
                </div>

                <span className={cn('hidden sm:inline shrink-0 text-micro px-1.5 py-0.5 rounded font-medium', meta.badge)}>
                  {t(meta.labelKey as never)}
                </span>

                <span className={cn(
                  'shrink-0 text-caption transition-colors',
                  isCopied ? 'text-type-command' : isSelected ? 'text-muted-foreground' : 'text-muted-foreground/40'
                )}>
                  {isCopied ? (
                    <span className="inline-flex items-center gap-1"><Check size={12} />{t('card.copied')}</span>
                  ) : note.type === 'bookmark' ? (
                    <span className="inline-flex items-center gap-1"><ExternalLink size={12} />{t('card.open')}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1"><Copy size={12} />{t('card.copy')}</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Bottom hint ──────────────────────────────────────────────── */}
      {showHint && (
        <>
          <div className="border-t border-border/50" />
          <div
            className="flex items-center gap-1.5 px-4 text-micro text-muted-foreground/30"
            style={{ height: HINT_HEIGHT }}
          >
            <span>{t('search.hint.keyword')}</span>
            <span>·</span>
            <span>{t('search.hint.ai')}</span>
          </div>
        </>
      )}
    </div>
  )
}
