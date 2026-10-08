import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Server-only modules are plain functions under test.
      'server-only': fileURLToPath(new URL('./tests/empty.ts', import.meta.url)),
    },
  },
  // Each server test starts an embedded PostgreSQL (PGlite); under a full parallel run its setup can pass 10 s.
  test: { include: ['tests/**/*.test.ts'], environment: 'node', hookTimeout: 30_000 },
})
