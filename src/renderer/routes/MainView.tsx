import { type ReactElement, useEffect, useState, useCallback, useRef } from 'react'
import { useNoteStore } from '../stores/noteStore'
import { useStatusBarStore } from '../stores/statusBarStore'
import { CommandInput } from '../components/command/CommandInput'
import type { AICommand } from '../components/command/CommandInput'
import { CommandResultPanel } from '../components/command/CommandResultPanel'
import { CardWall } from '../components/cards/CardWall'
import { StatusBar } from '../components/statusbar/StatusBar'
import { StatusBarItem } from '../components/statusbar/StatusBarItem'
import { StatusBarPanel } from '../components/statusbar/StatusBarPanel'
import { AIOperationPanel } from '../components/statusbar/panels/AIOperationPanel'
import { Settings, AlertCircle, RotateCw, Sparkles } from 'lucide-react'
import { useT } from '../i18n'
import type { Note, AICommandRequest, AICommandResult } from '../../shared/types'

/** delete/edit results await a second-phase confirmation. */
type PendingResult = Extract<AICommandResult, { kind: 'delete_candidates' } | { kind: 'edit_preview' }>

export function MainView(): ReactElement {
  const fetchNotes = useNoteStore((s) => s.fetchNotes)
  const searchQuery = useNoteStore((s) => s.searchQuery)
  const setSearchQuery = useNoteStore((s) => s.setSearchQuery)
  const setSearchResult = useNoteStore((s) => s.setSearchResult)
  const updateNote = useNoteStore((s) => s.updateNote)
  const deleteNote = useNoteStore((s) => s.deleteNote)
  const { t } = useT()

  // Status bar
  const failedCount = useStatusBarStore((s) => s.getFailedCount())

  // Command lifecycle state
  const [processingCmd, setProcessingCmd] = useState<AICommand | null>(null)
  const [pending, setPending] = useState<PendingResult | null>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const reqIdRef = useRef<string | null>(null)
  const lastCmdRef = useRef<AICommand | null>(null)

  // Initial data load
  useEffect(() => {
    fetchNotes()
  }, [])

  // Real-time IPC events
  useEffect(() => {
    const c1 = window.electronAPI.on('event:note-created', (n: unknown) => {
      if ((n as Note).status === 'published') fetchNotes()
    })
    const c2 = window.electronAPI.on('event:note-updated', () => fetchNotes())
    const c3 = window.electronAPI.on('event:note-deleted', () => fetchNotes())
    return () => { c1(); c2(); c3() }
  }, [fetchNotes])

  const toErrorMessage = useCallback((err: unknown): string => {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('NO_ACTIVE_PROVIDER')) return t('search.noProvider')
    if (msg.includes('EDIT_TARGET_NOT_FOUND')) return t('search.noTarget')
    return t('search.failed')
  }, [t])

  // ── Run a `/` command through the main-process AI service ────────────
  const runAICommand = useCallback(async (cmd: AICommand) => {
    const requestId = crypto.randomUUID()
    const controller = new AbortController()
    abortRef.current = controller
    reqIdRef.current = requestId
    lastCmdRef.current = cmd
    setError(null)
    setPending(null)
    setProcessingCmd(cmd)

    const req: AICommandRequest = { id: requestId, type: cmd.type, raw: cmd.raw, explicit: cmd.explicit }
    const startedAt = Date.now()

    try {
      const result = await window.electronAPI.aiCommand.run(req)
      if (controller.signal.aborted) return
      if (result.kind === 'search') {
        setSearchResult({ query: result.query, notes: result.notes })
      } else if (result.kind === 'add') {
        setSearchResult(null)
        setSearchQuery('')
        await fetchNotes()
      } else if (result.kind === 'delete_candidates' && result.matches.length === 0) {
        setError(t('search.noTarget'))
      } else {
        setPending(result)
        return // wait for confirm
      }

      // Track success
      useStatusBarStore.getState().addRecord({
        id: requestId,
        type: cmd.type,
        raw: cmd.raw,
        status: 'success',
        duration: Date.now() - startedAt,
        createdAt: new Date().toISOString()
      })
    } catch (err) {
      if (controller.signal.aborted) return
      console.error('AI command failed:', err)
      setError(toErrorMessage(err))

      // Track failure
      useStatusBarStore.getState().addRecord({
        id: requestId,
        type: cmd.type,
        raw: cmd.raw,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - startedAt,
        createdAt: new Date().toISOString()
      })
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        reqIdRef.current = null
        setProcessingCmd(null)
      }
    }
  }, [fetchNotes, setSearchResult, setSearchQuery, toErrorMessage, t])

  const handleAbort = useCallback(() => {
    const id = reqIdRef.current
    if (id) window.electronAPI.aiCommand.cancel(id).catch(() => {})
    abortRef.current?.abort()
    abortRef.current = null
    reqIdRef.current = null
    setProcessingCmd(null)
  }, [])

  // Editing the input exits any search result / pending confirmation.
  const handleInputChange = useCallback((v: string) => {
    setSearchQuery(v)
    if (useNoteStore.getState().searchResult) setSearchResult(null)
    setPending(null)
    setError(null)
  }, [setSearchQuery, setSearchResult])

  // ── Confirm an approved delete/edit ──────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!pending) return
    setApplying(true)
    setError(null)
    const startedAt = Date.now()
    const confirmId = crypto.randomUUID()

    try {
      if (pending.kind === 'delete_candidates') {
        const noteIds = pending.matches.map((n) => n.id)
        await window.electronAPI.aiCommand.confirm({ type: 'delete', noteIds })
        useStatusBarStore.getState().addRecord({
          id: confirmId,
          type: 'delete',
          raw: noteIds.join(', '),
          status: 'success',
          duration: Date.now() - startedAt,
          createdAt: new Date().toISOString()
        })
      } else {
        await window.electronAPI.aiCommand.confirm({ type: 'edit', noteId: pending.target.id, proposed: pending.proposed })
        useStatusBarStore.getState().addRecord({
          id: confirmId,
          type: 'edit',
          raw: pending.target.title,
          status: 'success',
          duration: Date.now() - startedAt,
          createdAt: new Date().toISOString()
        })
      }
      setPending(null)
      setSearchQuery('')
      await fetchNotes()
    } catch (err) {
      console.error('Confirm failed:', err)
      setError(toErrorMessage(err))
      useStatusBarStore.getState().addRecord({
        id: confirmId,
        type: pending.kind === 'delete_candidates' ? 'delete' : 'edit',
        raw: pending.kind === 'delete_candidates' ? pending.matches.map((n) => n.id).join(', ') : pending.target.title,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - startedAt,
        createdAt: new Date().toISOString()
      })
    } finally {
      setApplying(false)
    }
  }, [pending, fetchNotes, setSearchQuery, toErrorMessage])

  const handleCancelPending = useCallback(() => setPending(null), [])

  const handleRetry = useCallback(() => {
    if (lastCmdRef.current) runAICommand(lastCmdRef.current)
  }, [runAICommand])

  // Card edit/delete buttons → real store actions
  const handleCardUpdate = useCallback((id: string, title: string, content: string) => {
    updateNote({ id, title, content }).catch((err) => console.error('Failed to update note:', err))
  }, [updateNote])

  const handleCardDelete = useCallback((id: string) => {
    deleteNote(id).catch((err) => console.error('Failed to delete note:', err))
  }, [deleteNote])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* AI Command Bar — draggable region on macOS hiddenInset */}
      <div className="shrink-0 px-24 pt-[46px] pb-[6px] drag-region">
        <div className="no-drag flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="relative max-w-2xl mx-auto">
              <CommandInput
                mode="local"
                value={searchQuery}
                onChange={handleInputChange}
                onCommit={runAICommand}
                processing={!!processingCmd}
                onAbort={handleAbort}
              />
              {error && (
                <div className="absolute top-full left-0 right-0 z-40 mt-2 flex items-center gap-2 pl-[6px] text-caption text-type-credential">
                  <AlertCircle size={12} className="shrink-0" />
                  <span className="truncate">{error}</span>
                  <button
                    onClick={handleRetry}
                    className="ml-1 shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <RotateCw size={12} />
                    {t('search.retry')}
                  </button>
                </div>
              )}
              {pending && (
                <div className="absolute top-full left-0 right-0 z-40 mt-2">
                  <CommandResultPanel
                    result={pending}
                    applying={applying}
                    onConfirm={handleConfirm}
                    onCancel={handleCancelPending}
                  />
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => window.electronAPI.window.showSettings()}
            className="shrink-0 mt-1 p-2 rounded-xl text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Card canvas */}
      <div className="flex-1 overflow-y-auto">
        <CardWall onUpdate={handleCardUpdate} onDelete={handleCardDelete} />
      </div>

      {/* Status bar */}
      <StatusBar>
        <StatusBarItem
          id="ai"
          icon={<Sparkles size={14} />}
          label={t('statusbar.aiRecords')}
          text={failedCount > 0 ? t('statusbar.failed', { n: failedCount }) : t('statusbar.ai')}
          badge={failedCount}
        >
          <StatusBarPanel title={t('statusbar.aiRecords')}>
            <AIOperationPanel />
          </StatusBarPanel>
        </StatusBarItem>
      </StatusBar>
    </div>
  )
}
