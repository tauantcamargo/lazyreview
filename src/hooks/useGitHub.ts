import { useQuery } from '@tanstack/react-query'
import { Effect } from 'effect'
import { GitHubApi, type ListPRsOptions } from '../services/GitHubApi'
import { AppLayer } from '../services/index'
import type { PullRequest } from '../models/pull-request'
import type { FileChange } from '../models/file-change'
import type { Comment } from '../models/comment'
import type { Review } from '../models/review'
import type { Commit } from '../models/commit'

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

// Legacy hook for backwards compatibility during migration
interface UseGitHubReturn {
  readonly prs: readonly PullRequest[]
  readonly loading: boolean
  readonly error: string | null
  readonly fetchPRs: (
    owner: string,
    repo: string,
    options?: ListPRsOptions,
  ) => void
  readonly fetchPR: (
    owner: string,
    repo: string,
    number: number,
  ) => Promise<PullRequest | null>
  readonly fetchFiles: (
    owner: string,
    repo: string,
    number: number,
  ) => Promise<readonly FileChange[]>
  readonly fetchComments: (
    owner: string,
    repo: string,
    number: number,
  ) => Promise<readonly Comment[]>
  readonly fetchReviews: (
    owner: string,
    repo: string,
    number: number,
  ) => Promise<readonly Review[]>
  readonly fetchMyPRs: () => void
  readonly fetchReviewRequests: () => void
}

export function useGitHub(): UseGitHubReturn {
  const { data: prs = [], isLoading, error } = usePullRequests('', '')

  return {
    prs,
    loading: isLoading,
    error: error ? String(error) : null,
    fetchPRs: (owner, repo, options) => {
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.listPullRequests(owner, repo, options)
        }),
      )
    },
    fetchPR: async (owner, repo, number) => {
      try {
        return await runEffect(
          Effect.gen(function* () {
            const api = yield* GitHubApi
            return yield* api.getPullRequest(owner, repo, number)
          }),
        )
      } catch {
        return null
      }
    },
    fetchFiles: async (owner, repo, number) => {
      try {
        return await runEffect(
          Effect.gen(function* () {
            const api = yield* GitHubApi
            return yield* api.getPullRequestFiles(owner, repo, number)
          }),
        )
      } catch {
        return []
      }
    },
    fetchComments: async (owner, repo, number) => {
      try {
        return await runEffect(
          Effect.gen(function* () {
            const api = yield* GitHubApi
            return yield* api.getPullRequestComments(owner, repo, number)
          }),
        )
      } catch {
        return []
      }
    },
    fetchReviews: async (owner, repo, number) => {
      try {
        return await runEffect(
          Effect.gen(function* () {
            const api = yield* GitHubApi
            return yield* api.getPullRequestReviews(owner, repo, number)
          }),
        )
      } catch {
        return []
      }
    },
    fetchMyPRs: () => {
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getMyPRs()
        }),
      )
    },
    fetchReviewRequests: () => {
      runEffect(
        Effect.gen(function* () {
          const api = yield* GitHubApi
          return yield* api.getReviewRequests()
        }),
      )
    },
  }
}
