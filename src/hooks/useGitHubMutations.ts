import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { CodeReviewApi } from '../services/GitHubApi'
import type { CodeReviewApiService, ReviewThread } from '../services/CodeReviewApiTypes'
import type { ApiError } from '../services/CodeReviewApiTypes'
import { runEffect } from '../utils/effect'
import {
  createOptimisticComment,
  createOptimisticIssueComment,
  createOptimisticReview,
  applyOptimisticComment,
  applyOptimisticIssueComment,
  applyOptimisticReview,
  applyThreadResolution,
  type OptimisticCommentShape,
  type OptimisticIssueCommentShape,
  type OptimisticReviewShape,
} from './optimistic-updates'

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
// Optimistic mutation factory
// ---------------------------------------------------------------------------

interface OptimisticCacheUpdate<TParams> {
  readonly queryKey: (params: TParams) => readonly (string | number)[]
  readonly updater: (oldData: unknown, params: TParams) => unknown
}

interface CreateOptimisticMutationOptions<TParams, TResult> {
  readonly effect: (api: CodeReviewApiService, params: TParams) => Effect.Effect<TResult, ApiError>
  readonly invalidateKeys: (params: TParams) => readonly (readonly (string | number)[])[]
  readonly cacheUpdates: readonly OptimisticCacheUpdate<TParams>[]
}

interface OptimisticContext {
  readonly snapshots: ReadonlyMap<string, unknown>
}

export function createOptimisticMutation<TParams, TResult = void>(
  options: CreateOptimisticMutationOptions<TParams, TResult>,
) {
  return function useMutationHook() {
    const queryClient = useQueryClient()
    return useMutation<TResult, Error, TParams, OptimisticContext>({
      mutationFn: (params: TParams) =>
        runEffect(
          Effect.gen(function* () {
            const api = yield* CodeReviewApi
            return yield* options.effect(api, params)
          }),
        ),
      onMutate: async (params: TParams) => {
        const snapshots = await takeSnapshots(queryClient, options.cacheUpdates, params)
        for (const update of options.cacheUpdates) {
          const key = [...update.queryKey(params)]
          const oldData = queryClient.getQueryData(key)
          queryClient.setQueryData(key, update.updater(oldData, params))
        }
        return { snapshots }
      },
      onError: (_error: Error, params: TParams, context?: OptimisticContext) => {
        if (context?.snapshots) {
          for (const [keyStr, data] of context.snapshots) {
            queryClient.setQueryData(JSON.parse(keyStr) as readonly unknown[], data)
          }
        }
      },
      onSettled: (_data: TResult | undefined, _error: Error | null, params: TParams) => {
        for (const key of options.invalidateKeys(params)) {
          queryClient.invalidateQueries({ queryKey: [...key] })
        }
      },
    })
  }
}

