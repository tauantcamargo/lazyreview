import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProviderType } from '../services/providers/types'

/**
 * Tests for useSuggestion hook.
 *
 * Since we don't have @testing-library/react-hooks, we test by mocking
 * React hooks and verifying the hook returns the correct shape and
 * delegates correctly to underlying mutations.
 */

// ---------------------------------------------------------------------------
// Mock mutation
// ---------------------------------------------------------------------------

const mockSubmitMutate = vi.fn()
const mockAcceptMutate = vi.fn()
let submitIsPending = false
let acceptIsPending = false

let useMutationCallCount = 0

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(() => {
    const idx = useMutationCallCount++
    if (idx % 2 === 0) {
      return { mutate: mockSubmitMutate, isPending: submitIsPending }
    }
    return { mutate: mockAcceptMutate, isPending: acceptIsPending }
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}))

// Mock Effect and CodeReviewApi
vi.mock('../utils/effect', () => ({
  runEffect: vi.fn(),
}))

// Track React state
let errorState: string | null = null
const mockSetError = vi.fn((val: string | null) => {
  errorState = val
})

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useState: (initial: unknown) => {
      return [errorState ?? initial, mockSetError]
    },
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => (fn as () => unknown)(),
  }
})

import { useSuggestion } from './useSuggestion'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createHook(providerType: ProviderType = 'github') {
  useMutationCallCount = 0

  return useSuggestion({
    providerType,
    owner: 'octocat',
    repo: 'hello-world',
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    errorState = null
    useMutationCallCount = 0
    submitIsPending = false
    acceptIsPending = false
  })

  describe('canSuggest', () => {
    it('returns true for github provider', () => {
      const result = createHook('github')
      expect(result.canSuggest).toBe(true)
    })

    it('returns true for gitlab provider', () => {
      const result = createHook('gitlab')
      expect(result.canSuggest).toBe(true)
    })

    it('returns false for bitbucket provider', () => {
      const result = createHook('bitbucket')
      expect(result.canSuggest).toBe(false)
    })

    it('returns false for azure provider', () => {
      const result = createHook('azure')
      expect(result.canSuggest).toBe(false)
    })

    it('returns false for gitea provider', () => {
      const result = createHook('gitea')
      expect(result.canSuggest).toBe(false)
    })
  })

  describe('initial state', () => {
    it('starts with isSubmitting false', () => {
      const result = createHook()
      expect(result.isSubmitting).toBe(false)
    })

    it('starts with error null', () => {
      const result = createHook()
      expect(result.error).toBeNull()
    })

    it('exposes providerType', () => {
      const result = createHook('gitlab')
      expect(result.providerType).toBe('gitlab')
    })
  })

  describe('submitSuggestion', () => {
    it('provides a function', () => {
      const result = createHook()
      expect(typeof result.submitSuggestion).toBe('function')
    })

    it('calls submit mutation with params', () => {
      const result = createHook()
      const params = {
        prNumber: 1,
        body: 'fix this',
        path: 'src/index.ts',
        line: 10,
        side: 'RIGHT' as const,
        suggestion: 'const x = 1',
      }

      result.submitSuggestion(params)
      expect(mockSubmitMutate).toHaveBeenCalledOnce()
      expect(mockSubmitMutate.mock.calls[0][0]).toEqual(params)
    })

    it('clears error before submitting', () => {
      errorState = 'Previous error'
      const result = createHook()

      result.submitSuggestion({
        prNumber: 1,
        body: '',
        path: 'a.ts',
        line: 1,
        side: 'RIGHT',
        suggestion: 'x',
      })

      expect(mockSetError).toHaveBeenCalledWith(null)
    })
  })

  describe('acceptSuggestion', () => {
    it('provides a function', () => {
      const result = createHook()
      expect(typeof result.acceptSuggestion).toBe('function')
    })

    it('calls accept mutation with commentId and prNumber', () => {
      const result = createHook()
      result.acceptSuggestion(123, 42)

      expect(mockAcceptMutate).toHaveBeenCalledOnce()
      expect(mockAcceptMutate.mock.calls[0][0]).toEqual({
        commentId: 123,
        prNumber: 42,
      })
    })

    it('clears error before accepting', () => {
      errorState = 'Previous error'
      const result = createHook()

      result.acceptSuggestion(123, 42)
      expect(mockSetError).toHaveBeenCalledWith(null)
    })
  })

  describe('isSubmitting', () => {
    it('is true when submit mutation is pending', () => {
      submitIsPending = true
      const result = createHook()
      expect(result.isSubmitting).toBe(true)
    })

    it('is true when accept mutation is pending', () => {
      acceptIsPending = true
      const result = createHook()
      expect(result.isSubmitting).toBe(true)
    })

    it('is false when neither mutation is pending', () => {
      submitIsPending = false
      acceptIsPending = false
      const result = createHook()
      expect(result.isSubmitting).toBe(false)
    })
  })

  describe('provider type exposure', () => {
    const providerTypes: readonly ProviderType[] = ['github', 'gitlab', 'bitbucket', 'azure', 'gitea']

    it('returns correct providerType for all providers', () => {
      for (const type of providerTypes) {
        const result = createHook(type)
        expect(result.providerType).toBe(type)
      }
    })
  })
})
