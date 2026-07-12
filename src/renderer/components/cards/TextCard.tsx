import { type ReactElement, useState, useRef, useEffect } from 'react'
import type { Note } from '../../../shared/types'
import { Copy, FileText, Pencil, Trash2, Check, Maximize2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { LongTextModal } from '../common/LongTextModal'
import { useT } from '../../i18n'
import { useFormatTime } from '../../hooks/useFormatTime'

interface Props {
  note: Note
  onUpdate?: (id: string, title: string, content: string) => void
  onDelete?: (id: string) => void
}

const SHORT_CONTENT_LIMIT = 150

export function TextCard({ note, onUpdate, onDelete }: Props): ReactElement {
  const { t } = useT()
  const formatTime = useFormatTime()
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editTitle, setEditTitle] = useState(note.title)
  const [editContent, setEditContent] = useState(note.content)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const isLong = note.content.length > SHORT_CONTENT_LIMIT
  const preview = isLong ? note.content.slice(0, SHORT_CONTENT_LIMIT) + '...' : note.content

  useEffect(() => { if (editing) titleInputRef.current?.focus() }, [editing])

  const handleCopy = async () => { await navigator.clipboard.writeText(note.content); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const handleSave = () => { onUpdate?.(note.id, editTitle.trim() || note.title, editContent.trim() || note.content); setEditing(false); setConfirming(false) }
  const handleCancel = () => { setEditTitle(note.title); setEditContent(note.content); setEditing(false); setConfirming(false) }

  const timeAgo = formatTime(note.updatedAt)
  const tagList = note.tags.slice(0, 3)

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3 card-hover">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={16} className="text-type-text shrink-0" />
          {editing ? (
            <input ref={titleInputRef} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="flex-1 text-body font-medium bg-muted/50 rounded-lg px-2 py-1 outline-none border border-border focus:border-ring/30 min-w-0" onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }} />
          ) : (
            <>
              <span className="text-body font-medium truncate flex-1">{note.title}</span>
              <span className="text-micro px-1.5 py-0.5 rounded font-medium bg-type-text/10 text-type-text shrink-0 select-none">{t('type.text')}</span>
            </>
          )}
        </div>

        {confirming ? (
          <div className="text-center py-2">
            <p className="text-label text-muted-foreground mb-2">{t('confirm.delete')}</p>
            <div className="flex items-center justify-center gap-2">
              <button onClick={handleCancel} className="text-caption px-3 py-1 rounded-lg border border-border hover:bg-muted transition-colors">{t('confirm.cancel')}</button>
              <button onClick={() => { onDelete?.(note.id); setConfirming(false) }} className="text-caption px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">{t('confirm.ok')}</button>
            </div>
          </div>
        ) : editing ? (
          <div className="space-y-2">
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full text-label bg-muted/50 rounded-lg px-2 py-1.5 outline-none border border-border focus:border-ring/30 resize-none min-h-[80px] leading-relaxed" onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }} />
            <div className="flex items-center justify-end gap-2">
              <button onClick={handleCancel} className="text-caption px-3 py-1 rounded-lg border border-border hover:bg-muted transition-colors">{t('confirm.cancel')}</button>
              <button onClick={handleSave} className="text-caption px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">{t('card.save')}</button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-label text-muted-foreground leading-relaxed whitespace-pre-line">{preview}</p>
            {isLong && (
              <button onClick={() => setShowModal(true)} className="mt-1.5 flex items-center gap-1 text-micro text-type-text hover:text-type-text/80 transition-colors">
                <Maximize2 size={12} /> {t('card.expand')}
              </button>
            )}
            {tagList.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mt-2">
                {tagList.map((tg) => <span key={tg} className="text-micro px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{tg}</span>)}
              </div>
            )}
          </div>
        )}

        {!editing && !confirming && (
          <>
            <div className="border-t border-border/60" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-micro text-muted-foreground min-w-0"><span className="truncate">{note.category}</span><span>·</span><span className="shrink-0">{timeAgo}</span></div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={handleCopy} className={cn('flex items-center gap-1 text-micro px-1.5 py-1 rounded-md transition-colors', copied ? 'text-type-text bg-type-text/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? t('card.copied') : t('card.copy')}</button>
                <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-micro px-1.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Pencil size={12} /> {t('card.edit')}</button>
                <button onClick={() => setConfirming(true)} className="flex items-center gap-1 text-micro px-1.5 py-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={12} /> {t('card.delete')}</button>
              </div>
            </div>
          </>
        )}
      </div>

      {showModal && <LongTextModal note={note} onClose={() => setShowModal(false)} onUpdate={onUpdate} onDelete={onDelete} />}
    </>
  )
}
