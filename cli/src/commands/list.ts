import { Command } from 'commander'
import { ensureStorageDirectories, getDefaultStoragePath } from '@utils/paths'
import { loadConfig } from '@services/config.service'
import { initStorageService, getNotes } from '@services/storage.service'

export const listCommand = new Command('list')
  .description('List your saved notes')
  .option('-c, --category <cat>', 'Filter by category')
  .option('-t, --type <type>', 'Filter by type (apikey|credential|command|bookmark|text)')
  .option('-n, --limit <n>', 'Max results', '20')
  .action(async (options) => {
    const storagePath = getDefaultStoragePath()

    ensureStorageDirectories(storagePath)
    loadConfig(storagePath)
    initStorageService(storagePath)

    const result = await getNotes({
      category: options.category,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      limit: Number(options.limit),
      offset: 0
    })

    let notes = result.notes
    if (options.type) {
      notes = notes.filter((n) => n.type === options.type)
    }

    if (notes.length === 0) {
      console.log('No notes found.')
      process.exit(0)
    }

    console.log(`\n📋 ${notes.length} note(s)\n`)
    for (const n of notes) {
      const icon = { apikey: '🔑', credential: '🔒', command: '💻', bookmark: '🔗', text: '📝' }[n.type] ?? '📝'
      const preview = n.content.slice(0, 60).replace(/\n/g, ' ')
      console.log(`  ${icon} ${n.id.slice(0, 8)}  ${n.title}`)
      console.log(`     ${n.category} · ${n.tags.slice(0, 3).join(', ') || '-'}`)
      console.log(`     ${preview}${n.content.length > 60 ? '...' : ''}`)
      console.log('')
    }

    process.exit(0)
  })
