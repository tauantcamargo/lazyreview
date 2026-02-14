import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'

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

function connectionLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'connected'
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
 * Short provider badge label for the status area.
 */
export function providerBadge(provider: string): string {
  switch (provider) {
    case 'github':
      return '[GH]'
    case 'gitlab':
      return '[GL]'
    case 'bitbucket':
      return '[BB]'
    case 'azure':
      return '[AZ]'
    case 'gitea':
      return '[GT]'
    default:
      return `[${provider.slice(0, 2).toUpperCase()}]`
  }
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

  // Build breadcrumb segments
  const breadcrumbs: readonly string[] = [
    'LazyReview',
    ...(screenName ? [screenName] : repoPath ? [repoPath] : []),
    ...(browseRepoPath ? [browseRepoPath] : []),
    ...(prNumber !== undefined && prTitle
      ? [`PR #${prNumber}: ${truncate(prTitle, 40)}`]
      : []),
  ]

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
              <Text color={theme.colors.muted}> {'>'} </Text>
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
        <Text color={connectionColor(connectionStatus)}>
          {'●'}
        </Text>
        <Text color={theme.colors.muted}>{connectionLabel(connectionStatus)}</Text>
        <Text color={theme.colors.muted}>│</Text>
        <Text color={providerColor(provider)} bold>{providerBadge(provider)}</Text>
        <Text color={theme.colors.muted}>│</Text>
        <Text color={theme.colors.secondary}>{username}</Text>
      </Box>
    </Box>
  )
}
