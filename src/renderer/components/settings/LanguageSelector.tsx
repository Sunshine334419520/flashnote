import type { ReactElement } from 'react'
import { Languages } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useT } from '../../i18n'
import type { Language } from '../../i18n'

const OPTIONS: { value: Language; labelKey: 'settings.language.zhCN' | 'settings.language.en' | 'settings.language.system' }[] = [
  { value: 'zh-CN', labelKey: 'settings.language.zhCN' },
  { value: 'en', labelKey: 'settings.language.en' },
  { value: 'system', labelKey: 'settings.language.system' },
]

export function LanguageSelector(): ReactElement {
  const { language, setLanguage, t } = useT()

  return (
    <div className="px-8 py-6 space-y-4">
      <h2 className="text-body font-medium text-foreground">{t('settings.language')}</h2>
      <div className="flex gap-2">
        {OPTIONS.map(({ value, labelKey }) => (
          <button
            key={value}
            onClick={() => setLanguage(value)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-colors',
              language === value
                ? 'border-primary/40 bg-primary/5 text-primary'
                : 'border-border hover:border-primary/20 hover:bg-muted/50 text-muted-foreground'
            )}
          >
            <Languages size={16} />
            <span className="text-caption font-medium">{t(labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
