import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for usePendingReview hook.
 *
 * Since we don't have @testing-library/react-hooks, we test the behavior
 * by verifying that the underlying mutation hooks are called with the correct
 * parameters and callback shapes. We intercept the onSuccess/onError callbacks
 * passed to mutate() to verify state transitions match expectations.
 */

// ---------------------------------------------------------------------------
// Types for mock mutations
// ---------------------------------------------------------------------------

interface MutateCallbacks<TData = void> {
  onSuccess?: (data: TData) => void
  onError?: (err: Error) => void
}

interface MockMutation<TParams = unknown, TData = void> {
  mutate: ReturnType<typeof vi.fn>
  isPending: boolean
  lastCallbacks: () => MutateCallbacks<TData> | undefined
  lastParams: () => TParams | undefined
}

function createMockMutation<TParams = unknown, TData = void>(): MockMutation<TParams, TData> {
  const mutateFn = vi.fn()
  return {
    mutate: mutateFn,
    isPending: false,
    lastCallbacks() {
      const calls = mutateFn.mock.calls
      return calls.length > 0 ? (calls[calls.length - 1][1] as MutateCallbacks<TData>) : undefined
    },
    lastParams() {
      const calls = mutateFn.mock.calls
      return calls.length > 0 ? (calls[calls.length - 1][0] as TParams) : undefined
    },
  }
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreatePendingReview = createMockMutation<
  { owner: string; repo: string; prNumber: number },
  { id: number }
>()
const mockAddPendingReviewComment = createMockMutation<{
  owner: string
  repo: string
  prNumber: number
  reviewId: number
  body: string
  path: string
  line: number
  side: string
  startLine?: number
  startSide?: string
}>()
const mockSubmitPendingReview = createMockMutation<{
  owner: string
  repo: string
  prNumber: number
  reviewId: number
  body: string
  event: string
}>()
const mockDiscardPendingReview = createMockMutation<{
  owner: string
  repo: string
  prNumber: number
  reviewId: number
}>()

vi.mock('./useGitHub', () => ({
  useCreatePendingReview: () => mockCreatePendingReview,
  useAddPendingReviewComment: () => mockAddPendingReviewComment,
  useSubmitPendingReview: () => mockSubmitPendingReview,
  useDiscardPendingReview: () => mockDiscardPendingReview,
}))

// ---------------------------------------------------------------------------
// Mock React hooks to capture state transitions
// ---------------------------------------------------------------------------

interface StateCapture {
  reviewId: number | null
  pendingComments: readonly { body: string; path: string; line: number; side: string }[]
  error: string | null
}

let stateCapture: StateCapture = {
  reviewId: null,
  pendingComments: [],
  error: null,
}

// We track what useState setters are called with to verify state transitions
const mockSetReviewId = vi.fn((updater: number | null) => {
  stateCapture = { ...stateCapture, reviewId: updater }
})
const mockSetPendingComments = vi.fn((updater: unknown) => {
  if (typeof updater === 'function') {
    stateCapture = {
      ...stateCapture,
      pendingComments: (updater as (prev: readonly unknown[]) => readonly unknown[])(stateCapture.pendingComments) as StateCapture['pendingComments'],
    }
  } else {
    stateCapture = { ...stateCapture, pendingComments: updater as StateCapture['pendingComments'] }
  }
})
const mockSetError = vi.fn((updater: string | null) => {
  stateCapture = { ...stateCapture, error: updater }
})

let useStateCalls = 0
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useState: (initial: unknown) => {
      const callIndex = useStateCalls++
      // Order: reviewId (0), pendingComments (1), error (2)
      if (callIndex % 3 === 0) return [stateCapture.reviewId ?? initial, mockSetReviewId]
      if (callIndex % 3 === 1) return [stateCapture.pendingComments ?? initial, mockSetPendingComments]
      return [stateCapture.error ?? initial, mockSetError]
    },
    useCallback: (fn: unknown) => fn,
  }
})

