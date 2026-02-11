import React from 'react'
import { Text } from 'ink'
import { useTheme } from '../../theme/index'
import { useCheckRuns } from '../../hooks/useGitHub'
import { summarizeChecks } from '../../models/check'

interface CheckStatusIconProps {
  readonly owner: string
  readonly repo: string
  readonly sha: string
  readonly enabled?: boolean
}

export function CheckStatusIcon({
  owner,
  repo,
  sha,
  enabled = true,
}: CheckStatusIconProps): React.ReactElement {
  const theme = useTheme()
  const { data } = useCheckRuns(owner, repo, sha, { enabled })

  if (!data || data.total_count === 0) {
    return <Text color={theme.colors.muted}>{enabled ? '' : '\u00B7'}</Text>
  }

  const summary = summarizeChecks(data.check_runs)

  if (summary.conclusion === 'success') {
    return <Text color={theme.colors.success}>{'\u2713'}</Text>
  }
  if (summary.conclusion === 'failure') {
    return <Text color={theme.colors.error}>{'\u2717'}</Text>
  }
  if (summary.conclusion === 'pending') {
    return <Text color={theme.colors.warning}>{'\u25CF'}</Text>
  }

  return <Text color={theme.colors.muted}>{'\u00B7'}</Text>
}
