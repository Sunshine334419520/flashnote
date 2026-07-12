import type { ReactElement } from 'react'
import type { AIProviderConfig } from '../../../shared/types'
import { Check, Zap, Trash2, Wrench } from 'lucide-react'
import { useT } from '../../i18n'

interface ProviderCardProps {
  config: AIProviderConfig
  onSetActive: () => void
  onEdit: () => void
  onDelete: () => void
  onTest: () => void
  isTesting: boolean
}

export function ProviderCard({
  config,
  onSetActive,
  onEdit,
  onDelete,
  onTest,
  isTesting
}: ProviderCardProps): ReactElement {
  const { t } = useT()
  const maskedKey =
    config.apiKey.slice(0, 6) + '...' + config.apiKey.slice(-4)

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 transition-colors ${
        config.isActive
          ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-card hover:border-primary/20'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-body">{config.name}</h3>
          {config.isActive && (
            <span className="inline-flex items-center gap-1 text-micro px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
              <Zap size={12} /> {t('provider.active')}
            </span>
          )}
        </div>
        <span className="text-micro px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground uppercase tracking-wider">
          {config.type}
        </span>
      </div>

      {/* Info */}
      <div className="space-y-1 text-label text-muted-foreground">
        <div className="flex justify-between">
          <span>{t('provider.field.model')}</span>
          <span className="text-foreground/70 font-mono text-caption">{config.model}</span>
        </div>
        <div className="flex justify-between">
          <span>{t('provider.field.apiKey')}</span>
          <span className="text-foreground/70 font-mono text-caption">{maskedKey}</span>
        </div>
        <div className="flex justify-between">
          <span>{t('provider.field.endpoint')}</span>
          <span className="text-foreground/70 font-mono text-caption truncate max-w-[200px]">
            {config.baseURL}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {!config.isActive && (
          <button
            onClick={onSetActive}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-caption font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Check size={12} /> {t('provider.setActive')}
          </button>
        )}
        <button
          onClick={onTest}
          disabled={isTesting}
          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-caption bg-muted/50 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {isTesting ? (
            <span className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          ) : (
            <Zap size={12} />
          )}
          {isTesting ? t('provider.testing') : t('provider.test')}
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-caption text-muted-foreground hover:bg-muted transition-colors"
          title={t('provider.edit')}
        >
          <Wrench size={12} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-caption text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 transition-colors"
          title={t('provider.delete')}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
