import { readNote, createNote, modifyNote, removeNote } from '../storage.service'
import { recallCandidates } from '../index.service'
import { extractJSON } from './anthropic.provider'
import { heuristicParse } from './base'
import {
  SMART_PARSE_SYSTEM_PROMPT,
  buildParseUserMessage,
  RERANK_SYSTEM_PROMPT,
  buildRerankUserMessage,
  LOCATE_SYSTEM_PROMPT,
  buildLocateUserMessage,
  EDIT_PROPOSE_SYSTEM_PROMPT,
  buildEditProposeUserMessage,
  INTENT_SYSTEM_PROMPT,
  buildIntentUserMessage
} from './prompts'
import type { AICandidate } from './prompts'
import type { AIService } from './index'
import { logger } from '../../utils/logger'
import { maskSecrets } from '../../utils/mask'
import { AI_COMMAND } from '../../../shared/constants'
import type {
  AICommandRequest,
  AICommandResult,
  AICommandConfirmRequest,
  AICommandConfirmResult,
  EditProposal,
  Note,
  SmartParseResult
} from '../../../shared/types'

/**
 * Executes command-bar operations (search/add/delete/edit) against real notes
 * using the active AI provider. No Electron deps — broadcasting is the IPC layer's
 * job. delete/edit only locate/preview here; mutations happen in confirm().
 *
 * Every step logs under scope `ai:<op>` tagged with `req` (the command requestId),
 * so one command's full chain is greppable end to end.
 */
export class AICommandService {
  constructor(private readonly ai: AIService) {}

  async run(req: AICommandRequest, signal: AbortSignal): Promise<AICommandResult> {
    let type = req.type
    let raw = req.raw

    logger.info('ai:cmd', 'run', {
      req: req.id,
      type: req.type,
      explicit: req.explicit,
      raw: maskSecrets(req.raw).slice(0, 500)
    })

    // Natural language: resolve intent first, then route.
    if (!req.explicit) {
      const intent = await this.classifyIntent(req.raw, signal, req.id)
      type = intent.intent
      raw = intent.query || req.raw
    }

    switch (type) {
      case 'search':
        return { kind: 'search', query: raw, notes: await this.search(raw, signal, req.id) }
      case 'add':
        return { kind: 'add', note: await this.add(raw, signal, req.id) }
      case 'delete': {
        const { matches, reasons } = await this.locateForDelete(raw, signal, req.id)
        return { kind: 'delete_candidates', query: raw, matches, reasons }
      }
      case 'edit': {
        const preview = await this.locateForEdit(raw, signal, req.id)
        if (!preview) throw new Error('EDIT_TARGET_NOT_FOUND')
        return { kind: 'edit_preview', ...preview }
      }
      default:
        throw new Error(`Unknown command type: ${type}`)
    }
  }

  confirm(req: AICommandConfirmRequest): AICommandConfirmResult {
    if (req.type === 'delete') {
      for (const id of req.noteIds) removeNote(id)
      logger.info('ai:delete', 'confirmed', { count: req.noteIds.length, noteIds: req.noteIds })
      return { kind: 'deleted', count: req.noteIds.length }
    }
    const note = modifyNote({
      id: req.noteId,
      title: req.proposed.title,
      content: req.proposed.content,
      category: req.proposed.category,
      tags: req.proposed.tags
    })
    logger.info('ai:edit', 'confirmed', { noteId: req.noteId, fields: Object.keys(req.proposed) })
    return { kind: 'edited', note }
  }

  // ── search: FTS recall → LLM rerank ──────────────────────────────────

  private async search(query: string, signal: AbortSignal, traceId: string): Promise<Note[]> {
    logger.info('ai:search', 'input', { req: traceId, query: maskSecrets(query) })

    const candidates = recallCandidates(query, AI_COMMAND.CANDIDATE_LIMIT)
    logger.info('ai:search', 'recall', {
      req: traceId,
      count: candidates.length,
      notes: candidates.slice(0, 20).map((n) => ({ id: n.id, type: n.type, title: maskSecrets(n.title) }))
    })
    if (candidates.length === 0) return []

    const raw = await this.ai.complete({
      system: RERANK_SYSTEM_PROMPT,
      user: buildRerankUserMessage(query, candidates.map(toCandidate)),
      json: true,
      maxTokens: AI_COMMAND.MAX_TOKENS.RERANK,
      signal,
      traceId,
      label: 'search.rerank'
    })

    const parsed = safeJson<{
      interpretation?: string
      ranked?: Array<{ i?: number; score?: number }>
    }>(raw)
    if (!parsed) logParseFailure('ai:search', 'search.rerank', traceId, raw)

    const results: Array<{ note: Note; score?: number }> = []
    for (const r of parsed?.ranked ?? []) {
      if ((r.score ?? 0) < AI_COMMAND.RELEVANCE_THRESHOLD) continue
      const note = candidates[(r.i ?? 0) - 1]
      if (note) results.push({ note, score: r.score })
    }
    results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

    logger.info('ai:search', 'ranked', {
      req: traceId,
      interpretation: parsed?.interpretation ?? '',
      kept: results.length,
      ofCandidates: candidates.length,
      results: results.slice(0, 10).map((r) => ({ id: r.note.id, score: r.score, title: maskSecrets(r.note.title) }))
    })
    return results.map((r) => r.note)
  }

