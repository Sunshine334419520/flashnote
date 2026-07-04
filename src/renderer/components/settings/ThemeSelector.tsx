import type { ReactElement } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '../../lib/cn'

interface Props {
  theme: 'light' | 'dark' | 'system'
  onChange: (t: 'light' | 'dark' | 'system') => void
}

const OPTIONS: { value: 'light' | 'dark' | 'system'; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: '浅色' },
  { value: 'dark', icon: Moon, label: '深色' },
  { value: 'system', icon: Monitor, label: '跟随系统' },
]

export function ThemeSelector({ theme, onChange }: Props): ReactElement {
  return (
    <div className="px-8 py-6 space-y-4">
      <h2 className="text-sm font-medium text-foreground">界面模式</h2>
      <div className="flex gap-2">
        {OPTIONS.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={cn(
              'flex-1 flex flex-col items-center gap-2 px-4 py-3 rounded-xl border transition-colors',
              theme === value
                ? 'border-primary/40 bg-primary/5 text-primary'
                : 'border-border hover:border-primary/20 hover:bg-muted/50 text-muted-foreground'
            )}
          >
            <Icon size={18} />
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
