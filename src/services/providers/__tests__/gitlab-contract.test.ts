import { testProviderContract } from './provider-contract'
import { createMockGitLabProvider } from './mock-helpers'

testProviderContract('gitlab', createMockGitLabProvider)
