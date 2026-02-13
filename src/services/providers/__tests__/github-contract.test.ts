import { testProviderContract } from './provider-contract'
import { createMockGitHubProvider } from './mock-helpers'

testProviderContract('github', createMockGitHubProvider)
