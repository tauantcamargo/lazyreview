export function openExternal(url: string): void {
  // Placeholder for OS-specific open logic.
  void url;
}

export { getConfigDir } from './paths';
export { ensureDir } from './fs';
export { storeSecret, getSecret, deleteSecret, deriveAccount } from './secure-store';
