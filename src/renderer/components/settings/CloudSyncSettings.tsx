import { type ReactElement, useEffect, useCallback, useState } from 'react'
import { Cloud, CloudAlert, RefreshCw, Link2, ExternalLink, AlertCircle } from 'lucide-react'
import { useCloudSyncStore } from '../../stores/cloudSyncStore'
import { useFormatTime } from '../../hooks/useFormatTime'
import { useT } from '../../i18n'
import { cn } from '../../lib/cn'

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

  const isConnected = connection?.status === 'connected'
  const isConnecting = connection?.status === 'connecting'
  const isSyncing = syncProgress != null && syncProgress.phase !== 'idle'

  const handleConnect = useCallback(async () => {
    setError(null)
    try {
      await connect('notion')
    } catch (err) {
      const msg = (err as Error).message
      console.error('Connect failed:', msg)
      setError(msg)
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
          {isConnected ? (
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
        <div className="flex items-center gap-2 pt-1">
          {isConnected ? (
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
                {t('cloud.syncNow')}
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
              onClick={handleConnect}
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
      </div>

      {/* Feishu card (grayed out, coming soon) */}
      <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 space-y-3 opacity-60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ExternalLink size={16} className="text-muted-foreground/50" />
            <span className="text-body font-medium text-muted-foreground">{t('cloud.feishu')}</span>
          </div>
          <span className="text-micro font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground/60">
            {t('cloud.feishuComingSoon')}
          </span>
        </div>
        <p className="text-label text-muted-foreground/60">{t('cloud.feishuComingSoon')}</p>
      </div>
    </div>
  )
}
