import { type ReactElement, useState, useEffect, useRef, useCallback } from 'react'

export function QuickCapture(): ReactElement {
  const [content, setContent] = useState('')
  const [hint, setHint] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSave = useCallback(async () => {
    if (!content.trim() || isSaving) return

    setIsSaving(true)
    try {
      await window.electronAPI.notes.create({
        content: content.trim(),
        sourceHint: hint.trim() || undefined
      })
      setContent('')
      setHint('')
      window.electronAPI.window.hideQuickCapture()
    } catch (err) {
      console.error('Failed to save note:', err)
    } finally {
      setIsSaving(false)
    }
  }, [content, hint, isSaving])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        window.electronAPI.window.hideQuickCapture()
      }
    },
    [handleSave]
  )

  return (
    <div className="h-screen flex items-center justify-center bg-black/20">
      <div className="w-full max-w-lg bg-card rounded-xl shadow-2xl border p-6 space-y-4">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste or type your note content here..."
          className="w-full h-32 bg-transparent text-base resize-none outline-none placeholder:text-muted-foreground"
          disabled={isSaving}
        />

        <input
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='What is this? (e.g. "DeepSeek API key", "meeting notes")'
          className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm outline-none border border-transparent focus:border-primary/30 transition-colors placeholder:text-muted-foreground/60"
          disabled={isSaving}
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-mono">⌘Enter</kbd> to save
            {' · '}
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-mono">Esc</kbd> to cancel
          </span>
          <button
            onClick={handleSave}
            disabled={!content.trim() || isSaving}
            className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Capture'}
          </button>
        </div>
      </div>
    </div>
  )
}
