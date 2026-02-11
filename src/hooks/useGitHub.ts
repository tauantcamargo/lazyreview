import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { GitHubApi, type ListPRsOptions } from '../services/GitHubApi'
import { AppLayer } from '../services/index'
import { useRefreshInterval } from './useRefreshInterval'

function runEffect<A>(
  effect: Effect.Effect<A, unknown, unknown>,
): Promise<A> {
  return Effect.runPromise(
    effect.pipe(Effect.provide(AppLayer)) as Effect.Effect<A, never, never>,
  )
}

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

export function useMyPRs() {
  const refetchInterval = useRefreshInterval()

  return useQuery({
    queryKey: ['my-prs'],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getMyPRs()
        }),
      ),
    refetchInterval,
  })
}

export function useReviewRequests() {
  const refetchInterval = useRefreshInterval()

  return useQuery({
    queryKey: ['review-requests'],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getReviewRequests()
        }),
      ),
    refetchInterval,
  })
}

export function useInvolvedPRs() {
  const refetchInterval = useRefreshInterval()

  return useQuery({
    queryKey: ['involved-prs'],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getInvolvedPRs()
        }),
      ),
    refetchInterval,
  })
}

export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'

interface SubmitReviewParams {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly body: string
  readonly event: ReviewEvent
}

export function useSubmitReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ owner, repo, prNumber, body, event }: SubmitReviewParams) =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          yield* api.submitReview(owner, repo, prNumber, body, event)
        }),
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['pr-reviews', variables.owner, variables.repo, variables.prNumber],
      })
      queryClient.invalidateQueries({
        queryKey: ['pr-comments', variables.owner, variables.repo, variables.prNumber],
      })
    },
  })
}

interface CreateCommentParams {
  readonly owner: string
  readonly repo: string
  readonly issueNumber: number
  readonly body: string
}

export function useCreateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ owner, repo, issueNumber, body }: CreateCommentParams) =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          yield* api.createComment(owner, repo, issueNumber, body)
        }),
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['pr-comments', variables.owner, variables.repo, variables.issueNumber],
      })
    },
  })
}

interface CreateReviewCommentParams {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly body: string
  readonly commitId: string
  readonly path: string
  readonly line: number
  readonly side: 'LEFT' | 'RIGHT'
}

export function useCreateReviewComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ owner, repo, prNumber, body, commitId, path, line, side }: CreateReviewCommentParams) =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          yield* api.createReviewComment(owner, repo, prNumber, body, commitId, path, line, side)
        }),
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['pr-comments', variables.owner, variables.repo, variables.prNumber],
      })
    },
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

export type MergeMethod = 'merge' | 'squash' | 'rebase'

interface MergePRParams {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly mergeMethod: MergeMethod
  readonly commitTitle?: string
  readonly commitMessage?: string
}

export function useMergePR() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ owner, repo, prNumber, mergeMethod, commitTitle, commitMessage }: MergePRParams) =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          yield* api.mergePullRequest(owner, repo, prNumber, mergeMethod, commitTitle, commitMessage)
        }),
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['pr', variables.owner, variables.repo, variables.prNumber],
      })
      queryClient.invalidateQueries({ queryKey: ['prs'] })
      queryClient.invalidateQueries({ queryKey: ['my-prs'] })
      queryClient.invalidateQueries({ queryKey: ['review-requests'] })
      queryClient.invalidateQueries({ queryKey: ['involved-prs'] })
    },
  })
}
