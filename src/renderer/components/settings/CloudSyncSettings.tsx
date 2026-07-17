import { type ReactElement, useEffect, useCallback, useState } from 'react'
import { Cloud, CloudAlert, RefreshCw, Link2, ExternalLink, AlertCircle, NotepadText } from 'lucide-react'
import { useCloudSyncStore } from '../../stores/cloudSyncStore'
import { useFormatTime } from '../../hooks/useFormatTime'
import { useT } from '../../i18n'
import { cn } from '../../lib/cn'
import type { CloudConnection, SyncProgress, CloudServiceType } from '../../../shared/types'

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

  const [autoSync, setAutoSync] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Listen for cloud status changes from the main process (settings window
  // is a separate BrowserWindow, so it needs its own IPC event listeners).
  useEffect(() => {
    const unsubStatus = window.electronAPI.on('event:cloud-status-changed', (data: unknown) => {
      useCloudSyncStore.getState().setConnection(data as CloudConnection | null)
    })
    const unsubProgress = window.electronAPI.on('event:cloud-sync-progress', (data: unknown) => {
      useCloudSyncStore.getState().setSyncProgress(data as SyncProgress | null)
    })
    return () => { unsubStatus(); unsubProgress() }
  }, [])

  const isConnected = connection?.status === 'connected'
  const isNotionConnected = isConnected && connection?.service === 'notion'
  const isOnenoteConnected = isConnected && connection?.service === 'onenote'
  const isConnecting = connection?.status === 'connecting'
  const isSyncing = syncProgress != null && syncProgress.phase !== 'idle'

  const [connectingService, setConnectingService] = useState<CloudServiceType | null>(null)

  const handleConnect = useCallback(async (service: CloudServiceType) => {
    setError(null)
    setConnectingService(service)
    try {
      await connect(service)
    } catch (err) {
      const msg = (err as Error).message
      console.error('Connect failed:', msg)
      setError(msg)
    } finally {
      setConnectingService(null)
    }
  }, [connect])

  const handleDisconnect = useCallback(async () => {
    await disconnect()
  }, [disconnect])

  const handleSync = useCallback(async () => {
    await sync()
    await fetchStatus()
  }, [sync, fetchStatus])

  return (
    <div className="px-8 py-6 space-y-4">
      {/* Header */}
      <div className="space-y-0.5">
        <h2 className="text-body font-medium text-foreground">{t('cloud.title')}</h2>
        <p className="text-label text-muted-foreground">{t('cloud.subtitle')}</p>
      </div>

      {/* Error banner */}
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

      {/* Notion card */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link2 size={16} className="text-muted-foreground" />
            <span className="text-body font-medium">Notion</span>
          </div>
          {isNotionConnected ? (
            <span className="text-micro font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              {t('cloud.connected')}
            </span>
          ) : isConnecting ? (
            <span className="text-micro font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
              {t('cloud.connecting')}
            </span>
          ) : connection?.status === 'error' ? (
            <span className="text-micro font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-600">
              {t('cloud.syncFailed')}
            </span>
          ) : (
            <span className="text-micro font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {t('cloud.disconnected')}
            </span>
          )}
        </div>

        {/* Connected details */}
        {isConnected && (
          <div className="space-y-1.5 text-caption text-muted-foreground">
            {connection.accountEmail && (
              <div className="flex justify-between">
                <span>{t('cloud.account')}</span>
                <span className="text-foreground/70">{connection.accountEmail}</span>
              </div>
            )}
            {connection.workspaceName && (
              <div className="flex justify-between">
                <span>{t('cloud.workspace')}</span>
                <span className="text-foreground/70">{connection.workspaceName}</span>
              </div>
            )}
            {connection.lastSyncAt && (
              <div className="flex justify-between">
                <span>{t('cloud.lastSync')}</span>
                <span className="text-foreground/70">{formatTime(connection.lastSyncAt)}</span>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {connection?.status === 'error' && connection.error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-caption text-red-600 dark:text-red-400">
            <CloudAlert size={14} className="shrink-0 mt-0.5" />
            <span>{connection.error}</span>
          </div>
        )}

        {/* Disconnected description */}
        {!isConnected && !isConnecting && connection?.status !== 'error' && (
          <p className="text-label text-muted-foreground">{t('cloud.subtitle')}</p>
        )}

        {/* Connecting indicator */}
        {isConnecting && (
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <RefreshCw size={12} className="animate-spin" />
            <span>{t('cloud.connecting')}</span>
          </div>
        )}

        {/* Auto-sync toggle (connected only) */}
        {isConnected && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-label text-muted-foreground">{t('cloud.autoSync')}</span>
            <button
              onClick={() => setAutoSync(!autoSync)}
              className={cn(
                'relative w-9 h-5 rounded-full transition-colors',
                autoSync ? 'bg-primary' : 'bg-muted'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
                  autoSync ? 'left-4.5' : 'left-0.5'
                )}
                style={{ left: autoSync ? '18px' : '2px' }}
              />
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
          {isNotionConnected ? (
            <>
              <button
                onClick={handleSync}
                disabled={isSyncing || isLoading}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-label font-medium transition-colors',
                  'bg-primary/10 text-primary hover:bg-primary/20',
                  (isSyncing || isLoading) && 'opacity-50 cursor-not-allowed'
                )}
              >
                <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? t('cloud.syncing') : t('cloud.syncNow')}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-label font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                {t('cloud.disconnect')}
              </button>
            </>
          ) : (
            <button
              onClick={() => handleConnect('notion')}
              disabled={isConnecting || isLoading}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-label font-medium transition-colors',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                (isConnecting || isLoading) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isConnecting ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Cloud size={12} />
              )}
              {isConnecting ? t('cloud.connecting') : t('cloud.connect')}
            </button>
          )}
          </div>

          {/* Sync progress bar */}
          {isSyncing && syncProgress && syncProgress.total > 0 && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* OneNote card */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <NotepadText size={16} className="text-highlight" />
            <span className="text-body font-medium">{t('cloud.onenote')}</span>
          </div>
          {isOnenoteConnected ? (
            <span className="text-micro font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              {t('cloud.connected')}
            </span>
          ) : isConnecting ? (
            <span className="text-micro font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
              {t('cloud.connecting')}
            </span>
          ) : connection?.status === 'error' ? (
            <span className="text-micro font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-600">
              {t('cloud.syncFailed')}
            </span>
          ) : (
            <button
              onClick={() => handleConnect('onenote')}
              disabled={isConnecting || isLoading}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-micro font-medium transition-colors',
                'bg-primary/10 text-primary hover:bg-primary/20',
                (isConnecting || isLoading) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {connectingService === 'onenote' ? (
                <RefreshCw size={10} className="animate-spin" />
              ) : null}
              {connectingService === 'onenote' ? t('cloud.connecting') : t('cloud.connectGeneric')}
            </button>
          )}
        </div>

        {/* Connected details (only when OneNote is connected) */}
        {isOnenoteConnected && (
          <div className="space-y-1.5 text-caption text-muted-foreground">
            {connection!.accountEmail && (
              <div className="flex justify-between">
                <span>{t('cloud.account')}</span>
                <span className="text-foreground/70">{connection!.accountEmail}</span>
              </div>
            )}
            {connection!.lastSyncAt && (
              <div className="flex justify-between">
                <span>{t('cloud.lastSync')}</span>
                <span className="text-foreground/70">{formatTime(connection!.lastSyncAt)}</span>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {connection?.status === 'error' && connection.error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-caption text-red-600 dark:text-red-400">
            <CloudAlert size={14} className="shrink-0 mt-0.5" />
            <span>{connection.error}</span>
          </div>
        )}

        {/* Disconnected description */}
        {!isOnenoteConnected && !isConnecting && connection?.status !== 'error' && (
          <p className="text-caption text-muted-foreground">{t('cloud.onenoteHint')}</p>
        )}
      </div>
    </div>
  )
}
