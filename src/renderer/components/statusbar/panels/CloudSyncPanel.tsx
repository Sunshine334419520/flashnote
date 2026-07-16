import { type ReactElement, useMemo } from 'react'
import { Cloud, CloudAlert, RefreshCw, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react'
import { useCloudSyncStore } from '../../../stores/cloudSyncStore'
import { useFormatTime } from '../../../hooks/useFormatTime'
import { useT } from '../../../i18n'
import { cn } from '../../../lib/cn'

export function CloudSyncPanel(): ReactElement {
  const connection = useCloudSyncStore((s) => s.connection)
  const syncProgress = useCloudSyncStore((s) => s.syncProgress)
  const syncRecords = useCloudSyncStore((s) => s.syncRecords)
  const sync = useCloudSyncStore((s) => s.sync)
  const formatTime = useFormatTime()
  const { t } = useT()

  const displayRecords = useMemo(() => [...syncRecords].reverse(), [syncRecords])
  const isSyncing = syncProgress != null && syncProgress.phase !== 'idle'

  // ── Disconnected ──────────────────────────────────────────
  if (!connection || connection.status === 'disconnected') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[160px] text-center px-4 py-6 gap-3">
        <Cloud size={28} className="text-muted-foreground/30" />
        <div>
          <p className="text-body font-medium text-muted-foreground">{t('cloud.disconnected')}</p>
          <p className="text-caption text-muted-foreground/60 mt-0.5">{t('cloud.subtitle')}</p>
        </div>
        <button
          onClick={() => window.electronAPI.window.showSettings()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-label font-medium hover:bg-primary/90 transition-colors"
        >
          <ExternalLink size={12} />
          {t('cloud.goSettings')}
        </button>
      </div>
    )
  }

  // ── Connecting ────────────────────────────────────────────
  if (connection.status === 'connecting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[160px] text-center px-4 py-6 gap-3">
        <Loader2 size={28} className="animate-spin text-primary" />
        <div>
          <p className="text-body font-medium text-muted-foreground">{t('cloud.connecting')}</p>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────
  if (connection.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[160px] text-center px-4 py-6 gap-3">
        <CloudAlert size={28} className="text-type-credential" />
        <div>
          <p className="text-body font-medium text-type-credential">{t('cloud.syncFailed')}</p>
          <p className="text-caption text-muted-foreground/60 mt-0.5 max-w-[240px] truncate">
            {connection.error ?? t('cloud.error.expired')}
          </p>
        </div>
        <button
          onClick={() => window.electronAPI.window.showSettings()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-label font-medium hover:bg-primary/90 transition-colors"
        >
          {t('cloud.goSettings')}
        </button>
      </div>
    )
  }

  // ── Connected ─────────────────────────────────────────────
  const showSyncing = isSyncing
  const showConnected = !showSyncing

  return (
    <div className="min-h-[160px]">
      {/* Status header */}
      <div className={cn(
        'flex items-center gap-2.5 px-3 py-2.5',
        showSyncing && 'bg-blue-50/30 dark:bg-blue-950/10'
      )}>
        {showSyncing ? (
          <RefreshCw size={16} className="animate-spin text-blue-500 shrink-0" />
        ) : (
          <CheckCircle2 size={16} className="text-green-500 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-body font-medium text-foreground truncate">
            {showSyncing ? t('cloud.syncing') : t('cloud.connected')}
          </p>
          {showConnected && connection.accountEmail && (
            <p className="text-caption text-muted-foreground truncate">{connection.accountEmail}</p>
          )}
          {showSyncing && syncProgress && (
            <p className="text-caption text-muted-foreground">
              {syncProgress.current} / {syncProgress.total}
            </p>
          )}
        </div>
        {showConnected && (
          <button
            onClick={() => sync()}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <RefreshCw size={10} />
            {t('cloud.syncNow')}
          </button>
        )}
      </div>

      {/* Progress bar (syncing) */}
      {showSyncing && syncProgress && syncProgress.total > 0 && (
        <div className="px-3 pb-1">
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border/30" />

      {/* Recent sync records */}
      {showConnected && (
        <>
          <div className="px-3 py-1.5">
            <span className="text-micro text-muted-foreground/60">{t('cloud.syncRecords')}</span>
          </div>
          {displayRecords.length === 0 ? (
            <div className="px-3 pb-3 text-caption text-muted-foreground/40">{t('cloud.noRecords')}</div>
          ) : (
            <div className="divide-y divide-border/20">
              {displayRecords.slice(-5).map((rec) => (
                <div key={rec.id} className="flex items-center gap-2 px-3 py-1.5 text-caption">
                  <span className={cn(
                    'shrink-0 w-1.5 h-1.5 rounded-full',
                    rec.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                  )} />
                  <span className="flex-1 truncate text-muted-foreground/80">
                    {rec.status === 'success' ? t('cloud.recentSync') : t('cloud.syncFailed')}
                  </span>
                  <span className="shrink-0 text-muted-foreground/40 tabular-nums">
                    {formatTime(rec.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Connected info footer */}
      {showConnected && connection.lastSyncAt && (
        <>
          <div className="border-t border-border/30" />
          <div className="px-3 py-1.5 text-caption text-muted-foreground/50">
            {t('cloud.lastSync')}: {formatTime(connection.lastSyncAt)}
          </div>
        </>
      )}
    </div>
  )
}
