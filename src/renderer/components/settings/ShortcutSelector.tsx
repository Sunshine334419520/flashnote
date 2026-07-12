import { type ReactElement, useState, useEffect, useCallback, useRef } from 'react'
import { useT } from '../../i18n'
import { cn } from '../../lib/cn'
import { Check, ChevronDown, Plus, RotateCw } from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────

const isMac = navigator.platform.toLowerCase().includes('mac')

interface ShortcutOption {
  key: string
  display: string
}

const RECOMMENDED: ShortcutOption[] = isMac
  ? [
      { key: 'Alt+Space', display: '⌥ Space' },
      { key: 'Ctrl+Space', display: '⌃ Space' },
      { key: 'Alt+S', display: '⌥ S' },
      { key: 'Alt+F', display: '⌥ F' }
    ]
  : [
      { key: 'Alt+Space', display: 'Alt + Space' },
      { key: 'Ctrl+Space', display: 'Ctrl + Space' },
      { key: 'Alt+S', display: 'Alt + S' },
      { key: 'Alt+Shift+Space', display: 'Alt + Shift + Space' }
    ]

const CUSTOM_STORAGE_KEY = 'flashnote.customShortcuts'

function loadCustomShortcuts(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveCustomShortcuts(shortcuts: string[]): void {
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(shortcuts))
}

// ── Key event → Electron accelerator string ─────────────────────────────

function keyToAccelerator(e: React.KeyboardEvent): string | null {
  const parts: string[] = []

  if (e.metaKey) parts.push(isMac ? 'Cmd' : 'Super')
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  const key = e.key
  if (['Meta', 'Control', 'Alt', 'Shift', 'CapsLock', 'Tab'].includes(key)) return null

  let normalized: string
  if (key.length === 1) normalized = key.toUpperCase()
  else if (key === ' ') normalized = 'Space'
  else if (key.startsWith('F') && /^F\d+$/.test(key)) normalized = key
  else normalized = key.charAt(0).toUpperCase() + key.slice(1)

  parts.push(normalized)
  return parts.join('+')
}

function acceleratorToDisplay(accel: string): string {
  if (!accel) return ''
  if (isMac) {
    return accel
      .replace(/Cmd/g, '⌘')
      .replace(/Alt/g, '⌥')
      .replace(/Ctrl/g, '⌃')
      .replace(/Shift/g, '⇧')
      .replace(/\+/g, '')
  }
  return accel.replace(/\+/g, ' + ')
}

// ── Component ────────────────────────────────────────────────────────────

interface Props {
  current: string
  onChange: (hotkey: string) => Promise<boolean>
}

