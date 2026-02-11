import { Context, Effect, Layer, Schema as S } from 'effect'
import { AuthError, GitHubError, NetworkError } from '../models/errors'
import { PullRequest } from '../models/pull-request'
import { Comment } from '../models/comment'
import { Review } from '../models/review'
import { FileChange } from '../models/file-change'
import { Commit } from '../models/commit'
import { CheckRunsResponse } from '../models/check'
import { Auth } from './Auth'
import { updateRateLimit } from '../hooks/useRateLimit'
import { touchLastUpdated } from '../hooks/useLastUpdated'

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

  readonly getPullRequestCommits: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<readonly Commit[], ApiError>

  readonly getMyPRs: () => Effect.Effect<readonly PullRequest[], ApiError>

  readonly getReviewRequests: () => Effect.Effect<
    readonly PullRequest[],
    ApiError
  >

  readonly getInvolvedPRs: () => Effect.Effect<readonly PullRequest[], ApiError>

  readonly getCheckRuns: (
    owner: string,
    repo: string,
    ref: string,
  ) => Effect.Effect<CheckRunsResponse, ApiError>

  readonly submitReview: (
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
  ) => Effect.Effect<void, ApiError>

  readonly createComment: (
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ) => Effect.Effect<void, ApiError>

  readonly createReviewComment: (
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    commitId: string,
    path: string,
    line: number,
    side: 'LEFT' | 'RIGHT',
    startLine?: number,
    startSide?: 'LEFT' | 'RIGHT',
  ) => Effect.Effect<void, ApiError>

  readonly getReviewThreads: (
    owner: string,
    repo: string,
    prNumber: number,
  ) => Effect.Effect<readonly ReviewThread[], ApiError>

  readonly resolveReviewThread: (
    threadId: string,
  ) => Effect.Effect<void, ApiError>

  readonly unresolveReviewThread: (
    threadId: string,
  ) => Effect.Effect<void, ApiError>

  readonly replyToReviewComment: (
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    inReplyTo: number,
  ) => Effect.Effect<void, ApiError>

  readonly requestReReview: (
    owner: string,
    repo: string,
    prNumber: number,
    reviewers: readonly string[],
  ) => Effect.Effect<void, ApiError>

  readonly mergePullRequest: (
    owner: string,
    repo: string,
    prNumber: number,
    mergeMethod: 'merge' | 'squash' | 'rebase',
    commitTitle?: string,
    commitMessage?: string,
  ) => Effect.Effect<void, ApiError>
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

      updateRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new GitHubError({
          message: `GitHub API error: ${response.status} ${response.statusText} - ${body}`,
          status: response.status,
          url,
        })
      }

      const data = await response.json()
      touchLastUpdated()
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

function mutateGitHub(
  method: 'POST' | 'PUT',
  path: string,
  token: string,
  body: Record<string, unknown>,
): Effect.Effect<void, GitHubError | NetworkError> {
  const url = `${BASE_URL}${path}`

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(body),
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '')
        throw new GitHubError({
          message: `GitHub API error: ${response.status} ${response.statusText} - ${responseBody}`,
          status: response.status,
          url,
        })
      }

      touchLastUpdated()
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

function graphqlGitHub<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Effect.Effect<T, GitHubError | NetworkError> {
  const url = 'https://api.github.com/graphql'

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ query, variables }),
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '')
        throw new GitHubError({
          message: `GitHub GraphQL error: ${response.status} ${response.statusText} - ${responseBody}`,
          status: response.status,
          url,
        })
      }

      const data = await response.json()
      if (data.errors) {
        throw new GitHubError({
          message: `GitHub GraphQL error: ${JSON.stringify(data.errors)}`,
          status: 200,
          url,
        })
      }

      touchLastUpdated()
      return data.data as T
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

export interface ReviewThread {
  readonly id: string
  readonly isResolved: boolean
  readonly comments: readonly { readonly databaseId: number }[]
}

// Schema for GitHub Search API response
const SearchResultSchema = S.Struct({
  total_count: S.Number,
  incomplete_results: S.Boolean,
  items: S.Array(PullRequest),
})

