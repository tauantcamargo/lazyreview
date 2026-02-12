import { Effect, Layer, Schema as S } from 'effect'
import { PullRequest } from '../models/pull-request'
import { Comment } from '../models/comment'
import { IssueComment } from '../models/issue-comment'
import { Review } from '../models/review'
import { FileChange } from '../models/file-change'
import { Commit } from '../models/commit'
import { CheckRunsResponse } from '../models/check'
import { Auth } from './Auth'
import { CodeReviewApi } from './CodeReviewApiTypes'
import {
  fetchGitHub,
  fetchGitHubPaginated,
  mutateGitHub,
  mutateGitHubJson,
  graphqlGitHub,
  fetchGitHubSearchPaginated,
  buildQueryString,
} from './GitHubApiHelpers'

function buildStateQualifier(stateFilter: 'open' | 'closed' | 'all' = 'open'): string {
  switch (stateFilter) {
    case 'open':
      return 'is:open'
    case 'closed':
      return 'is:closed'
    case 'all':
      return ''
  }
}

export const GitHubApiLive = Layer.effect(
  CodeReviewApi,
  Effect.gen(function* () {
    const auth = yield* Auth

    return CodeReviewApi.of({
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
          return yield* fetchGitHubPaginated(
            `/repos/${owner}/${repo}/pulls/${number}/files`,
            token,
            FileChange,
          )
        }),

      getPullRequestComments: (owner, repo, number) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHubPaginated(
            `/repos/${owner}/${repo}/pulls/${number}/comments`,
            token,
            Comment,
          )
        }),

      getIssueComments: (owner, repo, issueNumber) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHubPaginated(
            `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
            token,
            IssueComment,
          )
        }),

      getPullRequestReviews: (owner, repo, number) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHubPaginated(
            `/repos/${owner}/${repo}/pulls/${number}/reviews`,
            token,
            Review,
          )
        }),

      getPullRequestCommits: (owner, repo, number) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHubPaginated(
            `/repos/${owner}/${repo}/pulls/${number}/commits`,
            token,
            Commit,
          )
        }),

      getMyPRs: (stateFilter = 'open') =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          const stateQ = buildStateQualifier(stateFilter)
          const query = `is:pr ${stateQ} author:@me`.replace(/\s+/g, ' ').trim()
          return yield* fetchGitHubSearchPaginated(query, token)
        }),

      getReviewRequests: (stateFilter = 'open') =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          const stateQ = buildStateQualifier(stateFilter)
          const query = `is:pr ${stateQ} review-requested:@me`.replace(/\s+/g, ' ').trim()
          return yield* fetchGitHubSearchPaginated(query, token)
        }),

      getInvolvedPRs: (stateFilter = 'open') =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          const stateQ = buildStateQualifier(stateFilter)
          const query = `is:pr ${stateQ} involves:@me`.replace(/\s+/g, ' ').trim()
          return yield* fetchGitHubSearchPaginated(query, token)
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
          const gqlQuery = `
            query($owner: String!, $repo: String!, $prNumber: Int!, $cursor: String) {
              repository(owner: $owner, name: $repo) {
                pullRequest(number: $prNumber) {
                  reviewThreads(first: 100, after: $cursor) {
                    pageInfo {
                      hasNextPage
                      endCursor
                    }
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
                  pageInfo: {
                    hasNextPage: boolean
                    endCursor: string | null
                  }
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

          type ThreadNode = ThreadsResponse['repository']['pullRequest']['reviewThreads']['nodes'][number]
          const allNodes: ThreadNode[] = []
          let cursor: string | null = null
          let hasNextPage = true

          while (hasNextPage) {
            const data: ThreadsResponse = yield* graphqlGitHub<ThreadsResponse>(
              token,
              gqlQuery,
              { owner, repo, prNumber, cursor },
            )
            const threads: ThreadsResponse['repository']['pullRequest']['reviewThreads'] | undefined =
              data?.repository?.pullRequest?.reviewThreads
            if (!threads?.nodes) {
              break
            }
            allNodes.push(...threads.nodes)
            hasNextPage = threads.pageInfo.hasNextPage
            cursor = threads.pageInfo.endCursor
          }

          return allNodes.map(
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

      deleteReviewComment: (owner, repo, commentId) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'DELETE',
            `/repos/${owner}/${repo}/pulls/comments/${commentId}`,
            token,
            {},
          )
        }),

      createPendingReview: (owner, repo, prNumber) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          const result = yield* mutateGitHubJson<{ id: number }>(
            'POST',
            `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
            token,
            {},
          )
          return { id: result.id }
        }),

      addPendingReviewComment: (owner, repo, prNumber, reviewId, body, path, line, side, startLine, startSide) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'POST',
            `/repos/${owner}/${repo}/pulls/${prNumber}/reviews/${reviewId}/comments`,
            token,
            {
              body,
              path,
              line,
              side,
              ...(startLine != null ? { start_line: startLine, start_side: startSide ?? side } : {}),
            },
          )
        }),

      submitPendingReview: (owner, repo, prNumber, reviewId, body, event) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'POST',
            `/repos/${owner}/${repo}/pulls/${prNumber}/reviews/${reviewId}/events`,
            token,
            { body, event },
          )
        }),

      discardPendingReview: (owner, repo, prNumber, reviewId) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'DELETE',
            `/repos/${owner}/${repo}/pulls/${prNumber}/reviews/${reviewId}`,
            token,
            {},
          )
        }),

      closePullRequest: (owner, repo, prNumber) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'PATCH',
            `/repos/${owner}/${repo}/pulls/${prNumber}`,
            token,
            { state: 'closed' },
          )
        }),

      reopenPullRequest: (owner, repo, prNumber) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'PATCH',
            `/repos/${owner}/${repo}/pulls/${prNumber}`,
            token,
            { state: 'open' },
          )
        }),

      editIssueComment: (owner, repo, commentId, body) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'PATCH',
            `/repos/${owner}/${repo}/issues/comments/${commentId}`,
            token,
            { body },
          )
        }),

      editReviewComment: (owner, repo, commentId, body) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'PATCH',
            `/repos/${owner}/${repo}/pulls/comments/${commentId}`,
            token,
            { body },
          )
        }),

      updatePRDescription: (owner, repo, prNumber, body) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'PATCH',
            `/repos/${owner}/${repo}/pulls/${prNumber}`,
            token,
            { body },
          )
        }),

      getCurrentUser: () =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          return yield* fetchGitHub(
            '/user',
            token,
            S.Struct({ login: S.String }),
          )
        }),
    })
  }),
)
