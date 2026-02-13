import { testProviderContract } from './provider-contract'
import { createMockBitbucketProvider } from './mock-helpers'

testProviderContract('bitbucket', createMockBitbucketProvider)
