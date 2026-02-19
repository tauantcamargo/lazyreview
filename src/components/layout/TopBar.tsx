import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import { providerBadge } from '../../utils/provider-helpers'

export type ConnectionStatus = 'connected' | 'rate-limited' | 'error'

interface TopBarProps {
  readonly username: string
  readonly provider: string
  readonly repoPath?: string
  readonly browseRepoPath?: string
  readonly screenName?: string
  readonly prTitle?: string
  readonly prNumber?: number
  readonly connectionStatus?: ConnectionStatus
}

function connectionColor(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'green'
    case 'rate-limited':
      return 'yellow'
    case 'error':
      return 'red'
  }
}

function connectionLabel(status: ConnectionStatus): string | null {
  switch (status) {
    case 'connected':
      return null // dot-only when connected
    case 'rate-limited':
      return 'rate limited'
    case 'error':
      return 'disconnected'
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen - 1)}~`
}

/**
 * Provider-specific badge color for visual identification.
 */
export function providerColor(provider: string): string {
  switch (provider) {
    case 'github':
      return 'white'
    case 'gitlab':
      return '#FC6D26' // GitLab orange
    case 'bitbucket':
      return '#0052CC' // Bitbucket blue
    case 'azure':
      return 'cyan'
    case 'gitea':
      return 'green'
    default:
      return 'white'
  }
}

export function TopBar({
  username,
  provider,
  repoPath,
  browseRepoPath,
  screenName,
  prTitle,
  prNumber,
  connectionStatus = 'connected',
}: TopBarProps): React.ReactElement {
  const theme = useTheme()

  // Build breadcrumb segments — provider badge leads the trail
  const badge = providerBadge(provider)
  const breadcrumbs: readonly string[] = [
    `${badge} LazyReview`,
    ...(screenName ? [screenName] : repoPath ? [repoPath] : []),
    ...(browseRepoPath ? [browseRepoPath] : []),
    ...(prNumber !== undefined && prTitle
      ? [`#${prNumber}: ${truncate(prTitle, 30)}`]
      : []),
  ]

  const label = connectionLabel(connectionStatus)

  return (
    <Box
      height={1}
      width="100%"
      justifyContent="space-between"
      paddingX={1}
    >
      <Box gap={0}>
        {breadcrumbs.map((segment, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <Text color={theme.colors.border}> {'›'} </Text>
            )}
            <Text
              color={i === 0 ? theme.colors.accent : theme.colors.text}
              bold={i === 0}
            >
              {segment}
            </Text>
          </React.Fragment>
        ))}
      </Box>
      <Box gap={1}>
        <Text color={connectionColor(connectionStatus)}>{'●'}</Text>
        {label && <Text color={theme.colors.muted}>{label}</Text>}
        <Text color={theme.colors.muted}>│</Text>
        <Text color={theme.colors.secondary}>{username}</Text>
      </Box>
    </Box>
  )
}
