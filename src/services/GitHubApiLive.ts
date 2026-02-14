import { Effect, Layer, Schema as S } from 'effect'
import { PullRequest } from '../models/pull-request'
import { Comment } from '../models/comment'
import { IssueComment } from '../models/issue-comment'
import { Review } from '../models/review'
import { FileChange } from '../models/file-change'
import { Commit } from '../models/commit'
import { CheckRunsResponse } from '../models/check'
import { User } from '../models/user'
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
import { validateOwner, validateRepo, validateNumber, validateRef } from '../utils/sanitize'

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
      listPRs: (owner, repo, options = {}) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          const token = yield* auth.getToken()
          const mergedOptions = { ...options, perPage: options.perPage ?? 100 }
          const qs = buildQueryString(mergedOptions)
          return yield* fetchGitHub(
            `/repos/${owner}/${repo}/pulls${qs}`,
            token,
            S.Array(PullRequest),
          )
        }),

      getPR: (owner, repo, number) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(number)
          const token = yield* auth.getToken()
          return yield* fetchGitHub(
            `/repos/${owner}/${repo}/pulls/${number}`,
            token,
            PullRequest,
          )
        }),

      getPRFiles: (owner, repo, number) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(number)
          const token = yield* auth.getToken()
          return yield* fetchGitHubPaginated(
            `/repos/${owner}/${repo}/pulls/${number}/files`,
            token,
            FileChange,
          )
        }),

      getPRComments: (owner, repo, number) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(number)
          const token = yield* auth.getToken()
          return yield* fetchGitHubPaginated(
            `/repos/${owner}/${repo}/pulls/${number}/comments`,
            token,
            Comment,
          )
        }),

      getIssueComments: (owner, repo, issueNumber) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(issueNumber)
          const token = yield* auth.getToken()
          return yield* fetchGitHubPaginated(
            `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
            token,
            IssueComment,
          )
        }),

      getPRReviews: (owner, repo, number) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(number)
          const token = yield* auth.getToken()
          return yield* fetchGitHubPaginated(
            `/repos/${owner}/${repo}/pulls/${number}/reviews`,
            token,
            Review,
          )
        }),

      getPRCommits: (owner, repo, number) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(number)
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

      getPRChecks: (owner, repo, ref) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateRef(ref)
          const token = yield* auth.getToken()
          return yield* fetchGitHub(
            `/repos/${owner}/${repo}/commits/${ref}/check-runs`,
            token,
            CheckRunsResponse,
          )
        }),

      submitReview: (owner, repo, prNumber, body, event) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'POST',
            `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
            token,
            { body, event },
          )
        }),

      addComment: (owner, repo, issueNumber, body) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(issueNumber)
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'POST',
            `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
            token,
            { body },
          )
        }),

      addDiffComment: (owner, repo, prNumber, body, commitId, path, line, side, startLine, startSide) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
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
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
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

      resolveThread: (threadId) =>
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

      unresolveThread: (threadId) =>
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

      replyToComment: (owner, repo, prNumber, body, inReplyTo) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
          validateNumber(inReplyTo)
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
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'POST',
            `/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`,
            token,
            { reviewers: [...reviewers] },
          )
        }),

      mergePR: (owner, repo, prNumber, mergeMethod, commitTitle, commitMessage) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
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
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(commentId)
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
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
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
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
          validateNumber(reviewId)
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
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
          validateNumber(reviewId)
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
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
          validateNumber(reviewId)
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'DELETE',
            `/repos/${owner}/${repo}/pulls/${prNumber}/reviews/${reviewId}`,
            token,
            {},
          )
        }),

      closePR: (owner, repo, prNumber) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'PATCH',
            `/repos/${owner}/${repo}/pulls/${prNumber}`,
            token,
            { state: 'closed' },
          )
        }),

      reopenPR: (owner, repo, prNumber) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
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
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(commentId)
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
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(commentId)
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'PATCH',
            `/repos/${owner}/${repo}/pulls/comments/${commentId}`,
            token,
            { body },
          )
        }),

      updatePRBody: (owner, repo, prNumber, body) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'PATCH',
            `/repos/${owner}/${repo}/pulls/${prNumber}`,
            token,
            { body },
          )
        }),

      updatePRTitle: (owner, repo, prNumber, title) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'PATCH',
            `/repos/${owner}/${repo}/pulls/${prNumber}`,
            token,
            { title },
          )
        }),

      getCommitDiff: (owner, repo, sha) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateRef(sha)
          const token = yield* auth.getToken()
          const CommitDetailSchema = S.Struct({
            files: S.optionalWith(S.Array(FileChange), { default: () => [] }),
          })
          const result = yield* fetchGitHub(
            `/repos/${owner}/${repo}/commits/${sha}`,
            token,
            CommitDetailSchema,
          )
          return result.files
        }),

      convertToDraft: (nodeId) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* graphqlGitHub<unknown>(
            token,
            `mutation($pullRequestId: ID!) {
              convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
                pullRequest { isDraft }
              }
            }`,
            { pullRequestId: nodeId },
          )
        }),

      markReadyForReview: (nodeId) =>
        Effect.gen(function* () {
          const token = yield* auth.getToken()
          yield* graphqlGitHub<unknown>(
            token,
            `mutation($pullRequestId: ID!) {
              markPullRequestAsReady(input: { pullRequestId: $pullRequestId }) {
                pullRequest { isDraft }
              }
            }`,
            { pullRequestId: nodeId },
          )
        }),

      getLabels: (owner, repo) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          const token = yield* auth.getToken()
          return yield* fetchGitHubPaginated(
            `/repos/${owner}/${repo}/labels`,
            token,
            S.Struct({
              id: S.Number,
              name: S.String,
              color: S.String,
              description: S.NullOr(S.String),
              default: S.optionalWith(S.Boolean, { default: () => false }),
            }),
          )
        }),

      setLabels: (owner, repo, prNumber, labels) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'PUT',
            `/repos/${owner}/${repo}/issues/${prNumber}/labels`,
            token,
            { labels: [...labels] },
          )
        }),

      getCollaborators: (owner, repo) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          const token = yield* auth.getToken()
          return yield* fetchGitHubPaginated(
            `/repos/${owner}/${repo}/collaborators`,
            token,
            User,
          )
        }),

      updateAssignees: (owner, repo, prNumber, assignees) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          validateNumber(prNumber)
          const token = yield* auth.getToken()
          yield* mutateGitHub(
            'POST',
            `/repos/${owner}/${repo}/issues/${prNumber}/assignees`,
            token,
            { assignees: [...assignees] },
          )
        }),

      createPR: (owner, repo, title, body, baseBranch, headBranch, draft) =>
        Effect.gen(function* () {
          validateOwner(owner)
          validateRepo(repo)
          const token = yield* auth.getToken()
          const result = yield* mutateGitHubJson<{ number: number; html_url: string }>(
            'POST',
            `/repos/${owner}/${repo}/pulls`,
            token,
            {
              title,
              body,
              base: baseBranch,
              head: headBranch,
              ...(draft != null ? { draft } : {}),
            },
          )
          return { number: result.number, html_url: result.html_url }
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
