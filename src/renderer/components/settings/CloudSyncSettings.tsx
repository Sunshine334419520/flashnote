import { type ReactElement, useEffect, useCallback, useState } from 'react'
import { Cloud, CloudAlert, RefreshCw, AlertCircle } from 'lucide-react'
import { useCloudSyncStore } from '../../stores/cloudSyncStore'
import { useFormatTime } from '../../hooks/useFormatTime'
import { useT } from '../../i18n'
import { cn } from '../../lib/cn'
import { NotionIcon, OneNoteIcon } from './CloudServiceIcons'
import { SYNC_PHASES, CLOUD_STATUS } from '../../../shared/types'
import type { CloudConnection, SyncProgress, CloudServiceType } from '../../../shared/types'

interface ServiceOption {
  value: CloudServiceType
  label: string
  descriptionKey: string
  Icon: (props: { size?: number; className?: string }) => ReactElement
}

const SERVICE_OPTIONS: ServiceOption[] = [
  {
    value: 'notion',
    label: 'Notion',
    descriptionKey: 'cloud.notionHint',
    Icon: NotionIcon,
  },
  {
    value: 'onenote',
    label: 'OneNote',
    descriptionKey: 'cloud.onenoteHint',
    Icon: OneNoteIcon,
  },
]

export function CloudSyncSettings(): ReactElement {
  const connection = useCloudSyncStore((s) => s.connection)
  const syncProgress = useCloudSyncStore((s) => s.syncProgress)
  const isLoading = useCloudSyncStore((s) => s.isLoading)
  const fetchStatus = useCloudSyncStore((s) => s.fetchStatus)
  const connect = useCloudSyncStore((s) => s.connect)
  const disconnect = useCloudSyncStore((s) => s.disconnect)
  const sync = useCloudSyncStore((s) => s.sync)
  const formatTime = useFormatTime()
  const { t } = useT()

  const [selectedService, setSelectedService] = useState<CloudServiceType>('notion')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    const unsubStatus = window.electronAPI.on('event:cloud-status-changed', (data: unknown) => {
      useCloudSyncStore.getState().setConnection(data as CloudConnection | null)
    })
    const unsubProgress = window.electronAPI.on('event:cloud-sync-progress', (data: unknown) => {
      useCloudSyncStore.getState().setSyncProgress(data as SyncProgress | null)
    })
    return () => { unsubStatus(); unsubProgress() }
  }, [])

  const isConnected = connection?.status === CLOUD_STATUS.CONNECTED
  const isConnecting = connection?.status === CLOUD_STATUS.CONNECTING
  const isInitializing = connection?.status === CLOUD_STATUS.INITIALIZING
  const isSyncing = syncProgress != null && syncProgress.phase !== SYNC_PHASES.IDLE
  const connectedService = connection?.service as CloudServiceType | undefined
  const connectedOption = connectedService ? SERVICE_OPTIONS.find(o => o.value === connectedService) : null

  const handleConnect = useCallback(async () => {
    setError(null)
    try {
      await connect(selectedService)
      // After connect() returns, connection.status is 'connecting'.
      // OAuth is now in progress in the browser — the UI will track
      // connection.status via IPC events (→ 'connected' or 'error').
    } catch (err) {
      const msg = (err as Error).message
      console.error('Connect failed:', msg)
      setError(msg)
    }
  }, [connect, selectedService])

  const handleDisconnect = useCallback(async () => {
    await disconnect()
  }, [disconnect])

  const handleSync = useCallback(async () => {
    await sync()
    await fetchStatus()
  }, [sync, fetchStatus])

  return (
    <div className="px-8 py-6 space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-body font-medium text-foreground">{t('cloud.title')}</h2>
        <p className="text-label text-muted-foreground">{t('cloud.subtitle')}</p>
      </div>

      {/* Connection error banner — OAuth timeout / rejection, not yet connected */}
      {!isConnected && connection?.status === CLOUD_STATUS.ERROR && connection.error && (
        <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-caption text-red-600 dark:text-red-400">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{t('cloud.syncFailed')}</p>
            <p className="text-red-600/70 dark:text-red-400/70 mt-0.5 break-all">{connection.error}</p>
          </div>
        </div>
      )}

      {/* Local error banner — IPC call itself failed (port in use, etc.) */}
      {error && (
        <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-caption text-red-600 dark:text-red-400">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{t('cloud.syncFailed')}</p>
            <p className="text-red-600/70 dark:text-red-400/70 mt-0.5 break-all">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="shrink-0 text-red-600/50 hover:text-red-600 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Connecting (OAuth in browser) ───────────────────── */}
      {isConnecting && (
        <div className="flex flex-col items-center justify-center min-h-[180px] gap-3">
          <RefreshCw size={28} className="animate-spin text-primary" />
          <div className="text-center">
            <p className="text-body font-medium text-foreground">等待浏览器授权</p>
            <p className="text-caption text-muted-foreground mt-0.5">
              {SERVICE_OPTIONS.find(o => o.value === selectedService)?.label}
            </p>
          </div>
        </div>
      )}

      {/* ── Initializing (setting up remote DB + first sync) ── */}
      {isInitializing && (
        <div className="flex flex-col items-center justify-center min-h-[180px] gap-3">
          <RefreshCw size={28} className="animate-spin text-primary" />
          <div className="text-center">
            <p className="text-body font-medium text-foreground">正在初始化云同步...</p>
            <p className="text-caption text-muted-foreground mt-0.5">
              连接成功，正在同步数据
            </p>
          </div>
        </div>
      )}

      {/* ── Service selector (disconnected) ───────────────────── */}
      {!isConnected && !isConnecting && !isInitializing && (
        <div className="min-h-[180px] space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {SERVICE_OPTIONS.map(({ value, label, descriptionKey, Icon }) => {
              const isSelected = selectedService === value
              return (
                <button
                  key={value}
                  onClick={() => setSelectedService(value)}
                  className={cn(
                    'flex flex-col items-center gap-3 px-4 py-5 rounded-xl border-2 transition-all',
                    isSelected
                      ? 'border-primary/40 bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/20 hover:bg-muted/30'
                  )}
                >
                  <Icon
                    size={36}
                    className={cn(
                      'transition-colors',
                      isSelected ? 'text-foreground' : 'text-muted-foreground/60'
                    )}
                  />
                  <div className="text-center">
                    <p className={cn(
                      'text-caption font-medium transition-colors',
                      isSelected ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {label}
                    </p>
                    <p className="text-micro text-muted-foreground/50 mt-0.5 leading-tight max-w-[140px]">
                      {t(descriptionKey as never)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          <button
            onClick={handleConnect}
            disabled={isConnecting || isLoading}
            className={cn(
              'w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-label font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
              (isConnecting || isLoading) && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Cloud size={14} />
            {t('cloud.connect')}
          </button>
        </div>
      )}

      {/* ── Connected state ──────────────────────────────────── */}
      {isConnected && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          {/* Service header */}
          <div className="flex items-center gap-3">
            {connectedOption && <connectedOption.Icon size={28} className="text-foreground shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-body font-medium">{connectedOption?.label ?? connection.service}</span>
                <span className="text-micro font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                  {t('cloud.connected')}
                </span>
              </div>
              {connection.accountEmail && (
                <p className="text-caption text-muted-foreground mt-0.5 truncate">{connection.accountEmail}</p>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 text-caption">
            {connection.workspaceName && (
              <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-muted/50">
                <span className="text-muted-foreground">{t('cloud.workspace')}</span>
                <span className="text-foreground/80 font-medium">{connection.workspaceName}</span>
              </div>
            )}
            {connection.lastSyncAt && (
              <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-muted/50">
                <span className="text-muted-foreground">{t('cloud.lastSync')}</span>
                <span className="text-foreground/80 font-medium tabular-nums">{formatTime(connection.lastSyncAt)}</span>
              </div>
            )}
          </div>

          {/* Sync error inline */}
          {connection.error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-caption text-red-600 dark:text-red-400">
              <CloudAlert size={14} className="shrink-0 mt-0.5" />
              <span>{connection.error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSync}
                disabled={isSyncing || isLoading}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-label font-medium transition-colors',
                  'bg-primary/10 text-primary hover:bg-primary/20',
                  (isSyncing || isLoading) && 'opacity-50 cursor-not-allowed'
                )}
              >
                <RefreshCw size={14} className={cn(isSyncing && 'animate-spin')} />
                {isSyncing ? t('cloud.syncing') : t('cloud.syncNow')}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-label font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                {t('cloud.disconnect')}
              </button>
            </div>

            {isSyncing && syncProgress && syncProgress.total > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-caption text-muted-foreground">
                  <span>{t(`cloud.phase.${syncProgress.phase}` as never)}</span>
                  <span>{syncProgress.current}/{syncProgress.total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
