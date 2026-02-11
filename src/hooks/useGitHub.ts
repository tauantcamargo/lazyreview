import { useQuery } from '@tanstack/react-query'
import { Effect } from 'effect'
import { GitHubApi, type ListPRsOptions } from '../services/GitHubApi'
import { runEffect } from '../utils/effect'
import { useRefreshInterval } from './useRefreshInterval'

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
          const api = yield* GitHubApi
          return yield* api.listPullRequests(owner, repo, options)
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
          const api = yield* GitHubApi
          return yield* api.getPullRequest(owner, repo, number)
        }),
      ),
    enabled: !!owner && !!repo && !!number,
    refetchInterval,
  })
}

export function usePRFiles(owner: string, repo: string, number: number) {
  const refetchInterval = useRefreshInterval(30)

  return useQuery({
    queryKey: ['pr-files', owner, repo, number],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getPullRequestFiles(owner, repo, number)
        }),
      ),
    enabled: !!owner && !!repo && !!number,
    refetchInterval,
  })
}

export function usePRComments(owner: string, repo: string, number: number) {
  const refetchInterval = useRefreshInterval(30)

  return useQuery({
    queryKey: ['pr-comments', owner, repo, number],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getPullRequestComments(owner, repo, number)
        }),
      ),
    enabled: !!owner && !!repo && !!number,
    refetchInterval,
  })
}

export function useIssueComments(owner: string, repo: string, issueNumber: number) {
  const refetchInterval = useRefreshInterval(30)

  return useQuery({
    queryKey: ['issue-comments', owner, repo, issueNumber],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getIssueComments(owner, repo, issueNumber)
        }),
      ),
    enabled: !!owner && !!repo && !!issueNumber,
    refetchInterval,
  })
}

export function usePRReviews(owner: string, repo: string, number: number) {
  const refetchInterval = useRefreshInterval(30)

  return useQuery({
    queryKey: ['pr-reviews', owner, repo, number],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getPullRequestReviews(owner, repo, number)
        }),
      ),
    enabled: !!owner && !!repo && !!number,
    refetchInterval,
  })
}

export function usePRCommits(owner: string, repo: string, number: number) {
  const refetchInterval = useRefreshInterval(30)

  return useQuery({
    queryKey: ['pr-commits', owner, repo, number],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getPullRequestCommits(owner, repo, number)
        }),
      ),
    enabled: !!owner && !!repo && !!number,
    refetchInterval,
  })
}

export type PRStateFilter = 'open' | 'closed' | 'all'

export function useMyPRs(stateFilter: PRStateFilter = 'open') {
  const refetchInterval = useRefreshInterval()

  return useQuery({
    queryKey: ['my-prs', stateFilter],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getMyPRs(stateFilter)
        }),
      ),
    refetchInterval,
  })
}

export function useReviewRequests(stateFilter: PRStateFilter = 'open') {
  const refetchInterval = useRefreshInterval()

  return useQuery({
    queryKey: ['review-requests', stateFilter],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getReviewRequests(stateFilter)
        }),
      ),
    refetchInterval,
  })
}

export function useInvolvedPRs(stateFilter: PRStateFilter = 'open') {
  const refetchInterval = useRefreshInterval()

  return useQuery({
    queryKey: ['involved-prs', stateFilter],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getInvolvedPRs(stateFilter)
        }),
      ),
    refetchInterval,
  })
}

export function useReviewThreads(owner: string, repo: string, number: number) {
  const refetchInterval = useRefreshInterval(30)

  return useQuery({
    queryKey: ['pr-review-threads', owner, repo, number],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getReviewThreads(owner, repo, number)
        }),
      ),
    enabled: !!owner && !!repo && !!number,
    refetchInterval,
  })
}

export function useCheckRuns(owner: string, repo: string, ref: string) {
  const refetchInterval = useRefreshInterval(30)

  return useQuery({
    queryKey: ['check-runs', owner, repo, ref],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getCheckRuns(owner, repo, ref)
        }),
      ),
    enabled: !!owner && !!repo && !!ref,
    refetchInterval,
  })
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getCurrentUser()
        }),
      ),
    staleTime: Infinity,
  })
}
