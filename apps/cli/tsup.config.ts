import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  external: [
    // Native modules that shouldn't be bundled
    'better-sqlite3',
    'keytar',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
