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

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0')
}

/** Local calendar date, e.g. 2026-07-11 (not UTC). */
function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local wall-clock timestamp, e.g. 2026-07-11 23:51:18.123 (not UTC). */
function localTimestamp(d: Date): string {
  return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

function getLogPath(): string {
  if (!logDir) return ''
  return join(logDir, `flashnote-${localDate(new Date())}.log`)
}

function write(level: string, source: string, message: string, data?: unknown): void {
  const timestamp = localTimestamp(new Date())
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
