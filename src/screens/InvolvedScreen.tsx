import React, { useState } from 'react'
import { useInvolvedPRs, type PRStateFilter } from '../hooks/useGitHub'
import { PRListScreen } from './PRListScreen'
import type { PullRequest } from '../models/pull-request'

interface InvolvedScreenProps {
  readonly onSelect: (pr: PullRequest, list?: readonly PullRequest[], index?: number) => void
}

export function InvolvedScreen({ onSelect }: InvolvedScreenProps): React.ReactElement {
  const [stateFilter, setStateFilter] = useState<PRStateFilter>('open')
  const { data: prs = [], isLoading, error } = useInvolvedPRs(stateFilter)

  return (
    <PRListScreen
      title="Involved Pull Requests"
      prs={prs}
      isLoading={isLoading}
      error={error}
      emptyMessage={`No ${stateFilter === 'all' ? '' : stateFilter + ' '}pull requests you're involved in`}
      loadingMessage="Loading involved PRs..."
      queryKeys={[['involved-prs', stateFilter]]}
      stateFilter={stateFilter}
      onStateChange={setStateFilter}
      onSelect={onSelect}
    />
  )
}
