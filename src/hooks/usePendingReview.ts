import { useState, useCallback } from 'react'
import {
  useCreatePendingReview,
  useAddPendingReviewComment,
  useSubmitPendingReview,
  useDiscardPendingReview,
} from './useGitHub'
import type { ReviewEvent } from './useGitHub'

export interface PendingComment {
  readonly body: string
  readonly path: string
  readonly line: number
  readonly side: 'LEFT' | 'RIGHT'
  readonly startLine?: number
  readonly startSide?: 'LEFT' | 'RIGHT'
}

interface UsePendingReviewOptions {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly setStatusMessage: (msg: string) => void
}

export function usePendingReview({
  owner,
  repo,
  prNumber,
  setStatusMessage,
}: UsePendingReviewOptions) {
  const [reviewId, setReviewId] = useState<number | null>(null)
  const [pendingComments, setPendingComments] = useState<readonly PendingComment[]>([])
  const [error, setError] = useState<string | null>(null)

  const createPending = useCreatePendingReview()
  const addComment = useAddPendingReviewComment()
  const submitPending = useSubmitPendingReview()
  const discardPending = useDiscardPendingReview()

  const isActive = reviewId != null

  const startReview = useCallback(() => {
    setError(null)
    createPending.mutate(
      { owner, repo, prNumber },
      {
        onSuccess: (data) => {
          setReviewId(data.id)
          setPendingComments([])
          setStatusMessage('Review started - comments will be batched')
        },
        onError: (err) => {
          setError(String(err))
          setStatusMessage(`Error starting review: ${String(err)}`)
        },
      },
    )
  }, [owner, repo, prNumber, createPending, setStatusMessage])

  const addPendingComment = useCallback(
    (comment: PendingComment, body: string) => {
      if (reviewId == null) return
      setError(null)
      addComment.mutate(
        {
          owner,
          repo,
          prNumber,
          reviewId,
          body,
          path: comment.path,
          line: comment.line,
          side: comment.side,
          startLine: comment.startLine,
          startSide: comment.startSide,
        },
        {
          onSuccess: () => {
            setPendingComments((prev) => [...prev, comment])
            setStatusMessage(`Pending comment added (${pendingComments.length + 1} total)`)
          },
          onError: (err) => {
            setError(String(err))
            setStatusMessage(`Error adding comment: ${String(err)}`)
          },
        },
      )
    },
    [owner, repo, prNumber, reviewId, addComment, pendingComments.length, setStatusMessage],
  )

  const submitReview = useCallback(
    (body: string, event: ReviewEvent) => {
      if (reviewId == null) return
      setError(null)
      submitPending.mutate(
        { owner, repo, prNumber, reviewId, body, event },
        {
          onSuccess: () => {
            setReviewId(null)
            setPendingComments([])
            setStatusMessage('Review submitted')
          },
          onError: (err) => {
            setError(String(err))
            setStatusMessage(`Error submitting review: ${String(err)}`)
          },
        },
      )
    },
    [owner, repo, prNumber, reviewId, submitPending, setStatusMessage],
  )

  const discardReview = useCallback(() => {
    if (reviewId == null) return
    setError(null)
    discardPending.mutate(
      { owner, repo, prNumber, reviewId },
      {
        onSuccess: () => {
          setReviewId(null)
          setPendingComments([])
          setStatusMessage('Pending review discarded')
        },
        onError: (err) => {
          setError(String(err))
          setStatusMessage(`Error discarding review: ${String(err)}`)
        },
      },
    )
  }, [owner, repo, prNumber, reviewId, discardPending, setStatusMessage])

  return {
    isActive,
    reviewId,
    pendingComments,
    pendingCount: pendingComments.length,
    error,
    isSubmitting: submitPending.isPending,
    isAdding: addComment.isPending,
    startReview,
    addPendingComment,
    submitReview,
    discardReview,
  }
}
