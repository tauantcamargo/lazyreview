import React from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { useTheme } from '../../theme/index'
import { Divider } from '../common/Divider'
import { useListNavigation } from '../../hooks/useListNavigation'
import type { PullRequest } from '../../models/pull-request'
import type { Review } from '../../models/review'
import { MarkdownText } from '../common/MarkdownText'
import { ReviewSummary } from './ReviewSummary'

const PR_DETAIL_CONTENT_HEIGHT_RESERVED = 18
const DESCRIPTION_HEADER_LINES = 2

interface DescriptionTabProps {
  readonly pr: PullRequest
  readonly reviews: readonly Review[]
  readonly isActive: boolean
  readonly onEditDescription?: (context: { readonly body: string }) => void
}

function PRInfoSection({
  pr,
}: {
  readonly pr: PullRequest
}): React.ReactElement {
  const theme = useTheme()

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      borderStyle="single"
      borderColor={theme.colors.border}
      overflow="hidden"
    >
      <Box flexDirection="row">
        <Text color={theme.colors.muted}>Author: </Text>
        <Text color={theme.colors.secondary} bold>
          {pr.user.login}
        </Text>
      </Box>
      {pr.requested_reviewers.length > 0 ? (
        <Box flexDirection="row" marginTop={0}>
          <Text color={theme.colors.muted}>Reviewers: </Text>
          <Text color={theme.colors.text}>
            {pr.requested_reviewers.map((r) => r.login).join(', ')}
          </Text>
        </Box>
      ) : null}
      {pr.labels.length > 0 ? (
        <Box flexDirection="row" marginTop={0}>
          <Text color={theme.colors.muted}>Labels: </Text>
          {pr.labels.map((label) => (
            <Text key={label.id} color={`#${label.color}`}>
              [{label.name}]{' '}
            </Text>
          ))}
        </Box>
      ) : null}
      <Box paddingY={0}>
        <Divider />
      </Box>
      <Box flexDirection="row" marginTop={0}>
        <Text color={theme.colors.diffAdd}>+{pr.additions}</Text>
        <Text> </Text>
        <Text color={theme.colors.diffDel}>-{pr.deletions}</Text>
        <Text color={theme.colors.muted}>
          {' '}
          {pr.changed_files} files changed
        </Text>
      </Box>
    </Box>
  )
}

function PRDescriptionSection({
  pr,
}: {
  readonly pr: PullRequest
}): React.ReactElement {
  const theme = useTheme()

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box flexDirection="row" marginBottom={1}>
        <Text color={theme.colors.accent} bold>
          Description
        </Text>
        <Text color={theme.colors.muted}> by </Text>
        <Text color={theme.colors.secondary} bold>
          {pr.user.login}
        </Text>
      </Box>
      <Box paddingLeft={1} width="85%">
        <MarkdownText content={pr.body} />
      </Box>
    </Box>
  )
}

export function DescriptionTab({
  pr,
  reviews,
  isActive,
  onEditDescription,
}: DescriptionTabProps): React.ReactElement {
  const theme = useTheme()
  const { stdout } = useStdout()
  const contentHeight = Math.max(
    1,
    (stdout?.rows ?? 24) - PR_DETAIL_CONTENT_HEIGHT_RESERVED,
  )
  const viewportHeight = Math.max(
    1,
    contentHeight - DESCRIPTION_HEADER_LINES,
  )

  const sections = [
    <PRInfoSection key="info" pr={pr} />,
    <PRDescriptionSection key="desc" pr={pr} />,
    <ReviewSummary key="reviews" reviews={reviews} />,
  ]

  const { selectedIndex } = useListNavigation({
    itemCount: sections.length,
    viewportHeight,
    isActive,
  })

  useInput(
    (input) => {
      if (input === 'D' && onEditDescription) {
        onEditDescription({ body: pr.body ?? '' })
      }
    },
    { isActive },
  )

  return (
    <Box flexDirection="column" flexGrow={1} minHeight={0} overflow="hidden">
      <Box flexDirection="row" paddingX={1} paddingY={0} marginBottom={1}>
        <Text color={theme.colors.accent} bold>
          PR details
        </Text>
      </Box>
      <Box
        flexDirection="column"
        flexGrow={1}
        minHeight={0}
        overflow="hidden"
        height={viewportHeight}
      >
        {sections.slice(selectedIndex)}
      </Box>
    </Box>
  )
}
