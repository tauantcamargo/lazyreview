import type { Provider } from './provider';
import type { ProviderType } from './types';
import { createGitHubProvider } from './github';
import { createGitLabProvider } from './gitlab';
import { createBitbucketProvider } from './bitbucket';
import { createAzureDevOpsProvider } from './azuredevops';

export type ProviderFactoryConfig = {
  type: ProviderType;
  token: string;
  baseUrl?: string;
};

export function createProvider(config: ProviderFactoryConfig): Provider {
  switch (config.type) {
    case 'github':
      return createGitHubProvider({ token: config.token, baseUrl: config.baseUrl });
    case 'gitlab':
      return createGitLabProvider({ token: config.token, baseUrl: config.baseUrl });
    case 'bitbucket':
      return createBitbucketProvider({ token: config.token, baseUrl: config.baseUrl });
    case 'azuredevops':
      return createAzureDevOpsProvider({ token: config.token, baseUrl: config.baseUrl });
    default:
      throw new Error(`Unsupported provider: ${config.type}`);
  }
}
