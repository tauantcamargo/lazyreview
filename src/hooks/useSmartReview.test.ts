import { describe, it, expect } from 'vitest'
import type { AiAnnotation } from '../services/ai/review-prompts'

// ---------------------------------------------------------------------------
// useSmartReview - Pure logic tests
//
// We test the extracted pure functions used by the hook rather than
// the hook itself (which requires React rendering context).
// ---------------------------------------------------------------------------

// Replicate pure functions from useSmartReview for testing

const DEFAULT_MAX_ANALYSES = 10

interface RateLimitState {
  readonly count: number
  readonly maxAnalyses: number
}

function isRateLimited(state: RateLimitState): boolean {
  return state.count >= state.maxAnalyses
}

function incrementCount(state: RateLimitState): RateLimitState {
  return { ...state, count: state.count + 1 }
}

function buildCacheKey(filename: string, commitSha: string): string {
  return `smart-review:${filename}:${commitSha}`
}

interface SmartReviewState {
  readonly annotations: readonly AiAnnotation[]
  readonly isAnalyzing: boolean
  readonly error: string | null
}

function getInitialState(): SmartReviewState {
  return {
    annotations: [],
    isAnalyzing: false,
    error: null,
  }
}

function setAnalyzing(state: SmartReviewState): SmartReviewState {
  return { ...state, isAnalyzing: true, error: null }
}

function setResults(
  state: SmartReviewState,
  annotations: readonly AiAnnotation[],
): SmartReviewState {
  return { ...state, annotations, isAnalyzing: false, error: null }
}

function setError(state: SmartReviewState, error: string): SmartReviewState {
  return { ...state, isAnalyzing: false, error }
}

function clearState(): SmartReviewState {
  return getInitialState()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSmartReview pure logic', () => {
  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('getInitialState', () => {
    it('returns empty annotations', () => {
      const state = getInitialState()
      expect(state.annotations).toEqual([])
    })

    it('is not analyzing initially', () => {
      const state = getInitialState()
      expect(state.isAnalyzing).toBe(false)
    })

    it('has no error initially', () => {
      const state = getInitialState()
      expect(state.error).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // State transitions
  // -------------------------------------------------------------------------

  describe('state transitions', () => {
    it('setAnalyzing sets isAnalyzing to true and clears error', () => {
      const initial = { ...getInitialState(), error: 'previous error' }
      const next = setAnalyzing(initial)
      expect(next.isAnalyzing).toBe(true)
      expect(next.error).toBeNull()
    })

    it('setResults stores annotations and stops analyzing', () => {
      const initial = setAnalyzing(getInitialState())
      const annotations: AiAnnotation[] = [
        { line: 5, severity: 'warning', message: 'Test issue' },
      ]
      const next = setResults(initial, annotations)
      expect(next.annotations).toEqual(annotations)
      expect(next.isAnalyzing).toBe(false)
      expect(next.error).toBeNull()
    })

    it('setError stores error message and stops analyzing', () => {
      const initial = setAnalyzing(getInitialState())
      const next = setError(initial, 'API rate limit exceeded')
      expect(next.error).toBe('API rate limit exceeded')
      expect(next.isAnalyzing).toBe(false)
    })

    it('clearState resets to initial state', () => {
      const state = setResults(getInitialState(), [
        { line: 1, severity: 'info', message: 'test' },
      ])
      const cleared = clearState()
      expect(cleared).toEqual(getInitialState())
      expect(cleared.annotations).toEqual([])
    })

    it('state transitions are immutable', () => {
      const initial = getInitialState()
      const analyzing = setAnalyzing(initial)
      expect(initial.isAnalyzing).toBe(false)
      expect(analyzing.isAnalyzing).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Cache key generation
  // -------------------------------------------------------------------------

  describe('buildCacheKey', () => {
    it('generates a key from filename and commitSha', () => {
      const key = buildCacheKey('src/app.ts', 'abc1234')
      expect(key).toBe('smart-review:src/app.ts:abc1234')
    })

    it('generates different keys for different files', () => {
      const key1 = buildCacheKey('src/a.ts', 'abc1234')
      const key2 = buildCacheKey('src/b.ts', 'abc1234')
      expect(key1).not.toBe(key2)
    })

    it('generates different keys for different commits', () => {
      const key1 = buildCacheKey('src/a.ts', 'abc1234')
      const key2 = buildCacheKey('src/a.ts', 'def5678')
      expect(key1).not.toBe(key2)
    })

    it('produces a consistent key for same inputs', () => {
      const key1 = buildCacheKey('src/a.ts', 'abc1234')
      const key2 = buildCacheKey('src/a.ts', 'abc1234')
      expect(key1).toBe(key2)
    })
  })

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------

  describe('rate limiting', () => {
    it('is not rate limited when count is below max', () => {
      const state: RateLimitState = { count: 0, maxAnalyses: DEFAULT_MAX_ANALYSES }
      expect(isRateLimited(state)).toBe(false)
    })

    it('is rate limited when count equals max', () => {
      const state: RateLimitState = { count: 10, maxAnalyses: DEFAULT_MAX_ANALYSES }
      expect(isRateLimited(state)).toBe(true)
    })

    it('is rate limited when count exceeds max', () => {
      const state: RateLimitState = { count: 15, maxAnalyses: DEFAULT_MAX_ANALYSES }
      expect(isRateLimited(state)).toBe(true)
    })

    it('incrementCount increases count by 1', () => {
      const state: RateLimitState = { count: 3, maxAnalyses: DEFAULT_MAX_ANALYSES }
      const next = incrementCount(state)
      expect(next.count).toBe(4)
      expect(next.maxAnalyses).toBe(DEFAULT_MAX_ANALYSES)
    })

    it('incrementCount is immutable', () => {
      const state: RateLimitState = { count: 3, maxAnalyses: DEFAULT_MAX_ANALYSES }
      const next = incrementCount(state)
      expect(state.count).toBe(3)
      expect(next.count).toBe(4)
    })

    it('respects custom max analyses', () => {
      const state: RateLimitState = { count: 5, maxAnalyses: 5 }
      expect(isRateLimited(state)).toBe(true)
    })

    it('custom max of 0 always limits', () => {
      const state: RateLimitState = { count: 0, maxAnalyses: 0 }
      expect(isRateLimited(state)).toBe(true)
    })

    it('tracks rate limit progression correctly', () => {
      let state: RateLimitState = { count: 0, maxAnalyses: 3 }
      expect(isRateLimited(state)).toBe(false)
      state = incrementCount(state)
      expect(isRateLimited(state)).toBe(false)
      state = incrementCount(state)
      expect(isRateLimited(state)).toBe(false)
      state = incrementCount(state)
      expect(isRateLimited(state)).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Default config
  // -------------------------------------------------------------------------

  describe('default config', () => {
    it('default max analyses is 10', () => {
      expect(DEFAULT_MAX_ANALYSES).toBe(10)
    })
  })
})
