import { useState, useCallback } from 'react'
import {
  useSubmitReview,
  useResolveReviewThread,
  useUnresolveReviewThread,
  useRequestReReview,
} from './useGitHubMutations'
import type { ReviewEvent } from './useGitHubMutations'
import type { ResolveContext } from '../components/pr/ConversationsTab'

interface UseReviewActionsOptions {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly setStatusMessage: (msg: string) => void
}

export function useReviewActions({
  owner,
  repo,
  prNumber,
  setStatusMessage,
}: UseReviewActionsOptions) {
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [showReReviewModal, setShowReReviewModal] = useState(false)
  const [reReviewError, setReReviewError] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(true)

  const submitReview = useSubmitReview()
  const resolveThread = useResolveReviewThread()
  const unresolveThread = useUnresolveReviewThread()
  const requestReReview = useRequestReReview()

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
          onError: (err) => setReviewError(String(err)),
        },
      )
    },
    [owner, repo, prNumber, submitReview, setStatusMessage],
  )

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
          onError: (err) => setReReviewError(String(err)),
        },
      )
    },
    [owner, repo, prNumber, requestReReview, setStatusMessage],
  )

  const openReviewModal = useCallback(() => {
    setReviewError(null)
    setShowReviewModal(true)
  }, [])

  const openReReviewModal = useCallback(() => {
    setReReviewError(null)
    setShowReReviewModal(true)
  }, [])

  return {
    showReviewModal,
    reviewError,
    submitReviewPending: submitReview.isPending,
    handleReviewSubmit,
    openReviewModal,
    closeReviewModal: useCallback(() => setShowReviewModal(false), []),
    showReReviewModal,
    reReviewError,
    requestReReviewPending: requestReReview.isPending,
    handleReReviewSubmit,
    openReReviewModal,
    closeReReviewModal: useCallback(() => setShowReReviewModal(false), []),
    handleToggleResolve,
    showResolved,
    handleToggleShowResolved,
  } as const
}
