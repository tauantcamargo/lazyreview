import { match } from 'ts-pattern';
import type { Provider } from './provider';
import type { ProviderType } from './types';
import { createGitHubProvider } from './github';
import { createGitLabProvider } from './gitlab';
import { createBitbucketProvider } from './bitbucket';
import { createAzureDevOpsProvider } from './azuredevops';

export type ProviderConfig = {
  token: string;
  baseUrl?: string;
};

export type ProviderFactoryConfig = ProviderConfig & {
  type: ProviderType;
};

export function createProvider(type: ProviderType, config: ProviderConfig): Provider;
export function createProvider(config: ProviderFactoryConfig): Provider;
export function createProvider(
  typeOrConfig: ProviderType | ProviderFactoryConfig,
  maybeConfig?: ProviderConfig
): Provider {
  const { type, token, baseUrl } = typeof typeOrConfig === 'string'
    ? { type: typeOrConfig, ...maybeConfig! }
    : typeOrConfig;

  return match(type)
    .with('github', () => createGitHubProvider({ token, baseUrl }))
    .with('gitlab', () => createGitLabProvider({ token, baseUrl }))
    .with('bitbucket', () => createBitbucketProvider({ token, baseUrl }))
    .with('azuredevops', () => createAzureDevOpsProvider({ token, baseUrl }))
    .exhaustive();
}