function fetchGitHubSearch(
  query: string,
  token: string,
): Effect.Effect<readonly PullRequest[], GitHubError | NetworkError> {
  const url = `${BASE_URL}/search/issues?q=${encodeURIComponent(query)}&per_page=100`
  const decode = S.decodeUnknownSync(SearchResultSchema)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new GitHubError({
          message: `GitHub API error: ${response.status} ${response.statusText} - ${body}`,
          status: response.status,
          url,
        })
      }

      const data = await response.json()
      touchLastUpdated()
      const result = decode(data)
      return result.items
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
          const mergedOptions = { ...options, perPage: options.perPage ?? 100 }
          const qs = buildQueryString(mergedOptions)
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

      getPullRequestCommits: (owner, repo, number) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHub(
            `/repos/${owner}/${repo}/pulls/${number}/commits`,
            token,
            S.Array(Commit),
          )
        }),

      getMyPRs: () =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHubSearch('is:pr is:open author:@me', token)
        }),

      getReviewRequests: () =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHubSearch(
            'is:pr is:open review-requested:@me',
            token,
          )
        }),

      getInvolvedPRs: () =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHubSearch('is:pr is:open involves:@me', token)
        }),

      getCheckRuns: (owner, repo, ref) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHub(
            `/repos/${owner}/${repo}/commits/${ref}/check-runs`,
            token,
            CheckRunsResponse,
          )
        }),

      submitReview: (owner, repo, prNumber, body, event) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'POST',
            `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
            token,
            { body, event },
          )
        }),

      createComment: (owner, repo, issueNumber, body) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'POST',
            `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
            token,
            { body },
          )
        }),

      createReviewComment: (owner, repo, prNumber, body, commitId, path, line, side, startLine, startSide) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'POST',
            `/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
            token,
            {
              body,
              commit_id: commitId,
              path,
              line,
              side,
              ...(startLine != null ? { start_line: startLine, start_side: startSide ?? side } : {}),
            },
          )
        }),

      getReviewThreads: (owner, repo, prNumber) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          const query = `
            query($owner: String!, $repo: String!, $prNumber: Int!) {
              repository(owner: $owner, name: $repo) {
                pullRequest(number: $prNumber) {
                  reviewThreads(first: 100) {
                    nodes {
                      id
                      isResolved
                      comments(first: 1) {
                        nodes {
                          databaseId
                        }
                      }
                    }
                  }
                }
              }
            }
          `
          interface ThreadsResponse {
            repository: {
              pullRequest: {
                reviewThreads: {
                  nodes: {
                    id: string
                    isResolved: boolean
                    comments: {
                      nodes: { databaseId: number }[]
                    }
                  }[]
                }
              }
            }
          }
          const data = yield* graphqlGitHub<ThreadsResponse>(
            token,
            query,
            { owner, repo, prNumber },
          )
          const nodes = data?.repository?.pullRequest?.reviewThreads?.nodes
          if (!nodes) {
            return []
          }
          return nodes.map(
            (thread) => ({
              id: thread.id,
              isResolved: thread.isResolved,
              comments: thread.comments.nodes.map((c) => ({
                databaseId: c.databaseId,
              })),
            }),
          )
        }),

      resolveReviewThread: (threadId) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* graphqlGitHub<unknown>(
            token,
            `mutation($threadId: ID!) {
              resolveReviewThread(input: { threadId: $threadId }) {
                thread { isResolved }
              }
            }`,
            { threadId },
          )
        }),

      unresolveReviewThread: (threadId) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* graphqlGitHub<unknown>(
            token,
            `mutation($threadId: ID!) {
              unresolveReviewThread(input: { threadId: $threadId }) {
                thread { isResolved }
              }
            }`,
            { threadId },
          )
        }),

      replyToReviewComment: (owner, repo, prNumber, body, inReplyTo) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'POST',
            `/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
            token,
            { body, in_reply_to: inReplyTo },
          )
        }),

      requestReReview: (owner, repo, prNumber, reviewers) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'POST',
            `/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`,
            token,
            { reviewers: [...reviewers] },
          )
        }),

      mergePullRequest: (owner, repo, prNumber, mergeMethod, commitTitle, commitMessage) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'PUT',
            `/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
            token,
            {
              merge_method: mergeMethod,
              ...(commitTitle !== undefined ? { commit_title: commitTitle } : {}),
              ...(commitMessage !== undefined ? { commit_message: commitMessage } : {}),
            },
          )
        }),
    })
  }),
)
