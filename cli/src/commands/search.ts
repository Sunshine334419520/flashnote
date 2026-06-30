import { Command } from 'commander'
import { homedir } from 'os'
import { join } from 'path'
import { ensureStorageDirectories } from '@utils/paths'
import { loadConfig } from '@services/config.service'
import { initStorageService, getNotes } from '@services/storage.service'

export const searchCommand = new Command('search')
  .description('Search your notes')
  .argument('<query...>', 'Search keyword or phrase')
  .action(async (queryParts: string[]) => {
    const query = queryParts.join(' ')
    const storagePath = join(process.env.FLASHNOTE_HOME ?? homedir(), 'FlashNote')

    ensureStorageDirectories(storagePath)
    loadConfig(storagePath)
    initStorageService(storagePath)

    const result = await getNotes({
      text: query,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      limit: 20,
      offset: 0
    })

    console.log(`\n🔍 Search: "${query}" — ${result.total} result(s)\n`)
    if (result.notes.length === 0) {
      console.log('No matches found.')
      process.exit(0)
    }

    for (const n of result.notes) {
      const icon = { apikey: '🔑', credential: '🔒', command: '💻', bookmark: '🔗', text: '📝' }[n.type] ?? '📝'
      const preview = n.content.slice(0, 80).replace(/\n/g, ' ')
      console.log(`  ${icon} ${n.id.slice(0, 8)}  ${n.title}`)
      console.log(`     ${n.category} · ${n.tags.slice(0, 3).join(', ')}`)
      console.log(`     ${preview}${n.content.length > 80 ? '...' : ''}`)
      console.log('')
    }

    process.exit(0)
  })
