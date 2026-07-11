import { type ReactElement, useState, useEffect, useCallback } from 'react'
import type { AIProviderConfig } from '../../../shared/types'
import { ProviderCard } from './ProviderCard'
import { ProviderForm } from './ProviderForm'
import { Plus, Server } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useT } from '../../i18n'

export function AIProviderSettings(): ReactElement {
  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProvider, setEditingProvider] = useState<AIProviderConfig | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const { t } = useT()

  const fetchProviders = useCallback(async () => {
    try {
      const list = await window.electronAPI.ai.providers.list()
      setProviders(list)
    } catch (err) {
      console.error('Failed to load providers:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  const handleAdd = useCallback(
    async (config: Omit<AIProviderConfig, 'id' | 'createdAt' | 'isActive'>) => {
      try {
        await window.electronAPI.ai.providers.add(config)
        setShowForm(false)
        await fetchProviders()
      } catch (err) {
        console.error('Failed to add provider:', err)
      }
    },
    [fetchProviders]
  )

  const handleUpdate = useCallback(
    async (config: Omit<AIProviderConfig, 'id' | 'createdAt' | 'isActive'>) => {
      if (!editingProvider) return
      try {
        await window.electronAPI.ai.providers.update(editingProvider.id, config)
        setEditingProvider(null)
        await fetchProviders()
      } catch (err) {
        console.error('Failed to update provider:', err)
      }
    },
    [editingProvider, fetchProviders]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await window.electronAPI.ai.providers.delete(id)
        await fetchProviders()
      } catch (err) {
        console.error('Failed to delete provider:', err)
      }
    },
    [fetchProviders]
  )

  const handleSetActive = useCallback(
    async (id: string) => {
      try {
        await window.electronAPI.ai.providers.setActive(id)
        await fetchProviders()
      } catch (err) {
        console.error('Failed to set active provider:', err)
      }
    },
    [fetchProviders]
  )

  const handleTest = useCallback(
    async (id: string) => {
      setTestingId(id)
      setTestResult(null)
      try {
        const ok = await window.electronAPI.ai.providers.test(id)
        setTestResult(
          ok
            ? { ok: true, msg: t('provider.test.success') }
            : { ok: false, msg: t('provider.test.fail') }
        )
      } catch (err) {
        setTestResult({ ok: false, msg: t('provider.test.error') + (err as Error).message })
      } finally {
        setTestingId(null)
      }
    },
    [t]
  )

  // Auto-dismiss the test result banner after 3s
  useEffect(() => {
    if (!testResult) return
    const timer = setTimeout(() => setTestResult(null), 3000)
    return () => clearTimeout(timer)
  }, [testResult])

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('provider.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('provider.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          {t('provider.add')}
        </button>
      </div>

      {/* Test result banner (replaces blocking alert()) */}
      {testResult && (
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm',
            testResult.ok
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400'
          )}
        >
          <span>{testResult.ok ? '✓' : '✕'}</span>
          <span>{testResult.msg}</span>
        </div>
      )}

      {/* Provider cards */}
      {providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Server size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">{t('provider.empty.title')}</p>
          <p className="text-xs mt-1 opacity-60">
            {t('provider.empty.hint')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              config={p}
              onSetActive={() => handleSetActive(p.id)}
              onEdit={() => setEditingProvider(p)}
              onDelete={() => handleDelete(p.id)}
              onTest={() => handleTest(p.id)}
              isTesting={testingId === p.id}
            />
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <ProviderForm
          mode="add"
          onSave={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingProvider && (
        <ProviderForm
          mode="edit"
          initial={editingProvider}
          onSave={handleUpdate}
          onCancel={() => setEditingProvider(null)}
        />
      )}
    </div>
  )
}
