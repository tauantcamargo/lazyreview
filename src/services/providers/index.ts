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

export { adaptProvider, ensureV2Capabilities } from './adapter'

import type { CodeReviewApiService } from '../CodeReviewApiTypes'
import type { Provider, ProviderConfig } from './types'
import { createGitHubProvider, createUnsupportedProvider } from './github'
import { createGitLabProvider } from './gitlab'
import { createBitbucketProvider } from './bitbucket'
import { createAzureProvider } from './azure'
import { createGiteaProvider } from './gitea'
import { adaptProvider } from './adapter'

/**
 * Factory function that creates the appropriate Provider implementation
 * based on the config's type field.
 *
 * All providers are wrapped with the ProviderV1Adapter so they
 * automatically gain default implementations for V2 optional methods
 * (batchGetPRs, streamFileDiff, getTimeline, submitSuggestion,
 * acceptSuggestion). Providers that natively implement a V2 method
 * will have their implementation preserved.
 *
 * Currently GitHub, GitLab, Bitbucket, Azure DevOps, and Gitea/Forgejo are
 * supported. Other provider types return an "unsupported" provider whose
 * methods all fail with a descriptive error.
 */
export function createProvider(
  config: ProviderConfig,
  service: CodeReviewApiService,
): Provider {
  let provider: Provider

  switch (config.type) {
    case 'github':
      provider = createGitHubProvider(config, service)
      break
    case 'gitlab':
      provider = createGitLabProvider(config)
      break
    case 'bitbucket':
      provider = createBitbucketProvider(config)
      break
    case 'azure':
      provider = createAzureProvider(config)
      break
    case 'gitea':
      provider = createGiteaProvider(config)
      break
    default:
      provider = createUnsupportedProvider(config.type)
      break
  }

  return adaptProvider(provider)
}
