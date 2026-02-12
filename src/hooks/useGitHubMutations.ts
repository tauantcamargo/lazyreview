import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { CodeReviewApi } from '../services/GitHubApi'
import type { CodeReviewApiService } from '../services/CodeReviewApiTypes'
import type { ApiError } from '../services/CodeReviewApiTypes'
import { runEffect } from '../utils/effect'

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

interface CreateMutationOptions<TParams, TResult> {
  readonly effect: (api: CodeReviewApiService, params: TParams) => Effect.Effect<TResult, ApiError>
  readonly invalidateKeys?: (params: TParams) => readonly (readonly (string | number)[])[]
}

export function createGitHubMutation<TParams, TResult = void>(
  options: CreateMutationOptions<TParams, TResult>,
) {
  return function useMutationHook() {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: (params: TParams) =>
        runEffect(
          Effect.gen(function* () {
            const api = yield* CodeReviewApi
            return yield* options.effect(api, params)
          }),
        ),
      ...(options.invalidateKeys
        ? {
            onSuccess: (_data: TResult, params: TParams) => {
              for (const key of options.invalidateKeys!(params)) {
                queryClient.invalidateQueries({ queryKey: [...key] })
              }
            },
          }
        : {}),
    })
  }
}

// ---------------------------------------------------------------------------
// Invalidation helpers
// ---------------------------------------------------------------------------

export function invalidatePRLists(): readonly string[][] {
  return [['prs'], ['my-prs'], ['review-requests'], ['involved-prs']]
}

export function invalidatePRComments(
  owner: string,
  repo: string,
  prNumber: number,
): readonly (readonly (string | number)[])[] {
  return [['pr-comments', owner, repo, prNumber]]
}

export function invalidatePRThreads(
  owner: string,
  repo: string,
  prNumber: number,
): readonly (readonly (string | number)[])[] {
  return [
    ['pr-comments', owner, repo, prNumber],
    ['pr-review-threads', owner, repo, prNumber],
  ]
}

// ---------------------------------------------------------------------------
// Param types
// ---------------------------------------------------------------------------

export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
export type MergeMethod = 'merge' | 'squash' | 'rebase'

interface PRParams {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
}

interface SubmitReviewParams extends PRParams {
  readonly body: string
  readonly event: ReviewEvent
}

interface CreateCommentParams {
  readonly owner: string
  readonly repo: string
  readonly issueNumber: number
  readonly body: string
}

interface CreateReviewCommentParams extends PRParams {
  readonly body: string
  readonly commitId: string
  readonly path: string
  readonly line: number
  readonly side: 'LEFT' | 'RIGHT'
  readonly startLine?: number
  readonly startSide?: 'LEFT' | 'RIGHT'
}

interface ResolveThreadParams extends PRParams {
  readonly threadId: string
}

interface ReplyToReviewCommentParams extends PRParams {
  readonly body: string
  readonly inReplyTo: number
}

interface RequestReReviewParams extends PRParams {
  readonly reviewers: readonly string[]
}

interface MergePRParams extends PRParams {
  readonly mergeMethod: MergeMethod
  readonly commitTitle?: string
  readonly commitMessage?: string
}

interface DeleteReviewCommentParams extends PRParams {
  readonly commentId: number
}

interface PendingReviewCommentParams extends PRParams {
  readonly reviewId: number
  readonly body: string
  readonly path: string
  readonly line: number
  readonly side: 'LEFT' | 'RIGHT'
  readonly startLine?: number
  readonly startSide?: 'LEFT' | 'RIGHT'
}

interface SubmitPendingReviewParams extends PRParams {
  readonly reviewId: number
  readonly body: string
  readonly event: ReviewEvent
}

interface DiscardPendingReviewParams extends PRParams {
  readonly reviewId: number
}

interface UpdatePRDescriptionParams extends PRParams {
  readonly body: string
}

