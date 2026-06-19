import { createHash } from 'crypto'

/**
 * Compute a SHA-256 hash of content + optional hint.
 * Used for AI classification cache keying.
 */
export function hashContent(content: string, hint?: string): string {
  return createHash('sha256')
    .update(content + (hint ?? ''))
    .digest('hex')
}

/**
 * Compute SHA-256 of file content for change detection.
 */
export function hashFileContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}
