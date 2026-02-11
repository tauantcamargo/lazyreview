import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.tsx'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
