import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Effect } from 'effect'
import { CodeReviewApi, type ListPRsOptions } from '../services/GitHubApi'
import { runEffect } from '../utils/effect'
import { useRefreshInterval } from './useRefreshInterval'
import {
  useSharedPRCache,
  crossPopulateFromInvolved,
  crossPopulateToInvolved,
} from './useSharedPRCache'

// Re-export mutations for backwards compatibility
export {
  useSubmitReview,
  useCreateComment,
  useCreateReviewComment,
  useResolveReviewThread,
  useUnresolveReviewThread,
  useReplyToReviewComment,
  useRequestReReview,
  useMergePR,
  useDeleteReviewComment,
  useCreatePendingReview,
  useAddPendingReviewComment,
  useSubmitPendingReview,
  useDiscardPendingReview,
  useClosePullRequest,
  useReopenPullRequest,
  useEditIssueComment,
  useEditReviewComment,
  useConvertToDraft,
  useMarkReadyForReview,
  useSetLabels,
  useUpdateAssignees,
} from './useGitHubMutations'
export type { ReviewEvent, MergeMethod } from './useGitHubMutations'

export function usePullRequests(
  owner: string,
  repo: string,
  options?: ListPRsOptions,
) {
  const refetchInterval = useRefreshInterval()

  return useQuery({
    queryKey: ['prs', owner, repo, options],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.listPRs(owner, repo, options)
        }),
      ),
    enabled: !!owner && !!repo,
    refetchInterval,
  })
}

export function usePullRequest(owner: string, repo: string, number: number) {
  const refetchInterval = useRefreshInterval(30)

  return useQuery({
    queryKey: ['pr', owner, repo, number],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPR(owner, repo, number)
        }),
      ),
    enabled: !!owner && !!repo && !!number,
    refetchInterval,
  })
}

export function usePRFiles(
  owner: string,
  repo: string,
  number: number,
  options?: { readonly enabled?: boolean },
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['pr-files', owner, repo, number],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPRFiles(owner, repo, number)
        }),
      ),
    enabled: enabledFlag && !!owner && !!repo && !!number,
    refetchInterval,
  })
}

export function usePRComments(
  owner: string,
  repo: string,
  number: number,
  options?: { readonly enabled?: boolean },
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['pr-comments', owner, repo, number],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPRComments(owner, repo, number)
        }),
      ),
    enabled: enabledFlag && !!owner && !!repo && !!number,
    refetchInterval,
  })
}

export function useIssueComments(
  owner: string,
  repo: string,
  issueNumber: number,
  options?: { readonly enabled?: boolean },
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['issue-comments', owner, repo, issueNumber],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getIssueComments(owner, repo, issueNumber)
        }),
      ),
    enabled: enabledFlag && !!owner && !!repo && !!issueNumber,
    refetchInterval,
  })
}

export function usePRReviews(
  owner: string,
  repo: string,
  number: number,
  options?: { readonly enabled?: boolean },
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['pr-reviews', owner, repo, number],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPRReviews(owner, repo, number)
        }),
      ),
    enabled: enabledFlag && !!owner && !!repo && !!number,
    refetchInterval,
  })
}

export function usePRCommits(
  owner: string,
  repo: string,
  number: number,
  options?: { readonly enabled?: boolean },
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['pr-commits', owner, repo, number],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPRCommits(owner, repo, number)
        }),
      ),
    enabled: enabledFlag && !!owner && !!repo && !!number,
    refetchInterval,
  })
}

export type PRStateFilter = 'open' | 'closed' | 'all'

export function useMyPRs(stateFilter: PRStateFilter = 'open') {
  const refetchInterval = useRefreshInterval()
  const queryClient = useQueryClient()
  const { myPRsPlaceholder } = useSharedPRCache(stateFilter)

  const query = useQuery({
    queryKey: ['my-prs', stateFilter],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getMyPRs(stateFilter)
        }),
      ),
    placeholderData: myPRsPlaceholder,
    refetchInterval,
  })

  // Cross-populate: after my-prs data arrives, try to populate involved cache
  useEffect(() => {
    if (query.data && query.isFetched) {
      crossPopulateToInvolved(queryClient, stateFilter)
    }
  }, [query.data, query.isFetched, queryClient, stateFilter])

  return query
}

export function useReviewRequests(stateFilter: PRStateFilter = 'open') {
  const refetchInterval = useRefreshInterval()
  const queryClient = useQueryClient()
  const { reviewRequestsPlaceholder } = useSharedPRCache(stateFilter)

  const query = useQuery({
    queryKey: ['review-requests', stateFilter],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getReviewRequests(stateFilter)
        }),
      ),
    placeholderData: reviewRequestsPlaceholder,
    refetchInterval,
  })

  // Cross-populate: after review-requests data arrives, try to populate involved cache
  useEffect(() => {
    if (query.data && query.isFetched) {
      crossPopulateToInvolved(queryClient, stateFilter)
    }
  }, [query.data, query.isFetched, queryClient, stateFilter])

  return query
}

