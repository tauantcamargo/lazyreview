import { defaultProviderHost, getDefaultProvider, loadConfig, type ProviderType, storeToken, readToken, deleteToken } from '@lazyreview/core';

function resolveProvider(input?: string): { type: ProviderType; host: string } {
  const config = loadConfig();
  if (input) {
    const match = config.providers?.find((provider) => provider.name === input || provider.type === input);
    if (match) {
      return { type: match.type, host: match.host ?? defaultHost(match.type) };
    }

    return { type: input as ProviderType, host: defaultHost(input as ProviderType) };
  }

  const defaultProvider = getDefaultProvider(config);
  if (!defaultProvider) {
    return { type: 'github', host: defaultHost('github') };
  }

  return { type: defaultProvider.type, host: defaultProvider.host ?? defaultHost(defaultProvider.type) };
}

function defaultHost(provider: ProviderType): string {
  return defaultProviderHost(provider);
}

export async function login(provider?: string, hostOverride?: string, token?: string): Promise<void> {
  const resolved = resolveProvider(provider);
  const host = hostOverride ?? resolved.host;
  const value = token ?? process.env.LAZYREVIEW_TOKEN ?? '';
  if (!value) {
    throw new Error('Token is required (use --token or LAZYREVIEW_TOKEN)');
  }

  const result = await storeToken(resolved.type, host, value);
  console.log(`Stored ${resolved.type} token (${result.storage}) for ${host}`);
}

export async function logout(provider?: string, hostOverride?: string): Promise<void> {
  const resolved = resolveProvider(provider);
  const host = hostOverride ?? resolved.host;
  const result = await deleteToken(resolved.type, host);
  console.log(`Removed ${resolved.type} token (${result.storage}) for ${host}`);
}

export async function status(provider?: string, hostOverride?: string): Promise<void> {
  const resolved = resolveProvider(provider);
  const host = hostOverride ?? resolved.host;
  const token = await readToken(resolved.type, host);
  if (!token) {
    console.log(`No token stored for ${resolved.type} (${host})`);
    return;
  }

  console.log(`Token present for ${resolved.type} (${host})`);
}
