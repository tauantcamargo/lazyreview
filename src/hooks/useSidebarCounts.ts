import { useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore, useCallback, useRef, useEffect } from 'react'
import type { PullRequest } from '../models/pull-request'

export interface SidebarCounts {
  readonly involved: number | null
  readonly myPrs: number | null
  readonly forReview: number | null
  readonly forReviewUnread: number | null
  readonly thisRepo: number | null
  readonly browse: number | null
  readonly team: number | null
}

const EMPTY_COUNTS: SidebarCounts = {
  involved: null,
  myPrs: null,
  forReview: null,
  forReviewUnread: null,
  thisRepo: null,
  browse: null,
  team: null,
}

/** @internal Exported for testing */
export function extractCount(
  queryClient: ReturnType<typeof useQueryClient>,
  keyPrefix: string,
): number | null {
  const queries = queryClient.getQueriesData<readonly PullRequest[]>({
    queryKey: [keyPrefix],
    exact: false,
  })

  // Find the first query that has data (the active state filter)
  for (const [, data] of queries) {
    if (data !== undefined) {
      return data.length
    }
  }

  return null
}

/** @internal Exported for testing */
export function extractThisRepoCount(
  queryClient: ReturnType<typeof useQueryClient>,
): number | null {
  const queries = queryClient.getQueriesData<readonly PullRequest[]>({
    queryKey: ['prs'],
    exact: false,
  })

  for (const [, data] of queries) {
    if (data !== undefined) {
      return data.length
    }
  }

  return null
}

export function useSidebarCounts(
  isUnread: (htmlUrl: string, prUpdatedAt: string) => boolean,
): SidebarCounts {
  const queryClient = useQueryClient()
  const countsRef = useRef<SidebarCounts>(EMPTY_COUNTS)

  const computeCounts = useCallback((): SidebarCounts => {
    const involved = extractCount(queryClient, 'involved-prs')
    const myPrs = extractCount(queryClient, 'my-prs')
    const forReview = extractCount(queryClient, 'review-requests')
    const thisRepo = extractThisRepoCount(queryClient)

    // Count unread in for-review list
    let forReviewUnread: number | null = null
    if (forReview !== null) {
      const reviewQueries = queryClient.getQueriesData<readonly PullRequest[]>({
        queryKey: ['review-requests'],
        exact: false,
      })
      let unreadCount = 0
      for (const [, data] of reviewQueries) {
        if (data !== undefined) {
          for (const pr of data) {
            if (isUnread(pr.html_url, pr.updated_at)) {
              unreadCount++
            }
          }
          break
        }
      }
      forReviewUnread = unreadCount > 0 ? unreadCount : null
    }

    // Browse count comes from browse-prs query key
    const browse = extractCount(queryClient, 'browse-prs')

    // Team count comes from team-prs query key (if team dashboard has been loaded)
    const team = extractCount(queryClient, 'team-prs')

    return { involved, myPrs, forReview, forReviewUnread, thisRepo, browse, team }
  }, [queryClient, isUnread])

  // Subscribe to query cache changes
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const unsubscribe = queryClient.getQueryCache().subscribe(() => {
        const next = computeCounts()
        const prev = countsRef.current
        // Only notify if counts actually changed
        if (
          next.involved !== prev.involved ||
          next.myPrs !== prev.myPrs ||
          next.forReview !== prev.forReview ||
          next.forReviewUnread !== prev.forReviewUnread ||
          next.thisRepo !== prev.thisRepo ||
          next.browse !== prev.browse ||
          next.team !== prev.team
        ) {
          countsRef.current = next
          onStoreChange()
        }
      })
      return unsubscribe
    },
    [queryClient, computeCounts],
  )

  const getSnapshot = useCallback(() => {
    return countsRef.current
  }, [])

  // Initialize on mount
  useEffect(() => {
    countsRef.current = computeCounts()
  }, [computeCounts])

  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_COUNTS)
}
