import { useState, useCallback } from 'react'
import {
  useCreateComment,
  useCreateReviewComment,
  useReplyToReviewComment,
  useEditIssueComment,
  useEditReviewComment,
  useUpdatePRDescription,
  useUpdatePRTitle,
} from './useGitHubMutations'
import type { InlineCommentContext } from '../models/inline-comment'
import type { ReplyContext } from '../components/pr/ConversationsTab'

export interface EditCommentContext {
  readonly commentId: number
  readonly body: string
  readonly isReviewComment: boolean
}

export interface EditDescriptionContext {
  readonly body: string
}

export interface EditTitleContext {
  readonly title: string
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
  const [descriptionEditContext, setDescriptionEditContext] = useState<EditDescriptionContext | null>(null)
  const [titleEditContext, setTitleEditContext] = useState<EditTitleContext | null>(null)

  const createComment = useCreateComment()
  const createReviewComment = useCreateReviewComment()
  const replyToReviewComment = useReplyToReviewComment()
  const editIssueComment = useEditIssueComment()
  const editReviewCommentMutation = useEditReviewComment()
  const updatePRDescription = useUpdatePRDescription()
  const updatePRTitle = useUpdatePRTitle()

  const handleOpenGeneralComment = useCallback(() => {
    setCommentError(null)
    setInlineContext(null)
    setReplyContext(null)
    setEditContext(null)
    setDescriptionEditContext(null)
    setTitleEditContext(null)
    setShowCommentModal(true)
  }, [])

  const handleOpenInlineComment = useCallback((context: InlineCommentContext) => {
    setCommentError(null)
    setInlineContext(context)
    setReplyContext(null)
    setEditContext(null)
    setDescriptionEditContext(null)
    setTitleEditContext(null)
    setShowCommentModal(true)
  }, [])

  const handleOpenReply = useCallback((context: ReplyContext) => {
    setCommentError(null)
    setInlineContext(null)
    setReplyContext(context)
    setEditContext(null)
    setDescriptionEditContext(null)
    setTitleEditContext(null)
    setShowCommentModal(true)
  }, [])

  const handleOpenEditComment = useCallback((context: EditCommentContext) => {
    setCommentError(null)
    setInlineContext(null)
    setReplyContext(null)
    setEditContext(context)
    setDescriptionEditContext(null)
    setTitleEditContext(null)
    setShowCommentModal(true)
  }, [])

  const handleOpenEditDescription = useCallback((context: EditDescriptionContext) => {
    setCommentError(null)
    setInlineContext(null)
    setReplyContext(null)
    setEditContext(null)
    setDescriptionEditContext(context)
    setTitleEditContext(null)
    setShowCommentModal(true)
  }, [])

  const handleOpenEditTitle = useCallback((context: EditTitleContext) => {
    setCommentError(null)
    setInlineContext(null)
    setReplyContext(null)
    setEditContext(null)
    setDescriptionEditContext(null)
    setTitleEditContext(context)
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

  const handleEditDescriptionSubmit = useCallback(
    (body: string) => {
      if (!descriptionEditContext) return
      setCommentError(null)
      updatePRDescription.mutate(
        { owner, repo, prNumber, body },
        {
          onSuccess: () => {
            setShowCommentModal(false)
            setDescriptionEditContext(null)
            setStatusMessage('Description updated')
          },
          onError: (err) => setCommentError(String(err)),
        },
      )
    },
    [owner, repo, prNumber, descriptionEditContext, updatePRDescription, setStatusMessage],
  )

  const handleEditTitleSubmit = useCallback(
    (title: string) => {
      if (!titleEditContext) return
      setCommentError(null)
      updatePRTitle.mutate(
        { owner, repo, prNumber, title },
        {
          onSuccess: () => {
            setShowCommentModal(false)
            setTitleEditContext(null)
            setStatusMessage('Title updated')
          },
          onError: (err) => setCommentError(String(err)),
        },
      )
    },
    [owner, repo, prNumber, titleEditContext, updatePRTitle, setStatusMessage],
  )

  const handleCommentSubmit = useCallback(
    (body: string) => {
      setCommentError(null)

      if (titleEditContext) {
        handleEditTitleSubmit(body)
        return
      }

      if (descriptionEditContext) {
        handleEditDescriptionSubmit(body)
        return
      }

      if (editContext) {
        handleEditCommentSubmit(body)
        return
      }

      if (replyContext) {
        if (replyContext.isIssueComment) {
          // Issue comment replies are new issue comments with quoted original
          const firstLine = replyContext.body?.split('\n')[0] ?? ''
          const quotedBody = `> @${replyContext.user} wrote:\n> ${firstLine}\n\n${body}`
          createComment.mutate(
            { owner, repo, issueNumber: prNumber, body: quotedBody },
            {
              onSuccess: () => {
                setShowCommentModal(false)
                setReplyContext(null)
                setStatusMessage('Reply posted')
              },
              onError: (err) => setCommentError(String(err)),
            },
          )
        } else {
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
        }
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
    [owner, repo, prNumber, replyContext, inlineContext, editContext, descriptionEditContext, titleEditContext, headSha,
      createComment, createReviewComment, replyToReviewComment, handleEditCommentSubmit, handleEditDescriptionSubmit, handleEditTitleSubmit, setStatusMessage],
  )

  const closeCommentModal = useCallback(() => {
    setShowCommentModal(false)
    setInlineContext(null)
    setReplyContext(null)
    setEditContext(null)
    setDescriptionEditContext(null)
    setTitleEditContext(null)
  }, [])

  const commentModalTitle = titleEditContext
    ? 'Edit Title'
    : descriptionEditContext
      ? 'Edit Description'
      : editContext
        ? 'Edit Comment'
        : replyContext
          ? `Reply to ${replyContext.user}`
          : inlineContext
            ? 'Add Inline Comment'
            : 'Add Comment'

  const replyPreview = replyContext?.body
    ? replyContext.body.slice(0, 100) + (replyContext.body.length > 100 ? '...' : '')
    : undefined

  const commentModalContext = titleEditContext
    ? undefined
    : descriptionEditContext
      ? undefined
      : editContext
        ? undefined
        : replyContext
          ? replyPreview
          : inlineContext
            ? `${inlineContext.path}:${inlineContext.line}`
            : undefined

  const commentModalDefaultValue = titleEditContext?.title ?? descriptionEditContext?.body ?? editContext?.body

  return {
    showCommentModal,
    commentError,
    commentModalTitle,
    commentModalContext,
    commentModalDefaultValue,
    commentSubmitPending: createComment.isPending || createReviewComment.isPending || replyToReviewComment.isPending || updatePRDescription.isPending || updatePRTitle.isPending,
    inlineContext,
    editContext,
    descriptionEditContext,
    titleEditContext,
    handleCommentSubmit,
    handleOpenGeneralComment,
    handleOpenInlineComment,
    handleOpenReply,
    handleOpenEditComment,
    handleOpenEditDescription,
    handleOpenEditTitle,
    closeCommentModal,
  } as const
}
