export type {
  ProviderType,
  ProviderConfig,
  ProviderCapabilities,
  Provider,
  ListPRsParams,
  PRListResult,
  AddDiffCommentParams,
  AddPendingReviewCommentParams,
} from './types'

export { getDefaultBaseUrl } from './types'

export { createGitHubProvider, createUnsupportedProvider } from './github'

import type { CodeReviewApiService } from '../CodeReviewApiTypes'
import type { Provider, ProviderConfig } from './types'
import { createGitHubProvider, createUnsupportedProvider } from './github'

/**
 * Factory function that creates the appropriate Provider implementation
 * based on the config's type field.
 *
 * Currently only GitHub is supported. Other provider types return an
 * "unsupported" provider whose methods all fail with a descriptive error.
 */
export function createProvider(
  config: ProviderConfig,
  service: CodeReviewApiService,
): Provider {
  switch (config.type) {
    case 'github':
      return createGitHubProvider(config, service)
    default:
      return createUnsupportedProvider(config.type)
  }
}
