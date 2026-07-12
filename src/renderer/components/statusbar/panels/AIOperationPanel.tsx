import { type ReactElement, useMemo } from 'react'
import { Check, X, Loader2, Search, Plus, Trash2, Pencil, RotateCw, Sparkles } from 'lucide-react'
import { useStatusBarStore } from '../../../stores/statusBarStore'
import { useT } from '../../../i18n'
import { cn } from '../../../lib/cn'
import type { AIOperationRecord, AICommandRequest } from '../../../../shared/types'

// ── Helpers ──────────────────────────────────────────────────────────────

const TYPE_ICON: Record<AIOperationRecord['type'], typeof Search> = {
  search: Search,
  add: Plus,
  delete: Trash2,
  edit: Pencil
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(delta / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

// ── Component ────────────────────────────────────────────────────────────

export function AIOperationPanel(): ReactElement {
  const records = useStatusBarStore((s) => s.aiRecords)
  const addRecord = useStatusBarStore((s) => s.addRecord)
  const { t } = useT()

  // Reverse: newest at the bottom (natural scroll order)
  const display = useMemo(() => [...records].reverse(), [records])

  const handleRetry = async (record: AIOperationRecord) => {
    const reqId = crypto.randomUUID()

    // Mark as processing
    addRecord({
      id: reqId,
      type: record.type,
      raw: record.raw,
      status: 'processing',
      duration: 0,
      createdAt: new Date().toISOString()
    })

    const startedAt = Date.now()
    try {
      await window.electronAPI.aiCommand.run({
        id: reqId,
        type: record.type,
        raw: record.raw,
        explicit: true
      })
      addRecord({
        id: reqId,
        type: record.type,
        raw: record.raw,
        status: 'success',
        duration: Date.now() - startedAt,
        createdAt: new Date().toISOString()
      })
    } catch (err) {
      addRecord({
        id: reqId,
        type: record.type,
        raw: record.raw,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - startedAt,
        createdAt: new Date().toISOString()
      })
    }
  }

  return (
    <div className="min-h-[140px]">
      {display.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[140px] text-muted-foreground/40 gap-2">
          <Sparkles size={28} className="opacity-30" />
          <span className="text-caption">{t('statusbar.noRecords')}</span>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {display.map((rec) => {
            const TypeIcon = TYPE_ICON[rec.type]
            const isProcessing = rec.status === 'processing'
            const isFailed = rec.status === 'failed'

            return (
              <div
                key={rec.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 text-caption',
                  isFailed && 'bg-red-50/30 dark:bg-red-950/10'
                )}
              >
                {/* Status */}
                {isProcessing ? (
                  <Loader2 size={12} className="animate-spin shrink-0 text-primary" />
                ) : isFailed ? (
                  <X size={12} className="shrink-0 text-type-credential" />
                ) : (
                  <Check size={12} className="shrink-0 text-type-command" />
                )}

                {/* Type icon */}
                <TypeIcon size={12} className="shrink-0 text-muted-foreground/50" />

                {/* Content: type label + raw input */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className={cn(
                    'shrink-0 text-micro px-1 py-0 rounded',
                    isFailed
                      ? 'bg-type-credential/10 text-type-credential'
                      : 'bg-muted/50 text-muted-foreground/60'
                  )}>
                    {rec.type}
                  </span>
                  <span className="truncate text-muted-foreground/80">{rec.raw}</span>
                </div>

                {/* Error brief */}
                {isFailed && rec.error && (
                  <span className="shrink-0 text-micro text-type-credential/70 truncate max-w-[120px] hidden sm:inline">
                    {rec.error}
                  </span>
                )}

                {/* Duration */}
                <span className="shrink-0 text-muted-foreground/40 tabular-nums w-10 text-right">
                  {isProcessing ? '...' : formatDuration(rec.duration)}
                </span>

                {/* Time */}
                <span className="shrink-0 text-muted-foreground/30 w-12 text-right hidden sm:inline">
                  {formatTime(rec.createdAt)}
                </span>

                {/* Retry */}
                {isFailed && (
                  <button
                    onClick={() => handleRetry(rec)}
                    className="shrink-0 p-1 rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/5 transition-colors"
                    title={t('search.retry')}
                  >
                    <RotateCw size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
