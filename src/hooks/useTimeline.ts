import { useQuery } from '@tanstack/react-query'
import { Effect } from 'effect'
import { CodeReviewApi } from '../services/GitHubApi'
import { runEffect } from '../utils/effect'
import { useRefreshInterval } from './useRefreshInterval'

/**
 * React Query hook for fetching PR timeline events.
 *
 * Uses the CodeReviewApi.getTimeline method which returns a TimelineEvent[]
 * discriminated union (commit, review, comment, label-change, assignee-change,
 * status-check, force-push).
 *
 * Only fetches when owner, repo, and prNumber are all truthy and enabled is true.
 */
export function useTimeline(
  owner: string,
  repo: string,
  prNumber: number,
  options?: { readonly enabled?: boolean },
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['pr-timeline', owner, repo, prNumber],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          if (api.getTimeline) {
            return yield* api.getTimeline(owner, repo, prNumber)
          }
          return [] as const
        }),
      ),
    enabled: enabledFlag && !!owner && !!repo && !!prNumber,
    refetchInterval,
  })
}
