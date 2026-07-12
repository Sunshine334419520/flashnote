import { type ReactElement } from 'react'
import { Loader2, Trash2, Pencil } from 'lucide-react'
import { useT } from '../../i18n'
import type { AICommandResult, EditProposal, Note, NoteType } from '../../../shared/types'
import { cn } from '../../lib/cn'

type ConfirmableResult = Extract<
  AICommandResult,
  { kind: 'delete_candidates' } | { kind: 'edit_preview' }
>

interface Props {
  result: ConfirmableResult
  applying: boolean
  onConfirm: () => void
  onCancel: () => void
}

const TYPE_BADGE: Record<NoteType, string> = {
  apikey: 'bg-type-apikey/10 text-type-apikey',
  command: 'bg-type-command/10 text-type-command',
  credential: 'bg-type-credential/10 text-type-credential',
  bookmark: 'bg-type-bookmark/10 text-type-bookmark',
  text: 'bg-type-text/10 text-type-text'
}

export function CommandResultPanel({ result, applying, onConfirm, onCancel }: Props): ReactElement {
  const { t } = useT()

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3 shadow-lg max-h-[60vh] overflow-y-auto">
      {result.kind === 'delete_candidates' ? (
        <>
          <div className="flex items-center gap-1.5 text-label font-medium text-type-credential">
            <Trash2 size={12} />
            <span>{t('cmdpanel.deleteTitle')}</span>
          </div>
          <ul className="space-y-1.5">
            {result.matches.map((note) => (
              <li key={note.id} className="flex items-start gap-2 text-label">
                <TypeBadge type={note.type} label={t(`type.${note.type}` as never)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground/90">{note.title}</p>
                  {result.reasons[note.id] && (
                    <p className="truncate text-caption text-muted-foreground/60">{result.reasons[note.id]}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Actions
            confirmLabel={t('cmdpanel.delete', { n: result.matches.length })}
            cancelLabel={t('cmdpanel.cancel')}
            destructive
            disabled={result.matches.length === 0}
            applying={applying}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-label font-medium text-primary">
            <Pencil size={12} />
            <span>{t('cmdpanel.editTitle')}</span>
          </div>
          <div className="flex items-center gap-2 text-label">
            <TypeBadge type={result.target.type} label={t(`type.${result.target.type}` as never)} />
            <span className="truncate text-foreground/90">{result.target.title}</span>
          </div>
          {result.summary && (
            <p className="text-caption text-muted-foreground/70">{result.summary}</p>
          )}
          <EditDiff target={result.target} proposed={result.proposed} />
          <Actions
            confirmLabel={t('cmdpanel.apply')}
            cancelLabel={t('cmdpanel.cancel')}
            applying={applying}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </>
      )}
    </div>
  )
}

function TypeBadge({ type, label }: { type: NoteType; label: string }): ReactElement {
  return (
    <span
      className={cn(
        'shrink-0 select-none rounded px-1.5 py-0.5 text-micro font-medium',
        TYPE_BADGE[type]
      )}
    >
      {label}
    </span>
  )
}

function EditDiff({ target, proposed }: { target: Note; proposed: EditProposal }): ReactElement {
  const { t } = useT()
  const rows: Array<{ label: string; from: string; to: string }> = []
  if (proposed.title !== undefined) rows.push({ label: t('cmdpanel.fieldTitle'), from: target.title, to: proposed.title })
  if (proposed.category !== undefined) rows.push({ label: t('cmdpanel.fieldCategory'), from: target.category, to: proposed.category })
  if (proposed.tags !== undefined) rows.push({ label: t('cmdpanel.fieldTags'), from: target.tags.join(', '), to: proposed.tags.join(', ') })
  if (proposed.content !== undefined) rows.push({ label: t('cmdpanel.fieldContent'), from: target.content, to: proposed.content })

  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-2.5">
      {rows.map((row) => (
        <div key={row.label} className="text-label">
          <span className="text-muted-foreground/50">{row.label}</span>
          <div className="mt-0.5 space-y-0.5">
            <p className="truncate text-muted-foreground/50 line-through">{row.from || '—'}</p>
            <p className="truncate text-foreground/90">{row.to || '—'}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

interface ActionsProps {
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  disabled?: boolean
  applying: boolean
  onConfirm: () => void
  onCancel: () => void
}

function Actions({
  confirmLabel,
  cancelLabel,
  destructive,
  disabled,
  applying,
  onConfirm,
  onCancel
}: ActionsProps): ReactElement {
  return (
    <div className="flex items-center justify-end gap-2 pt-0.5">
      <button
        onClick={onCancel}
        disabled={applying}
        className="rounded-lg px-3 py-1.5 text-label text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        onClick={onConfirm}
        disabled={applying || disabled}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-label font-medium text-white transition-colors disabled:opacity-50',
          destructive ? 'bg-type-credential hover:bg-type-credential/90' : 'bg-primary hover:bg-primary/90'
        )}
      >
        {applying && <Loader2 size={12} className="animate-spin" />}
        {confirmLabel}
      </button>
    </div>
  )
}
