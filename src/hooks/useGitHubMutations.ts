import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { GitHubApi } from '../services/GitHubApi'
import { runEffect } from '../utils/effect'

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
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.submitReview(owner, repo, prNumber, body, event)
      })),
    onSuccess: (_data, v) => {
      queryClient.invalidateQueries({ queryKey: ['pr-reviews', v.owner, v.repo, v.prNumber] })
      queryClient.invalidateQueries({ queryKey: ['pr-comments', v.owner, v.repo, v.prNumber] })
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
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.createComment(owner, repo, issueNumber, body)
      })),
    onSuccess: (_data, v) => {
      queryClient.invalidateQueries({ queryKey: ['pr-comments', v.owner, v.repo, v.issueNumber] })
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
  readonly startLine?: number
  readonly startSide?: 'LEFT' | 'RIGHT'
}

export function useCreateReviewComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ owner, repo, prNumber, body, commitId, path, line, side, startLine, startSide }: CreateReviewCommentParams) =>
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.createReviewComment(owner, repo, prNumber, body, commitId, path, line, side, startLine, startSide)
      })),
    onSuccess: (_data, v) => {
      queryClient.invalidateQueries({ queryKey: ['pr-comments', v.owner, v.repo, v.prNumber] })
    },
  })
}

interface ResolveThreadParams {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly threadId: string
}

export function useResolveReviewThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ threadId }: ResolveThreadParams) =>
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.resolveReviewThread(threadId)
      })),
    onSuccess: (_data, v) => {
      queryClient.invalidateQueries({ queryKey: ['pr-review-threads', v.owner, v.repo, v.prNumber] })
      queryClient.invalidateQueries({ queryKey: ['pr-comments', v.owner, v.repo, v.prNumber] })
    },
  })
}

export function useUnresolveReviewThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ threadId }: ResolveThreadParams) =>
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.unresolveReviewThread(threadId)
      })),
    onSuccess: (_data, v) => {
      queryClient.invalidateQueries({ queryKey: ['pr-review-threads', v.owner, v.repo, v.prNumber] })
      queryClient.invalidateQueries({ queryKey: ['pr-comments', v.owner, v.repo, v.prNumber] })
    },
  })
}

interface ReplyToReviewCommentParams {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly body: string
  readonly inReplyTo: number
}

export function useReplyToReviewComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ owner, repo, prNumber, body, inReplyTo }: ReplyToReviewCommentParams) =>
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.replyToReviewComment(owner, repo, prNumber, body, inReplyTo)
      })),
    onSuccess: (_data, v) => {
      queryClient.invalidateQueries({ queryKey: ['pr-comments', v.owner, v.repo, v.prNumber] })
      queryClient.invalidateQueries({ queryKey: ['pr-review-threads', v.owner, v.repo, v.prNumber] })
    },
  })
}

interface RequestReReviewParams {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly reviewers: readonly string[]
}

export function useRequestReReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ owner, repo, prNumber, reviewers }: RequestReReviewParams) =>
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.requestReReview(owner, repo, prNumber, reviewers)
      })),
    onSuccess: (_data, v) => {
      queryClient.invalidateQueries({ queryKey: ['pr', v.owner, v.repo, v.prNumber] })
      queryClient.invalidateQueries({ queryKey: ['pr-reviews', v.owner, v.repo, v.prNumber] })
    },
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
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.mergePullRequest(owner, repo, prNumber, mergeMethod, commitTitle, commitMessage)
      })),
    onSuccess: (_data, v) => {
      queryClient.invalidateQueries({ queryKey: ['pr', v.owner, v.repo, v.prNumber] })
      invalidatePRLists(queryClient)
    },
  })
}

interface DeleteReviewCommentParams {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly commentId: number
}

export function useDeleteReviewComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ owner, repo, commentId }: DeleteReviewCommentParams) =>
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.deleteReviewComment(owner, repo, commentId)
      })),
    onSuccess: (_data, v) => {
      queryClient.invalidateQueries({ queryKey: ['pr-comments', v.owner, v.repo, v.prNumber] })
      queryClient.invalidateQueries({ queryKey: ['pr-review-threads', v.owner, v.repo, v.prNumber] })
    },
  })
}

