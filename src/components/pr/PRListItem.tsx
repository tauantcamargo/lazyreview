import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { PullRequest } from '../../models/pull-request'
import { timeAgo } from '../../utils/date'
import { CheckStatusIcon } from './CheckStatusIcon'
import { ReviewStatusIcon } from './ReviewStatusIcon'

interface PRListItemProps {
  readonly item: PullRequest
  readonly isFocus: boolean
}

function extractRepoFromUrl(url: string): string | null {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)\/pull/)
  return match?.[1] ?? null
}

function extractOwnerRepo(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull/)
  if (!match?.[1] || !match?.[2]) return null
  return { owner: match[1], repo: match[2] }
}

export function PRListItem({
  item,
  isFocus,
}: PRListItemProps): React.ReactElement {
  const theme = useTheme()

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
  const repoName = extractRepoFromUrl(item.html_url)
  const ownerRepo = extractOwnerRepo(item.html_url)
  const headSha = item.head.sha

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box gap={1}>
        <Text color={stateColor} bold>
          {stateIcon}
        </Text>
        {ownerRepo && headSha && (
          <CheckStatusIcon owner={ownerRepo.owner} repo={ownerRepo.repo} sha={headSha} />
        )}
        {ownerRepo && (
          <ReviewStatusIcon owner={ownerRepo.owner} repo={ownerRepo.repo} prNumber={item.number} />
        )}
        <Text
          color={isFocus ? theme.colors.listSelectedFg : theme.colors.text}
          bold={isFocus}
          inverse={isFocus}
        >
          #{item.number}
        </Text>
        <Text
          color={isFocus ? theme.colors.listSelectedFg : theme.colors.text}
          bold={isFocus}
          inverse={isFocus}
        >
          {item.title}
        </Text>
        {item.labels.length > 0 && (
          <Box gap={0}>
            {item.labels.map(
              (label: { id: number; name: string; color: string }) => (
                <Text key={label.id} color={`#${label.color}`} bold>
                  {` ${label.name} `}
                </Text>
              ),
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