async function takeSnapshots<TParams>(
  queryClient: QueryClient,
  cacheUpdates: readonly OptimisticCacheUpdate<TParams>[],
  params: TParams,
): Promise<ReadonlyMap<string, unknown>> {
  const snapshots = new Map<string, unknown>()
  for (const update of cacheUpdates) {
    const key = [...update.queryKey(params)]
    await queryClient.cancelQueries({ queryKey: key })
    snapshots.set(JSON.stringify(key), queryClient.getQueryData(key))
  }
  return snapshots
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

interface UpdatePRTitleParams extends PRParams {
  readonly title: string
}

interface EditCommentParams extends PRParams {
  readonly commentId: number
  readonly body: string
}

// ---------------------------------------------------------------------------
// Mutation hooks (with optimistic updates for key mutations)
// ---------------------------------------------------------------------------

export const useSubmitReview = createOptimisticMutation<SubmitReviewParams>({
  effect: (api, p) => api.submitReview(p.owner, p.repo, p.prNumber, p.body, p.event),
  invalidateKeys: (p) => [
    ['pr-reviews', p.owner, p.repo, p.prNumber],
    ...invalidatePRComments(p.owner, p.repo, p.prNumber),
  ],
  cacheUpdates: [
    {
      queryKey: (p) => ['pr-reviews', p.owner, p.repo, p.prNumber],
      updater: (old, p) =>
        applyOptimisticReview(
          old as readonly OptimisticReviewShape[] | undefined,
          createOptimisticReview({ body: p.body, event: p.event }),
        ),
    },
  ],
})

export const useCreateComment = createOptimisticMutation<CreateCommentParams>({
  effect: (api, p) => api.addComment(p.owner, p.repo, p.issueNumber, p.body),
  invalidateKeys: (p) => [
    ['pr-comments', p.owner, p.repo, p.issueNumber],
    ['issue-comments', p.owner, p.repo, p.issueNumber],
  ],
  cacheUpdates: [
    {
      queryKey: (p) => ['issue-comments', p.owner, p.repo, p.issueNumber],
      updater: (old, p) =>
        applyOptimisticIssueComment(
          old as readonly OptimisticIssueCommentShape[] | undefined,
          createOptimisticIssueComment({ body: p.body }),
        ),
    },
  ],
})

export const useCreateReviewComment = createOptimisticMutation<CreateReviewCommentParams>({
  effect: (api, p) =>
    api.addDiffComment(p.owner, p.repo, p.prNumber, p.body, p.commitId, p.path, p.line, p.side, p.startLine, p.startSide),
  invalidateKeys: (p) => invalidatePRComments(p.owner, p.repo, p.prNumber),
  cacheUpdates: [
    {
      queryKey: (p) => ['pr-comments', p.owner, p.repo, p.prNumber],
      updater: (old, p) =>
        applyOptimisticComment(
          old as readonly OptimisticCommentShape[] | undefined,
          createOptimisticComment({ body: p.body, path: p.path, line: p.line, side: p.side }),
        ),
    },
  ],
})

export const useResolveReviewThread = createOptimisticMutation<ResolveThreadParams>({
  effect: (api, p) => api.resolveThread(p.threadId),
  invalidateKeys: (p) => invalidatePRThreads(p.owner, p.repo, p.prNumber),
  cacheUpdates: [
    {
      queryKey: (p) => ['pr-review-threads', p.owner, p.repo, p.prNumber],
      updater: (old, p) =>
        applyThreadResolution(old as readonly ReviewThread[] | undefined, p.threadId, true),
    },
  ],
})

export const useUnresolveReviewThread = createOptimisticMutation<ResolveThreadParams>({
  effect: (api, p) => api.unresolveThread(p.threadId),
  invalidateKeys: (p) => invalidatePRThreads(p.owner, p.repo, p.prNumber),
  cacheUpdates: [
    {
      queryKey: (p) => ['pr-review-threads', p.owner, p.repo, p.prNumber],
      updater: (old, p) =>
        applyThreadResolution(old as readonly ReviewThread[] | undefined, p.threadId, false),
    },
  ],
})

export const useReplyToReviewComment = createOptimisticMutation<ReplyToReviewCommentParams>({
  effect: (api, p) => api.replyToComment(p.owner, p.repo, p.prNumber, p.body, p.inReplyTo),
  invalidateKeys: (p) => invalidatePRThreads(p.owner, p.repo, p.prNumber),
  cacheUpdates: [
    {
      queryKey: (p) => ['pr-comments', p.owner, p.repo, p.prNumber],
      updater: (old, p) =>
        applyOptimisticComment(
          old as readonly OptimisticCommentShape[] | undefined,
          createOptimisticComment({ body: p.body, inReplyToId: p.inReplyTo }),
        ),
    },
  ],
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
    api.mergePR(p.owner, p.repo, p.prNumber, p.mergeMethod, p.commitTitle, p.commitMessage),
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
  effect: (api, p) => api.closePR(p.owner, p.repo, p.prNumber),
  invalidateKeys: (p) => [
    ['pr', p.owner, p.repo, p.prNumber],
    ...invalidatePRLists(),
  ],
})

export const useReopenPullRequest = createGitHubMutation<PRParams>({
  effect: (api, p) => api.reopenPR(p.owner, p.repo, p.prNumber),
  invalidateKeys: (p) => [
    ['pr', p.owner, p.repo, p.prNumber],
    ...invalidatePRLists(),
  ],
})

export const useUpdatePRDescription = createGitHubMutation<UpdatePRDescriptionParams>({
  effect: (api, p) => api.updatePRBody(p.owner, p.repo, p.prNumber, p.body),
  invalidateKeys: (p) => [
    ['pr', p.owner, p.repo, p.prNumber],
    ...invalidatePRLists(),
  ],
})

export const useUpdatePRTitle = createGitHubMutation<UpdatePRTitleParams>({
  effect: (api, p) => api.updatePRTitle(p.owner, p.repo, p.prNumber, p.title),
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

// ---------------------------------------------------------------------------
// Draft PR toggle
// ---------------------------------------------------------------------------

interface DraftToggleParams extends PRParams {
  readonly nodeId: string
}

export const useConvertToDraft = createGitHubMutation<DraftToggleParams>({
  effect: (api, p) => api.convertToDraft(p.nodeId),
  invalidateKeys: (p) => [
    ['pr', p.owner, p.repo, p.prNumber],
    ...invalidatePRLists(),
  ],
})

export const useMarkReadyForReview = createGitHubMutation<DraftToggleParams>({
  effect: (api, p) => api.markReadyForReview(p.nodeId),
  invalidateKeys: (p) => [
    ['pr', p.owner, p.repo, p.prNumber],
    ...invalidatePRLists(),
  ],
})

// ---------------------------------------------------------------------------
// Label management
// ---------------------------------------------------------------------------

interface SetLabelsParams extends PRParams {
  readonly labels: readonly string[]
}

export const useSetLabels = createGitHubMutation<SetLabelsParams>({
  effect: (api, p) => api.setLabels(p.owner, p.repo, p.prNumber, p.labels),
  invalidateKeys: (p) => [
    ['pr', p.owner, p.repo, p.prNumber],
    ...invalidatePRLists(),
  ],
})

// ---------------------------------------------------------------------------
// Assignee management
// ---------------------------------------------------------------------------

interface UpdateAssigneesParams extends PRParams {
  readonly assignees: readonly string[]
}

export const useUpdateAssignees = createGitHubMutation<UpdateAssigneesParams>({
  effect: (api, p) => api.updateAssignees(p.owner, p.repo, p.prNumber, p.assignees),
  invalidateKeys: (p) => [
    ['pr', p.owner, p.repo, p.prNumber],
    ...invalidatePRLists(),
  ],
})

// ---------------------------------------------------------------------------
// PR creation
// ---------------------------------------------------------------------------

interface CreatePullRequestParams {
  readonly owner: string
  readonly repo: string
  readonly title: string
  readonly body: string
  readonly baseBranch: string
  readonly headBranch: string
  readonly draft?: boolean
}

interface CreatePullRequestResult {
  readonly number: number
  readonly html_url: string
}

export const useCreatePullRequest = createGitHubMutation<
  CreatePullRequestParams,
  CreatePullRequestResult
>({
  effect: (api, p) =>
    api.createPR(p.owner, p.repo, p.title, p.body, p.baseBranch, p.headBranch, p.draft),
  invalidateKeys: (p) => [
    ['prs', p.owner, p.repo],
    ...invalidatePRLists(),
  ],
})
