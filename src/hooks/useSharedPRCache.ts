import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { PullRequest } from '../models/pull-request'
import { useCurrentUser } from './useGitHub'
import type { PRStateFilter } from './useGitHub'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum age (in ms) of cached data before we consider it too stale for
 * deriving subsets.  If the source query's `dataUpdatedAt` is older than
 * this threshold we skip placeholder derivation and let React Query refetch.
 */
export const CACHE_STALENESS_MS = 2 * 60 * 1000 // 2 minutes

// ---------------------------------------------------------------------------
// Query key helpers
// ---------------------------------------------------------------------------

const involvedKey = (stateFilter: PRStateFilter): readonly [string, PRStateFilter] => [
  'involved-prs',
  stateFilter,
]

const myPRsKey = (stateFilter: PRStateFilter): readonly [string, PRStateFilter] => [
  'my-prs',
  stateFilter,
]

const reviewRequestsKey = (stateFilter: PRStateFilter): readonly [string, PRStateFilter] => [
  'review-requests',
  stateFilter,
]

// ---------------------------------------------------------------------------
// Pure filter functions (exported for testing and reuse)
// ---------------------------------------------------------------------------

/**
 * Filter a list of PRs to those authored by `currentUserLogin`.
 * This mirrors what the API returns for `getMyPRs` (GitHub: `author:@me`).
 */
export function filterMyPRs(
  prs: readonly PullRequest[],
  currentUserLogin: string,
): readonly PullRequest[] {
  return prs.filter((pr) => pr.user.login === currentUserLogin)
}

/**
 * Filter a list of PRs to those where `currentUserLogin` is in the
 * `requested_reviewers` list. This mirrors what the API returns for
 * `getReviewRequests` (GitHub: `review-requested:@me`).
 */
export function filterReviewRequests(
  prs: readonly PullRequest[],
  currentUserLogin: string,
): readonly PullRequest[] {
  return prs.filter((pr) =>
    pr.requested_reviewers.some((reviewer) => reviewer.login === currentUserLogin),
  )
}

/**
 * Merge two PR lists into one, deduplicating by PR number.
 * Preserves the order of the first list, appending unique items from the second.
 */
function mergePRLists(
  a: readonly PullRequest[],
  b: readonly PullRequest[],
): readonly PullRequest[] {
  const seen = new Set(a.map((pr) => pr.number))
  const unique = b.filter((pr) => !seen.has(pr.number))
  return [...a, ...unique]
}

// ---------------------------------------------------------------------------
// Cache freshness check
// ---------------------------------------------------------------------------

function isCacheFresh(
  queryClient: QueryClient,
  key: readonly unknown[],
): boolean {
  const state = queryClient.getQueryState(key)
  if (!state || !state.dataUpdatedAt) return false
  return Date.now() - state.dataUpdatedAt < CACHE_STALENESS_MS
}

// ---------------------------------------------------------------------------
// deriveCacheData -- pure function for deriving placeholder data
// ---------------------------------------------------------------------------

export interface DerivedCacheData {
  /** Placeholder data for the my-prs query (derived from involved cache) */
  readonly myPRsPlaceholder: readonly PullRequest[] | undefined
  /** Placeholder data for the review-requests query (derived from involved cache) */
  readonly reviewRequestsPlaceholder: readonly PullRequest[] | undefined
  /** Placeholder data for the involved-prs query (merged from my-prs + review-requests) */
  readonly involvedPlaceholder: readonly PullRequest[] | undefined
}

/**
 * Derive placeholder cache data by checking existing React Query cache entries.
 *
 * Strategy:
 * 1. If `involved-prs` is cached and fresh, derive `my-prs` and `review-requests`
 *    from it by filtering on user.login and requested_reviewers.
 * 2. If both `my-prs` and `review-requests` are cached and fresh, merge them
 *    (deduped) as a placeholder for `involved-prs`.
 * 3. Individual subset caches cannot derive the other subset (my-prs cannot
 *    derive review-requests and vice versa).
 */
