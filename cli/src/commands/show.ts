import { Command } from 'commander'
import { ensureStorageDirectories, getDefaultStoragePath } from '@utils/paths'
import { loadConfig } from '@services/config.service'
import { initStorageService, readNote, getNotes } from '@services/storage.service'

export const showCommand = new Command('show')
  .description('Show full content of a note')
  .argument('<id>', 'Note ID (first 8 chars is enough)')
  .action(async (id: string) => {
    const storagePath = getDefaultStoragePath()

    ensureStorageDirectories(storagePath)
    loadConfig(storagePath)
    initStorageService(storagePath)

    // Support partial ID matching
    const { notes } = await getNotes({ sortBy: 'createdAt', sortOrder: 'desc', limit: 200, offset: 0 })
    const match = notes.find((n) => n.id.startsWith(id))
    if (!match) {
      console.log(`Note not found: ${id}`)
      process.exit(1)
    }

    const note = readNote(match.id)
    if (!note) {
      console.log(`Note not found: ${id}`)
      process.exit(1)
    }

    const typeLabel = { apikey: 'API Key', credential: 'Credential', command: 'Command', bookmark: 'Bookmark', text: 'Text' }[note.type] ?? 'Text'

    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  ${note.title}`)
    console.log(`${'═'.repeat(60)}`)
    console.log(`  ID:       ${note.id}`)
    console.log(`  Type:     ${typeLabel}`)
    console.log(`  Category: ${note.category}`)
    console.log(`  Tags:     ${note.tags.join(', ') || '(none)'}`)
    if (note.sensitive) console.log(`  🔒 Sensitive`)
    console.log(`  Created:  ${note.createdAt}`)
    console.log(`  Updated:  ${note.updatedAt}`)
    console.log(`${'─'.repeat(60)}`)
    console.log(note.content)
    console.log(`${'═'.repeat(60)}\n`)

    process.exit(0)
  })
