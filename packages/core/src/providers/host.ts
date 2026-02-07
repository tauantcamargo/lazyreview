import type { ProviderType } from './types';

export function defaultProviderHost(provider: ProviderType): string {
  switch (provider) {
    case 'github':
      return 'github.com';
    case 'gitlab':
      return 'gitlab.com';
    case 'bitbucket':
      return 'bitbucket.org';
    case 'azuredevops':
      return 'dev.azure.com';
    default:
      return '';
  }
}

export function buildProviderBaseUrl(provider: ProviderType, host: string): string {
  const normalized = host.startsWith('http') ? host : `https://${host}`;
  switch (provider) {
    case 'github': {
      if (normalized.includes('api.github.com')) {
        return normalized;
      }
      if (normalized.endsWith('github.com')) {
        return 'https://api.github.com';
      }
      return `${normalized.replace(/\/$/, '')}/api/v3`;
    }
    case 'gitlab':
      return normalized.endsWith('/api/v4') ? normalized : `${normalized}/api/v4`;
    case 'bitbucket':
      if (normalized.includes('api.bitbucket.org')) {
        return normalized.endsWith('/2.0') ? normalized : `${normalized}/2.0`;
      }
      if (normalized.endsWith('bitbucket.org')) {
        return 'https://api.bitbucket.org/2.0';
      }
      return normalized.endsWith('/rest/api/1.0') ? normalized : `${normalized}/rest/api/1.0`;
    default:
      return normalized;
  }
}