export function deriveCacheData(
  queryClient: QueryClient,
  stateFilter: PRStateFilter,
  currentUserLogin: string | undefined,
): DerivedCacheData {
  const empty: DerivedCacheData = {
    myPRsPlaceholder: undefined,
    reviewRequestsPlaceholder: undefined,
    involvedPlaceholder: undefined,
  }

  if (!currentUserLogin) return empty

  const iKey = involvedKey(stateFilter)
  const mKey = myPRsKey(stateFilter)
  const rKey = reviewRequestsKey(stateFilter)

  // -- Strategy 1: Derive subsets from the involved superset ----------------
  const involvedData = queryClient.getQueryData<readonly PullRequest[]>(iKey)
  if (involvedData && isCacheFresh(queryClient, iKey)) {
    return {
      myPRsPlaceholder: filterMyPRs(involvedData, currentUserLogin),
      reviewRequestsPlaceholder: filterReviewRequests(involvedData, currentUserLogin),
      involvedPlaceholder: undefined, // Already cached, no placeholder needed
    }
  }

  // -- Strategy 2: Merge subsets into an involved placeholder ---------------
  const myPRsData = queryClient.getQueryData<readonly PullRequest[]>(mKey)
  const reviewData = queryClient.getQueryData<readonly PullRequest[]>(rKey)

  if (
    myPRsData &&
    reviewData &&
    isCacheFresh(queryClient, mKey) &&
    isCacheFresh(queryClient, rKey)
  ) {
    return {
      myPRsPlaceholder: undefined, // Already cached
      reviewRequestsPlaceholder: undefined, // Already cached
      involvedPlaceholder: mergePRLists(myPRsData, reviewData),
    }
  }

  return empty
}

// ---------------------------------------------------------------------------
// crossPopulateCache -- populate sibling caches after a fetch completes
// ---------------------------------------------------------------------------

/**
 * After an involved-prs query returns data, populate the my-prs and
 * review-requests caches with derived subsets (only if they don't already
 * have fresh data).
 */
export function crossPopulateFromInvolved(
  queryClient: QueryClient,
  stateFilter: PRStateFilter,
  involvedData: readonly PullRequest[],
  currentUserLogin: string,
): void {
  const mKey = myPRsKey(stateFilter)
  const rKey = reviewRequestsKey(stateFilter)

  if (!isCacheFresh(queryClient, mKey)) {
    queryClient.setQueryData(mKey, filterMyPRs(involvedData, currentUserLogin))
  }

  if (!isCacheFresh(queryClient, rKey)) {
    queryClient.setQueryData(
      rKey,
      filterReviewRequests(involvedData, currentUserLogin),
    )
  }
}

/**
 * After a my-prs or review-requests query returns data, check if we can
 * merge with the other subset to populate the involved cache.
 */
export function crossPopulateToInvolved(
  queryClient: QueryClient,
  stateFilter: PRStateFilter,
): void {
  const iKey = involvedKey(stateFilter)
  const mKey = myPRsKey(stateFilter)
  const rKey = reviewRequestsKey(stateFilter)

  // Only populate involved if it's not already fresh
  if (isCacheFresh(queryClient, iKey)) return

  const myPRsData = queryClient.getQueryData<readonly PullRequest[]>(mKey)
  const reviewData = queryClient.getQueryData<readonly PullRequest[]>(rKey)

  if (myPRsData && reviewData && isCacheFresh(queryClient, mKey) && isCacheFresh(queryClient, rKey)) {
    queryClient.setQueryData(iKey, mergePRLists(myPRsData, reviewData))
  }
}

// ---------------------------------------------------------------------------
// useSharedPRCache hook
// ---------------------------------------------------------------------------

export interface SharedPRCache {
  /** Placeholder data for useMyPRs when involved cache is available */
  readonly myPRsPlaceholder: readonly PullRequest[] | undefined
  /** Placeholder data for useReviewRequests when involved cache is available */
  readonly reviewRequestsPlaceholder: readonly PullRequest[] | undefined
  /** Placeholder data for useInvolvedPRs when both subset caches are available */
  readonly involvedPlaceholder: readonly PullRequest[] | undefined
  /** Current user login for cross-population */
  readonly currentUserLogin: string | undefined
}

/**
 * Hook that provides intelligent cache sharing between the three user-scoped
 * PR queries (Involved, My PRs, For Review).
 *
 * Usage:
 * - Pass the returned placeholder data as `placeholderData` to the corresponding
 *   useQuery calls.
 * - After a query completes, call the appropriate cross-populate function.
 */
export function useSharedPRCache(stateFilter: PRStateFilter): SharedPRCache {
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()
  const currentUserLogin = currentUser?.login

  const derived = useMemo(
    () => deriveCacheData(queryClient, stateFilter, currentUserLogin),
    // We intentionally depend on the queryClient object identity rather than
    // its internal cache state.  The placeholder data is used as *initial*
    // data by React Query -- once the real query fires, it replaces it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateFilter, currentUserLogin],
  )

  return {
    ...derived,
    currentUserLogin,
  }
}
