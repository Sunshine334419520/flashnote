import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CloudConnectionRow } from '../../../../src/main/database/schema'
import { CloudSyncService } from '../../../../src/main/services/cloud/cloud-sync.service'

// ── Infrastructure mocks ────────────────────────────────────────────────

const mockDb = { prepare: vi.fn(), exec: vi.fn() }
const mockStatement = { run: vi.fn().mockReturnValue({}), get: vi.fn().mockReturnValue(null), all: vi.fn().mockReturnValue([]) }

vi.mock('../../../../src/main/database/connection', () => ({ getDatabase: vi.fn(() => mockDb) }))
vi.mock('../../../../src/main/utils/broadcast', () => ({ broadcast: vi.fn() }))
vi.mock('../../../../src/main/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('../../../../src/shared/ipc-channels', () => ({
  IPC_CHANNELS: { EVENT_CLOUD_STATUS_CHANGED: 'event:cloud-status-changed', EVENT_CLOUD_SYNC_PROGRESS: 'event:cloud-sync-progress' }
}))

// ── Helpers ────────────────────────────────────────────────────────────

function makeRow(overrides?: Partial<CloudConnectionRow>): CloudConnectionRow {
  return {
    id: 'conn-1', service: 'notion', access_token: 'tok',
    workspace_id: 'ws-1', workspace_name: 'My WS', account_name: 'User', account_email: 'u@t.com',
    database_id: 'db-1', database_url: 'https://n.so/db', last_sync_at: '2025-07-14T12:00:00.000Z',
    status: 'connected', error: null,
    created_at: '2025-07-01T00:00:00.000Z', updated_at: '2025-07-14T12:00:00.000Z',
    ...overrides
  }
}

function setup(row: CloudConnectionRow | null) {
  mockDb.prepare.mockReturnValue(mockStatement)
  mockStatement.get.mockReturnValue(row)
  mockStatement.run.mockReturnValue({})
}

beforeEach(() => { vi.clearAllMocks(); setup(null) })

// ── Tests ──────────────────────────────────────────────────────────────

describe('CloudSyncService', () => {
  describe('getStatus', () => {
    it('returns null when no connection', () => {
      expect(new CloudSyncService().getStatus()).toBeNull()
    })

    it('returns connection with all fields', () => {
      setup(makeRow())
      const s = new CloudSyncService().getStatus()!
      expect(s.id).toBe('conn-1')
      expect(s.service).toBe('notion')
      expect(s.status).toBe('connected')
      expect(s.workspaceName).toBe('My WS')
      expect(s.accountEmail).toBe('u@t.com')
      expect(s.lastSyncAt).toBe('2025-07-14T12:00:00.000Z')
    })

    it('returns error status with message', () => {
      setup(makeRow({ status: 'error', error: 'Token expired', account_email: null, workspace_name: null, database_url: null, last_sync_at: null }))
      const s = new CloudSyncService().getStatus()!
      expect(s.status).toBe('error')
      expect(s.error).toBe('Token expired')
      expect(s.accountEmail).toBeUndefined()
    })

    it('returns connecting status', () => {
      setup(makeRow({ status: 'connecting', access_token: '', database_id: null }))
      expect(new CloudSyncService().getStatus()!.status).toBe('connecting')
    })
  })

  describe('disconnect', () => {
    it('deletes connection row from DB', async () => {
      setup(makeRow())
      await new CloudSyncService().disconnect()
      const calls = mockDb.prepare.mock.calls.map((c: unknown[]) => c[0])
      expect(calls.some((c: string) => c.includes('DELETE FROM cloud_connections'))).toBe(true)
    })

    it('is safe when not connected', async () => {
      setup(null)
      await expect(new CloudSyncService().disconnect()).resolves.toBeUndefined()
    })
  })

  describe('syncNow / pullAll', () => {
    it('syncNow throws when not connected', async () => {
      await expect(new CloudSyncService().syncNow()).rejects.toThrow('Not connected')
    })

    it('pullAll throws when not connected', async () => {
      await expect(new CloudSyncService().pullAll()).rejects.toThrow('Not connected')
    })
  })

  describe('schedulePush', () => {
    it('is safe when disconnected', () => {
      const svc = new CloudSyncService()
      svc.schedulePush('n1', 'create')
      svc.schedulePush('n2', 'update')
      svc.schedulePush('n3', 'delete')
    })
  })

  describe('connect', () => {
    it('throws for unsupported service', async () => {
      await expect(new CloudSyncService().connect('feishu' as any)).rejects.toThrow('Unsupported cloud service: feishu')
    })

    it('returns connecting status immediately (OAuth is async)', async () => {
      const result = await new CloudSyncService().connect('notion')
      expect(result.status).toBe('connecting')
      expect(result.service).toBe('notion')
      expect(result.id).toBeTruthy()
    })
  })

  describe('getPendingAuthUrl', () => {
    it('returns null without auth in progress', () => {
      expect(new CloudSyncService().getPendingAuthUrl()).toBeNull()
    })
  })

  describe('polling', () => {
    it('start/stop are idempotent', () => {
      const svc = new CloudSyncService()
      svc.startPolling(); svc.startPolling()
      svc.stopPolling(); svc.stopPolling()
    })
  })
})
