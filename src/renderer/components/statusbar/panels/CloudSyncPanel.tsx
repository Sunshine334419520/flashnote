import { type ReactElement } from 'react'
import { Cloud, CloudAlert, RefreshCw, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react'
import { useCloudSyncStore } from '../../../stores/cloudSyncStore'
import { useFormatTime } from '../../../hooks/useFormatTime'
import { useT } from '../../../i18n'
import { cn } from '../../../lib/cn'

export function CloudSyncPanel(): ReactElement {
  const connection = useCloudSyncStore((s) => s.connection)
  const syncProgress = useCloudSyncStore((s) => s.syncProgress)
  const sync = useCloudSyncStore((s) => s.sync)
  const formatTime = useFormatTime()
  const { t } = useT()

  const isSyncing = syncProgress != null && syncProgress.phase !== 'idle'

  // ── Disconnected ──────────────────────────────────────────
  if (!connection || connection.status === 'disconnected') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[140px] text-center px-4 py-6 gap-3">
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
      <div className="flex flex-col items-center justify-center min-h-[140px] text-center px-4 py-6 gap-3">
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
      <div className="flex flex-col items-center justify-center min-h-[140px] text-center px-4 py-6 gap-3">
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

  // ── Connected / Syncing ───────────────────────────────────

  return (
    <div className="flex flex-col min-h-[140px]">
      {/* Status row */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <CheckCircle2 size={16} className="text-green-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-body font-medium text-foreground truncate">{t('cloud.connected')}</p>
          {connection.accountEmail && (
            <p className="text-caption text-muted-foreground mt-0.5 truncate">{connection.accountEmail}</p>
          )}
        </div>
        <button
          onClick={() => sync()}
          disabled={isSyncing}
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-label font-medium transition-colors',
            isSyncing
              ? 'bg-primary/10 text-primary/50 cursor-not-allowed'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
          )}
        >
          <RefreshCw size={12} className={cn(isSyncing && 'animate-spin')} />
          {isSyncing ? t('cloud.syncing') : t('cloud.syncNow')}
        </button>
      </div>

      {/* Sync progress */}
      {isSyncing && syncProgress && (
        <div className="px-4 space-y-1">
          <p className="text-caption text-muted-foreground">
            {syncProgress.total > 0
              ? `${syncProgress.current} / ${syncProgress.total}`
              : t(`cloud.phase.${syncProgress.phase}` as never)}
          </p>
          {syncProgress.total > 0 && (
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Spacer to push footer to bottom */}
      <div className="flex-1" />

      {/* Footer: last sync time (auto + manual) */}
      <div className="border-t border-border/30 px-4 py-2 flex items-center gap-2 text-caption text-muted-foreground">
        <span className="shrink-0">{t('cloud.lastSync')}</span>
        {connection.lastSyncAt ? (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="tabular-nums">{formatTime(connection.lastSyncAt)}</span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-muted-foreground/40">{t('cloud.noRecords')}</span>
          </>
        )}
      </div>
    </div>
  )
}
