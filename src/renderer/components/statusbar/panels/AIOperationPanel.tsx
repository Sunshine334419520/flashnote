import { type ReactElement, useMemo, useEffect, useState } from 'react'
import { Loader2, RotateCw, ExternalLink } from 'lucide-react'
import { useStatusBarStore } from '../../../stores/statusBarStore'
import { PROVIDER_META, ProviderIcon } from '../../common/ProviderIcons'
import { useT } from '../../../i18n'
import { cn } from '../../../lib/cn'
import type { AIOperationRecord, AIProviderConfig } from '../../../../shared/types'

// ── Helpers ──────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(delta / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  return `${Math.floor(min / 60)}h ago`
}

// ── Component ────────────────────────────────────────────────────────────

export function AIOperationPanel(): ReactElement {
  const records = useStatusBarStore((s) => s.aiRecords)
  const addRecord = useStatusBarStore((s) => s.addRecord)
  const tokenUsage = useStatusBarStore((s) => s.tokenUsage)
  const clearRecords = useStatusBarStore((s) => s.clearRecords)
  const { t } = useT()

  const [providers, setProviders] = useState<AIProviderConfig[]>([])

  useEffect(() => {
    window.electronAPI.ai.providers.list().then(setProviders).catch(() => setProviders([]))
  }, [])

  const activeProvider = providers.find((p) => p.isActive)
  const display = useMemo(() => [...records].reverse(), [records])
  const isConnected = activeProvider != null

  const handleRetry = async (record: AIOperationRecord) => {
    const reqId = crypto.randomUUID()
    addRecord({
      id: reqId, type: record.type, raw: record.raw,
      status: 'processing', duration: 0, createdAt: new Date().toISOString()
    })
    const startedAt = Date.now()
    try {
      await window.electronAPI.aiCommand.run({
        id: reqId, type: record.type, raw: record.raw, explicit: true
      })
      addRecord({
        id: reqId, type: record.type, raw: record.raw,
        status: 'success', duration: Date.now() - startedAt, createdAt: new Date().toISOString()
      })
    } catch (err) {
      addRecord({
        id: reqId, type: record.type, raw: record.raw,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - startedAt, createdAt: new Date().toISOString()
      })
    }
  }

  return (
    <div className="min-h-[140px] flex flex-col">
      {/* Provider section */}
      {isConnected ? (
        <div className="px-4 py-2.5 border-b border-border/30 flex items-center gap-2.5">
          <ProviderIcon type={activeProvider.type} size={20} />
          <div className="flex-1 min-w-0">
            <p className="text-label font-medium text-foreground truncate">{activeProvider.name}</p>
            <p className="text-micro text-muted-foreground/70 truncate">{activeProvider.model}</p>
          </div>
          {tokenUsage > 0 && (
            <span className="text-micro text-muted-foreground/50 tabular-nums shrink-0">
              {(tokenUsage / 1000).toFixed(1)}k tok
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <div
            onClick={() => window.electronAPI.window.showSettings()}
            className="cursor-pointer text-caption text-muted-foreground/40 hover:text-primary transition-colors"
          >
            {t('statusbar.noAi')}
          </div>
        </div>
      )}

      {/* Operation records */}
      {display.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground/30">
          <span className="text-caption">{t('statusbar.noRecords')}</span>
        </div>
      ) : (
        <div className="divide-y divide-border/30 overflow-y-auto flex-1">
          {display.map((rec) => {
            const isProcessing = rec.status === 'processing'
            const isFailed = rec.status === 'failed'
            return (
              <div key={rec.id} className={cn('flex items-center gap-2.5 px-3 py-2 text-caption', isFailed && 'bg-red-50/30 dark:bg-red-950/10')}>
                {isProcessing ? (
                  <Loader2 size={10} className="animate-spin shrink-0 text-primary" />
                ) : (
                  <span className={cn('shrink-0 w-2 h-2 rounded-full', isFailed ? 'bg-type-credential' : 'bg-type-command')} />
                )}
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  <span className={cn('shrink-0 text-micro px-1 py-0 rounded', isFailed ? 'bg-type-credential/10 text-type-credential/80' : 'bg-muted/50 text-muted-foreground/50')}>
                    {rec.type}
                  </span>
                  <span className="truncate text-muted-foreground/80" title={rec.raw}>{rec.raw}</span>
                </div>
                <span className="shrink-0 text-muted-foreground/40 tabular-nums">{formatTime(rec.createdAt)}</span>
                {isFailed && (
                  <button onClick={() => handleRetry(rec)} className="shrink-0 p-0.5 rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/5 transition-colors" title={t('search.retry')}>
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
