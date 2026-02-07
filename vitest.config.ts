import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    environmentMatchGlobs: [
      // Use jsdom for UI package tests (React hooks/components)
      ['packages/ui/**/*.{test,spec}.{ts,tsx}', 'jsdom'],
      // Use jsdom for CLI React hook tests
      ['apps/cli/**/*.{test,spec}.{ts,tsx}', 'jsdom'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.d.ts',
        '**/*.generated.ts',
        '**/index.ts',
        'scripts',
        'benchmarks',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 10000,
  },
});
