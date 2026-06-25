import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '.env') })

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    env: {
      JWT_SECRET: process.env.JWT_SECRET || 'test-secret-for-vitest',
      NODE_ENV: 'test',
      DATABASE_URL_TEST: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL || '',
    },
  },
})
