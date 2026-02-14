import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { PullRequest } from '../../models/pull-request'
import { timeAgo } from '../../utils/date'
import { CheckStatusIcon } from './CheckStatusIcon'
import { ReviewStatusIcon } from './ReviewStatusIcon'
import { useReadState } from '../../hooks/useReadState'
import { contrastForeground, normalizeHexColor } from '../../utils/color'
import { parseGitHubPRUrl, extractRepoFromPRUrl } from '../../utils/git'

interface PRListItemProps {
  readonly item: PullRequest
  readonly isFocus: boolean
  readonly compact?: boolean
}

function CompactPRListItem({
  item,
  isFocus,
}: Omit<PRListItemProps, 'compact'>): React.ReactElement {
  const theme = useTheme()
  const { isUnread } = useReadState()
  const unread = isUnread(item.html_url, item.updated_at)

  const stateColor = item.draft
    ? theme.colors.muted
    : item.merged
      ? theme.colors.secondary
      : item.state === 'open'
        ? theme.colors.success
        : theme.colors.error

  const stateIcon = item.draft
    ? 'D'
    : item.merged
      ? 'M'
      : item.state === 'open'
        ? 'O'
        : 'C'

  const textColor = isFocus
    ? theme.colors.listSelectedFg
    : unread
      ? theme.colors.accent
      : theme.colors.text

  const commentText = item.comments > 0 ? `${item.comments} comments` : null

  return (
    <Box paddingX={1} gap={1}>
      <Text color={stateColor} bold>
        {stateIcon}
      </Text>
      {unread && (
        <Text color={theme.colors.accent} bold>*</Text>
      )}
      <Text color={textColor} bold={isFocus || unread} inverse={isFocus}>
        #{item.number}
      </Text>
      <Text color={textColor} bold={isFocus || unread} inverse={isFocus}>
        {item.title}
      </Text>
      <Text color={theme.colors.muted}>|</Text>
      <Text color={theme.colors.muted}>{item.user.login}</Text>
      <Text color={theme.colors.muted}>|</Text>
      <Text color={theme.colors.muted}>{timeAgo(item.created_at)}</Text>
      {commentText && (
        <>
          <Text color={theme.colors.muted}>|</Text>
          <Text color={theme.colors.muted}>{commentText}</Text>
        </>
      )}
    </Box>
  )
}

function FullPRListItem({
  item,
  isFocus,
}: Omit<PRListItemProps, 'compact'>): React.ReactElement {
  const theme = useTheme()
  const { isUnread } = useReadState()
  const unread = isUnread(item.html_url, item.updated_at)

  const stateColor = item.draft
    ? theme.colors.muted
    : item.merged
      ? theme.colors.secondary
      : item.state === 'open'
        ? theme.colors.success
        : theme.colors.error

  const stateIcon = item.draft
    ? 'D'
    : item.merged
      ? 'M'
      : item.state === 'open'
        ? 'O'
        : 'C'
  const repoName = extractRepoFromPRUrl(item.html_url)
  const ownerRepo = parseGitHubPRUrl(item.html_url)
  const headSha = item.head.sha

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box gap={1}>
        <Text color={stateColor} bold>
          {stateIcon}
        </Text>
        {ownerRepo && headSha && (
          <CheckStatusIcon owner={ownerRepo.owner} repo={ownerRepo.repo} sha={headSha} enabled={isFocus} />
        )}
        {ownerRepo && (
          <ReviewStatusIcon owner={ownerRepo.owner} repo={ownerRepo.repo} prNumber={item.number} enabled={isFocus} />
        )}
        {unread && (
          <Text color={theme.colors.accent} bold>*</Text>
        )}
        <Text
          color={isFocus ? theme.colors.listSelectedFg : unread ? theme.colors.accent : theme.colors.text}
          bold={isFocus || unread}
          inverse={isFocus}
        >
          #{item.number}
        </Text>
        <Text
          color={isFocus ? theme.colors.listSelectedFg : unread ? theme.colors.accent : theme.colors.text}
          bold={isFocus || unread}
          inverse={isFocus}
        >
          {item.title}
        </Text>
        {item.labels.length > 0 && (
          <Box gap={0}>
            {item.labels.map(
              (label: { id: number; name: string; color: string }) => {
                const bgColor = label.color ? normalizeHexColor(label.color) : undefined
                const fgColor = label.color ? contrastForeground(label.color) : theme.colors.muted
                return (
                  <Text
                    key={label.id}
                    color={fgColor}
                    backgroundColor={bgColor}
                    bold
                  >
                    {` ${label.name} `}
                  </Text>
                )
              },
            )}
          </Box>
        )}
      </Box>
      <Box gap={1} paddingLeft={3}>
        {repoName && (
          <>
            <Text color={theme.colors.secondary}>{repoName}</Text>
            <Text color={theme.colors.muted}>|</Text>
          </>
        )}
        <Text color={theme.colors.muted}>{item.user.login}</Text>
        {item.assignees && item.assignees.length > 0 && (
          <>
            <Text color={theme.colors.muted}>|</Text>
            <Text color={theme.colors.warning}>
              @{item.assignees.map((a) => a.login).join(' @')}
            </Text>
          </>
        )}
        <Text color={theme.colors.muted}>|</Text>
        <Text color={theme.colors.muted}>{timeAgo(item.created_at)}</Text>
        {item.requested_reviewers.length > 0 && (
          <>
            <Text color={theme.colors.muted}>|</Text>
            <Text color={theme.colors.info}>
              {item.requested_reviewers.map((r) => r.login).join(', ')}
            </Text>
          </>
        )}
        {item.comments > 0 && (
          <>
            <Text color={theme.colors.muted}>|</Text>
            <Text color={theme.colors.muted}>{item.comments} comments</Text>
          </>
        )}
      </Box>
    </Box>
  )
}

export function PRListItem({
  item,
  isFocus,
  compact = false,
}: PRListItemProps): React.ReactElement {
  if (compact) {
    return <CompactPRListItem item={item} isFocus={isFocus} />
  }
  return <FullPRListItem item={item} isFocus={isFocus} />
}
