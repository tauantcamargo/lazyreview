import { useState, useCallback } from 'react'
import {
  useSubmitReview,
  useCreateComment,
  useCreateReviewComment,
  useReplyToReviewComment,
  useResolveReviewThread,
  useUnresolveReviewThread,
  useRequestReReview,
  useMergePR,
  useClosePullRequest,
  useReopenPullRequest,
  useEditIssueComment,
  useEditReviewComment,
} from './useGitHub'
import type { ReviewEvent, MergeMethod } from './useGitHub'
import type { InlineCommentContext } from '../models/inline-comment'
import type { ReplyContext, ResolveContext } from '../components/pr/ConversationsTab'

export interface EditCommentContext {
  readonly commentId: number
  readonly body: string
  readonly isReviewComment: boolean
}

interface UsePRDetailModalsOptions {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly headSha: string
  readonly setStatusMessage: (msg: string) => void
  readonly onMergeSuccess: () => void
  readonly onCloseSuccess?: () => void
}

export function usePRDetailModals({
  owner,
  repo,
  prNumber,
  headSha,
  setStatusMessage,
  onMergeSuccess,
  onCloseSuccess,
}: UsePRDetailModalsOptions) {
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [showReReviewModal, setShowReReviewModal] = useState(false)
  const [reReviewError, setReReviewError] = useState<string | null>(null)
  const [inlineContext, setInlineContext] = useState<InlineCommentContext | null>(null)
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null)
  const [editContext, setEditContext] = useState<EditCommentContext | null>(null)
  const [showResolved, setShowResolved] = useState(true)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  const submitReview = useSubmitReview()
  const createComment = useCreateComment()
  const createReviewComment = useCreateReviewComment()
  const replyToReviewComment = useReplyToReviewComment()
  const resolveThread = useResolveReviewThread()
  const unresolveThread = useUnresolveReviewThread()
  const requestReReview = useRequestReReview()
  const mergePR = useMergePR()
  const closePR = useClosePullRequest()
  const reopenPR = useReopenPullRequest()
  const editIssueComment = useEditIssueComment()
  const editReviewCommentMutation = useEditReviewComment()

  const hasModal = showReviewModal || showCommentModal || showMergeModal || showReReviewModal || showCloseConfirm

  const handleReviewSubmit = useCallback(
    (body: string, event: ReviewEvent) => {
      setReviewError(null)
      submitReview.mutate(
        { owner, repo, prNumber, body, event },
        {
          onSuccess: () => {
            setShowReviewModal(false)
            setStatusMessage('Review submitted')
          },
          onError: (err) => {
            setReviewError(String(err))
          },
        },
      )
    },
    [owner, repo, prNumber, submitReview, setStatusMessage],
  )

  const handleOpenGeneralComment = useCallback(() => {
    setCommentError(null)
    setInlineContext(null)
    setReplyContext(null)
    setShowCommentModal(true)
  }, [])

  const handleOpenInlineComment = useCallback((context: InlineCommentContext) => {
    setCommentError(null)
    setInlineContext(context)
    setReplyContext(null)
    setShowCommentModal(true)
  }, [])

  const handleOpenReply = useCallback((context: ReplyContext) => {
    setCommentError(null)
    setInlineContext(null)
    setReplyContext(context)
    setShowCommentModal(true)
  }, [])

  const handleToggleResolve = useCallback(
    (context: ResolveContext) => {
      if (context.isResolved) {
        unresolveThread.mutate(
          { owner, repo, prNumber, threadId: context.threadId },
          {
            onSuccess: () => setStatusMessage('Thread unresolved'),
            onError: (err) => setStatusMessage(`Error: ${String(err)}`),
          },
        )
      } else {
        resolveThread.mutate(
          { owner, repo, prNumber, threadId: context.threadId },
          {
            onSuccess: () => setStatusMessage('Thread resolved'),
            onError: (err) => setStatusMessage(`Error: ${String(err)}`),
          },
        )
      }
    },
    [owner, repo, prNumber, resolveThread, unresolveThread, setStatusMessage],
  )

  const handleToggleShowResolved = useCallback(() => {
    setShowResolved((prev) => !prev)
  }, [])

  const handleReReviewSubmit = useCallback(
    (reviewers: readonly string[]) => {
      setReReviewError(null)
      requestReReview.mutate(
        { owner, repo, prNumber, reviewers },
        {
          onSuccess: () => {
            setShowReReviewModal(false)
            setStatusMessage(`Re-review requested from ${reviewers.join(', ')}`)
          },
          onError: (err) => {
            setReReviewError(String(err))
          },
        },
      )
    },
    [owner, repo, prNumber, requestReReview, setStatusMessage],
  )

  const handleOpenEditComment = useCallback((context: EditCommentContext) => {
    setCommentError(null)
    setInlineContext(null)
    setReplyContext(null)
    setEditContext(context)
    setShowCommentModal(true)
  }, [])

  const handleEditCommentSubmit = useCallback(
    (body: string) => {
      if (!editContext) return
      setCommentError(null)
      const mutation = editContext.isReviewComment ? editReviewCommentMutation : editIssueComment
      mutation.mutate(
        { owner, repo, prNumber, commentId: editContext.commentId, body },
        {
          onSuccess: () => {
            setShowCommentModal(false)
            setEditContext(null)
            setStatusMessage('Comment updated')
          },
          onError: (err) => {
            setCommentError(String(err))
          },
        },
      )
    },
    [owner, repo, prNumber, editContext, editIssueComment, editReviewCommentMutation, setStatusMessage],
  )

  const handleCommentSubmit = useCallback(
    (body: string) => {
      setCommentError(null)

      if (editContext) {
        handleEditCommentSubmit(body)
        return
      }

      if (replyContext) {
        replyToReviewComment.mutate(
          {
            owner,
            repo,
            prNumber,
            body,
            inReplyTo: replyContext.commentId,
          },
          {
            onSuccess: () => {
              setShowCommentModal(false)
              setReplyContext(null)
              setStatusMessage('Reply posted')
            },
            onError: (err) => {
              setCommentError(String(err))
            },
          },
        )
      } else if (inlineContext) {
        createReviewComment.mutate(
          {
            owner,
            repo,
            prNumber,
            body,
            commitId: headSha,
            path: inlineContext.path,
            line: inlineContext.line,
            side: inlineContext.side,
            startLine: inlineContext.startLine,
            startSide: inlineContext.startSide,
          },
          {
            onSuccess: () => {
              setShowCommentModal(false)
              setInlineContext(null)
              setStatusMessage('Comment posted')
            },
            onError: (err) => {
              setCommentError(String(err))
            },
          },
        )
      } else {
        createComment.mutate(
          { owner, repo, issueNumber: prNumber, body },
          {
            onSuccess: () => {
              setShowCommentModal(false)
              setStatusMessage('Comment posted')
            },
            onError: (err) => {
              setCommentError(String(err))
            },
          },
        )
      }
    },
    [owner, repo, prNumber, replyContext, inlineContext, editContext, headSha, createComment, createReviewComment, replyToReviewComment, handleEditCommentSubmit, setStatusMessage],
  )

  const handleMergeSubmit = useCallback(
    (mergeMethod: MergeMethod, commitTitle?: string) => {
      setMergeError(null)
      mergePR.mutate(
        { owner, repo, prNumber, mergeMethod, commitTitle },
        {
          onSuccess: () => {
            setShowMergeModal(false)
            setStatusMessage('PR merged successfully')
            onMergeSuccess()
          },
          onError: (err) => {
            setMergeError(String(err))
          },
        },
      )
    },
    [owner, repo, prNumber, mergePR, setStatusMessage, onMergeSuccess],
  )

  const openReviewModal = useCallback(() => {
    setReviewError(null)
    setShowReviewModal(true)
  }, [])

  const openReReviewModal = useCallback(() => {
    setReReviewError(null)
    setShowReReviewModal(true)
  }, [])

  const openMergeModal = useCallback(() => {
    setMergeError(null)
    setShowMergeModal(true)
  }, [])

  const closeCommentModal = useCallback(() => {
    setShowCommentModal(false)
    setInlineContext(null)
    setReplyContext(null)
    setEditContext(null)
  }, [])

  const handleClosePR = useCallback(() => {
    closePR.mutate(
      { owner, repo, prNumber },
      {
        onSuccess: () => {
          setShowCloseConfirm(false)
          setStatusMessage('PR closed')
          onCloseSuccess?.()
        },
        onError: (err) => {
          setShowCloseConfirm(false)
          setStatusMessage(`Error closing PR: ${String(err)}`)
        },
      },
    )
  }, [owner, repo, prNumber, closePR, setStatusMessage, onCloseSuccess])

  const handleReopenPR = useCallback(() => {
    reopenPR.mutate(
      { owner, repo, prNumber },
      {
        onSuccess: () => {
          setStatusMessage('PR reopened')
        },
        onError: (err) => {
          setStatusMessage(`Error reopening PR: ${String(err)}`)
        },
      },
    )
  }, [owner, repo, prNumber, reopenPR, setStatusMessage])

  const commentModalTitle = editContext
    ? 'Edit Comment'
    : replyContext
      ? `Reply to ${replyContext.user}`
      : inlineContext
        ? 'Add Inline Comment'
        : 'Add Comment'
  const commentModalContext = editContext
    ? undefined
    : replyContext
      ? (replyContext.body ? replyContext.body.slice(0, 100) + (replyContext.body.length > 100 ? '...' : '') : undefined)
      : inlineContext
        ? `${inlineContext.path}:${inlineContext.line}`
        : undefined
  const commentModalDefaultValue = editContext?.body

  return {
    hasModal, showResolved, inlineContext, editContext,
    showReviewModal, reviewError, submitReviewPending: submitReview.isPending,
    handleReviewSubmit, openReviewModal, closeReviewModal: () => setShowReviewModal(false),
    showCommentModal, commentError, commentModalTitle, commentModalContext, commentModalDefaultValue,
    commentSubmitPending: createComment.isPending || createReviewComment.isPending || replyToReviewComment.isPending,
    handleCommentSubmit, handleOpenGeneralComment, handleOpenInlineComment, handleOpenReply, closeCommentModal,
    showMergeModal, mergeError, mergePRPending: mergePR.isPending,
    handleMergeSubmit, openMergeModal, closeMergeModal: () => setShowMergeModal(false),
    showReReviewModal, reReviewError, requestReReviewPending: requestReReview.isPending,
    handleReReviewSubmit, openReReviewModal, closeReReviewModal: () => setShowReReviewModal(false),
    handleToggleResolve, handleToggleShowResolved,
    showCloseConfirm, openCloseConfirm: () => setShowCloseConfirm(true),
    closeCloseConfirm: () => setShowCloseConfirm(false),
    handleClosePR, handleReopenPR, closePRPending: closePR.isPending, reopenPRPending: reopenPR.isPending,
    handleOpenEditComment,
  }
}
