import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/cli.tsx'],
      thresholds: {
        lines: 20,
        statements: 20,
        functions: 20,
        branches: 35,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
