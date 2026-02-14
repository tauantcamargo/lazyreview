import { testProviderContract } from './provider-contract'
import { createMockProvider } from './mock-helpers'

testProviderContract('gitea', () =>
  createMockProvider('gitea', {
    supportsDraftPR: false,
    supportsReviewThreads: false,
    supportsGraphQL: false,
    supportsReactions: true,
    supportsCheckRuns: false,
    supportsMergeStrategies: ['merge', 'squash', 'rebase'],
  }),
)
