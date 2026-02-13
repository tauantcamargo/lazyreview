import { describe, it, expect } from 'vitest'
import type { Provider, ProviderConfig, ProviderCapabilities, ProviderType } from './types'
import { getDefaultBaseUrl } from './types'

describe('ProviderType', () => {
  it('accepts all supported provider types', () => {
    const types: ProviderType[] = ['github', 'gitlab', 'bitbucket', 'azure', 'gitea']
    expect(types).toHaveLength(5)
  })
})

describe('ProviderConfig', () => {
  it('can be constructed with all required fields', () => {
    const config: ProviderConfig = {
      type: 'github',
      baseUrl: 'https://api.github.com',
      token: 'ghp_test123',
      owner: 'myorg',
      repo: 'myrepo',
    }
    expect(config.type).toBe('github')
    expect(config.baseUrl).toBe('https://api.github.com')
    expect(config.token).toBe('ghp_test123')
    expect(config.owner).toBe('myorg')
    expect(config.repo).toBe('myrepo')
  })

  it('supports all provider types', () => {
    const types: ProviderType[] = ['github', 'gitlab', 'bitbucket', 'azure', 'gitea']
    for (const type of types) {
      const config: ProviderConfig = {
        type,
        baseUrl: getDefaultBaseUrl(type),
        token: 'test-token',
        owner: 'org',
        repo: 'repo',
      }
      expect(config.type).toBe(type)
    }
  })
})

describe('ProviderCapabilities', () => {
  it('can express a fully-capable provider', () => {
    const caps: ProviderCapabilities = {
      supportsDraftPR: true,
      supportsReviewThreads: true,
      supportsGraphQL: true,
      supportsReactions: true,
      supportsCheckRuns: true,
      supportsMergeStrategies: ['merge', 'squash', 'rebase'],
    }
    expect(caps.supportsDraftPR).toBe(true)
    expect(caps.supportsReviewThreads).toBe(true)
    expect(caps.supportsGraphQL).toBe(true)
    expect(caps.supportsReactions).toBe(true)
    expect(caps.supportsCheckRuns).toBe(true)
    expect(caps.supportsMergeStrategies).toEqual(['merge', 'squash', 'rebase'])
  })

  it('can express a limited provider', () => {
    const caps: ProviderCapabilities = {
      supportsDraftPR: false,
      supportsReviewThreads: false,
      supportsGraphQL: false,
      supportsReactions: false,
      supportsCheckRuns: false,
      supportsMergeStrategies: [],
    }
    expect(caps.supportsDraftPR).toBe(false)
    expect(caps.supportsMergeStrategies).toHaveLength(0)
  })
})

describe('getDefaultBaseUrl', () => {
  it('returns correct URL for github', () => {
    expect(getDefaultBaseUrl('github')).toBe('https://api.github.com')
  })

  it('returns correct URL for gitlab', () => {
    expect(getDefaultBaseUrl('gitlab')).toBe('https://gitlab.com/api/v4')
  })

  it('returns correct URL for bitbucket', () => {
    expect(getDefaultBaseUrl('bitbucket')).toBe('https://api.bitbucket.org/2.0')
  })

  it('returns correct URL for azure', () => {
    expect(getDefaultBaseUrl('azure')).toBe('https://dev.azure.com')
  })

  it('returns correct URL for gitea', () => {
    expect(getDefaultBaseUrl('gitea')).toBe('https://gitea.com/api/v1')
  })
})

describe('Provider interface', () => {
  it('requires type and capabilities fields', () => {
    // Compile-time check: a partial Provider must have type and capabilities
    const partialCheck: Pick<Provider, 'type' | 'capabilities'> = {
      type: 'github',
      capabilities: {
        supportsDraftPR: true,
        supportsReviewThreads: true,
        supportsGraphQL: true,
        supportsReactions: true,
        supportsCheckRuns: true,
        supportsMergeStrategies: ['merge', 'squash', 'rebase'],
      },
    }
    expect(partialCheck.type).toBe('github')
    expect(partialCheck.capabilities.supportsDraftPR).toBe(true)
  })
})
