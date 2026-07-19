import { type ReactElement, useEffect, useState } from 'react'
import { Loader2, RotateCw, ChevronRight, ChevronDown, Sparkles } from 'lucide-react'
import { useStatusBarStore } from '../../../stores/statusBarStore'
import { ProviderIcon } from '../../common/ProviderIcons'
import { useT } from '../../../i18n'
import { cn } from '../../../lib/cn'
import type { AIOperationRecord, AIProviderConfig } from '../../../../shared/types'

function formatTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(delta / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  return `${Math.floor(min / 60)}h ago`
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n} tokens`
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k tokens`
  return `${(n / 1_000_000).toFixed(1)}M tokens`
}

export function AIOperationPanel(): ReactElement {
  const records = useStatusBarStore((s) => s.aiRecords)
  const addRecord = useStatusBarStore((s) => s.addRecord)
  const tokenUsage = useStatusBarStore((s) => s.tokenUsage)
  const { t } = useT()
  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    window.electronAPI.ai.providers.list().then(setProviders).catch(() => setProviders([]))
  }, [])

  const activeProvider = providers.find((p) => p.isActive)
  const isConnected = activeProvider != null
  const display = [...records].reverse()

  const handleRetry = async (record: AIOperationRecord) => {
    const reqId = crypto.randomUUID()
    addRecord({ id: reqId, type: record.type, raw: record.raw, status: 'processing', duration: 0, createdAt: new Date().toISOString() })
    const startedAt = Date.now()
    try {
      await window.electronAPI.aiCommand.run({ id: reqId, type: record.type, raw: record.raw, explicit: true })
      addRecord({ id: reqId, type: record.type, raw: record.raw, status: 'success', duration: Date.now() - startedAt, createdAt: new Date().toISOString() })
    } catch (err) {
      addRecord({ id: reqId, type: record.type, raw: record.raw, status: 'failed', error: err instanceof Error ? err.message : String(err), duration: Date.now() - startedAt, createdAt: new Date().toISOString() })
    }
  }

  return (
    <div className="flex flex-col">
      {/* Provider info */}
      {isConnected ? (
        <div className="px-3 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden">
            <ProviderIcon type={activeProvider.type} size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-label font-medium text-foreground truncate">{activeProvider.name}</p>
            </div>
            <p className="text-micro text-muted-foreground/60 mt-0.5 truncate">
              {activeProvider.model}
              {tokenUsage > 0 && (
                <span className="tabular-nums"> · {formatTokens(tokenUsage)}</span>
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Sparkles size={24} className="text-muted-foreground/20" />
          <button
            onClick={() => window.electronAPI.window.showSettings()}
            className="text-caption text-muted-foreground/40 hover:text-primary transition-colors"
          >
            {t('statusbar.noAi')}
          </button>
        </div>
      )}

      {/* Operations toggle */}
      <div className="border-t border-border/30" />
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-3 py-2 text-caption text-foreground/80 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-foreground/80">AI 操作记录</span>
          {display.length > 0 && (
            <span className="w-[6px] h-[6px] rounded-full bg-type-credential" />
          )}
        </div>
        <span className="flex items-center gap-1 text-muted-foreground/40">
          {display.length > 0 && (
            <span className="text-micro">{display.length}</span>
          )}
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>

      {/* Expanded records */}
      {expanded && (
        <div className="border-t border-border/20 max-h-[200px] overflow-y-auto">
          {display.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-caption text-muted-foreground/20">
              {t('statusbar.noRecords')}
            </div>
          ) : (
            display.map((rec) => {
              const isProcessing = rec.status === 'processing'
              const isFailed = rec.status === 'failed'
              return (
                <div key={rec.id} className={cn('flex items-center gap-2 px-3 py-1.5 text-caption', isFailed && 'bg-red-50/30 dark:bg-red-950/10')}>
                  {isProcessing ? (
                    <Loader2 size={9} className="animate-spin shrink-0 text-primary" />
                  ) : (
                    <span className={cn('shrink-0 w-1.5 h-1.5 rounded-full', isFailed ? 'bg-type-credential' : 'bg-type-command')} />
                  )}
                  <span className={cn('shrink-0 text-micro px-1 rounded', isFailed ? 'bg-type-credential/10 text-type-credential/70' : 'bg-muted/50 text-muted-foreground/40')}>
                    {rec.type}
                  </span>
                  <span className="flex-1 truncate text-muted-foreground/60" title={rec.raw}>{rec.raw}</span>
                  <span className="shrink-0 text-muted-foreground/25 tabular-nums">{formatTime(rec.createdAt)}</span>
                  {isFailed && (
                    <button onClick={() => handleRetry(rec)} className="shrink-0 p-0.5 rounded text-muted-foreground/30 hover:text-primary hover:bg-primary/5 transition-colors">
                      <RotateCw size={11} />
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
