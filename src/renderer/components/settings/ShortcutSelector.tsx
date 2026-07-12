import { type ReactElement, useState, useEffect, useCallback, useRef } from 'react'
import { useT } from '../../i18n'
import { cn } from '../../lib/cn'
import { Check, RotateCw } from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────

const isMac = navigator.platform.toLowerCase().includes('mac')

interface ShortcutOption {
  key: string        // Electron accelerator string, e.g. "Alt+Space"
  display: string    // OS-native symbol display, e.g. "⌥ Space"
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

// ── Key event → Electron accelerator string ─────────────────────────────

function keyToAccelerator(e: React.KeyboardEvent): string | null {
  const parts: string[] = []

  // Meta and Ctrl are distinct — don't merge them
  if (e.metaKey) parts.push(isMac ? 'Cmd' : 'Super')
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  // Ignore standalone modifier key presses
  const key = e.key
  if (['Meta', 'Control', 'Alt', 'Shift', 'CapsLock', 'Tab'].includes(key)) {
    return null
  }

  // Normalize key name
  let normalized: string
  if (key.length === 1) {
    normalized = key.toUpperCase()
  } else if (key === ' ') {
    normalized = 'Space'
  } else if (key.startsWith('F') && /^F\d+$/.test(key)) {
    normalized = key
  } else {
    // Arrow keys, etc.
    normalized = key.charAt(0).toUpperCase() + key.slice(1)
  }

  parts.push(normalized)
  return parts.join('+')
}

function acceleratorToDisplay(accel: string): string {
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
  const [recording, setRecording] = useState(false)
  const [saving, setSaving] = useState<string | null>(null) // which key is being saved
  const [error, setError] = useState<string | null>(null)
  const recordRef = useRef<HTMLDivElement>(null)

  // Focus the recording element so it captures keys
  useEffect(() => {
    if (recording && recordRef.current) {
      recordRef.current.focus()
    }
  }, [recording])

  const handleRecordKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Esc cancels recording
      if (e.key === 'Escape') {
        setRecording(false)
        setError(null)
        return
      }

      const accel = keyToAccelerator(e)
      if (!accel) return

      setSaving(accel)
      setError(null)

      const ok = await onChange(accel)
      if (ok) {
        setRecording(false)
      } else {
        setError(t('shortcut.conflict'))
      }
      setSaving(null)
    },
    [onChange, t]
  )

  const handleRecommend = useCallback(
    async (key: string) => {
      if (key === current) return
      setSaving(key)
      setError(null)
      const ok = await onChange(key)
      if (!ok) setError(t('shortcut.conflict'))
      setSaving(null)
    },
    [current, onChange, t]
  )

  const isActive = (key: string) => key === current

  return (
    <div className="px-8 py-6 space-y-4">
      {/* Section title */}
      <div>
        <h2 className="text-body font-medium text-foreground">{t('shortcut.title')}</h2>
        <p className="text-caption text-muted-foreground mt-0.5">{t('shortcut.subtitle')}</p>
      </div>

      {/* Current shortcut */}
      <div className="flex items-center gap-3">
        <span className="text-label text-muted-foreground shrink-0">{t('shortcut.current')}</span>
        <button
          onClick={() => setRecording(true)}
          disabled={recording}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-body font-mono transition-colors',
            recording
              ? 'border-primary ring-2 ring-primary/20 text-primary'
              : 'hover:border-primary/30 cursor-pointer'
          )}
        >
          {recording ? (
            <>
              <span className="text-caption text-primary animate-pulse">{t('shortcut.recording')}</span>
            </>
          ) : (
            <span>{acceleratorToDisplay(current)}</span>
          )}
        </button>
      </div>

      {/* Recording prompt */}
      {recording && (
        <div
          ref={recordRef}
          tabIndex={0}
          onKeyDown={handleRecordKeyDown}
          onBlur={() => setRecording(false)}
          className="outline-none"
        >
          <p className="text-caption text-muted-foreground/60">
            {t('shortcut.pressKeys')}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-caption text-type-credential">{error}</p>
      )}

      {/* Recommended shortcuts */}
      <div className="space-y-2">
        <p className="text-label text-muted-foreground">{t('shortcut.recommended')}</p>
        <div className="flex flex-wrap gap-2">
          {RECOMMENDED.map((opt) => {
            const active = isActive(opt.key)
            const loading = saving === opt.key
            return (
              <button
                key={opt.key}
                onClick={() => handleRecommend(opt.key)}
                disabled={active || saving !== null}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-label font-mono transition-colors',
                  active
                    ? 'border-primary/40 bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/20 text-muted-foreground hover:text-foreground',
                  saving !== null && 'opacity-50 cursor-not-allowed'
                )}
              >
                {loading ? (
                  <RotateCw size={12} className="animate-spin" />
                ) : active ? (
                  <Check size={12} className="text-primary" />
                ) : null}
                <span>{opt.display}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
