import { match } from 'ts-pattern';
import type { ProviderType } from './types';

export function defaultProviderHost(provider: ProviderType): string {
  return match(provider)
    .with('github', () => 'github.com')
    .with('gitlab', () => 'gitlab.com')
    .with('bitbucket', () => 'bitbucket.org')
    .with('azuredevops', () => 'dev.azure.com')
    .exhaustive();
}

export function buildProviderBaseUrl(provider: ProviderType, host: string): string {
  const normalized = host.startsWith('http') ? host : `https://${host}`;

  return match(provider)
    .with('github', () => {
      if (normalized.includes('api.github.com')) {
        return normalized;
      }
      if (normalized.endsWith('github.com')) {
        return 'https://api.github.com';
      }
      return `${normalized.replace(/\/$/, '')}/api/v3`;
    })
    .with('gitlab', () =>
      normalized.endsWith('/api/v4') ? normalized : `${normalized}/api/v4`
    )
    .with('bitbucket', () => {
      if (normalized.includes('api.bitbucket.org')) {
        return normalized.endsWith('/2.0') ? normalized : `${normalized}/2.0`;
      }
      if (normalized.endsWith('bitbucket.org')) {
        return 'https://api.bitbucket.org/2.0';
      }
      return normalized.endsWith('/rest/api/1.0') ? normalized : `${normalized}/rest/api/1.0`;
    })
    .with('azuredevops', () => normalized)
    .exhaustive();
}
