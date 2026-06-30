import { Command } from 'commander'
import { homedir } from 'os'
import { join } from 'path'
import { ensureStorageDirectories } from '@utils/paths'
import { loadConfig } from '@services/config.service'
import { initStorageService, createNote, modifyNote } from '@services/storage.service'
import { AIService } from '@services/ai'

export const captureCommand = new Command('capture')
  .description('Capture a note — AI will parse and classify automatically')
  .argument('<input...>', 'Your note content (natural language, AI will figure out the rest)')
  .action(async (inputParts: string[]) => {
    const rawInput = inputParts.join(' ')
    const storagePath = join(process.env.FLASHNOTE_HOME ?? homedir(), 'FlashNote')

    // Init
    ensureStorageDirectories(storagePath)
    loadConfig(storagePath)
    initStorageService(storagePath)
    const ai = new AIService(storagePath)

    console.log(`\n📝 Capturing: "${rawInput.slice(0, 80)}${rawInput.length > 80 ? '...' : ''}"`)
    console.log('⏳ Parsing with AI...')

    const parsed = await ai.parse(rawInput)

    const note = createNote(
      { content: parsed.cleanedContent },
      {
        type: parsed.type,
        category: parsed.category,
        tags: parsed.tags,
        title: parsed.title,
        sensitive: parsed.sensitive,
        typedData: parsed.typedData
      }
    )
    // Publish immediately for CLI (no async task queue needed)
    modifyNote({ id: note.id, status: 'published' })

    console.log('')
    console.log(`✅ Saved: "${note.title}"`)
    console.log(`   ID:       ${note.id}`)
    console.log(`   Type:     ${note.type}`)
    console.log(`   Category: ${note.category}`)
    console.log(`   Tags:     ${note.tags.join(', ') || '(none)'}`)
    if (note.sensitive) {
      console.log(`   🔒 Sensitive (masked on card)`)
    }
    console.log('')

    process.exit(0)
  })
