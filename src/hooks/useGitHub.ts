import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { GitHubApi, type ListPRsOptions } from '../services/GitHubApi'
import { AppLayer } from '../services/index'

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
  })
}

export function usePullRequest(owner: string, repo: string, number: number) {
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
  })
}

export function usePRFiles(owner: string, repo: string, number: number) {
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
  })
}

export function usePRComments(owner: string, repo: string, number: number) {
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
  })
}

export function usePRReviews(owner: string, repo: string, number: number) {
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
  })
}

export function usePRCommits(owner: string, repo: string, number: number) {
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
  })
}

export function useMyPRs() {
  return useQuery({
    queryKey: ['my-prs'],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getMyPRs()
        }),
      ),
  })
}

export function useReviewRequests() {
  return useQuery({
    queryKey: ['review-requests'],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getReviewRequests()
        }),
      ),
  })
}

export function useInvolvedPRs() {
  return useQuery({
    queryKey: ['involved-prs'],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getInvolvedPRs()
        }),
      ),
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
  })
}

