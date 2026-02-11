import { Context, Effect, Layer, Schema as S } from 'effect'
import { AuthError, GitHubError, NetworkError } from '../models/errors'
import { PullRequest } from '../models/pull-request'
import { Comment } from '../models/comment'
import { Review } from '../models/review'
import { FileChange } from '../models/file-change'
import { Auth } from './Auth'

const BASE_URL = 'https://api.github.com'

export interface ListPRsOptions {
  readonly state?: 'open' | 'closed' | 'all'
  readonly sort?: 'created' | 'updated' | 'popularity' | 'long-running'
  readonly direction?: 'asc' | 'desc'
  readonly perPage?: number
  readonly page?: number
}

type ApiError = GitHubError | NetworkError | AuthError

export interface GitHubApiService {
  readonly listPullRequests: (
    owner: string,
    repo: string,
    options?: ListPRsOptions,
  ) => Effect.Effect<readonly PullRequest[], ApiError>

  readonly getPullRequest: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<PullRequest, ApiError>

  readonly getPullRequestFiles: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<readonly FileChange[], ApiError>

  readonly getPullRequestComments: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<readonly Comment[], ApiError>

  readonly getPullRequestReviews: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<readonly Review[], ApiError>

  readonly getMyPRs: () => Effect.Effect<readonly PullRequest[], ApiError>

  readonly getReviewRequests: () => Effect.Effect<
    readonly PullRequest[],
    ApiError
  >
}

export class GitHubApi extends Context.Tag('GitHubApi')<
  GitHubApi,
  GitHubApiService
>() {}

function fetchGitHub<A, I>(
  path: string,
  token: string,
  schema: S.Schema<A, I>,
): Effect.Effect<A, GitHubError | NetworkError> {
  const url = `${BASE_URL}${path}`
  const decode = S.decodeUnknownSync(schema)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new GitHubError({
          message: `GitHub API error: ${response.status} ${response.statusText} - ${body}`,
          status: response.status,
          url,
        })
      }

      const data = await response.json()
      return decode(data)
    },
    catch: (error) => {
      if (error instanceof GitHubError) return error
      return new NetworkError({
        message: `Network request failed: ${String(error)}`,
        cause: error,
      })
    },
  })
}

function buildQueryString(options: ListPRsOptions): string {
  const params = new URLSearchParams()
  if (options.state) params.set('state', options.state)
  if (options.sort) params.set('sort', options.sort)
  if (options.direction) params.set('direction', options.direction)
  if (options.perPage) params.set('per_page', String(options.perPage))
  if (options.page) params.set('page', String(options.page))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const GitHubApiLive = Layer.effect(
  GitHubApi,
  Effect.gen(function* () {
    const auth = yield* Auth

    return GitHubApi.of({
      listPullRequests: (owner, repo, options = {}) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          const qs = buildQueryString(options)
          return yield* fetchGitHub(
            `/repos/${owner}/${repo}/pulls${qs}`,
            token,
            S.Array(PullRequest),
          )
        }),

      getPullRequest: (owner, repo, number) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHub(
            `/repos/${owner}/${repo}/pulls/${number}`,
            token,
            PullRequest,
          )
        }),

      getPullRequestFiles: (owner, repo, number) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHub(
            `/repos/${owner}/${repo}/pulls/${number}/files`,
            token,
            S.Array(FileChange),
          )
        }),

      getPullRequestComments: (owner, repo, number) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHub(
            `/repos/${owner}/${repo}/pulls/${number}/comments`,
            token,
            S.Array(Comment),
          )
        }),

      getPullRequestReviews: (owner, repo, number) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHub(
            `/repos/${owner}/${repo}/pulls/${number}/reviews`,
            token,
            S.Array(Review),
          )
        }),

      getMyPRs: () =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHub(
            '/user/issues?filter=created&state=open&pulls=true&per_page=30',
            token,
            S.Array(PullRequest),
          )
        }),

      getReviewRequests: () =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHub(
            '/user/issues?filter=review-requested&state=open&pulls=true&per_page=30',
            token,
            S.Array(PullRequest),
          )
        }),
    })
  }),
)
