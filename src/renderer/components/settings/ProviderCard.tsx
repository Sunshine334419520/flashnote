import type { ReactElement } from 'react'
import type { AIProviderConfig } from '../../../shared/types'
import { Check, Zap, Trash2, Wrench } from 'lucide-react'

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
          <h3 className="font-semibold text-sm">{config.name}</h3>
          {config.isActive && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
              <Zap size={10} /> Active
            </span>
          )}
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground uppercase tracking-wider">
          {config.type}
        </span>
      </div>

      {/* Info */}
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Model</span>
          <span className="text-foreground/70 font-mono text-[11px]">{config.model}</span>
        </div>
        <div className="flex justify-between">
          <span>API Key</span>
          <span className="text-foreground/70 font-mono text-[11px]">{maskedKey}</span>
        </div>
        <div className="flex justify-between">
          <span>Endpoint</span>
          <span className="text-foreground/70 font-mono text-[11px] truncate max-w-[200px]">
            {config.baseURL}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {!config.isActive && (
          <button
            onClick={onSetActive}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Check size={12} /> Set Active
          </button>
        )}
        <button
          onClick={onTest}
          disabled={isTesting}
          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] bg-muted/50 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {isTesting ? (
            <span className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          ) : (
            <Zap size={11} />
          )}
          {isTesting ? 'Testing...' : 'Test'}
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-[11px] text-muted-foreground hover:bg-muted transition-colors"
          title="Edit"
        >
          <Wrench size={12} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-[11px] text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 transition-colors"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
