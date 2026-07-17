import http from 'http'
import { logger } from '../../utils/logger'
import { NOTION_REDIRECT_PORT } from '../../../shared/constants'

/**
 * Local HTTP server that handles the OAuth redirect callback.
 */
export class OAuthServer {
  private server: http.Server | null = null
  private port = 0
  private resolveCallback: ((result: { code: string; state: string }) => void) | null = null
  private rejectCallback: ((err: Error) => void) | null = null
  private timeout: NodeJS.Timeout | null = null

  /** Start the server, preferring the given port, falling back to random. */
  async start(port?: number): Promise<{ port: number }> {
    const preferredPort = port ?? NOTION_REDIRECT_PORT
    const self = this
    return new Promise((resolve, reject) => {
      self.server = http.createServer((req, res) => {
        self.handleRequest(req, res)
      })

      const onError = (err: Error & { code?: string }): void => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${preferredPort} is already in use. Close other instances of FlashNote and try again.`))
          return
        }
        logger.error('cloud:auth-server', 'Server error', { error: err.message })
        reject(err)
      }

      self.server.on('error', onError)
      self.server.listen(preferredPort, '127.0.0.1', () => {
        setPort(self.server!.address())
      })

      function setPort(addr: ReturnType<http.Server['address']>): void {
        if (addr && typeof addr === 'object') {
          self.port = addr.port
          logger.info('cloud:auth-server', `Listening on port ${self.port}`)
          resolve({ port: self.port })
        } else {
          reject(new Error('Failed to get server address'))
        }
      }
    })
  }

  /** Wait for the OAuth callback. Times out after `timeoutMs` (default 5 min). */
  waitForCallback(timeoutMs = 300_000): Promise<{ code: string; state: string }> {
    return new Promise((resolve, reject) => {
      this.resolveCallback = resolve
      this.rejectCallback = reject

      this.timeout = setTimeout(() => {
        this.cleanup()
        reject(new Error('timed out'))
      }, timeoutMs)
    })
  }

  /** Stop the server and clean up. */
  async stop(): Promise<void> {
    this.cleanup()
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('cloud:auth-server', 'Server stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  // ── private ──────────────────────────────────────────────

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://localhost:${this.port}`)

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      if (error) {
        this.sendHTML(res, false, `授权失败：${error}`)
        this.rejectCallback?.(new Error(`OAuth error: ${error}`))
        return
      }

      if (!code) {
        this.sendHTML(res, false, '授权失败：未收到授权码')
        this.rejectCallback?.(new Error('No code in callback'))
        return
      }

      this.sendHTML(res, true, '授权成功！请返回 FlashNote。')
      this.resolveCallback?.({ code, state: state ?? '' })

      if (this.timeout) {
        clearTimeout(this.timeout)
        this.timeout = null
      }
    } else {
      res.writeHead(404)
      res.end('Not found')
    }
  }

  private sendHTML(res: http.ServerResponse, success: boolean, message: string): void {
    const color = success ? '#10B981' : '#EF4444'
    const icon = success ? '✓' : '✕'
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>FlashNote · 云同步</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;
  background: #fafaf9; color: #1c1917;">
  <div style="text-align: center;">
    <div style="font-size: 48px; color: ${color}; margin-bottom: 16px;">${icon}</div>
    <p style="font-size: 18px; font-weight: 500;">${message}</p>
    <p style="font-size: 14px; color: #78716c; margin-top: 8px;">此页面可以关闭</p>
  </div>
</body>
</html>`
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  }

  private cleanup(): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }
    this.resolveCallback = null
    this.rejectCallback = null
  }
}