export function useInvolvedPRs(stateFilter: PRStateFilter = 'open') {
  const refetchInterval = useRefreshInterval()
  const queryClient = useQueryClient()
  const { involvedPlaceholder, currentUserLogin } = useSharedPRCache(stateFilter)

  const query = useQuery({
    queryKey: ['involved-prs', stateFilter],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getInvolvedPRs(stateFilter)
        }),
      ),
    placeholderData: involvedPlaceholder,
    refetchInterval,
  })

  // Cross-populate: after involved data arrives, populate my-prs and review-requests caches
  useEffect(() => {
    if (query.data && query.isFetched && currentUserLogin) {
      crossPopulateFromInvolved(queryClient, stateFilter, query.data, currentUserLogin)
    }
  }, [query.data, query.isFetched, queryClient, stateFilter, currentUserLogin])

  return query
}

export function useReviewThreads(
  owner: string,
  repo: string,
  number: number,
  options?: { readonly enabled?: boolean },
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['pr-review-threads', owner, repo, number],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getReviewThreads(owner, repo, number)
        }),
      ),
    enabled: enabledFlag && !!owner && !!repo && !!number,
    refetchInterval,
  })
}

export function useCheckRuns(
  owner: string,
  repo: string,
  ref: string,
  options?: { readonly enabled?: boolean },
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['check-runs', owner, repo, ref],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPRChecks(owner, repo, ref)
        }),
      ),
    enabled: enabledFlag && !!owner && !!repo && !!ref,
    refetchInterval,
  })
}

export function useCommitDiff(
  owner: string,
  repo: string,
  sha: string,
  options?: { readonly enabled?: boolean },
) {
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['commit-diff', owner, repo, sha],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getCommitDiff(owner, repo, sha)
        }),
      ),
    enabled: enabledFlag && !!owner && !!repo && !!sha,
  })
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getCurrentUser()
        }),
      ),
    staleTime: Infinity,
  })
}

export function useRepoLabels(
  owner: string,
  repo: string,
  options?: { readonly enabled?: boolean },
) {
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['repo-labels', owner, repo],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getLabels(owner, repo)
        }),
      ),
    enabled: enabledFlag && !!owner && !!repo,
    staleTime: 5 * 60 * 1000, // 5 minutes - labels don't change often
  })
}

export function useCollaborators(
  owner: string,
  repo: string,
  options?: { readonly enabled?: boolean },
) {
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['collaborators', owner, repo],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getCollaborators(owner, repo)
        }),
      ),
    enabled: enabledFlag && !!owner && !!repo,
    staleTime: 5 * 60 * 1000, // 5 minutes - collaborators don't change often
  })
}

/**
 * Fetch a single page of PR files (metadata + patches).
 * Used for paginated loading when a PR has 300+ files.
 */
export function usePRFilesPage(
  owner: string,
  repo: string,
  number: number,
  page: number,
  options?: { readonly enabled?: boolean },
) {
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['pr-files-page', owner, repo, number, page],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPRFilesPage(owner, repo, number, page)
        }),
      ),
    enabled: enabledFlag && !!owner && !!repo && !!number && page >= 1,
    staleTime: 30 * 1000,
  })
}

/**
 * Fetch a single file's diff/patch on-demand.
 * Cached per file so revisiting a file doesn't re-fetch.
 */
export function useFileDiff(
  owner: string,
  repo: string,
  number: number,
  filename: string | null,
  options?: { readonly enabled?: boolean },
) {
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['file-diff', owner, repo, number, filename],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getFileDiff(owner, repo, number, filename!)
        }),
      ),
    enabled: enabledFlag && !!owner && !!repo && !!number && !!filename,
    staleTime: 60 * 1000, // 1 minute - file diffs don't change often during review
  })
}

/**
 * Fetch files changed between two commits (compare API).
 * Used for commit range selection in the Commits tab.
 */
export function useCompareFiles(
  owner: string,
  repo: string,
  base: string | null,
  head: string | null,
  options?: { readonly enabled?: boolean },
) {
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['compare-files', owner, repo, base, head],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          if (api.getCompareFiles) {
            return yield* api.getCompareFiles(owner, repo, base!, head!)
          }
          return [] as const
        }),
      ),
    enabled: enabledFlag && !!owner && !!repo && !!base && !!head,
    staleTime: 60 * 1000,
  })
}