  // ── add: AI parse (logged) → publish ─────────────────────────────────

  private async add(raw: string, signal: AbortSignal, traceId: string): Promise<Note> {
    logger.info('ai:add', 'input', { req: traceId, raw: maskSecrets(raw) })

    const parsed = await this.parseForAdd(raw, signal, traceId)
    logger.info('ai:add', 'parsed', {
      req: traceId,
      type: parsed.type,
      title: maskSecrets(parsed.title),
      category: parsed.category,
      tags: parsed.tags,
      sensitive: parsed.sensitive,
      cleanedContent: maskSecrets(parsed.cleanedContent).slice(0, 500)
    })

    const note = createNote(
      { content: parsed.cleanedContent },
      {
        type: parsed.type,
        category: parsed.category,
        tags: parsed.tags,
        title: parsed.title,
        sensitive: parsed.sensitive,
        typedData: parsed.typedData,
        status: 'published'
      }
    )
    logger.info('ai:add', 'stored', { req: traceId, noteId: note.id, type: note.type })
    return note
  }

  /** Parse for /add via the logged complete() path, with heuristic fallback. */
  private async parseForAdd(raw: string, signal: AbortSignal, traceId: string): Promise<SmartParseResult> {
    try {
      const out = await this.ai.complete({
        system: SMART_PARSE_SYSTEM_PROMPT,
        user: buildParseUserMessage(raw),
        json: true,
        maxTokens: AI_COMMAND.MAX_TOKENS.PARSE,
        signal,
        traceId,
        label: 'add.parse'
      })
      return extractJSON(out)
    } catch (err) {
      if (signal.aborted) throw err
      logger.warn('ai:add', 'parse failed → heuristic fallback', { req: traceId, error: (err as Error).message })
      return heuristicParse(raw)
    }
  }

  // ── delete: locate candidates (no mutation) ──────────────────────────

  private async locateForDelete(
    query: string,
    signal: AbortSignal,
    traceId: string
  ): Promise<{ matches: Note[]; reasons: Record<string, string> }> {
    logger.info('ai:delete', 'input', { req: traceId, query: maskSecrets(query) })

    const candidates = recallCandidates(query, AI_COMMAND.CANDIDATE_LIMIT)
    logger.info('ai:delete', 'recall', { req: traceId, count: candidates.length })
    if (candidates.length === 0) return { matches: [], reasons: {} }

    const located = await this.locate(query, candidates, signal, traceId, 'delete.locate')
    const byId = new Map(candidates.map((n) => [n.id, n]))
    const matches: Note[] = []
    const reasons: Record<string, string> = {}
    for (const m of located) {
      const note = byId.get(m.id)
      if (note) {
        matches.push(note)
        reasons[note.id] = m.reason ?? ''
      }
    }

    logger.info('ai:delete', 'located', {
      req: traceId,
      matches: matches.map((n) => ({ id: n.id, title: maskSecrets(n.title), reason: reasons[n.id] }))
    })
    return { matches, reasons }
  }

  // ── edit: locate target + propose changes (no mutation) ──────────────

  private async locateForEdit(
    instruction: string,
    signal: AbortSignal,
    traceId: string
  ): Promise<{ target: Note; proposed: EditProposal; summary: string } | null> {
    logger.info('ai:edit', 'input', { req: traceId, instruction: maskSecrets(instruction) })

    const candidates = recallCandidates(instruction, AI_COMMAND.CANDIDATE_LIMIT)
    logger.info('ai:edit', 'recall', { req: traceId, count: candidates.length })
    if (candidates.length === 0) return null

    // Step 1: pick the single most likely target from snippets.
    const located = await this.locate(instruction, candidates, signal, traceId, 'edit.locate')
    const targetId = located[0]?.id
    const shallow = candidates.find((n) => n.id === targetId)
    if (!shallow) {
      logger.info('ai:edit', 'no target', { req: traceId, candidates: candidates.length })
      return null
    }
    logger.info('ai:edit', 'target', { req: traceId, noteId: shallow.id, title: maskSecrets(shallow.title) })

    // Step 2: read full content, propose the edit.
    const target = readNote(shallow.id) ?? shallow
    const raw = await this.ai.complete({
      system: EDIT_PROPOSE_SYSTEM_PROMPT,
      user: buildEditProposeUserMessage(instruction, {
        title: target.title,
        content: target.content,
        tags: target.tags,
        category: target.category
      }),
      json: true,
      maxTokens: AI_COMMAND.MAX_TOKENS.EDIT,
      signal,
      traceId,
      label: 'edit.propose'
    })

    const parsed = safeJson<{ proposed?: EditProposal; summary?: string }>(raw)
    if (!parsed) logParseFailure('ai:edit', 'edit.propose', traceId, raw)
    const proposed = sanitizeProposal(parsed?.proposed)
    if (Object.keys(proposed).length === 0) {
      logger.info('ai:edit', 'no change proposed', { req: traceId, noteId: target.id })
      return null
    }

    logger.info('ai:edit', 'proposed', {
      req: traceId,
      noteId: target.id,
      fields: Object.keys(proposed),
      summary: parsed?.summary ?? '',
      proposed: maskProposal(proposed)
    })
    return { target, proposed, summary: parsed?.summary ?? '' }
  }

