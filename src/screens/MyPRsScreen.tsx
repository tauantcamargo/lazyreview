import React from 'react'
import { useMyPRs } from '../hooks/useGitHub'
import { PRListScreen } from './PRListScreen'
import type { PullRequest } from '../models/pull-request'

interface MyPRsScreenProps {
  readonly onSelect: (pr: PullRequest) => void
}

export function MyPRsScreen({ onSelect }: MyPRsScreenProps): React.ReactElement {
  const { data: prs = [], isLoading, error } = useMyPRs()

  return (
    <PRListScreen
      title="My Pull Requests"
      prs={prs}
      isLoading={isLoading}
      error={error}
      emptyMessage="You have no open pull requests"
      loadingMessage="Loading your PRs..."
      queryKeys={[['my-prs']]}
      onSelect={onSelect}
    />
  )
}
