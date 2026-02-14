export type {
  ProviderType,
  ProviderConfig,
  ProviderCapabilities,
  Provider,
  ListPRsParams,
  PRListResult,
  AddDiffCommentParams,
  AddPendingReviewCommentParams,
  CreatePRParams,
  CreatePRResult,
} from './types'

export { getDefaultBaseUrl } from './types'

export { createGitHubProvider, createUnsupportedProvider } from './github'

export { createGitLabProvider, encodeThreadId, decodeThreadId } from './gitlab'

export { createBitbucketProvider } from './bitbucket'

export { createAzureProvider, encodeAzureThreadId, decodeAzureThreadId } from './azure'

export { createGiteaProvider } from './gitea'

import type { CodeReviewApiService } from '../CodeReviewApiTypes'
import type { Provider, ProviderConfig } from './types'
import { createGitHubProvider, createUnsupportedProvider } from './github'
import { createGitLabProvider } from './gitlab'
import { createBitbucketProvider } from './bitbucket'
import { createAzureProvider } from './azure'
import { createGiteaProvider } from './gitea'

/**
 * Factory function that creates the appropriate Provider implementation
 * based on the config's type field.
 *
 * Currently GitHub, GitLab, Bitbucket, Azure DevOps, and Gitea/Forgejo are
 * supported. Other provider types return an "unsupported" provider whose
 * methods all fail with a descriptive error.
 */
export function createProvider(
  config: ProviderConfig,
  service: CodeReviewApiService,
): Provider {
  switch (config.type) {
    case 'github':
      return createGitHubProvider(config, service)
    case 'gitlab':
      return createGitLabProvider(config)
    case 'bitbucket':
      return createBitbucketProvider(config)
    case 'azure':
      return createAzureProvider(config)
    case 'gitea':
      return createGiteaProvider(config)
    default:
      return createUnsupportedProvider(config.type)
  }
}
