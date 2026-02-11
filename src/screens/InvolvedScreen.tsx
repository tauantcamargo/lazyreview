import React from 'react'
import { useInvolvedPRs } from '../hooks/useGitHub'
import { PRListScreen } from './PRListScreen'
import type { PullRequest } from '../models/pull-request'

interface InvolvedScreenProps {
  readonly onSelect: (pr: PullRequest) => void
}

export function InvolvedScreen({ onSelect }: InvolvedScreenProps): React.ReactElement {
  const { data: prs = [], isLoading, error } = useInvolvedPRs()

  return (
    <PRListScreen
      title="Involved Pull Requests"
      prs={prs}
      isLoading={isLoading}
      error={error}
      emptyMessage="No pull requests you're involved in"
      loadingMessage="Loading involved PRs..."
      queryKeys={[['involved-prs']]}
      onSelect={onSelect}
    />
  )
}
