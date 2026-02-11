import React from 'react'
import { Text } from 'ink'
import { useTheme } from '../../theme/index'
import { useCheckRuns } from '../../hooks/useGitHub'
import { summarizeChecks } from '../../models/check'

interface CheckStatusIconProps {
  readonly owner: string
  readonly repo: string
  readonly sha: string
}

export function CheckStatusIcon({
  owner,
  repo,
  sha,
}: CheckStatusIconProps): React.ReactElement | null {
  const theme = useTheme()
  const { data } = useCheckRuns(owner, repo, sha)

  if (!data || data.total_count === 0) {
    return null
  }

  const summary = summarizeChecks(data.check_runs)

  if (summary.conclusion === 'success') {
    return <Text color={theme.colors.success}>✓</Text>
  }
  if (summary.conclusion === 'failure') {
    return <Text color={theme.colors.error}>✗</Text>
  }
  if (summary.conclusion === 'pending') {
    return <Text color={theme.colors.warning}>●</Text>
  }

  return null
}
