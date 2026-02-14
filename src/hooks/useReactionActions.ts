import { useState, useCallback } from 'react'
import { useAddReaction } from './useGitHubMutations'
import type { ReactionType } from '../models/reaction'

export interface ReactionContext {
  readonly commentId: number
  readonly commentType: 'issue_comment' | 'review_comment'
}

interface UseReactionActionsOptions {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly setStatusMessage: (msg: string) => void
}

export function useReactionActions({
  owner,
  repo,
  prNumber,
  setStatusMessage,
}: UseReactionActionsOptions) {
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [reactionError, setReactionError] = useState<string | null>(null)
  const [reactionContext, setReactionContext] = useState<ReactionContext | null>(null)

  const addReaction = useAddReaction()

  const handleOpenReactionPicker = useCallback((context: ReactionContext) => {
    setReactionError(null)
    setReactionContext(context)
    setShowReactionPicker(true)
  }, [])

  const handleReactionSelect = useCallback(
    (reaction: ReactionType) => {
      if (!reactionContext) return
      setReactionError(null)
      addReaction.mutate(
        {
          owner,
          repo,
          prNumber,
          commentId: reactionContext.commentId,
          reaction,
          commentType: reactionContext.commentType,
        },
        {
          onSuccess: () => {
            setShowReactionPicker(false)
            setReactionContext(null)
            setStatusMessage(`Reaction added`)
          },
          onError: (err) => setReactionError(String(err)),
        },
      )
    },
    [owner, repo, prNumber, reactionContext, addReaction, setStatusMessage],
  )

  const closeReactionPicker = useCallback(() => {
    setShowReactionPicker(false)
    setReactionContext(null)
    setReactionError(null)
  }, [])

  return {
    showReactionPicker,
    reactionError,
    reactionPending: addReaction.isPending,
    handleOpenReactionPicker,
    handleReactionSelect,
    closeReactionPicker,
  } as const
}
