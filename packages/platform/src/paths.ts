import { homedir } from 'node:os';
import { join } from 'node:path';

export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) {
    return join(xdg, 'lazyreview');
  }

  return join(homedir(), '.config', 'lazyreview');
}
