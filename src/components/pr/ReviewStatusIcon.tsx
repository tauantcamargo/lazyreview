import React from 'react'
import { Text } from 'ink'
import { useTheme } from '../../theme/index'
import { usePRReviews } from '../../hooks/useGitHub'
import type { Review } from '../../models/review'

export type ReviewDecision = 'approved' | 'changes_requested' | 'pending' | 'none'

/**
 * Determine the overall review decision from a list of reviews.
 * Uses the latest review per user (only APPROVED and CHANGES_REQUESTED count).
 * If any user has requested changes, the result is changes_requested.
 * If all decisive reviewers approved, the result is approved.
 * Otherwise pending.
 */
export function getReviewDecision(reviews: readonly Review[]): ReviewDecision {
  if (reviews.length === 0) return 'none'

  // Build a map of latest meaningful review per user
  const latestByUser = new Map<string, Review['state']>()

  // Reviews come in chronological order from the API, so later entries override
  for (const review of reviews) {
    if (review.state === 'APPROVED' || review.state === 'CHANGES_REQUESTED') {
      latestByUser.set(review.user.login, review.state)
    }
  }

  if (latestByUser.size === 0) return 'pending'

  const states = [...latestByUser.values()]
  if (states.some((s) => s === 'CHANGES_REQUESTED')) return 'changes_requested'
  if (states.every((s) => s === 'APPROVED')) return 'approved'

  return 'pending'
}

interface ReviewStatusIconProps {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly enabled?: boolean
}

export function ReviewStatusIcon({
  owner,
  repo,
  prNumber,
  enabled = true,
}: ReviewStatusIconProps): React.ReactElement {
  const theme = useTheme()
  const { data: reviews } = usePRReviews(owner, repo, prNumber, { enabled })

  if (!reviews || reviews.length === 0) {
    return <Text color={theme.colors.muted}>{enabled ? '' : '\u00B7'}</Text>
  }

  const decision = getReviewDecision(reviews)

  if (decision === 'approved') {
    return <Text color={theme.colors.success}>A</Text>
  }
  if (decision === 'changes_requested') {
    return <Text color={theme.colors.error}>!</Text>
  }
  if (decision === 'pending') {
    return <Text color={theme.colors.warning}>R</Text>
  }

  return <Text color={theme.colors.muted}>{'\u00B7'}</Text>
}
