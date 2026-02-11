import React from 'react'
import { useReviewRequests } from '../hooks/useGitHub'
import { PRListScreen } from './PRListScreen'
import type { PullRequest } from '../models/pull-request'

interface ReviewRequestsScreenProps {
  readonly onSelect: (pr: PullRequest) => void
}

export function ReviewRequestsScreen({ onSelect }: ReviewRequestsScreenProps): React.ReactElement {
  const { data: prs = [], isLoading, error } = useReviewRequests()

  return (
    <PRListScreen
      title="For Review"
      prs={prs}
      isLoading={isLoading}
      error={error}
      emptyMessage="No review requests"
      loadingMessage="Loading review requests..."
      queryKeys={[['review-requests']]}
      onSelect={onSelect}
    />
  )
}
