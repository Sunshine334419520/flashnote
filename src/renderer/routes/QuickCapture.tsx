import { type ReactElement, useState, useRef, useEffect, useCallback } from 'react'

export function QuickCapture(): ReactElement {
  const [input, setInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isComposing = useRef(false)

  // Make body fully transparent for this window (only the card should be visible)
  useEffect(() => {
    const orig = document.body.style.backgroundColor
    document.body.style.backgroundColor = 'transparent'
    return () => {
      document.body.style.backgroundColor = orig
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleSave = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isSaving) return
    setIsSaving(true)
    try {
      await window.electronAPI.notes.create({ content: trimmed })
      window.electronAPI.window.hideQuickCapture()
    } catch (err) {
      console.error('Save failed:', err)
      setIsSaving(false)
    }
  }, [input, isSaving])

  return (
    <div
      className="h-full bg-transparent flex items-center justify-center"
      onMouseDown={() => window.electronAPI.window.hideQuickCapture()}
    >
      <div
        className="w-[500px] bg-card rounded-xl shadow-2xl border border-border/50 px-4 py-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onCompositionStart={() => { isComposing.current = true }}
          onCompositionEnd={() => { isComposing.current = false }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isComposing.current) {
              e.preventDefault()
              handleSave()
            } else if (e.key === 'Escape' && !isComposing.current) {
              window.electronAPI.window.hideQuickCapture()
            }
          }}
          placeholder="Type your note and press Enter..."
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/50 text-foreground"
          disabled={isSaving}
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  )
}
