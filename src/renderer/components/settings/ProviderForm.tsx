import { type ReactElement, useState, useEffect } from 'react'
import type { AIProviderConfig, AIProviderType } from '../../../shared/types'
import { BUILTIN_PROVIDER_PRESETS } from '../../../shared/constants'
import { X } from 'lucide-react'
import { useT } from '../../i18n'

interface ProviderFormProps {
  mode: 'add' | 'edit'
  initial?: AIProviderConfig
  onSave: (config: Omit<AIProviderConfig, 'id' | 'createdAt' | 'isActive'>) => void
  onCancel: () => void
}

const TYPE_LABELS: Record<AIProviderType, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  moonshot: 'Moonshot',
  zhipu: 'Zhipu (智谱)',
  custom: 'Custom'
}

export function ProviderForm({
  mode,
  initial,
  onSave,
  onCancel
}: ProviderFormProps): ReactElement {
  const [type, setType] = useState<AIProviderType>(initial?.type ?? 'anthropic')
  const [name, setName] = useState(initial?.name ?? '')
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '')
  const [baseURL, setBaseURL] = useState(initial?.baseURL ?? '')
  const [model, setModel] = useState(initial?.model ?? '')
  const [thinking, setThinking] = useState(initial?.thinking ?? 'disabled')
  const { t } = useT()

  // Auto-fill from preset when type changes
  useEffect(() => {
    if (mode === 'add' && !initial) {
      const preset = BUILTIN_PROVIDER_PRESETS.find((p) => p.type === type)
      if (preset) {
        setBaseURL(preset.baseURL)
        setModel(preset.model)
        setName(TYPE_LABELS[type])
      } else if (type === 'custom') {
        setName('')
      }
    }
  }, [type, mode])

  const canSave = name.trim() && apiKey.trim() && baseURL.trim() && model.trim()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    onSave({
      type,
      name: name.trim(),
      apiKey: apiKey.trim(),
      baseURL: baseURL.trim(),
      model: model.trim(),
      maxTokens: 300,
      thinking: type === 'deepseek' ? thinking : undefined
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-card rounded-2xl shadow-2xl border p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-heading font-bold">
            {mode === 'add' ? t('provider.form.addTitle') : t('provider.form.editTitle')}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Type selector */}
        <label className="block space-y-1.5">
          <span className="text-label font-medium text-muted-foreground">{t('provider.form.type')}</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AIProviderType)}
            className="w-full bg-muted/50 rounded-xl px-3 py-2 text-body outline-none border border-transparent focus:border-primary/30"
          >
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {/* Name */}
        <label className="block space-y-1.5">
          <span className="text-label font-medium text-muted-foreground">{t('provider.form.name')}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('provider.form.namePlaceholder')}
            className="w-full bg-muted/50 rounded-xl px-3 py-2 text-body outline-none border border-transparent focus:border-primary/30"
            autoFocus
          />
        </label>

        {/* API Key */}
        <label className="block space-y-1.5">
          <span className="text-label font-medium text-muted-foreground">{t('provider.form.apiKey')}</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={mode === 'edit' ? t('provider.form.apiKeyUnchanged') : 'sk-...'}
            className="w-full bg-muted/50 rounded-xl px-3 py-2 text-body font-mono outline-none border border-transparent focus:border-primary/30"
          />
        </label>

        {/* Base URL */}
        <label className="block space-y-1.5">
          <span className="text-label font-medium text-muted-foreground">{t('provider.form.baseURL')}</span>
          <input
            type="text"
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
            placeholder="https://api.example.com/v1"
            className="w-full bg-muted/50 rounded-xl px-3 py-2 text-body font-mono outline-none border border-transparent focus:border-primary/30"
            disabled={type !== 'custom'}
          />
        </label>

        {/* Model */}
        <label className="space-y-1.5">
          <span className="text-label font-medium text-muted-foreground">{t('provider.form.model')}</span>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model-name"
            className="w-full bg-muted/50 rounded-xl px-3 py-2 text-body outline-none border border-transparent focus:border-primary/30"
          />
        </label>

        {/* DeepSeek Thinking Mode */}
        {type === 'deepseek' && (
          <label className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
            <div>
              <span className="text-body font-medium">{t('provider.form.thinking')}</span>
              <p className="text-caption text-muted-foreground mt-0.5">
                {t('provider.form.thinkingHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setThinking((prev) => (prev === 'enabled' ? 'disabled' : 'enabled'))
              }
              className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ml-3 ${
                thinking === 'enabled' ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  thinking === 'enabled' ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl text-body font-medium bg-muted/50 hover:bg-muted transition-colors"
          >
            {t('provider.form.cancel')}
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="flex-1 px-4 py-2 rounded-xl text-body font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {mode === 'add' ? t('provider.form.addTitle') : t('provider.form.save')}
          </button>
        </div>
      </form>
    </div>
  )
}
