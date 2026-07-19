import { type ReactElement, useState, useEffect, useCallback, useRef } from 'react'
import { Sparkles, Cloud, Check, Monitor, Eye, EyeOff, Loader2, ChevronDown, Settings, Keyboard } from 'lucide-react'
import { useCloudSyncStore } from '../stores/cloudSyncStore'
import { CloudSyncSettings } from '../components/settings/CloudSyncSettings'
import { useT } from '../i18n'
import { cn } from '../lib/cn'
import type { AIProviderConfig, AIProviderType } from '../../shared/types'
import { CLOUD_STATUS } from '../../shared/types'
import { BUILTIN_PROVIDER_PRESETS, CONFIG_KEYS } from '../../shared/constants'
import { PROVIDER_META, ProviderIcon } from '../components/common/ProviderIcons'

// ================================================================
// Provider data
// ================================================================

interface ProviderOption {
  type: AIProviderType
  label: string
}

const PROVIDERS: ProviderOption[] = [
  { type: 'deepseek', label: 'DeepSeek' },
  { type: 'moonshot', label: 'Moonshot' },
  { type: 'anthropic', label: 'Anthropic' },
  { type: 'openai', label: 'OpenAI' },
  { type: 'zhipu', label: 'Zhipu' },
  { type: 'custom', label: '自定义' },
]

const DEFAULT_MODELS: Record<string, string[]> = {
  deepseek: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  moonshot: ['kimi-k3'],
  anthropic: ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-4-8'],
  openai: ['gpt-5.4-mini', 'gpt-5.4', 'gpt-5.4-nano'],
  zhipu: ['glm-4.7-flash', 'glm-4.7'],
}

// ================================================================
// Shortcut options
// ================================================================

const SHORTCUT_OPTIONS = [
  { key: 'Alt+Space', label: 'Alt + Space' },
  { key: 'CmdOrCtrl+Shift+K', label: '⌘/Ctrl + Shift + K' },
  { key: 'CmdOrCtrl+Shift+J', label: '⌘/Ctrl + Shift + J' },
  { key: 'CmdOrCtrl+Shift+Space', label: '⌘/Ctrl + Shift + Space' },
]

// ================================================================
// Main OnboardingView (modal overlay)
// ================================================================

interface Props { onComplete: () => void }
type Step = 'ai' | 'cloud' | 'shortcut' | 'done'

