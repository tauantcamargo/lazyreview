import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  createMockGitHubProvider,
  createMockGitLabProvider,
  createMockBitbucketProvider,
  createMinimalMockProvider,
  createMockLabel,
  createMockProvider,
} from './mock-helpers'
import { createUnsupportedProvider } from '../github'

describe('provider label capabilities', () => {
  it('GitHub provider supports labels', () => {
    const provider = createMockGitHubProvider()
    expect(provider.capabilities.supportsLabels).toBe(true)
  })

  it('GitLab provider does not support labels', () => {
    const provider = createMockGitLabProvider()
    expect(provider.capabilities.supportsLabels).toBe(false)
  })

  it('Bitbucket provider does not support labels', () => {
    const provider = createMockBitbucketProvider()
    expect(provider.capabilities.supportsLabels).toBe(false)
  })

  it('minimal provider does not support labels', () => {
    const provider = createMinimalMockProvider()
    expect(provider.capabilities.supportsLabels).toBe(false)
  })

  it('unsupported provider does not support labels', () => {
    const provider = createUnsupportedProvider('custom')
    expect(provider.capabilities.supportsLabels).toBe(false)
  })
})

describe('provider label methods', () => {
  it('getLabels returns labels for mock provider', async () => {
    const provider = createMockGitHubProvider()
    const labels = await Effect.runPromise(provider.getLabels())
    expect(Array.isArray(labels)).toBe(true)
    expect(labels).toHaveLength(1)
    expect(labels[0]!.name).toBe('bug')
    expect(labels[0]!.color).toBe('fc2929')
  })

  it('setLabels succeeds for mock provider', async () => {
    const provider = createMockGitHubProvider()
    await expect(
      Effect.runPromise(provider.setLabels(1, ['bug', 'feature'])),
    ).resolves.toBeUndefined()
  })

  it('getLabels fails for unsupported provider', async () => {
    const provider = createUnsupportedProvider('custom')
    const result = await Effect.runPromiseExit(provider.getLabels())
    expect(result._tag).toBe('Failure')
  })

  it('setLabels fails for unsupported provider', async () => {
    const provider = createUnsupportedProvider('custom')
    const result = await Effect.runPromiseExit(provider.setLabels(1, ['bug']))
    expect(result._tag).toBe('Failure')
  })

  it('allows overriding getLabels', async () => {
    const customLabel = createMockLabel({ name: 'custom', color: '00ff00' })
    const provider = createMockProvider('github', undefined, {
      getLabels: () => Effect.succeed([customLabel]),
    })
    const labels = await Effect.runPromise(provider.getLabels())
    expect(labels).toHaveLength(1)
    expect(labels[0]!.name).toBe('custom')
  })

  it('allows overriding setLabels', async () => {
    let capturedLabels: readonly string[] = []
    const provider = createMockProvider('github', undefined, {
      setLabels: (_prNumber, labels) => {
        capturedLabels = labels
        return Effect.succeed(undefined as void)
      },
    })
    await Effect.runPromise(provider.setLabels(1, ['bug', 'docs']))
    expect(capturedLabels).toEqual(['bug', 'docs'])
  })
})

describe('createMockLabel', () => {
  it('creates a label with defaults', () => {
    const label = createMockLabel()
    expect(label.id).toBe(1)
    expect(label.name).toBe('bug')
    expect(label.color).toBe('fc2929')
    expect(label.description).toBe('Something is broken')
    expect(label.default).toBe(false)
  })

  it('allows overrides', () => {
    const label = createMockLabel({ name: 'feature', color: '0075ca', id: 42 })
    expect(label.name).toBe('feature')
    expect(label.color).toBe('0075ca')
    expect(label.id).toBe(42)
  })

  it('allows null description', () => {
    const label = createMockLabel({ description: null })
    expect(label.description).toBeNull()
  })
})
