import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { adaptProvider, ensureV2Capabilities } from '../adapter'
import { createMockProvider, createMockPR, createMockComment } from './mock-helpers'
import type { Provider, ProviderCapabilities } from '../types'

describe('ensureV2Capabilities', () => {
  it('adds missing V2 flags with false defaults', () => {
    // Simulate a capabilities object that only has V1 flags
    const v1Caps = {
      supportsDraftPR: true,
      supportsReviewThreads: true,
      supportsGraphQL: true,
      supportsReactions: true,
      supportsCheckRuns: true,
      supportsLabels: true,
      supportsAssignees: true,
      supportsMergeStrategies: ['merge', 'squash', 'rebase'] as const,
      supportsStreaming: false,
      supportsBatchFetch: false,
      supportsWebhooks: false,
      supportsSuggestions: false,
      supportsTimeline: false,
      supportsBlame: false,
    } satisfies ProviderCapabilities

    const result = ensureV2Capabilities(v1Caps)

    expect(result.supportsStreaming).toBe(false)
    expect(result.supportsBatchFetch).toBe(false)
    expect(result.supportsWebhooks).toBe(false)
    expect(result.supportsSuggestions).toBe(false)
    expect(result.supportsTimeline).toBe(false)
    expect(result.supportsBlame).toBe(false)
  })

  it('preserves existing V2 flags if present', () => {
    const caps: ProviderCapabilities = {
      supportsDraftPR: true,
      supportsReviewThreads: true,
      supportsGraphQL: true,
      supportsReactions: true,
      supportsCheckRuns: true,
      supportsLabels: true,
      supportsAssignees: true,
      supportsMergeStrategies: ['merge'],
      supportsStreaming: true,
      supportsBatchFetch: true,
      supportsWebhooks: false,
      supportsSuggestions: true,
      supportsTimeline: false,
      supportsBlame: false,
    }

    const result = ensureV2Capabilities(caps)

    expect(result.supportsStreaming).toBe(true)
    expect(result.supportsBatchFetch).toBe(true)
    expect(result.supportsWebhooks).toBe(false)
    expect(result.supportsSuggestions).toBe(true)
    expect(result.supportsTimeline).toBe(false)
    expect(result.supportsBlame).toBe(false)
  })

  it('does not mutate the original capabilities', () => {
    const caps: ProviderCapabilities = {
      supportsDraftPR: false,
      supportsReviewThreads: false,
      supportsGraphQL: false,
      supportsReactions: false,
      supportsCheckRuns: false,
      supportsLabels: false,
      supportsAssignees: false,
      supportsMergeStrategies: [],
      supportsStreaming: false,
      supportsBatchFetch: false,
      supportsWebhooks: false,
      supportsSuggestions: false,
      supportsTimeline: false,
      supportsBlame: false,
    }

    const result = ensureV2Capabilities(caps)

    expect(result).not.toBe(caps)
    expect(result.supportsDraftPR).toBe(false)
  })
})

