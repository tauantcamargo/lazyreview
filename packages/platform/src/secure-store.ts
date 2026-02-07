import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chmodSync } from 'node:fs';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { join } from 'node:path';
import { ensureDir } from './fs';
import { getConfigDir } from './paths';

const SERVICE = 'lazyreview';
const KEY_FILE = 'tokens.key';
const DATA_FILE = 'tokens.json';

function getStoreDir(): string {
  return getConfigDir();
}

function getKeyPath(): string {
  return join(getStoreDir(), KEY_FILE);
}

function getDataPath(): string {
  return join(getStoreDir(), DATA_FILE);
}

function loadKey(): Buffer {
  const path = getKeyPath();
  if (existsSync(path)) {
    return readFileSync(path);
  }

  const key = randomBytes(32);
  ensureDir(getStoreDir());
  writeFileSync(path, key, { mode: 0o600 });
  chmodSync(path, 0o600);
  return key;
}

function encrypt(plain: string): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(payload: string): string {
  const data = Buffer.from(payload, 'base64');
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const key = loadKey();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

async function tryKeytar(): Promise<typeof import('keytar') | null> {
  try {
    const mod = await import('keytar');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

function readFallbackStore(): Record<string, string> {
  const path = getDataPath();
  if (!existsSync(path)) {
    return {};
  }

  const raw = readFileSync(path, 'utf8');
  if (!raw.trim()) {
    return {};
  }

  const data = JSON.parse(raw) as Record<string, string>;
  return data;
}

function writeFallbackStore(data: Record<string, string>): void {
  ensureDir(getStoreDir());
  const path = getDataPath();
  writeFileSync(path, JSON.stringify(data, null, 2), { mode: 0o600 });
  chmodSync(path, 0o600);
}

export async function storeSecret(account: string, secret: string): Promise<'keychain' | 'file'> {
  const keytar = await tryKeytar();
  if (keytar) {
    await keytar.setPassword(SERVICE, account, secret);
    return 'keychain';
  }

  const store = readFallbackStore();
  store[account] = encrypt(secret);
  writeFallbackStore(store);
  return 'file';
}

export async function getSecret(account: string): Promise<string | null> {
  const keytar = await tryKeytar();
  if (keytar) {
    return await keytar.getPassword(SERVICE, account);
  }

  const store = readFallbackStore();
  const value = store[account];
  if (!value) {
    return null;
  }

  return decrypt(value);
}

export async function deleteSecret(account: string): Promise<'keychain' | 'file'> {
  const keytar = await tryKeytar();
  if (keytar) {
    await keytar.deletePassword(SERVICE, account);
    return 'keychain';
  }

  const store = readFallbackStore();
  delete store[account];
  writeFallbackStore(store);
  return 'file';
}

export function deriveAccount(provider: string, host: string): string {
  return `${provider}:${host}`;
}
