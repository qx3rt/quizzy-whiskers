import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    env: {
      JWT_SECRET: 'test-secret-for-vitest',
      NODE_ENV: 'test',
    },
  },
})
