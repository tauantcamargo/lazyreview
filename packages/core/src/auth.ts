import { deriveAccount, deleteSecret, getSecret, storeSecret } from '@lazyreview/platform';

export type AuthResult = {
  storage: 'keychain' | 'file';
};

export async function storeToken(provider: string, host: string, token: string): Promise<AuthResult> {
  const account = deriveAccount(provider, host);
  const storage = await storeSecret(account, token);
  return { storage };
}

export async function readToken(provider: string, host: string): Promise<string | null> {
  const account = deriveAccount(provider, host);
  return await getSecret(account);
}

export async function deleteToken(provider: string, host: string): Promise<AuthResult> {
  const account = deriveAccount(provider, host);
  const storage = await deleteSecret(account);
  return { storage };
}
