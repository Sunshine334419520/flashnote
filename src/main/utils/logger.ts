import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { EOL } from 'os'

let logDir: string | null = null

export function initLogger(storagePath: string): void {
  logDir = join(storagePath, 'logs')
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
}

function getLogPath(): string {
  if (!logDir) return ''
  const date = new Date().toISOString().slice(0, 10)
  return join(logDir, `flashnote-${date}.log`)
}

function write(level: string, source: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] [${level}] [${source}] ${message}`
  const full = data ? line + ' ' + JSON.stringify(data) : line

  // Always console too
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  fn(full)

  // Write to file
  const path = getLogPath()
  if (path) {
    try {
      appendFileSync(path, full + EOL)
    } catch {
      // fail silently
    }
  }
}

export const logger = {
  info: (source: string, msg: string, data?: unknown) => write('INFO', source, msg, data),
  warn: (source: string, msg: string, data?: unknown) => write('WARN', source, msg, data),
  error: (source: string, msg: string, data?: unknown) => write('ERROR', source, msg, data)
}