  // ── shared helpers ───────────────────────────────────────────────────

  private async locate(
    query: string,
    candidates: Note[],
    signal: AbortSignal,
    traceId: string,
    label: string
  ): Promise<Array<{ id: string; reason?: string }>> {
    const raw = await this.ai.complete({
      system: LOCATE_SYSTEM_PROMPT,
      user: buildLocateUserMessage(query, candidates.map(toCandidate)),
      json: true,
      maxTokens: AI_COMMAND.MAX_TOKENS.LOCATE,
      signal,
      traceId,
      label
    })
    const parsed = safeJson<{ matches?: Array<{ i?: number; reason?: string }> }>(raw)
    if (!parsed) logParseFailure('ai:locate', label, traceId, raw)
    const out: Array<{ id: string; reason?: string }> = []
    for (const m of parsed?.matches ?? []) {
      const note = candidates[(m.i ?? 0) - 1]
      if (note) out.push({ id: note.id, reason: m.reason })
    }
    return out
  }

  private async classifyIntent(
    raw: string,
    signal: AbortSignal,
    traceId: string
  ): Promise<{ intent: AICommandRequest['type']; query: string }> {
    const out = await this.ai.complete({
      system: INTENT_SYSTEM_PROMPT,
      user: buildIntentUserMessage(raw),
      json: true,
      maxTokens: AI_COMMAND.MAX_TOKENS.INTENT,
      signal,
      traceId,
      label: 'intent'
    })
    const parsed = safeJson<{ intent?: string; query?: string }>(out)
    if (!parsed) logParseFailure('ai:intent', 'intent', traceId, out)
    const intent = (['search', 'add', 'delete', 'edit'] as const).includes(
      parsed?.intent as AICommandRequest['type']
    )
      ? (parsed!.intent as AICommandRequest['type'])
      : 'search'
    const query = parsed?.query ?? raw
    logger.info('ai:intent', 'resolved', { req: traceId, intent, query: maskSecrets(query).slice(0, 200) })
    return { intent, query }
  }
}

// ── module helpers ─────────────────────────────────────────────────────

function toCandidate(note: Note): AICandidate {
  return {
    id: note.id,
    type: note.type,
    title: note.title,
    tags: note.tags,
    snippet: note.content.replace(/\s+/g, ' ').slice(0, AI_COMMAND.SNIPPET_LENGTH)
  }
}

/** Only keep the four editable fields, dropping empties. */
function sanitizeProposal(proposed?: EditProposal): EditProposal {
  const out: EditProposal = {}
  if (!proposed) return out
  if (typeof proposed.title === 'string' && proposed.title.trim()) out.title = proposed.title
  if (typeof proposed.content === 'string' && proposed.content.trim()) out.content = proposed.content
  if (typeof proposed.category === 'string' && proposed.category.trim()) out.category = proposed.category
  if (Array.isArray(proposed.tags)) out.tags = proposed.tags.map(String)
  return out
}

/** Mask a proposal's string fields for logging. */
function maskProposal(proposed: EditProposal): EditProposal {
  return {
    ...(proposed.title !== undefined && { title: maskSecrets(proposed.title) }),
    ...(proposed.category !== undefined && { category: proposed.category }),
    ...(proposed.tags !== undefined && { tags: proposed.tags }),
    ...(proposed.content !== undefined && { content: maskSecrets(proposed.content).slice(0, 500) })
  }
}

/** Parse JSON that may be wrapped in markdown fences; null on failure. */
function safeJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1].trim() : text.trim()
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * A null parse almost always means the model's JSON was truncated (max_tokens)
 * or malformed. Log it loudly with the raw length + preview so a "0 results"
 * outcome is never mistaken for "nothing matched".
 */
function logParseFailure(scope: string, step: string, traceId: string, raw: string): void {
  logger.warn(scope, 'JSON parse failed (truncated or malformed response)', {
    req: traceId,
    step,
    chars: raw.length,
    preview: maskSecrets(raw).slice(0, 500)
  })
}
