import React, { useState } from 'react'
import { useReviewRequests, type PRStateFilter } from '../hooks/useGitHub'
import { PRListScreen } from './PRListScreen'
import type { PullRequest } from '../models/pull-request'

interface ReviewRequestsScreenProps {
  readonly onSelect: (pr: PullRequest, list?: readonly PullRequest[], index?: number) => void
}

export function ReviewRequestsScreen({ onSelect }: ReviewRequestsScreenProps): React.ReactElement {
  const [stateFilter, setStateFilter] = useState<PRStateFilter>('open')
  const { data: prs = [], isLoading, error } = useReviewRequests(stateFilter)

  return (
    <PRListScreen
      title="For Review"
      prs={prs}
      isLoading={isLoading}
      error={error}
      emptyMessage={`No ${stateFilter === 'all' ? '' : stateFilter + ' '}review requests`}
      loadingMessage="Loading review requests..."
      queryKeys={[['review-requests', stateFilter]]}
      stateFilter={stateFilter}
      onStateChange={setStateFilter}
      onSelect={onSelect}
    />
  )
}