export function ShortcutSelector({ current, onChange }: Props): ReactElement {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [customShortcuts, setCustomShortcuts] = useState<string[]>(loadCustomShortcuts)
  const containerRef = useRef<HTMLDivElement>(null)
  const recordRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  // Focus when recording starts
  useEffect(() => {
    if (recording && recordRef.current) {
      recordRef.current.focus()
    }
  }, [recording])

  // ── Select a shortcut (recommended or custom) ────────────────────────

  const handleSelect = useCallback(async (key: string) => {
    if (key === current) {
      setOpen(false)
      return
    }
    setSaving(key)
    setError(null)
    const ok = await onChange(key)
    if (ok) {
      setOpen(false)
    } else {
      setError(t('shortcut.conflict'))
    }
    setSaving(null)
  }, [current, onChange, t])

  // ── Enter recording mode ──────────────────────────────────────────────

  const startRecording = useCallback(() => {
    setOpen(false)
    setRecording(true)
    setError(null)
  }, [])

  // ── Handle key press during recording ─────────────────────────────────

  const handleRecordKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.key === 'Escape') {
      setRecording(false)
      return
    }

    const accel = keyToAccelerator(e)
    if (!accel) return

    setSaving(accel)
    setError(null)
    const ok = await onChange(accel)
    if (ok) {
      // Add to custom shortcuts if not already present
      setCustomShortcuts((prev) => {
        const next = [accel, ...prev.filter((s) => s !== accel)].slice(0, 5)
        saveCustomShortcuts(next)
        return next
      })
      setRecording(false)
    } else {
      setError(t('shortcut.conflict'))
    }
    setSaving(null)
  }, [onChange, t])

  // ── Build dropdown items ──────────────────────────────────────────────

  // Dedupe custom shortcuts that overlap with recommended
  const customOptions = customShortcuts.filter(
    (c) => !RECOMMENDED.some((r) => r.key === c)
  )

  const isActive = (key: string) => key === current

  return (
    <div className="px-8 py-6 space-y-4">
      {/* Section title */}
      <div>
        <h2 className="text-body font-medium text-foreground">{t('shortcut.title')}</h2>
        <p className="text-caption text-muted-foreground mt-0.5">{t('shortcut.subtitle')}</p>
      </div>

      {/* Current shortcut button + dropdown */}
      <div ref={containerRef} className="relative inline-block">
        <div className="flex items-center gap-3">
          <span className="text-label text-muted-foreground shrink-0">{t('shortcut.current')}</span>
          <button
            onClick={() => setOpen(!open)}
            disabled={recording}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-body font-mono transition-colors',
              recording
                ? 'border-primary ring-2 ring-primary/20 text-primary'
                : 'border-border hover:border-primary/30'
            )}
          >
            {recording ? (
              <span className="text-caption text-primary animate-pulse">{t('shortcut.recording')}</span>
            ) : (
              <>
                <span>{acceleratorToDisplay(current)}</span>
                <ChevronDown size={12} className="text-muted-foreground/50" />
              </>
            )}
          </button>
        </div>

        {/* Recording capture element */}
        {recording && (
          <div
            ref={recordRef}
            tabIndex={0}
            onKeyDown={handleRecordKeyDown}
            onBlur={() => setRecording(false)}
            className="outline-none"
          />
        )}

        {/* Recording hint */}
        {recording && (
          <p className="mt-2 text-caption text-muted-foreground/60">
            {t('shortcut.pressKeys')}
          </p>
        )}

        {/* Error */}
        {error && (
          <p className="mt-2 text-caption text-type-credential">{error}</p>
        )}

        {/* Dropdown */}
        {open && !recording && (
          <div className="absolute top-full left-0 mt-2 w-52 bg-card rounded-xl border border-border shadow-lg z-50 py-1 overflow-hidden">
            {/* Recommended */}
            <p className="px-3 py-1.5 text-micro text-muted-foreground/50">{t('shortcut.recommended')}</p>
            {RECOMMENDED.map((opt) => {
              const active = isActive(opt.key)
              const loading = saving === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => handleSelect(opt.key)}
                  disabled={saving !== null}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-label transition-colors',
                    active ? 'bg-muted/70' : 'hover:bg-muted/40',
                    saving !== null && 'opacity-50'
                  )}
                >
                  {loading ? (
                    <RotateCw size={12} className="animate-spin shrink-0 text-muted-foreground" />
                  ) : (
                    <span className="w-4 shrink-0 flex items-center justify-center">
                      {active && <Check size={12} className="text-primary" />}
                    </span>
                  )}
                  <span className={cn('font-mono', active && 'font-medium text-foreground')}>{opt.display}</span>
                </button>
              )
            })}

            {/* Custom shortcuts (persisted) */}
            {customOptions.length > 0 && (
              <>
                <div className="border-t border-border/50 my-1" />
                {customOptions.map((key) => {
                  const active = isActive(key)
                  const loading = saving === key
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelect(key)}
                      disabled={saving !== null}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-label transition-colors',
                        active ? 'bg-muted/70' : 'hover:bg-muted/40',
                        saving !== null && 'opacity-50'
                      )}
                    >
                      {loading ? (
                        <RotateCw size={12} className="animate-spin shrink-0 text-muted-foreground" />
                      ) : (
                        <span className="w-4 shrink-0 flex items-center justify-center">
                          {active && <Check size={12} className="text-primary" />}
                        </span>
                      )}
                      <span className={cn('font-mono', active && 'font-medium text-foreground')}>
                        {acceleratorToDisplay(key)}
                      </span>
                    </button>
                  )
                })}
              </>
            )}

            {/* Custom… action */}
            <div className="border-t border-border/50 mt-1 pt-1">
              <button
                onClick={startRecording}
                disabled={saving !== null}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-label text-muted-foreground hover:bg-muted/40 transition-colors"
              >
                <Plus size={12} className="shrink-0" />
                <span>{t('shortcut.custom')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
