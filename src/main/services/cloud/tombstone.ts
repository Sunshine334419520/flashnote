import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getDefaultStoragePath } from '../../utils/paths'

const FILE = 'deleted.json'

function getPath(): string {
  return join(getDefaultStoragePath(), FILE)
}

/** Record a deleted note ID so sync doesn't re-import it. */
export function addTombstone(noteId: string): void {
  const ids = getTombstones()
  if (!ids.includes(noteId)) {
    ids.push(noteId)
    writeFileSync(getPath(), JSON.stringify(ids), 'utf-8')
  }
}

/** Remove a note ID from the tombstone (cloud delete succeeded). */
export function removeTombstone(noteId: string): void {
  const ids = getTombstones()
  const next = ids.filter((id) => id !== noteId)
  if (next.length !== ids.length) {
    writeFileSync(getPath(), JSON.stringify(next), 'utf-8')
  }
}

/** Get all tombstone IDs. */
export function getTombstones(): string[] {
  try {
    const p = getPath()
    if (!existsSync(p)) return []
    const raw = readFileSync(p, 'utf-8')
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}
