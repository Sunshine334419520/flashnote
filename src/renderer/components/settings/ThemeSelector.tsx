import type { ReactElement } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useT } from '../../i18n'

interface Props {
  theme: 'light' | 'dark' | 'system'
  onChange: (t: 'light' | 'dark' | 'system') => void
}

export function ThemeSelector({ theme, onChange }: Props): ReactElement {
  const { t } = useT()

  return (
    <div className="px-8 py-6 space-y-4">
      <h2 className="text-body font-medium text-foreground">{t('settings.theme')}</h2>
      <div className="flex gap-2">
        <button
          onClick={() => onChange('light')}
          className={cn(
            'flex-1 flex flex-col items-center gap-2 px-4 py-3 rounded-xl border transition-colors',
            theme === 'light'
              ? 'border-primary/40 bg-primary/5 text-primary'
              : 'border-border hover:border-primary/20 hover:bg-muted/50 text-muted-foreground'
          )}
        >
          <Sun size={16} />
          <span className="text-caption font-medium">{t('settings.theme.light')}</span>
        </button>
        <button
          onClick={() => onChange('dark')}
          className={cn(
            'flex-1 flex flex-col items-center gap-2 px-4 py-3 rounded-xl border transition-colors',
            theme === 'dark'
              ? 'border-primary/40 bg-primary/5 text-primary'
              : 'border-border hover:border-primary/20 hover:bg-muted/50 text-muted-foreground'
          )}
        >
          <Moon size={16} />
          <span className="text-caption font-medium">{t('settings.theme.dark')}</span>
        </button>
        <button
          onClick={() => onChange('system')}
          className={cn(
            'flex-1 flex flex-col items-center gap-2 px-4 py-3 rounded-xl border transition-colors',
            theme === 'system'
              ? 'border-primary/40 bg-primary/5 text-primary'
              : 'border-border hover:border-primary/20 hover:bg-muted/50 text-muted-foreground'
          )}
        >
          <Monitor size={16} />
          <span className="text-caption font-medium">{t('settings.theme.system')}</span>
        </button>
      </div>
    </div>
  )
}
