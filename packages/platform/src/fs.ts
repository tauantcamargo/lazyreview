import { mkdirSync } from 'node:fs';

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}
