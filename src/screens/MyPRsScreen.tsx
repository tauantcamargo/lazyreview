import React, { useState } from 'react'
import { useMyPRs, type PRStateFilter } from '../hooks/useGitHub'
import { PRListScreen } from './PRListScreen'
import type { PullRequest } from '../models/pull-request'

interface MyPRsScreenProps {
  readonly onSelect: (pr: PullRequest, list?: readonly PullRequest[], index?: number) => void
}

export function MyPRsScreen({ onSelect }: MyPRsScreenProps): React.ReactElement {
  const [stateFilter, setStateFilter] = useState<PRStateFilter>('open')
  const { data: prs = [], isLoading, error } = useMyPRs(stateFilter)

  return (
    <PRListScreen
      title="My Pull Requests"
      prs={prs}
      isLoading={isLoading}
      error={error}
      emptyMessage={`You have no ${stateFilter === 'all' ? '' : stateFilter + ' '}pull requests`}
      loadingMessage="Loading your PRs..."
      queryKeys={[['my-prs', stateFilter]]}
      stateFilter={stateFilter}
      onStateChange={setStateFilter}
      onSelect={onSelect}
    />
  )
}
