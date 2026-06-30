#!/usr/bin/env node
import { Command } from 'commander'
import { captureCommand } from './commands/capture.js'
import { listCommand } from './commands/list.js'
import { showCommand } from './commands/show.js'
import { searchCommand } from './commands/search.js'
import { homedir } from 'os'

const program = new Command()

program
  .name('flashnote')
  .description('AI-native smart note-taking in your terminal')
  .version('0.1.0')

program.addCommand(captureCommand)
program.addCommand(listCommand)
program.addCommand(showCommand)
program.addCommand(searchCommand)

program.parse()
