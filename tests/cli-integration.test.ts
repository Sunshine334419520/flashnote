import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'child_process'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'

const TMP_HOME = join(tmpdir(), 'flashnote-test-' + Date.now())
const TMP_STORAGE = join(TMP_HOME, 'FlashNote')

const ROOT = join(__dirname, '..')

function run(args: string): string {
  // Use execFile-style via sh -c to avoid shell injection issues with special chars
  const cmd = `FLASHNOTE_HOME="${TMP_HOME}" npx tsx --tsconfig cli/tsconfig.json cli/src/index.ts ${args}`
  try {
    return execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env, FLASHNOTE_HOME: TMP_HOME },
      shell: '/bin/bash'
    })
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string }
    return e.stdout ?? e.stderr ?? String(err)
  }
}

/** Escape single quotes for shell */
function sq(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

describe('CLI Integration Tests', () => {
  beforeAll(() => {
    mkdirSync(TMP_HOME, { recursive: true })
    // First run initializes storage
    run('list')
  })

  afterAll(() => {
    if (existsSync(TMP_STORAGE)) {
      rmSync(TMP_STORAGE, { recursive: true, force: true })
    }
  })

  // ===========================================================
  // Capture — type detection
  // ===========================================================

  describe('capture with type detection', () => {
    it('detects API key type with correct title', () => {
      const out = run('capture sk-a6110badef0540d180d8670619393b49 我的deepseek api key')
      expect(out).toContain('Type:     apikey')
      expect(out).toContain('Category: API Keys & Credentials')
      expect(out).toContain('🔒 Sensitive')
      expect(out).toContain('✅ Saved')
      // Title should contain deepseek / api key — meaningful, not "Untitled Note"
      const titleMatch = out.match(/Saved: "(.*)"/)
      expect(titleMatch).not.toBeNull()
      expect(titleMatch![1].toLowerCase()).toMatch(/deepseek|api.key/)
    })

    it('detects command type', () => {
      const out = run('capture git clone https://github.com/example/repo.git')
      expect(out).toContain('Type:     command')
      expect(out).toContain('Category: Code Snippets')
    })

    it('detects bookmark type', () => {
      const out = run('capture https://claude.ai/code 这是claude code官网')
      expect(out).toContain('Type:     bookmark')
      expect(out).toContain('Category: Bookmarks & Links')
    })

    it('detects credential type (bank card)', () => {
      const out = run('capture 6222021234567890 我的招商银行卡')
      expect(out).toContain('Type:     credential')
      expect(out).toContain('🔒 Sensitive')
    })

    it('detects credential type (ID card)', () => {
      const out = run('capture 421087199608280052 身份证号码')
      expect(out).toContain('Type:     credential')
      expect(out).toContain('🔒 Sensitive')
    })

    it('detects text type (default)', () => {
      const out = run('capture 今天天气真好，适合出去走走')
      expect(out).toContain('Type:     text')
    })

    it('handles Chinese with mixed content', () => {
      const out = run('capture 18245643422 这是字节供应商的联系电话')
      expect(out).toContain('✅ Saved')
      expect(out).toContain('Tags:')
    })
  })

  // ===========================================================
  // List
  // ===========================================================

  describe('list', () => {
    it('lists all notes', () => {
      const out = run('list')
      expect(out).toContain('note(s)')
      expect(out).toContain('📝')
    })

    it('filters by category', () => {
      const out = run('list --category "API Keys & Credentials"')
      expect(out).toContain('API Keys')
    })

    it('filters by type', () => {
      const out = run('list --type apikey')
      expect(out).toContain('🔑')
      expect(out).not.toContain('💻')
    })

    it('respects limit', () => {
      const out = run('list --limit 2')
      const count = (out.match(/💻|🔑|🔗|🔒|📝/g) ?? []).length
      expect(count).toBeLessThanOrEqual(2)
    })
  })

  // ===========================================================
  // Show
  // ===========================================================

  describe('show', () => {
    let apiKeyId: string

    it('finds and shows a note by partial ID', () => {
      // First get the ID from list
      const listOut = run('list --type apikey')
      const match = listOut.match(/([a-f0-9]{8})/)
      expect(match).not.toBeNull()
      apiKeyId = match![1]

      const out = run(`show ${apiKeyId}`)
      expect(out).toContain('API Key')
      expect(out).toContain('sk-a6110bade')
    })

    it('shows error for non-existent ID', () => {
      const out = run('show deadbeef')
      expect(out).toContain('Note not found')
    })
  })

  // ===========================================================
  // Search
  // ===========================================================

  describe('search', () => {
    it('finds by content keyword', () => {
      const out = run('search deepseek')
      expect(out).toContain('deepseek')
    })

    it('finds by Chinese keyword', () => {
      const out = run('search 供应商')
      expect(out).toContain('供应商')
    })

    it('returns no results for unrelated keyword', () => {
      const out = run('search nonexistentxyz123')
      expect(out).toContain('0 result')
    })
  })

  // ===========================================================
  // Content search — search should return actual content, not just title
  // ===========================================================

  describe('search returns actual content', () => {
    it('search by title finds the note with content', () => {
      // First create a note with a unique identifiable keyword
      run('capture sk-helloworld123456 这个是hello的测试密钥')
      const out = run('search hello')
      expect(out).toContain('sk-helloworld')
    })

    it('search by content keyword finds the note', () => {
      const out = run('search helloworld')
      expect(out).toContain('sk-helloworld')
    })
  })

  // ===========================================================
  // Append — same topic should group together
  // ===========================================================

  describe('append to same topic', () => {
    it('two keys with same topic are both listed', () => {
      // Add another key with same topic hint
      run('capture sk-secondkey987654 又一个密钥')
      const out = run('search sk-secondkey')
      expect(out).toContain('sk-secondkey')
    })

    it('all API keys appear when listing by type', () => {
      const out = run('list --type apikey')
      // Should see at least 3 API keys (first test + hello + second key)
      const matches = (out.match(/🔑/g) ?? []).length
      expect(matches).toBeGreaterThanOrEqual(3)
    })
  })

  // ===========================================================
  // Edge cases
  // ===========================================================

  describe('edge cases', () => {
    it('handles input with dashes and underscores', () => {
      const out = run('capture test-user_admin_123-example')
      expect(out).toContain('✅ Saved')
    })

    it('handles input with commas and periods', () => {
      const out = run('capture hello, world. this is a test.')
      expect(out).toContain('✅ Saved')
    })

    it('handles input with Chinese and English mixed', () => {
      const out = run('capture Redis配置：maxmemory 2gb, 使用redis-cli连接')
      expect(out).toContain('✅ Saved')
    })

    it('handles input with URLs and text mixed', () => {
      const out = run('capture 参考文档 https://example.com/docs 这是中文说明')
      expect(out).toContain('✅ Saved')
    })
  })
})
