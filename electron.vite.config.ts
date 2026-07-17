import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8')) as { version: string }

// Load .env file for local development
function loadEnv(key: string): string {
  const envPath = resolve('.env')
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'))
    if (match) return match[1].trim()
  }
  return process.env[key] ?? ''
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    define: {
      'process.env.FLASHNOTE_NOTION_CLIENT_ID': JSON.stringify(loadEnv('FLASHNOTE_NOTION_CLIENT_ID')),
      'process.env.FLASHNOTE_NOTION_CLIENT_SECRET': JSON.stringify(loadEnv('FLASHNOTE_NOTION_CLIENT_SECRET'))
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer')
      }
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.platform': JSON.stringify(process.platform),
      '__APP_VERSION__': JSON.stringify(pkg.version)
    }
  }
})