describe('adaptProvider', () => {
  describe('method presence', () => {
    it('adds all V2 optional methods to a V1 provider', () => {
      const v1Provider = createMockProvider()
      const adapted = adaptProvider(v1Provider)

      expect(typeof adapted.batchGetPRs).toBe('function')
      expect(typeof adapted.streamFileDiff).toBe('function')
      expect(typeof adapted.getTimeline).toBe('function')
      expect(typeof adapted.submitSuggestion).toBe('function')
      expect(typeof adapted.acceptSuggestion).toBe('function')
      expect(typeof adapted.getFileBlame).toBe('function')
    })

    it('preserves all V1 methods', () => {
      const v1Provider = createMockProvider()
      const adapted = adaptProvider(v1Provider)

      expect(typeof adapted.listPRs).toBe('function')
      expect(typeof adapted.getPR).toBe('function')
      expect(typeof adapted.getPRFiles).toBe('function')
      expect(typeof adapted.addComment).toBe('function')
      expect(typeof adapted.mergePR).toBe('function')
      expect(typeof adapted.getCurrentUser).toBe('function')
    })

    it('preserves provider type', () => {
      const v1Provider = createMockProvider('gitlab')
      const adapted = adaptProvider(v1Provider)

      expect(adapted.type).toBe('gitlab')
    })
  })

  describe('default batchGetPRs', () => {
    it('calls getPR for each number sequentially', async () => {
      const mockPR1 = createMockPR({ number: 1 })
      const mockPR2 = createMockPR({ number: 2 })
      const mockPR3 = createMockPR({ number: 3 })

      let callCount = 0
      const v1Provider = createMockProvider('github', undefined, {
        getPR: (num: number) => {
          callCount++
          const prs: Record<number, typeof mockPR1> = {
            1: mockPR1,
            2: mockPR2,
            3: mockPR3,
          }
          return Effect.succeed(prs[num] ?? mockPR1)
        },
      })

      const adapted = adaptProvider(v1Provider)
      const result = await Effect.runPromise(adapted.batchGetPRs!([1, 2, 3]))

      expect(result).toHaveLength(3)
      expect(result[0]!.number).toBe(1)
      expect(result[1]!.number).toBe(2)
      expect(result[2]!.number).toBe(3)
      expect(callCount).toBe(3)
    })

    it('returns empty array for empty input', async () => {
      const adapted = adaptProvider(createMockProvider())
      const result = await Effect.runPromise(adapted.batchGetPRs!([]))

      expect(result).toEqual([])
    })
  })

  describe('default streamFileDiff', () => {
    it('yields the patch content from getFileDiff', async () => {
      const adapted = adaptProvider(createMockProvider())
      const chunks: string[] = []

      for await (const chunk of adapted.streamFileDiff!(1, 'src/index.ts')) {
        chunks.push(chunk)
      }

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0]).toContain('@@ -1,5 +1,8 @@')
    })

    it('yields nothing when file has no patch', async () => {
      const v1Provider = createMockProvider('github', undefined, {
        getFileDiff: () => Effect.succeed(null),
      })
      const adapted = adaptProvider(v1Provider)
      const chunks: string[] = []

      for await (const chunk of adapted.streamFileDiff!(1, 'missing.ts')) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual([])
    })
  })

  describe('default getTimeline', () => {
    it('returns empty array', async () => {
      const adapted = adaptProvider(createMockProvider())
      const result = await Effect.runPromise(adapted.getTimeline!(42))

      expect(result).toEqual([])
    })
  })

  describe('default acceptSuggestion', () => {
    it('fails with 501 not supported error', async () => {
      const adapted = adaptProvider(createMockProvider())

      const result = await Effect.runPromiseExit(
        adapted.acceptSuggestion!({ prNumber: 1, commentId: 123 }),
      )

      expect(result._tag).toBe('Failure')
    })
  })

  describe('preserves native V2 implementations', () => {
    it('uses native batchGetPRs when provided', async () => {
      const nativePR = createMockPR({ number: 99 })
      const v1Provider: Provider = {
        ...createMockProvider(),
        batchGetPRs: () => Effect.succeed([nativePR]),
      }

      const adapted = adaptProvider(v1Provider)
      const result = await Effect.runPromise(adapted.batchGetPRs!([99]))

      expect(result).toHaveLength(1)
      expect(result[0]!.number).toBe(99)
    })

    it('uses native getTimeline when provided', async () => {
      const v1Provider: Provider = {
        ...createMockProvider(),
        getTimeline: () =>
          Effect.succeed([
            {
              type: 'commit' as const,
              id: 'c1',
              timestamp: '2026-01-01T00:00:00Z',
              sha: 'abc',
              message: 'native timeline',
              author: { login: 'user' },
            },
          ]),
      }

      const adapted = adaptProvider(v1Provider)
      const result = await Effect.runPromise(adapted.getTimeline!(1))

      expect(result).toHaveLength(1)
      expect(result[0]!.type).toBe('commit')
    })

    it('uses native streamFileDiff when provided', async () => {
      async function* nativeStream() {
        yield 'chunk-1'
        yield 'chunk-2'
      }

      const v1Provider: Provider = {
        ...createMockProvider(),
        streamFileDiff: () => nativeStream(),
      }

      const adapted = adaptProvider(v1Provider)
      const chunks: string[] = []

      for await (const chunk of adapted.streamFileDiff!(1, 'file.ts')) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['chunk-1', 'chunk-2'])
    })
  })

  describe('capabilities', () => {
    it('ensures V2 capability flags are present', () => {
      const v1Provider = createMockProvider()
      const adapted = adaptProvider(v1Provider)

      expect(typeof adapted.capabilities.supportsStreaming).toBe('boolean')
      expect(typeof adapted.capabilities.supportsBatchFetch).toBe('boolean')
      expect(typeof adapted.capabilities.supportsWebhooks).toBe('boolean')
      expect(typeof adapted.capabilities.supportsSuggestions).toBe('boolean')
      expect(typeof adapted.capabilities.supportsTimeline).toBe('boolean')
      expect(typeof adapted.capabilities.supportsBlame).toBe('boolean')
    })
  })

  describe('default getFileBlame', () => {
    it('returns empty array by default', async () => {
      const adapted = adaptProvider(createMockProvider())
      const result = await Effect.runPromise(adapted.getFileBlame!('owner', 'repo', 'file.ts', 'main'))

      expect(result).toEqual([])
    })
  })
})
