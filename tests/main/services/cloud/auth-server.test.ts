import { describe, it, expect, afterEach } from 'vitest'
import http from 'http'
import { OAuthServer } from '../../../../src/main/services/cloud/auth-server'

// Tests use random port (0) to avoid port conflicts.
// Production uses fixed port 18923 (required by Notion OAuth registration).
const TEST_PORT = 0

afterEach(async () => {
  // ensure cleanup
})

describe('OAuthServer', () => {
  describe('start', () => {
    it('starts on a random available port', async () => {
      const server = new OAuthServer()
      const { port } = await server.start(0)

      expect(port).toBeGreaterThan(0)
      expect(port).toBeLessThan(65536)
      expect(Number.isInteger(port)).toBe(true)

      await server.stop()
    })

    it('listens on 127.0.0.1 only (not public)', async () => {
      const server = new OAuthServer()
      const { port } = await server.start(0)

      // Verify we can reach it on localhost
      const result = await new Promise<boolean>((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
          resolve(res.statusCode === 404) // / → 404 expected
        })
        req.on('error', () => resolve(false))
      })

      expect(result).toBe(true)
      await server.stop()
    })
  })

  describe('waitForCallback', () => {
    it('receives code and state from callback URL', async () => {
      const server = new OAuthServer()
      const { port } = await server.start(0)

      // Start waiting for callback
      const callbackPromise = server.waitForCallback(5000)

      // Simulate Notion redirect
      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          `http://127.0.0.1:${port}/callback?code=test-auth-code&state=csrf-state-123`,
          (res) => {
            expect(res.statusCode).toBe(200)
            // Read body to verify HTML
            let body = ''
            res.on('data', (chunk) => { body += chunk })
            res.on('end', () => {
              expect(body).toContain('FlashNote')
              expect(body).toContain('授权成功')
              resolve()
            })
          }
        )
        req.on('error', reject)
      })

      const result = await callbackPromise
      expect(result.code).toBe('test-auth-code')
      expect(result.state).toBe('csrf-state-123')

      await server.stop()
    })

    it('rejects on OAuth error parameter', async () => {
      const server = new OAuthServer()
      const { port } = await server.start(0)

      const callbackPromise = server.waitForCallback(5000)
      callbackPromise.catch(() => { /* suppress unhandled rejection during HTTP round-trip */ })

      await new Promise<void>((resolve) => {
        http.get(`http://127.0.0.1:${port}/callback?error=access_denied`, () => resolve())
      })

      await expect(callbackPromise).rejects.toThrow('access_denied')
      await server.stop()
    })

    it('rejects when no code provided', async () => {
      const server = new OAuthServer()
      const { port } = await server.start(0)

      const callbackPromise = server.waitForCallback(3000)
      callbackPromise.catch(() => { /* suppress unhandled rejection during HTTP round-trip */ })

      // Hit callback with no code parameter
      await new Promise<void>((resolve) => {
        http.get(`http://127.0.0.1:${port}/callback`, () => resolve())
      })

      await expect(callbackPromise).rejects.toThrow('No code in callback')
      await server.stop()
    })

    it('times out when no callback arrives', async () => {
      const server = new OAuthServer()
      await server.start(0)

      const start = Date.now()
      await expect(server.waitForCallback(500)).rejects.toThrow('timed out')
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(400) // allow small variance

      await server.stop()
    }, 2000)
  })

  describe('stop', () => {
    it('stops the server gracefully', async () => {
      const server = new OAuthServer()
      const { port } = await server.start(0)

      await server.stop()

      // Verify server is no longer listening
      const result = await new Promise<boolean>((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/`, () => resolve(false))
        req.on('error', () => resolve(true))
      })

      expect(result).toBe(true)
    })

    it('stop on a stopped server is a no-op', async () => {
      const server = new OAuthServer()
      // Don't start — stop should not throw
      await expect(server.stop()).resolves.toBeUndefined()
    })

    it('stop cleans up active callback waiters', async () => {
      const server = new OAuthServer()
      await server.start(0)
      // Start a wait — stop will close the server, resolving nothing
      server.waitForCallback(30000).catch(() => { /* expected */ })
      await server.stop()
      // should not hang
    })
  })

  describe('HTML response', () => {
    it('success page contains FlashNote branding', async () => {
      const server = new OAuthServer()
      const { port } = await server.start(0)

      const callbackPromise = server.waitForCallback(5000)

      const html = await new Promise<string>((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/callback?code=abc&state=xyz`, (res) => {
          let body = ''
          res.on('data', (chunk) => { body += chunk })
          res.on('end', () => resolve(body))
        }).on('error', reject)
      })

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('FlashNote')
      expect(html).toContain('授权成功')
      expect(html).toContain('此页面可以关闭')

      await callbackPromise // consume
      await server.stop()
    })

    it('error page contains failure styling', async () => {
      const server = new OAuthServer()
      const { port } = await server.start(0)

      const callbackPromise = server.waitForCallback(5000).catch(() => {})

      const html = await new Promise<string>((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/callback?error=access_denied`, (res) => {
          let body = ''
          res.on('data', (chunk) => { body += chunk })
          res.on('end', () => resolve(body))
        }).on('error', reject)
      })

      expect(html).toContain('授权失败')
      expect(html).toContain('access_denied')

      await callbackPromise
      await server.stop()
    })

    it('non-callback paths return 404', async () => {
      const server = new OAuthServer()
      const { port } = await server.start(0)

      const status = await new Promise<number>((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/some-random-path`, (res) => {
          resolve(res.statusCode ?? 0)
        }).on('error', reject)
      })

      expect(status).toBe(404)
      await server.stop()
    })
  })

  describe('edge cases', () => {
    it('server rejects second callback after first resolves', async () => {
      const server = new OAuthServer()
      const { port } = await server.start(0)

      const cb1 = server.waitForCallback(5000)

      // Send callback
      http.get(`http://127.0.0.1:${port}/callback?code=code1&state=s1`, () => {})

      const result = await cb1
      expect(result.code).toBe('code1')

      await server.stop()
    })
  })
})
