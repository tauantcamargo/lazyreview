import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { CodeReviewApi } from '../services/GitHubApi'
import { runEffect } from '../utils/effect'
import { getRateLimitRemaining } from './useRateLimit'
import type { PullRequest } from '../models/pull-request'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePrefetchOptions {
  readonly items: readonly PullRequest[]
  readonly selectedIndex: number
  readonly enabled: boolean
  readonly owner: string
  readonly repo: string
  readonly delayMs?: number
  readonly minRateLimit?: number
}

export interface UsePrefetchResult {
  readonly prefetchedPR: number | null
  readonly isPrefetching: boolean
}

// ---------------------------------------------------------------------------
// Constants (exported for testing)
// ---------------------------------------------------------------------------

export const DEFAULT_DELAY_MS = 500
export const DEFAULT_MIN_RATE_LIMIT = 200

// ---------------------------------------------------------------------------
// Pure functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Determine whether a prefetch should be scheduled for the given state.
 * Returns the PR number to prefetch, or null if prefetch should be skipped.
 */
export function shouldPrefetch(
  options: {
    readonly items: readonly PullRequest[]
    readonly selectedIndex: number
    readonly enabled: boolean
    readonly owner: string
    readonly repo: string
    readonly minRateLimit: number
    readonly rateLimitRemaining: number
    readonly alreadyPrefetched: ReadonlySet<number>
  },
): number | null {
  const {
    items,
    selectedIndex,
    enabled,
    owner,
    repo,
    minRateLimit,
    rateLimitRemaining,
    alreadyPrefetched,
  } = options

  if (!enabled) return null
  if (!owner || !repo) return null
  if (items.length === 0) return null
  if (selectedIndex < 0 || selectedIndex >= items.length) return null

  const selectedPR = items[selectedIndex]
  if (!selectedPR) return null

  const prNumber = selectedPR.number

  if (alreadyPrefetched.has(prNumber)) return null
  if (rateLimitRemaining < minRateLimit) return null

  return prNumber
}

/**
 * Build the list of query keys that will be prefetched for a PR.
 * These match the query keys used in useGitHub.ts hooks.
 */
export function buildPrefetchQueryKeys(
  owner: string,
  repo: string,
  prNumber: number,
): readonly (readonly [string, string, string, number])[] {
  return [
    ['pr', owner, repo, prNumber] as const,
    ['pr-files', owner, repo, prNumber] as const,
    ['pr-comments', owner, repo, prNumber] as const,
    ['pr-reviews', owner, repo, prNumber] as const,
  ]
}

// ---------------------------------------------------------------------------
// Query factory functions (reuse same keys as useGitHub.ts)
// ---------------------------------------------------------------------------

function makePRDetailQuery(owner: string, repo: string, prNumber: number) {
  return {
    queryKey: ['pr', owner, repo, prNumber] as const,
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPR(owner, repo, prNumber)
        }),
      ),
  }
}

function makePRFilesQuery(owner: string, repo: string, prNumber: number) {
  return {
    queryKey: ['pr-files', owner, repo, prNumber] as const,
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPRFiles(owner, repo, prNumber)
        }),
      ),
  }
}

function makePRCommentsQuery(owner: string, repo: string, prNumber: number) {
  return {
    queryKey: ['pr-comments', owner, repo, prNumber] as const,
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPRComments(owner, repo, prNumber)
        }),
      ),
  }
}

function makePRReviewsQuery(owner: string, repo: string, prNumber: number) {
  return {
    queryKey: ['pr-reviews', owner, repo, prNumber] as const,
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPRReviews(owner, repo, prNumber)
        }),
      ),
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Prefetch PR detail data when the cursor rests on a PR in the list.
 *
 * Populates the React Query cache so the detail view opens instantly.
 * Respects rate limits and cancels in-flight prefetches when the cursor moves.
 */
export function usePrefetch({
  items,
  selectedIndex,
  enabled,
  owner,
  repo,
  delayMs = DEFAULT_DELAY_MS,
  minRateLimit = DEFAULT_MIN_RATE_LIMIT,
}: UsePrefetchOptions): UsePrefetchResult {
  const queryClient = useQueryClient()
  const [prefetchedPR, setPrefetchedPR] = useState<number | null>(null)
  const [isPrefetching, setIsPrefetching] = useState(false)

  // Track prefetched PR numbers to avoid re-prefetching
  const prefetchedSetRef = useRef<ReadonlySet<number>>(new Set())

  const doPrefetch = useCallback(
    async (prNumber: number): Promise<void> => {
      if (!owner || !repo) return

      setIsPrefetching(true)

      try {
        await Promise.all([
          queryClient.prefetchQuery(makePRDetailQuery(owner, repo, prNumber)),
          queryClient.prefetchQuery(makePRFilesQuery(owner, repo, prNumber)),
          queryClient.prefetchQuery(makePRCommentsQuery(owner, repo, prNumber)),
          queryClient.prefetchQuery(makePRReviewsQuery(owner, repo, prNumber)),
        ])

        setPrefetchedPR(prNumber)
        prefetchedSetRef.current = new Set([...prefetchedSetRef.current, prNumber])
      } finally {
        setIsPrefetching(false)
      }
    },
    [queryClient, owner, repo],
  )

  useEffect(() => {
    const rateLimitRemaining = getRateLimitRemaining()

    const prNumber = shouldPrefetch({
      items,
      selectedIndex,
      enabled,
      owner,
      repo,
      minRateLimit,
      rateLimitRemaining,
      alreadyPrefetched: prefetchedSetRef.current,
    })

    if (prNumber === null) return

    const timerId = setTimeout(() => {
      // Re-check rate limit at fire time
      const currentRemaining = getRateLimitRemaining()
      if (currentRemaining < minRateLimit) return

      doPrefetch(prNumber)
    }, delayMs)

    return () => {
      clearTimeout(timerId)
    }
  }, [items, selectedIndex, enabled, owner, repo, delayMs, minRateLimit, doPrefetch])

  return { prefetchedPR, isPrefetching }
}