interface EditCommentParams extends PRParams {
  readonly commentId: number
  readonly body: string
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export const useSubmitReview = createGitHubMutation<SubmitReviewParams>({
  effect: (api, p) => api.submitReview(p.owner, p.repo, p.prNumber, p.body, p.event),
  invalidateKeys: (p) => [
    ['pr-reviews', p.owner, p.repo, p.prNumber],
    ...invalidatePRComments(p.owner, p.repo, p.prNumber),
  ],
})

export const useCreateComment = createGitHubMutation<CreateCommentParams>({
  effect: (api, p) => api.createComment(p.owner, p.repo, p.issueNumber, p.body),
  invalidateKeys: (p) => [
    ['pr-comments', p.owner, p.repo, p.issueNumber],
    ['issue-comments', p.owner, p.repo, p.issueNumber],
  ],
})

export const useCreateReviewComment = createGitHubMutation<CreateReviewCommentParams>({
  effect: (api, p) =>
    api.createReviewComment(p.owner, p.repo, p.prNumber, p.body, p.commitId, p.path, p.line, p.side, p.startLine, p.startSide),
  invalidateKeys: (p) => invalidatePRComments(p.owner, p.repo, p.prNumber),
})

export const useResolveReviewThread = createGitHubMutation<ResolveThreadParams>({
  effect: (api, p) => api.resolveReviewThread(p.threadId),
  invalidateKeys: (p) => invalidatePRThreads(p.owner, p.repo, p.prNumber),
})

export const useUnresolveReviewThread = createGitHubMutation<ResolveThreadParams>({
  effect: (api, p) => api.unresolveReviewThread(p.threadId),
  invalidateKeys: (p) => invalidatePRThreads(p.owner, p.repo, p.prNumber),
})

export const useReplyToReviewComment = createGitHubMutation<ReplyToReviewCommentParams>({
  effect: (api, p) => api.replyToReviewComment(p.owner, p.repo, p.prNumber, p.body, p.inReplyTo),
  invalidateKeys: (p) => invalidatePRThreads(p.owner, p.repo, p.prNumber),
})

export const useRequestReReview = createGitHubMutation<RequestReReviewParams>({
  effect: (api, p) => api.requestReReview(p.owner, p.repo, p.prNumber, p.reviewers),
  invalidateKeys: (p) => [
    ['pr', p.owner, p.repo, p.prNumber],
    ['pr-reviews', p.owner, p.repo, p.prNumber],
  ],
})

export const useMergePR = createGitHubMutation<MergePRParams>({
  effect: (api, p) =>
    api.mergePullRequest(p.owner, p.repo, p.prNumber, p.mergeMethod, p.commitTitle, p.commitMessage),
  invalidateKeys: (p) => [
    ['pr', p.owner, p.repo, p.prNumber],
    ...invalidatePRLists(),
  ],
})

export const useDeleteReviewComment = createGitHubMutation<DeleteReviewCommentParams>({
  effect: (api, p) => api.deleteReviewComment(p.owner, p.repo, p.commentId),
  invalidateKeys: (p) => invalidatePRThreads(p.owner, p.repo, p.prNumber),
})

export const useCreatePendingReview = createGitHubMutation<PRParams, { readonly id: number }>({
  effect: (api, p) => api.createPendingReview(p.owner, p.repo, p.prNumber),
})

export const useAddPendingReviewComment = createGitHubMutation<PendingReviewCommentParams>({
  effect: (api, p) =>
    api.addPendingReviewComment(p.owner, p.repo, p.prNumber, p.reviewId, p.body, p.path, p.line, p.side, p.startLine, p.startSide),
})

export const useSubmitPendingReview = createGitHubMutation<SubmitPendingReviewParams>({
  effect: (api, p) => api.submitPendingReview(p.owner, p.repo, p.prNumber, p.reviewId, p.body, p.event),
  invalidateKeys: (p) => [
    ['pr-reviews', p.owner, p.repo, p.prNumber],
    ...invalidatePRThreads(p.owner, p.repo, p.prNumber),
  ],
})

export const useDiscardPendingReview = createGitHubMutation<DiscardPendingReviewParams>({
  effect: (api, p) => api.discardPendingReview(p.owner, p.repo, p.prNumber, p.reviewId),
})

export const useClosePullRequest = createGitHubMutation<PRParams>({
  effect: (api, p) => api.closePullRequest(p.owner, p.repo, p.prNumber),
  invalidateKeys: (p) => [
    ['pr', p.owner, p.repo, p.prNumber],
    ...invalidatePRLists(),
  ],
})

export const useReopenPullRequest = createGitHubMutation<PRParams>({
  effect: (api, p) => api.reopenPullRequest(p.owner, p.repo, p.prNumber),
  invalidateKeys: (p) => [
    ['pr', p.owner, p.repo, p.prNumber],
    ...invalidatePRLists(),
  ],
})

export const useUpdatePRDescription = createGitHubMutation<UpdatePRDescriptionParams>({
  effect: (api, p) => api.updatePRDescription(p.owner, p.repo, p.prNumber, p.body),
  invalidateKeys: (p) => [
    ['pr', p.owner, p.repo, p.prNumber],
    ...invalidatePRLists(),
  ],
})

export const useEditIssueComment = createGitHubMutation<EditCommentParams>({
  effect: (api, p) => api.editIssueComment(p.owner, p.repo, p.commentId, p.body),
  invalidateKeys: (p) => [
    ...invalidatePRComments(p.owner, p.repo, p.prNumber),
    ['issue-comments', p.owner, p.repo, p.prNumber],
  ],
})

export const useEditReviewComment = createGitHubMutation<EditCommentParams>({
  effect: (api, p) => api.editReviewComment(p.owner, p.repo, p.commentId, p.body),
  invalidateKeys: (p) => invalidatePRThreads(p.owner, p.repo, p.prNumber),
})