interface CreatePendingReviewParams {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
}

export function useCreatePendingReview() {
  return useMutation({
    mutationFn: ({ owner, repo, prNumber }: CreatePendingReviewParams) =>
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        return yield* api.createPendingReview(owner, repo, prNumber)
      })),
  })
}

interface AddPendingReviewCommentParams {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly reviewId: number
  readonly body: string
  readonly path: string
  readonly line: number
  readonly side: 'LEFT' | 'RIGHT'
  readonly startLine?: number
  readonly startSide?: 'LEFT' | 'RIGHT'
}

export function useAddPendingReviewComment() {
  return useMutation({
    mutationFn: ({ owner, repo, prNumber, reviewId, body, path, line, side, startLine, startSide }: AddPendingReviewCommentParams) =>
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.addPendingReviewComment(owner, repo, prNumber, reviewId, body, path, line, side, startLine, startSide)
      })),
  })
}

interface SubmitPendingReviewParams {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly reviewId: number
  readonly body: string
  readonly event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
}

export function useSubmitPendingReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ owner, repo, prNumber, reviewId, body, event }: SubmitPendingReviewParams) =>
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.submitPendingReview(owner, repo, prNumber, reviewId, body, event)
      })),
    onSuccess: (_data, v) => {
      queryClient.invalidateQueries({ queryKey: ['pr-reviews', v.owner, v.repo, v.prNumber] })
      queryClient.invalidateQueries({ queryKey: ['pr-comments', v.owner, v.repo, v.prNumber] })
      queryClient.invalidateQueries({ queryKey: ['pr-review-threads', v.owner, v.repo, v.prNumber] })
    },
  })
}

interface DiscardPendingReviewParams {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly reviewId: number
}

export function useDiscardPendingReview() {
  return useMutation({
    mutationFn: ({ owner, repo, prNumber, reviewId }: DiscardPendingReviewParams) =>
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.discardPendingReview(owner, repo, prNumber, reviewId)
      })),
  })
}

interface PRStateParams {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
}

function invalidatePRLists(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['prs'] })
  queryClient.invalidateQueries({ queryKey: ['my-prs'] })
  queryClient.invalidateQueries({ queryKey: ['review-requests'] })
  queryClient.invalidateQueries({ queryKey: ['involved-prs'] })
}

export function useClosePullRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ owner, repo, prNumber }: PRStateParams) =>
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.closePullRequest(owner, repo, prNumber)
      })),
    onSuccess: (_data, v) => {
      queryClient.invalidateQueries({ queryKey: ['pr', v.owner, v.repo, v.prNumber] })
      invalidatePRLists(queryClient)
    },
  })
}

export function useReopenPullRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ owner, repo, prNumber }: PRStateParams) =>
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.reopenPullRequest(owner, repo, prNumber)
      })),
    onSuccess: (_data, v) => {
      queryClient.invalidateQueries({ queryKey: ['pr', v.owner, v.repo, v.prNumber] })
      invalidatePRLists(queryClient)
    },
  })
}

interface EditCommentParams extends PRStateParams {
  readonly commentId: number
  readonly body: string
}

export function useEditIssueComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ owner, repo, commentId, body }: EditCommentParams) =>
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.editIssueComment(owner, repo, commentId, body)
      })),
    onSuccess: (_data, v) => {
      queryClient.invalidateQueries({ queryKey: ['pr-comments', v.owner, v.repo, v.prNumber] })
    },
  })
}

export function useEditReviewComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ owner, repo, commentId, body }: EditCommentParams) =>
      runEffect(Effect.gen(function* () {
        const api = yield* GitHubApi
        yield* api.editReviewComment(owner, repo, commentId, body)
      })),
    onSuccess: (_data, v) => {
      queryClient.invalidateQueries({ queryKey: ['pr-comments', v.owner, v.repo, v.prNumber] })
      queryClient.invalidateQueries({ queryKey: ['pr-review-threads', v.owner, v.repo, v.prNumber] })
    },
  })
}