export function OnboardingView({ onComplete }: Props): ReactElement {
  const { t } = useT()
  const [step, setStep] = useState<Step>('ai')
  const [fade, setFade] = useState(false)
  const [hotkey, setHotkey] = useState('Alt+Space')
  const [saving, setSaving] = useState(false)
  const connection = useCloudSyncStore((s) => s.connection)

  useEffect(() => {
    window.electronAPI.settings.get(CONFIG_KEYS.HOTKEY).then((v) => {
      if (typeof v === 'string' && v) setHotkey(v)
    })
  }, [])

  const transition = useCallback((next: Step) => {
    setFade(true)
    setTimeout(() => { setStep(next); setFade(false) }, 200)
  }, [])

  const handleFinish = useCallback(async () => {
    setSaving(true)
    try {
      await window.electronAPI.settings.set(CONFIG_KEYS.HOTKEY, hotkey)
      await window.electronAPI.settings.set(CONFIG_KEYS.ONBOARDING_COMPLETED, true)
      onComplete()
    } catch { setSaving(false) }
  }, [hotkey, onComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm px-4">
      <div className={cn(
        'w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl p-6 transition-all duration-200',
        fade ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
      )}>
        {step === 'ai' && <AIConfigStep onDone={() => transition('cloud')} />}
        {step === 'cloud' && <CloudConfigStep onDone={() => transition('shortcut')} connection={connection} />}
        {step === 'shortcut' && (
          <ShortcutStep hotkey={hotkey} onChange={async (h) => { setHotkey(h); return true }} onDone={() => transition('done')} />
        )}
        {step === 'done' && (
          <DoneStep connection={connection} hotkey={hotkey} saving={saving} onFinish={handleFinish} />
        )}
      </div>
    </div>
  )
}

// ================================================================
// Step 1: AI Config
// ================================================================

function AIConfigStep({ onDone }: { onDone: () => void }): ReactElement {
  const [selected, setSelected] = useState<ProviderOption>(PROVIDERS[0])
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(DEFAULT_MODELS.deepseek[0])
  const [baseURL, setBaseURL] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testPhase, setTestPhase] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle')
  const [testError, setTestError] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)
  const { t } = useT()

  const preset = BUILTIN_PROVIDER_PRESETS.find((p) => p.type === selected.type)
  const modelOptions = selected.type !== 'custom' ? (DEFAULT_MODELS[selected.type] ?? []) : []
  const isCustom = selected.type === 'custom'

  const handleSelect = useCallback((p: ProviderOption) => {
    setSelected(p); setDropdownOpen(false); setError(null)
    if (p.type !== 'custom' && DEFAULT_MODELS[p.type]) {
      setModel(DEFAULT_MODELS[p.type][0])
      setBaseURL('')
    } else {
      setModel('')
    }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) setModelDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSave = useCallback(async () => {
    if (!apiKey.trim() || (!isCustom && !model.trim())) return
    setSaving(true)
    setError(null)
    setTestPhase('testing')
    setTestError(null)
    try {
      const config = isCustom
        ? { name: displayName.trim() || '自定义', type: 'custom' as AIProviderType, apiKey: apiKey.trim(), baseURL: baseURL.trim() || 'https://api.openai.com/v1', model: model.trim() || 'gpt-5.4-mini', maxTokens: 300 }
        : { name: selected.label, type: selected.type, apiKey: apiKey.trim(), baseURL: preset!.baseURL, model, maxTokens: preset!.maxTokens }
      const created = await window.electronAPI.ai.providers.add(
        config as Omit<AIProviderConfig, 'id' | 'createdAt' | 'isActive'>
      )

      // Auto-test the connection — delete provider on failure
      try {
        const ok = await window.electronAPI.ai.providers.test(created.id)
        if (ok) {
          setTestPhase('success')
          setTimeout(() => onDone(), 800)
        } else {
          await window.electronAPI.ai.providers.delete(created.id)
          setTestPhase('fail')
          setTestError(t('onboarding.verifyFail'))
        }
      } catch (testErr) {
        await window.electronAPI.ai.providers.delete(created.id)
        setTestPhase('fail')
        setTestError(t('onboarding.verifyFail') + ': ' + (testErr as Error).message)
      }
    } catch (err) {
      setError((err as Error).message)
      setTestPhase('idle')
    } finally { setSaving(false) }
  }, [apiKey, selected, preset, model, baseURL, displayName, isCustom, onDone, t])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles size={15} className="text-primary" />
        </span>
        <h2 className="text-body font-medium text-foreground">AI 配置</h2>
      </div>

      {/* Provider */}
      <div className="space-y-1">
        <label className="text-label text-muted-foreground">服务商</label>
        <button onClick={() => setDropdownOpen(!dropdownOpen)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/50 border border-border hover:border-primary/20 transition-colors text-body">
          <ProviderIcon type={selected.type} size={22} />
          <span className="flex-1 text-left">{selected.label}</span>
          <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', dropdownOpen && 'rotate-180')} />
        </button>
        {dropdownOpen && (
          <div className="border border-border rounded-xl overflow-hidden">
            {PROVIDERS.map((p) => (
              <button key={p.type} onClick={() => handleSelect(p)} className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 transition-colors text-body', p.type === selected.type && 'bg-primary/5')}>
                <ProviderIcon type={p.type} size={20} />
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* API Key */}
      <div className="space-y-1.5">
        <label className="text-label text-muted-foreground">API Key</label>
        <div className="relative">
          <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => { setApiKey(e.target.value); setError(null) }}
            placeholder="输入 API Key"
            className="w-full px-3 py-2.5 pr-10 rounded-xl bg-muted/50 border border-border text-body placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }} autoFocus />
          <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground">
            {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {/* Model */}
      {!isCustom && modelOptions.length > 0 && (
        <div className="space-y-1">
          <label className="text-label text-muted-foreground">模型</label>
          <div className="relative">
            <input type="text" value={model} onChange={(e) => setModel(e.target.value)} onFocus={() => setModelDropdownOpen(true)}
              placeholder="输入模型名称"
              className="w-full px-3 py-2.5 pr-10 rounded-xl bg-muted/50 border border-border text-body outline-none focus:border-primary/30 transition-colors" />
            <button onClick={() => setModelDropdownOpen(!modelDropdownOpen)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground">
              <ChevronDown size={14} className={cn('transition-transform', modelDropdownOpen && 'rotate-180')} />
            </button>
          </div>
          {modelDropdownOpen && (
            <div className="border border-border rounded-xl overflow-hidden -mt-0.5">
              {modelOptions.map((m) => (
                <button key={m} onClick={() => { setModel(m); setModelDropdownOpen(false) }} className={cn('w-full text-left px-3 py-2 text-caption hover:bg-muted/50 transition-colors', m === model && 'bg-primary/5 text-primary')}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom: extra fields */}
      {isCustom && (
        <>
          <div className="space-y-1.5">
            <label className="text-label text-muted-foreground">显示名称</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例如 我的 OpenAI"
              className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-body placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-label text-muted-foreground">模型名称</label>
            <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
              placeholder="例如 gpt-5.4-mini"
              className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-body placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-label text-muted-foreground">API 地址</label>
            <input type="text" value={baseURL} onChange={(e) => setBaseURL(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-body placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors" />
          </div>
        </>
      )}

      {error && <p className="text-caption text-red-500">{error}</p>}

      {/* ── Test feedback ──────────────────────────────────────────── */}
      {testPhase === 'testing' && (
        <div className="flex items-center justify-center gap-2 py-2 text-caption text-muted-foreground">
          <Loader2 size={13} className="animate-spin" />
          <span>{t('onboarding.verifying')}</span>
        </div>
      )}
      {testPhase === 'success' && (
        <div className="flex items-center justify-center gap-1.5 py-2 text-caption text-green-600 dark:text-green-400">
          <Check size={13} />
          <span>{t('onboarding.verifySuccess')}</span>
        </div>
      )}
      {testPhase === 'fail' && (
        <div className="space-y-2">
          <p className="text-caption text-red-500 text-center">{testError}</p>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 rounded-xl text-label font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all">
              {t('onboarding.retry')}
            </button>
            <button onClick={onDone}
              className="flex-1 py-2 rounded-xl text-label font-medium text-muted-foreground hover:bg-muted transition-colors">
              {t('onboarding.skipVerify')}
            </button>
          </div>
        </div>
      )}

      {/* ── Save button (idle state only) ─────────────────────────── */}
      {testPhase !== 'fail' && testPhase !== 'success' && (
        <button onClick={handleSave} disabled={!apiKey.trim() || saving || testPhase === 'testing'}
          className={cn('w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-label font-medium transition-all', apiKey.trim() && testPhase !== 'testing' ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm' : 'bg-muted text-muted-foreground cursor-not-allowed', (saving || testPhase === 'testing') && 'opacity-70')}>
          {saving || testPhase === 'testing' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {testPhase === 'testing' ? t('onboarding.verifying') : '保存并继续'}
        </button>
      )}

      {/* ── Skip button (hidden during testing/success) ───────────── */}
      {testPhase !== 'testing' && testPhase !== 'success' && testPhase !== 'fail' && (
        <button onClick={onDone} className="w-full py-2.5 rounded-xl text-label font-medium text-muted-foreground hover:bg-muted transition-colors">
          跳过
        </button>
      )}
    </div>
  )
}

// ================================================================
// Step 2: Cloud Sync Config
// ================================================================

function CloudConfigStep({ onDone, connection }: {
  onDone: () => void
  connection: ReturnType<typeof useCloudSyncStore.getState>['connection']
}): ReactElement {
  const { t } = useT()

  useEffect(() => {
    if (connection?.status === CLOUD_STATUS.CONNECTED) {
      const timer = setTimeout(onDone, 1500)
      return () => clearTimeout(timer)
    }
  }, [connection?.status, onDone])

  const isConnecting = connection?.status === CLOUD_STATUS.CONNECTING
  const isInitializing = connection?.status === CLOUD_STATUS.INITIALIZING
  const isConnected = connection?.status === 'connected'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Cloud size={15} className="text-primary" />
        </span>
        <h2 className="text-body font-medium text-foreground">云同步</h2>
      </div>

      <CloudSyncSettings />

      {/* OAuth connecting — waiting for browser callback */}
      {isConnecting && (
        <div className="flex items-center justify-center gap-2 py-3 text-caption text-muted-foreground">
          <Loader2 size={13} className="animate-spin" />
          等待浏览器授权...
        </div>
      )}

      {/* initRemote running — setting up cloud database + initial sync */}
      {isInitializing && (
        <div className="flex items-center justify-center gap-2 py-3 text-caption text-muted-foreground">
          <Loader2 size={13} className="animate-spin" />
          正在初始化云数据库并同步数据...
        </div>
      )}

      {/* Fully ready */}
      {isConnected && (
        <div className="flex items-center justify-center gap-1.5 py-3 text-caption text-green-600 dark:text-green-400">
          <Check size={13} />
          {t('cloud.connected')} — 即将进入下一步
        </div>
      )}

      {!isConnecting && !isInitializing && !isConnected && (
        <button onClick={onDone} className="w-full py-2.5 rounded-xl text-label font-medium text-muted-foreground hover:bg-muted transition-colors">
          跳过
        </button>
      )}
    </div>
  )
}

// ================================================================
// Step 3: Shortcut Config — designed for onboarding
// ================================================================

function ShortcutStep({ hotkey, onChange, onDone }: {
  hotkey: string
  onChange: (h: string) => Promise<boolean>
  onDone: () => void
}): ReactElement {
  const [current, setCurrent] = useState(hotkey)
  const [expanded, setExpanded] = useState(false)
  const [recording, setRecording] = useState(false)

  const currentLabel = SHORTCUT_OPTIONS.find((o) => o.key === current)?.label ?? current

  const select = useCallback(async (key: string) => {
    const ok = await onChange(key)
    if (ok) { setCurrent(key); setExpanded(false) }
  }, [onChange])

  // Custom shortcut recording
  const startRecording = useCallback(() => {
    setRecording(true)
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      const mods: string[] = []
      if (e.metaKey) mods.push('CmdOrCtrl')
      if (e.ctrlKey) mods.push('CmdOrCtrl')
      if (e.altKey) mods.push('Alt')
      if (e.shiftKey) mods.push('Shift')
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
      if (!['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) {
        const combo = [...new Set(mods), key].join('+')
        onChange(combo).then((ok) => {
          if (ok) setCurrent(combo)
          setRecording(false)
          setExpanded(false)
        })
        document.removeEventListener('keydown', handler)
      }
    }
    document.addEventListener('keydown', handler)
    // Stop after 5s if no input
    setTimeout(() => { document.removeEventListener('keydown', handler); setRecording(false) }, 5000)
  }, [onChange])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Keyboard size={15} className="text-primary" />
        </span>
        <h2 className="text-body font-medium text-foreground">快捷入口</h2>
      </div>

      <p className="text-caption text-muted-foreground">
        在任何界面按下快捷键即可快速唤起 FlashNote
      </p>

      {/* Current display + expand toggle */}
      <div className="space-y-1">
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/50 border border-border hover:border-primary/20 transition-colors text-body">
          <Keyboard size={14} className="text-primary/60 shrink-0" />
          <span className="flex-1 text-left font-mono tracking-wide">{currentLabel}</span>
          <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </button>

        {/* Expanded options — inline, no absolute positioning */}
        {expanded && (
          <div className="border border-border rounded-xl overflow-hidden">
            {SHORTCUT_OPTIONS.map((opt) => (
              <button key={opt.key} onClick={() => select(opt.key)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors text-body font-mono tracking-wide',
                  opt.key === current && 'bg-primary/5 text-primary'
                )}>
                <span>{opt.label}</span>
                {opt.key === current && <Check size={13} className="text-primary" />}
              </button>
            ))}
            <button
              onClick={startRecording}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors text-body border-t border-border"
            >
              <span className="text-muted-foreground">
                {recording ? '请按下组合键...' : '自定义快捷键'}
              </span>
              {recording && <Loader2 size={13} className="animate-spin text-primary" />}
            </button>
          </div>
        )}
      </div>

      <button onClick={onDone} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-label font-medium transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
        <Check size={14} />
        保存并继续
      </button>
    </div>
  )
}

// ================================================================
// Step 4: Done — summary + start
// ================================================================

interface DoneStepProps {
  connection: ReturnType<typeof useCloudSyncStore.getState>['connection']
  hotkey: string
  saving: boolean
  onFinish: () => void
}

function DoneStep({ connection, hotkey, saving, onFinish }: DoneStepProps): ReactElement {
  const { t } = useT()
  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const isCloudConnected = connection?.status === CLOUD_STATUS.CONNECTED

  useEffect(() => {
    window.electronAPI.ai.providers.list().then(setProviders).catch(() => setProviders([]))
  }, [])

  const activeProviders = providers.filter((p) => p.isActive)
  const aiLabel = activeProviders.length > 0 ? activeProviders.map((p) => p.name).join(', ') : t('onboarding.summary.none')
  const cloudLabel = isCloudConnected ? connection?.service ?? t('onboarding.summary.none') : t('onboarding.summary.none')

  return (
    <div className="space-y-5">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10">
          <Sparkles size={24} className="text-primary" />
        </div>
        <div className="space-y-0.5">
          <h2 className="text-title font-medium text-foreground">一切就绪</h2>
          <p className="text-caption text-muted-foreground">以下是你的配置摘要</p>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <SummaryRow icon={<Sparkles size={14} />} label={t('onboarding.summary.ai')} value={aiLabel} />
        <SummaryRow icon={<Cloud size={14} />} label={t('onboarding.summary.cloud')} value={cloudLabel} />
        <SummaryRow icon={<Monitor size={14} />} label={t('onboarding.summary.hotkey')} value={hotkey} last />
      </div>

      <button onClick={onFinish} disabled={saving}
        className={cn('w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-label font-medium transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm', saving && 'opacity-50 cursor-not-allowed')}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : null}
        开始使用
      </button>

      <p className="text-center text-micro text-muted-foreground/50 flex items-center justify-center gap-1">
        <Settings size={10} />
        随时可在设置中调整以上配置
      </p>
    </div>
  )
}

function SummaryRow({ icon, label, value, last }: { icon: ReactElement; label: string; value: string; last?: boolean }): ReactElement {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-2.5', !last && 'border-b border-border')}>
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-label text-muted-foreground w-[56px] shrink-0">{label}</span>
      <span className="text-body text-foreground truncate">{value}</span>
    </div>
  )
}
