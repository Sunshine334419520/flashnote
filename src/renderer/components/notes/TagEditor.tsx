import { type ReactElement, useState, type KeyboardEvent } from 'react'
import { X, Plus } from 'lucide-react'

interface TagEditorProps {
  tags: string[]
  onChange: (tags: string[]) => void
}

export function TagEditor({ tags, onChange }: TagEditorProps): ReactElement {
  const [input, setInput] = useState('')

  const addTag = (tag: string) => {
    const normalized = tag.trim().toLowerCase()
    if (normalized && !tags.includes(normalized)) {
      onChange([...tags, normalized])
    }
    setInput('')
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="hover:text-foreground transition-colors"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <div className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-dashed border-border/50 text-muted-foreground/50">
        <Plus size={10} />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
          placeholder="add tag"
          className="w-14 bg-transparent outline-none placeholder:text-muted-foreground/30"
        />
      </div>
    </div>
  )
}
