import { describe, it, expect } from 'vitest'
import { heuristicParse } from '@services/ai/base'

describe('heuristicParse', () => {
  describe('API key detection', () => {
    it('detects sk- prefix keys', () => {
      const r = heuristicParse('sk-a6110badef0540d180d8670619393b49 我的deepseek api key')
      expect(r.type).toBe('apikey')
      expect(r.sensitive).toBe(true)
      expect(r.category).toBe('API Keys & Credentials')
      expect(r.tags).toContain('api-key')
    })

    it('detects github_pat_ keys', () => {
      const r = heuristicParse('github_pat_xxxx my github token')
      expect(r.type).toBe('apikey')
      expect(r.sensitive).toBe(true)
    })

    it('detects token- prefixed strings', () => {
      const r = heuristicParse('token-abcd1234 this is my token')
      expect(r.type).toBe('apikey')
      expect(r.sensitive).toBe(true)
    })
  })

  describe('Command detection', () => {
    it('detects docker commands', () => {
      const r = heuristicParse('docker run -d --name redis redis:7-alpine')
      expect(r.type).toBe('command')
      expect(r.category).toBe('Code Snippets')
      expect(r.sensitive).toBe(false)
    })

    it('detects git commands', () => {
      const r = heuristicParse('git commit -m "fix bug"')
      expect(r.type).toBe('command')
    })

    it('detects npm commands', () => {
      const r = heuristicParse('npm install react')
      expect(r.type).toBe('command')
    })

    it('detects kubectl commands', () => {
      const r = heuristicParse('kubectl get pods')
      expect(r.type).toBe('command')
    })

    it('detects pip commands', () => {
      const r = heuristicParse('pip install numpy pandas')
      expect(r.type).toBe('command')
    })
  })

  describe('Bookmark detection', () => {
    it('detects URLs', () => {
      const r = heuristicParse('https://claude.ai/code 这是claude code官网')
      expect(r.type).toBe('bookmark')
      expect(r.category).toBe('Bookmarks & Links')
      expect(r.sensitive).toBe(false)
      expect(r.typedData).toBeDefined()
    })
  })

  describe('Credential detection', () => {
    it('detects bank card numbers', () => {
      const r = heuristicParse('6222021234567890 这是我的银行卡号')
      expect(r.type).toBe('credential')
      expect(r.sensitive).toBe(true)
    })

    it('detects 18-digit ID card numbers', () => {
      const r = heuristicParse('421087199608280052 记住这个身份证')
      expect(r.type).toBe('credential')
      expect(r.sensitive).toBe(true)
    })

    it('detects password mentions', () => {
      const r = heuristicParse('这是我的密码：password123')
      expect(r.type).toBe('credential')
      expect(r.sensitive).toBe(true)
    })

    it('detects 账号 mentions', () => {
      const r = heuristicParse('我的账号是 admin123')
      expect(r.type).toBe('credential')
      expect(r.sensitive).toBe(true)
    })
  })

  describe('Text detection (default)', () => {
    it('plain text defaults to text type', () => {
      const r = heuristicParse('今天天气真好')
      expect(r.type).toBe('text')
      expect(r.sensitive).toBe(false)
      expect(r.category).toBe('Other')
    })

    it('code with import defaults to command type via code detection', () => {
      const r = heuristicParse('import React from "react"')
      expect(r.type).toBe('command') // caught by code indicator
    })
  })
})
