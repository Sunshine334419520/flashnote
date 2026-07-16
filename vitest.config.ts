import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@services': resolve(__dirname, 'src/main/services'),
      '@utils': resolve(__dirname, 'src/main/utils'),
      '@database': resolve(__dirname, 'src/main/database')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/main/services/cloud/**'],
      exclude: [
        'src/main/services/cloud/adapter.ts',            // pure TypeScript interfaces
        'src/main/services/cloud/cloud-sync.service.ts'  // orchestrator — requires real OAuth / Notion API
      ],
      reporter: ['text', 'text-summary']
    }
  }
})