import { usePendingReview, type PendingComment } from './usePendingReview'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createHook() {
  const setStatusMessage = vi.fn()
  useStateCalls = 0
  const result = usePendingReview({
    owner: 'octocat',
    repo: 'hello-world',
    prNumber: 42,
    setStatusMessage,
  })
  return { result, setStatusMessage }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePendingReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stateCapture = { reviewId: null, pendingComments: [], error: null }
    mockCreatePendingReview.mutate = vi.fn()
    mockAddPendingReviewComment.mutate = vi.fn()
    mockSubmitPendingReview.mutate = vi.fn()
    mockDiscardPendingReview.mutate = vi.fn()
    mockCreatePendingReview.isPending = false
    mockAddPendingReviewComment.isPending = false
    mockSubmitPendingReview.isPending = false
    mockDiscardPendingReview.isPending = false
  })

  describe('initial state', () => {
    it('starts with isActive false', () => {
      const { result } = createHook()
      expect(result.isActive).toBe(false)
    })

    it('starts with reviewId null', () => {
      const { result } = createHook()
      expect(result.reviewId).toBeNull()
    })

    it('starts with empty pending comments', () => {
      const { result } = createHook()
      expect(result.pendingComments).toEqual([])
      expect(result.pendingCount).toBe(0)
    })

    it('starts with no error', () => {
      const { result } = createHook()
      expect(result.error).toBeNull()
    })

    it('starts with isSubmitting false', () => {
      const { result } = createHook()
      expect(result.isSubmitting).toBe(false)
    })

    it('starts with isAdding false', () => {
      const { result } = createHook()
      expect(result.isAdding).toBe(false)
    })
  })

  describe('startReview', () => {
    it('calls createPendingReview.mutate with correct params', () => {
      const { result } = createHook()
      result.startReview()

      expect(mockCreatePendingReview.mutate).toHaveBeenCalledOnce()
      const params = mockCreatePendingReview.mutate.mock.calls[0][0]
      expect(params).toEqual({
        owner: 'octocat',
        repo: 'hello-world',
        prNumber: 42,
      })
    })

    it('clears error before calling mutate', () => {
      const { result } = createHook()
      result.startReview()
      expect(mockSetError).toHaveBeenCalledWith(null)
    })

    it('sets reviewId and resets comments on success callback', () => {
      const { result } = createHook()
      result.startReview()

      const callbacks = mockCreatePendingReview.mutate.mock.calls[0][1] as MutateCallbacks<{ id: number }>
      callbacks.onSuccess?.({ id: 123 })

      expect(mockSetReviewId).toHaveBeenCalledWith(123)
      expect(mockSetPendingComments).toHaveBeenCalledWith([])
    })

    it('sets status message on success', () => {
      const { result, setStatusMessage } = createHook()
      result.startReview()

      const callbacks = mockCreatePendingReview.mutate.mock.calls[0][1] as MutateCallbacks<{ id: number }>
      callbacks.onSuccess?.({ id: 123 })

      expect(setStatusMessage).toHaveBeenCalledWith(
        'Review started - comments will be batched',
      )
    })

    it('sets error on failure callback', () => {
      const { result } = createHook()
      result.startReview()

      const callbacks = mockCreatePendingReview.mutate.mock.calls[0][1] as MutateCallbacks<{ id: number }>
      callbacks.onError?.(new Error('API rate limit'))

      expect(mockSetError).toHaveBeenCalledWith('Error: API rate limit')
    })

    it('sets status message with error on failure', () => {
      const { result, setStatusMessage } = createHook()
      result.startReview()

      const callbacks = mockCreatePendingReview.mutate.mock.calls[0][1] as MutateCallbacks<{ id: number }>
      callbacks.onError?.(new Error('API rate limit'))

      expect(setStatusMessage).toHaveBeenCalledWith(
        'Error starting review: Error: API rate limit',
      )
    })
  })

  describe('addPendingComment', () => {
    const comment: PendingComment = {
      body: 'Fix this',
      path: 'src/index.ts',
      line: 10,
      side: 'RIGHT',
    }

    it('does nothing when review is not active (reviewId is null)', () => {
      stateCapture.reviewId = null
      const { result } = createHook()
      result.addPendingComment(comment, 'Fix this')
      expect(mockAddPendingReviewComment.mutate).not.toHaveBeenCalled()
    })

    it('calls addComment.mutate with correct params when active', () => {
      stateCapture.reviewId = 999
      const { result } = createHook()
      result.addPendingComment(comment, 'Fix this')

      expect(mockAddPendingReviewComment.mutate).toHaveBeenCalledOnce()
      const params = mockAddPendingReviewComment.mutate.mock.calls[0][0]
      expect(params).toEqual({
        owner: 'octocat',
        repo: 'hello-world',
        prNumber: 42,
        reviewId: 999,
        body: 'Fix this',
        path: 'src/index.ts',
        line: 10,
        side: 'RIGHT',
        startLine: undefined,
        startSide: undefined,
      })
    })

    it('appends comment to pending list on success', () => {
      stateCapture.reviewId = 999
      const { result } = createHook()
      result.addPendingComment(comment, 'Fix this')

      const callbacks = mockAddPendingReviewComment.mutate.mock.calls[0][1] as MutateCallbacks
      callbacks.onSuccess?.()

      // Verify setPendingComments was called with an updater function
      expect(mockSetPendingComments).toHaveBeenCalled()
      const lastCall = mockSetPendingComments.mock.calls[mockSetPendingComments.mock.calls.length - 1][0]
      if (typeof lastCall === 'function') {
        const newComments = lastCall([])
        expect(newComments).toHaveLength(1)
        expect(newComments[0]).toEqual(comment)
      }
    })

    it('reports count in status message on success', () => {
      stateCapture.reviewId = 999
      stateCapture.pendingComments = []
      const { result, setStatusMessage } = createHook()
      result.addPendingComment(comment, 'Fix this')

      const callbacks = mockAddPendingReviewComment.mutate.mock.calls[0][1] as MutateCallbacks
      callbacks.onSuccess?.()

      expect(setStatusMessage).toHaveBeenCalledWith(
        'Pending comment added (1 total)',
      )
    })

    it('sets error on failure', () => {
      stateCapture.reviewId = 999
      const { result } = createHook()
      result.addPendingComment(comment, 'Fix this')

      const callbacks = mockAddPendingReviewComment.mutate.mock.calls[0][1] as MutateCallbacks
      callbacks.onError?.(new Error('422 Unprocessable'))

      expect(mockSetError).toHaveBeenCalledWith('Error: 422 Unprocessable')
    })

    it('sets error status message on failure', () => {
      stateCapture.reviewId = 999
      const { result, setStatusMessage } = createHook()
      result.addPendingComment(comment, 'Fix this')

      const callbacks = mockAddPendingReviewComment.mutate.mock.calls[0][1] as MutateCallbacks
      callbacks.onError?.(new Error('422 Unprocessable'))

      expect(setStatusMessage).toHaveBeenCalledWith(
        'Error adding comment: Error: 422 Unprocessable',
      )
    })

    it('passes multi-line range params when provided', () => {
      stateCapture.reviewId = 999
      const rangeComment: PendingComment = {
        body: 'Refactor',
        path: 'src/utils.ts',
        line: 20,
        side: 'RIGHT',
        startLine: 15,
        startSide: 'LEFT',
      }
      const { result } = createHook()
      result.addPendingComment(rangeComment, 'Refactor')

      const params = mockAddPendingReviewComment.mutate.mock.calls[0][0]
      expect(params.startLine).toBe(15)
      expect(params.startSide).toBe('LEFT')
    })
  })

  describe('submitReview', () => {
    it('does nothing when review is not active', () => {
      stateCapture.reviewId = null
      const { result } = createHook()
      result.submitReview('LGTM', 'APPROVE')
      expect(mockSubmitPendingReview.mutate).not.toHaveBeenCalled()
    })

    it('calls submitPending.mutate with correct params', () => {
      stateCapture.reviewId = 999
      const { result } = createHook()
      result.submitReview('Looks good!', 'APPROVE')

      expect(mockSubmitPendingReview.mutate).toHaveBeenCalledOnce()
      const params = mockSubmitPendingReview.mutate.mock.calls[0][0]
      expect(params).toEqual({
        owner: 'octocat',
        repo: 'hello-world',
        prNumber: 42,
        reviewId: 999,
        body: 'Looks good!',
        event: 'APPROVE',
      })
    })

    it('resets state on success', () => {
      stateCapture.reviewId = 999
      const { result } = createHook()
      result.submitReview('Done', 'COMMENT')

      const callbacks = mockSubmitPendingReview.mutate.mock.calls[0][1] as MutateCallbacks
      callbacks.onSuccess?.()

      expect(mockSetReviewId).toHaveBeenCalledWith(null)
      expect(mockSetPendingComments).toHaveBeenCalledWith([])
    })

    it('sets status message on success', () => {
      stateCapture.reviewId = 999
      const { result, setStatusMessage } = createHook()
      result.submitReview('Done', 'APPROVE')

      const callbacks = mockSubmitPendingReview.mutate.mock.calls[0][1] as MutateCallbacks
      callbacks.onSuccess?.()

      expect(setStatusMessage).toHaveBeenCalledWith('Review submitted')
    })

    it('sets error on failure', () => {
      stateCapture.reviewId = 999
      const { result } = createHook()
      result.submitReview('Done', 'APPROVE')

      const callbacks = mockSubmitPendingReview.mutate.mock.calls[0][1] as MutateCallbacks
      callbacks.onError?.(new Error('Server error'))

      expect(mockSetError).toHaveBeenCalledWith('Error: Server error')
    })

    it('sets error status message on failure', () => {
      stateCapture.reviewId = 999
      const { result, setStatusMessage } = createHook()
      result.submitReview('Done', 'APPROVE')

      const callbacks = mockSubmitPendingReview.mutate.mock.calls[0][1] as MutateCallbacks
      callbacks.onError?.(new Error('Server error'))

      expect(setStatusMessage).toHaveBeenCalledWith(
        'Error submitting review: Error: Server error',
      )
    })

    it('works with REQUEST_CHANGES event', () => {
      stateCapture.reviewId = 999
      const { result } = createHook()
      result.submitReview('Fix issues', 'REQUEST_CHANGES')

      const params = mockSubmitPendingReview.mutate.mock.calls[0][0]
      expect(params.event).toBe('REQUEST_CHANGES')
    })
  })

  describe('discardReview', () => {
    it('does nothing when review is not active', () => {
      stateCapture.reviewId = null
      const { result } = createHook()
      result.discardReview()
      expect(mockDiscardPendingReview.mutate).not.toHaveBeenCalled()
    })

    it('calls discardPending.mutate with correct params', () => {
      stateCapture.reviewId = 888
      const { result } = createHook()
      result.discardReview()

      expect(mockDiscardPendingReview.mutate).toHaveBeenCalledOnce()
      const params = mockDiscardPendingReview.mutate.mock.calls[0][0]
      expect(params).toEqual({
        owner: 'octocat',
        repo: 'hello-world',
        prNumber: 42,
        reviewId: 888,
      })
    })

    it('resets state on success', () => {
      stateCapture.reviewId = 888
      const { result } = createHook()
      result.discardReview()

      const callbacks = mockDiscardPendingReview.mutate.mock.calls[0][1] as MutateCallbacks
      callbacks.onSuccess?.()

      expect(mockSetReviewId).toHaveBeenCalledWith(null)
      expect(mockSetPendingComments).toHaveBeenCalledWith([])
    })

    it('sets status message on success', () => {
      stateCapture.reviewId = 888
      const { result, setStatusMessage } = createHook()
      result.discardReview()

      const callbacks = mockDiscardPendingReview.mutate.mock.calls[0][1] as MutateCallbacks
      callbacks.onSuccess?.()

      expect(setStatusMessage).toHaveBeenCalledWith(
        'Pending review discarded',
      )
    })

    it('sets error on failure', () => {
      stateCapture.reviewId = 888
      const { result } = createHook()
      result.discardReview()

      const callbacks = mockDiscardPendingReview.mutate.mock.calls[0][1] as MutateCallbacks
      callbacks.onError?.(new Error('Not found'))

      expect(mockSetError).toHaveBeenCalledWith('Error: Not found')
    })

    it('sets error status message on failure', () => {
      stateCapture.reviewId = 888
      const { result, setStatusMessage } = createHook()
      result.discardReview()

      const callbacks = mockDiscardPendingReview.mutate.mock.calls[0][1] as MutateCallbacks
      callbacks.onError?.(new Error('Not found'))

      expect(setStatusMessage).toHaveBeenCalledWith(
        'Error discarding review: Error: Not found',
      )
    })
  })

  describe('error propagation', () => {
    it('clears error before starting new operation (startReview)', () => {
      stateCapture.error = 'Previous error'
      const { result } = createHook()
      result.startReview()
      expect(mockSetError).toHaveBeenCalledWith(null)
    })

    it('clears error before adding comment', () => {
      stateCapture.reviewId = 999
      stateCapture.error = 'Previous error'
      const { result } = createHook()
      result.addPendingComment(
        { body: 'test', path: 'a.ts', line: 1, side: 'RIGHT' },
        'test',
      )
      expect(mockSetError).toHaveBeenCalledWith(null)
    })

    it('clears error before submitting review', () => {
      stateCapture.reviewId = 999
      stateCapture.error = 'Previous error'
      const { result } = createHook()
      result.submitReview('body', 'APPROVE')
      expect(mockSetError).toHaveBeenCalledWith(null)
    })

    it('clears error before discarding review', () => {
      stateCapture.reviewId = 999
      stateCapture.error = 'Previous error'
      const { result } = createHook()
      result.discardReview()
      expect(mockSetError).toHaveBeenCalledWith(null)
    })
  })

  describe('derived state', () => {
    it('isActive is true when reviewId is set', () => {
      stateCapture.reviewId = 42
      const { result } = createHook()
      expect(result.isActive).toBe(true)
    })

    it('isActive is false when reviewId is null', () => {
      stateCapture.reviewId = null
      const { result } = createHook()
      expect(result.isActive).toBe(false)
    })

    it('pendingCount reflects pendingComments length', () => {
      stateCapture.pendingComments = [
        { body: 'a', path: 'a.ts', line: 1, side: 'RIGHT' },
        { body: 'b', path: 'b.ts', line: 2, side: 'LEFT' },
      ]
      const { result } = createHook()
      expect(result.pendingCount).toBe(2)
    })

    it('isSubmitting reflects submitPending.isPending', () => {
      mockSubmitPendingReview.isPending = true
      const { result } = createHook()
      expect(result.isSubmitting).toBe(true)
    })

    it('isAdding reflects addComment.isPending', () => {
      mockAddPendingReviewComment.isPending = true
      const { result } = createHook()
      expect(result.isAdding).toBe(true)
    })
  })
})
