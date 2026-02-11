import { Effect, Layer, Schema as S } from 'effect'
import { PullRequest } from '../models/pull-request'
import { Comment } from '../models/comment'
import { Review } from '../models/review'
import { FileChange } from '../models/file-change'
import { Commit } from '../models/commit'
import { CheckRunsResponse } from '../models/check'
import { Auth } from './Auth'
import { GitHubApi } from './GitHubApiTypes'
import {
  fetchGitHub,
  mutateGitHub,
  mutateGitHubJson,
  graphqlGitHub,
  fetchGitHubSearch,
  buildQueryString,
} from './GitHubApiHelpers'

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
