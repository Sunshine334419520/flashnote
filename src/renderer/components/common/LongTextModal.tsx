import { type ReactElement, useState, useEffect, useRef } from 'react'
import type { Note } from '../../../shared/types'
import { FileText, Copy, Pencil, Trash2, Check, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useT } from '../../i18n'

interface Props {
  note: Note
  onClose: () => void
  onUpdate?: (id: string, title: string, content: string) => void
  onDelete?: (id: string) => void
}

export function LongTextModal({ note, onClose, onUpdate, onDelete }: Props): ReactElement {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [editTitle, setEditTitle] = useState(note.title)
  const [editContent, setEditContent] = useState(note.content)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(note.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleSave = () => {
    onUpdate?.(note.id, editTitle.trim() || note.title, editContent.trim() || note.content)
    setEditing(false)
  }

  const handleDelete = () => {
    onDelete?.(note.id)
    onClose()
  }

  const timeStr = new Date(note.createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b border-border shrink-0">
          <FileText size={16} className="text-type-text shrink-0" />
          {editing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 text-body font-medium bg-muted/50 rounded-lg px-2 py-1 outline-none border border-border focus:border-primary/30"
              autoFocus
            />
          ) : (
            <span className="text-body font-medium flex-1 truncate">{note.title}</span>
          )}
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {confirming ? (
            <div className="text-center py-8">
              <p className="text-body text-muted-foreground mb-3">{t('confirm.delete')}</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  className="text-label px-4 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  {t('confirm.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  className="text-label px-4 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  {t('confirm.ok')}
                </button>
              </div>
            </div>
          ) : editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[200px] text-body bg-muted/30 rounded-xl px-3 py-2 outline-none border border-border focus:border-primary/30 resize-none leading-relaxed"
            />
          ) : (
            <div className="text-body text-foreground leading-relaxed whitespace-pre-line">
              {note.content}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border shrink-0">
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <span>{note.category}</span>
            <span>·</span>
            <span>{timeStr}</span>
          </div>
          <div className="flex items-center gap-1">
            {editing ? (
              <>
                <button
                  onClick={() => { setEditing(false); setConfirming(false) }}
                  className="text-caption px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  {t('confirm.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  className="text-caption px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {t('card.save')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCopy}
                  className={cn(
                    'flex items-center gap-1 text-caption px-2 py-1.5 rounded-lg transition-colors',
                    copied
                      ? 'text-type-text bg-type-text/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? t('card.copied') : t('card.copyFull')}
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-caption px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil size={12} /> {t('card.edit')}
                </button>
                <button
                  onClick={() => setConfirming(true)}
                  className="flex items-center gap-1 text-caption px-2 py-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={12} /> {t('card.delete')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
