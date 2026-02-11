import React, { useState } from 'react'
import { usePullRequests } from '../hooks/useGitHub'
import type { PRStateFilter } from '../hooks/useGitHub'
import { PRListScreen } from './PRListScreen'
import { EmptyState } from '../components/common/EmptyState'
import type { PullRequest } from '../models/pull-request'

interface ThisRepoScreenProps {
  readonly owner: string | null
  readonly repo: string | null
  readonly onSelect: (pr: PullRequest) => void
}

export function ThisRepoScreen({ owner, repo, onSelect }: ThisRepoScreenProps): React.ReactElement {
  const [stateFilter, setStateFilter] = useState<PRStateFilter>('open')
  const { data: prs = [], isLoading, error } = usePullRequests(
    owner ?? '',
    repo ?? '',
    { state: stateFilter === 'all' ? 'all' : stateFilter === 'closed' ? 'closed' : 'open' },
  )

  if (!owner || !repo) {
    return <EmptyState message="Not in a git repository or remote not detected" />
  }

  return (
    <PRListScreen
      title={`${owner}/${repo}`}
      prs={prs}
      isLoading={isLoading}
      error={error}
      emptyMessage={`No ${stateFilter === 'all' ? '' : stateFilter + ' '}PRs in ${owner}/${repo}`}
      loadingMessage={`Loading PRs for ${owner}/${repo}...`}
      queryKeys={[['prs', owner, repo]]}
      stateFilter={stateFilter}
      onStateChange={setStateFilter}
      onSelect={onSelect}
    />
  )
}
