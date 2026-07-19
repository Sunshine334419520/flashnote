import { type ReactElement } from 'react'
import { Cloud, CloudAlert, RefreshCw, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react'
import { useCloudSyncStore } from '../../../stores/cloudSyncStore'
import { useFormatTime } from '../../../hooks/useFormatTime'
import { useT } from '../../../i18n'
import { cn } from '../../../lib/cn'
import { SYNC_PHASES, CLOUD_STATUS } from '../../../../shared/types'
import type { CloudServiceType } from '../../../../shared/types'
import { NotionIcon, OneNoteIcon } from '../../settings/CloudServiceIcons'

const SERVICE_ICONS: Record<CloudServiceType, ReactElement> = {
  notion: <NotionIcon size={22} />,
  onenote: <OneNoteIcon size={22} />,
  feishu: <Cloud size={22} />,
}

export function CloudSyncPanel(): ReactElement {
  const connection = useCloudSyncStore((s) => s.connection)
  const syncProgress = useCloudSyncStore((s) => s.syncProgress)
  const sync = useCloudSyncStore((s) => s.sync)
  const formatTime = useFormatTime()
  const { t } = useT()

  const isSyncing = syncProgress != null && syncProgress.phase !== SYNC_PHASES.IDLE

  // ── Disconnected ──────────────────────────────────────────
  if (!connection || connection.status === CLOUD_STATUS.DISCONNECTED) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-3 gap-2.5">
        <Cloud size={28} className="text-muted-foreground/20" />
        <div>
          <p className="text-body font-medium text-muted-foreground">{t('cloud.disconnected')}</p>
          <p className="text-caption text-muted-foreground/40 mt-0.5">{t('cloud.subtitle')}</p>
        </div>
        <button
          onClick={() => window.electronAPI.window.showSettings()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-label font-medium hover:bg-primary/90 transition-colors"
        >
          <ExternalLink size={12} />
          {t('cloud.goSettings')}
        </button>
      </div>
    )
  }

  // ── Connecting ────────────────────────────────────────────
  if (connection.status === CLOUD_STATUS.CONNECTING) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-3 gap-3">
        <Loader2 size={28} className="animate-spin text-primary" />
        <p className="text-body font-medium text-muted-foreground">{t('cloud.connecting')}</p>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────
  if (connection.status === CLOUD_STATUS.ERROR) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-3 gap-2.5">
        <CloudAlert size={28} className="text-type-credential" />
        <div>
          <p className="text-body font-medium text-type-credential">{t('cloud.syncFailed')}</p>
          <p className="text-caption text-muted-foreground/40 mt-0.5 max-w-[260px] truncate">
            {connection.error ?? t('cloud.error.expired')}
          </p>
        </div>
        <button
          onClick={() => window.electronAPI.window.showSettings()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-label font-medium hover:bg-primary/90 transition-colors"
        >
          {t('cloud.goSettings')}
        </button>
      </div>
    )
  }

  // ── Connected / Syncing ───────────────────────────────────
  const service = connection.service as CloudServiceType
  const serviceIcon = SERVICE_ICONS[service] ?? <Cloud size={22} />

  return (
    <div className="flex flex-col">
      {/* Service header */}
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
          {serviceIcon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-label font-medium text-foreground truncate">{t('cloud.connected')}</p>
          {connection.accountEmail && (
            <p className="text-micro text-muted-foreground/60 mt-0.5 truncate">{connection.accountEmail}</p>
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
        <div className="px-3 pb-2 space-y-1">
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

      {/* Footer */}
      <div className="border-t border-border/30 px-3 py-2 flex items-center gap-2 text-caption text-muted-foreground/40">
        <span className="shrink-0">{t('cloud.lastSync')}</span>
        {connection.lastSyncAt ? (
          <>
            <span className="text-muted-foreground/20">·</span>
            <span className="tabular-nums">{formatTime(connection.lastSyncAt)}</span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground/20">·</span>
            <span className="text-muted-foreground/30">{t('cloud.noRecords')}</span>
          </>
        )}
      </div>
    </div>
  )
}
