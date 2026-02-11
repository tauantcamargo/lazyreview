import { useState, useCallback } from 'react'
import {
  useCreateComment,
  useCreateReviewComment,
  useReplyToReviewComment,
  useEditIssueComment,
  useEditReviewComment,
} from './useGitHubMutations'
import type { InlineCommentContext } from '../models/inline-comment'
import type { ReplyContext } from '../components/pr/ConversationsTab'

export interface EditCommentContext {
  readonly commentId: number
  readonly body: string
  readonly isReviewComment: boolean
}

interface UseCommentActionsOptions {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly headSha: string
  readonly setStatusMessage: (msg: string) => void
}

export function useCommentActions({
  owner,
  repo,
  prNumber,
  headSha,
  setStatusMessage,
}: UseCommentActionsOptions) {
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [inlineContext, setInlineContext] = useState<InlineCommentContext | null>(null)
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null)
  const [editContext, setEditContext] = useState<EditCommentContext | null>(null)

  const createComment = useCreateComment()
  const createReviewComment = useCreateReviewComment()
  const replyToReviewComment = useReplyToReviewComment()
  const editIssueComment = useEditIssueComment()
  const editReviewCommentMutation = useEditReviewComment()

  const handleOpenGeneralComment = useCallback(() => {
    setCommentError(null)
    setInlineContext(null)
    setReplyContext(null)
    setEditContext(null)
    setShowCommentModal(true)
  }, [])

  const handleOpenInlineComment = useCallback((context: InlineCommentContext) => {
    setCommentError(null)
    setInlineContext(context)
    setReplyContext(null)
    setEditContext(null)
    setShowCommentModal(true)
  }, [])

  const handleOpenReply = useCallback((context: ReplyContext) => {
    setCommentError(null)
    setInlineContext(null)
    setReplyContext(context)
    setEditContext(null)
    setShowCommentModal(true)
  }, [])

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
          onError: (err) => setCommentError(String(err)),
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
          { owner, repo, prNumber, body, inReplyTo: replyContext.commentId },
          {
            onSuccess: () => {
              setShowCommentModal(false)
              setReplyContext(null)
              setStatusMessage('Reply posted')
            },
            onError: (err) => setCommentError(String(err)),
          },
        )
      } else if (inlineContext) {
        createReviewComment.mutate(
          {
            owner, repo, prNumber, body, commitId: headSha,
            path: inlineContext.path, line: inlineContext.line, side: inlineContext.side,
            startLine: inlineContext.startLine, startSide: inlineContext.startSide,
          },
          {
            onSuccess: () => {
              setShowCommentModal(false)
              setInlineContext(null)
              setStatusMessage('Comment posted')
            },
            onError: (err) => setCommentError(String(err)),
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
            onError: (err) => setCommentError(String(err)),
          },
        )
      }
    },
    [owner, repo, prNumber, replyContext, inlineContext, editContext, headSha,
      createComment, createReviewComment, replyToReviewComment, handleEditCommentSubmit, setStatusMessage],
  )

  const closeCommentModal = useCallback(() => {
    setShowCommentModal(false)
    setInlineContext(null)
    setReplyContext(null)
    setEditContext(null)
  }, [])

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
    showCommentModal,
    commentError,
    commentModalTitle,
    commentModalContext,
    commentModalDefaultValue,
    commentSubmitPending: createComment.isPending || createReviewComment.isPending || replyToReviewComment.isPending,
    inlineContext,
    editContext,
    handleCommentSubmit,
    handleOpenGeneralComment,
    handleOpenInlineComment,
    handleOpenReply,
    handleOpenEditComment,
    closeCommentModal,
  } as const
}
