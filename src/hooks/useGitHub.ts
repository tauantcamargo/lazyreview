import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { Effect } from 'effect'
import type { ListPRsOptions } from '../services/GitHubApi'
import { runEffect } from '../utils/effect'
import { runProviderEffect } from '../utils/providerEffect'
import { CodeReviewApi } from '../services/GitHubApi'
import { useRefreshInterval } from './useRefreshInterval'
import {
  useSharedPRCache,
  crossPopulateFromInvolved,
  crossPopulateToInvolved,
  mergePRLists,
} from './useSharedPRCache'
import { useBitbucketPRs } from './useBitbucketPRs'
import type { BitbucketScope } from './useBitbucketPRs'
import type { PullRequest } from '../models/pull-request'

/**
 * Merges a GitHub-sourced PR list with Bitbucket's (see useBitbucketPRs --
 * a no-op when Bitbucket isn't enabled or has no matching PRs).
 */
function useMergedWithBitbucket(
  githubData: readonly PullRequest[] | undefined,
  scope: BitbucketScope,
  stateFilter: PRStateFilter,
): {
  readonly data: readonly PullRequest[] | undefined
  readonly bitbucketAuthError: boolean
} {
  const bitbucket = useBitbucketPRs(scope, stateFilter)
  const data = useMemo(() => {
    if (!githubData) return githubData
    if (!bitbucket.data || bitbucket.data.prs.length === 0) return githubData
    return mergePRLists(githubData, bitbucket.data.prs)
  }, [githubData, bitbucket.data])
  return { data, bitbucketAuthError: bitbucket.data?.authError ?? false }
}

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
  provider?: string,
) {
  const refetchInterval = useRefreshInterval()

  return useQuery({
    queryKey: ['prs', owner, repo, options, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) => api.listPRs(owner, repo, options)),
    enabled: !!owner && !!repo,
    refetchInterval,
  })
}

export function usePullRequest(
  owner: string,
  repo: string,
  number: number,
  provider?: string,
) {
  const refetchInterval = useRefreshInterval(30)

  return useQuery({
    queryKey: ['pr', owner, repo, number, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) => api.getPR(owner, repo, number)),
    enabled: !!owner && !!repo && !!number,
    refetchInterval,
  })
}

export function usePRFiles(
  owner: string,
  repo: string,
  number: number,
  options?: { readonly enabled?: boolean },
  provider?: string,
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['pr-files', owner, repo, number, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) => api.getPRFiles(owner, repo, number)),
    enabled: enabledFlag && !!owner && !!repo && !!number,
    refetchInterval,
  })
}

export function usePRComments(
  owner: string,
  repo: string,
  number: number,
  options?: { readonly enabled?: boolean },
  provider?: string,
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['pr-comments', owner, repo, number, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) =>
        api.getPRComments(owner, repo, number),
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
  provider?: string,
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['issue-comments', owner, repo, issueNumber, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) =>
        api.getIssueComments(owner, repo, issueNumber),
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
  provider?: string,
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['pr-reviews', owner, repo, number, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) =>
        api.getPRReviews(owner, repo, number),
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
  provider?: string,
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['pr-commits', owner, repo, number, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) =>
        api.getPRCommits(owner, repo, number),
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

  const { data, bitbucketAuthError } = useMergedWithBitbucket(
    query.data,
    'my',
    stateFilter,
  )

  return { ...query, data, bitbucketAuthError }
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

  const { data, bitbucketAuthError } = useMergedWithBitbucket(
    query.data,
    'review-requested',
    stateFilter,
  )

  return { ...query, data, bitbucketAuthError }
}

export function useInvolvedPRs(stateFilter: PRStateFilter = 'open') {
  const refetchInterval = useRefreshInterval()
  const queryClient = useQueryClient()
  const { involvedPlaceholder, currentUserLogin } =
    useSharedPRCache(stateFilter)

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
      crossPopulateFromInvolved(
        queryClient,
        stateFilter,
        query.data,
        currentUserLogin,
      )
    }
  }, [query.data, query.isFetched, queryClient, stateFilter, currentUserLogin])

  const { data, bitbucketAuthError } = useMergedWithBitbucket(
    query.data,
    'involved',
    stateFilter,
  )

  return { ...query, data, bitbucketAuthError }
}

export function useReviewThreads(
  owner: string,
  repo: string,
  number: number,
  options?: { readonly enabled?: boolean },
  provider?: string,
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['pr-review-threads', owner, repo, number, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) =>
        api.getReviewThreads(owner, repo, number),
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
  provider?: string,
) {
  const refetchInterval = useRefreshInterval(30)
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['check-runs', owner, repo, ref, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) => api.getPRChecks(owner, repo, ref)),
    enabled: enabledFlag && !!owner && !!repo && !!ref,
    refetchInterval,
  })
}

export function useCommitDiff(
  owner: string,
  repo: string,
  sha: string,
  options?: { readonly enabled?: boolean },
  provider?: string,
) {
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['commit-diff', owner, repo, sha, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) => api.getCommitDiff(owner, repo, sha)),
    enabled: enabledFlag && !!owner && !!repo && !!sha,
  })
}

export function useCurrentUser(provider?: string) {
  return useQuery({
    queryKey: ['current-user', provider],
    queryFn: () => runProviderEffect(provider, (api) => api.getCurrentUser()),
    staleTime: Infinity,
  })
}

export function useRepoLabels(
  owner: string,
  repo: string,
  options?: { readonly enabled?: boolean },
  provider?: string,
) {
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['repo-labels', owner, repo, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) => api.getLabels(owner, repo)),
    enabled: enabledFlag && !!owner && !!repo,
    staleTime: 5 * 60 * 1000, // 5 minutes - labels don't change often
  })
}

export function useCollaborators(
  owner: string,
  repo: string,
  options?: { readonly enabled?: boolean },
  provider?: string,
) {
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['collaborators', owner, repo, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) => api.getCollaborators(owner, repo)),
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
  provider?: string,
) {
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['pr-files-page', owner, repo, number, page, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) =>
        api.getPRFilesPage(owner, repo, number, page),
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
  provider?: string,
) {
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['file-diff', owner, repo, number, filename, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) =>
        api.getFileDiff(owner, repo, number, filename!),
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
  provider?: string,
) {
  const enabledFlag = options?.enabled ?? true

  return useQuery({
    queryKey: ['compare-files', owner, repo, base, head, provider],
    queryFn: () =>
      runProviderEffect(provider, (api) => {
        if (api.getCompareFiles) {
          return api.getCompareFiles(owner, repo, base!, head!)
        }
        return Effect.succeed([] as const)
      }),
    enabled: enabledFlag && !!owner && !!repo && !!base && !!head,
    staleTime: 60 * 1000,
  })
}
