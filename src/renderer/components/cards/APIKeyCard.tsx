import { type ReactElement, useState, useRef, useEffect } from 'react'
import type { Note } from '../../../shared/types'
import { Copy, Key, Eye, EyeOff, Pencil, Trash2, Check } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useT } from '../../i18n'
import { useFormatTime } from '../../hooks/useFormatTime'

interface Props {
  note: Note
  onUpdate?: (id: string, title: string, content: string) => void
  onDelete?: (id: string) => void
}

export function APIKeyCard({ note, onUpdate, onDelete }: Props): ReactElement {
  const { t } = useT()
  const formatTime = useFormatTime()
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [editTitle, setEditTitle] = useState(note.title)
  const [editContent, setEditContent] = useState(note.content)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const service = (note.typedData as Record<string, string>)?.service ?? ''

  const masked =
    note.content.length > 10
      ? note.content.slice(0, 6) + '●'.repeat(12) + note.content.slice(-4)
      : note.content

  useEffect(() => {
    if (editing) titleInputRef.current?.focus()
  }, [editing])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(note.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleSave = () => {
    onUpdate?.(note.id, editTitle.trim() || note.title, editContent.trim() || note.content)
    setEditing(false)
    setConfirming(false)
  }

  const handleCancel = () => {
    setEditTitle(note.title)
    setEditContent(note.content)
    setEditing(false)
    setConfirming(false)
  }

  const timeAgo = formatTime(note.updatedAt)

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3 card-hover">
      {/* Header */}
      <div className="flex items-center gap-2 min-w-0">
        <Key size={15} className="text-type-apikey shrink-0" />
        {editing ? (
          <input
            ref={titleInputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="flex-1 text-sm font-medium bg-muted/50 rounded-lg px-2 py-1 outline-none border border-border focus:border-ring/30 min-w-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
          />
        ) : (
          <>
            <span className="text-sm font-medium truncate flex-1">{note.title}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-type-apikey/10 text-type-apikey shrink-0 select-none">
              {t('type.apikey')}
            </span>
          </>
        )}
        {service && !editing && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">
            {service}
          </span>
        )}
      </div>

      {/* Body */}
      {confirming ? (
        <div className="text-center py-2">
          <p className="text-xs text-muted-foreground mb-2">{t('confirm.delete')}</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={handleCancel} className="text-[11px] px-3 py-1 rounded-lg border border-border hover:bg-muted transition-colors">{t('confirm.cancel')}</button>
            <button onClick={() => { onDelete?.(note.id); setConfirming(false) }} className="text-[11px] px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">{t('confirm.ok')}</button>
          </div>
        </div>
      ) : editing ? (
        <div className="space-y-2">
          <input
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full text-[12px] font-mono bg-muted/50 rounded-lg px-2 py-1.5 outline-none border border-border focus:border-ring/30"
            onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
          />
          <div className="flex items-center justify-end gap-2">
            <button onClick={handleCancel} className="text-[11px] px-3 py-1 rounded-lg border border-border hover:bg-muted transition-colors">{t('confirm.cancel')}</button>
            <button onClick={handleSave} className="text-[11px] px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">{t('card.save')}</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[12px] font-mono text-muted-foreground bg-muted/30 rounded-lg px-2 py-1.5 truncate select-all">
            {note.sensitive && !revealed ? masked : note.content}
          </code>
          <button
            onClick={() => setRevealed(!revealed)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            title={revealed ? t('card.hide') : t('card.reveal')}
          >
            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      )}

      {/* Footer */}
      {!editing && !confirming && (
        <>
          <div className="border-t border-border/60" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground min-w-0">
              <span className="truncate">{note.category}</span>
              <span>·</span>
              <span className="shrink-0">{timeAgo}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleCopy}
                className={cn(
                  'flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md transition-colors',
                  copied ? 'text-type-apikey bg-type-apikey/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? t('card.copied') : t('card.copy')}
              </button>
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Pencil size={11} /> {t('card.edit')}
              </button>
              <button onClick={() => setConfirming(true)} className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 size={11} /> {t('card.delete')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
