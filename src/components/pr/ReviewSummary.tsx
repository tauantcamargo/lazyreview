import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { Review } from '../../models/review'

export function getLatestReviewByUser(
  reviews: readonly Review[],
): Map<string, Review> {
  const latest = new Map<string, Review>()
  for (const review of reviews) {
    if (review.state === 'PENDING') continue
    const existing = latest.get(review.user.login)
    if (
      !existing ||
      new Date(review.submitted_at ?? '').getTime() >
        new Date(existing.submitted_at ?? '').getTime()
    ) {
      latest.set(review.user.login, review)
    }
  }
  return latest
}

export function ReviewSummary({
  reviews,
}: {
  readonly reviews: readonly Review[]
}): React.ReactElement | null {
  const theme = useTheme()
  const latestByUser = getLatestReviewByUser(reviews)

  if (latestByUser.size === 0) return null

  const approved = [...latestByUser.values()].filter(
    (r) => r.state === 'APPROVED',
  )
  const changesRequested = [...latestByUser.values()].filter(
    (r) => r.state === 'CHANGES_REQUESTED',
  )
  const total = latestByUser.size

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={0}
      marginBottom={1}
    >
      <Box flexDirection="row" gap={1}>
        <Text color={theme.colors.muted} bold>
          Reviews:
        </Text>
        <Text>
          {approved.length > 0 && (
            <Text color={theme.colors.success}>
              {approved.length} of {total} approvals
            </Text>
          )}
          {approved.length > 0 && changesRequested.length > 0 && (
            <Text color={theme.colors.muted}> - </Text>
          )}
          {changesRequested.length > 0 && (
            <Text color={theme.colors.error}>
              {changesRequested.length} changes requested
            </Text>
          )}
        </Text>
      </Box>
      <Box flexDirection="row" gap={1} paddingLeft={2}>
        {[...latestByUser.entries()].map(([login, review]) => {
          const color =
            review.state === 'APPROVED'
              ? theme.colors.success
              : review.state === 'CHANGES_REQUESTED'
                ? theme.colors.error
                : theme.colors.warning
          const icon =
            review.state === 'APPROVED'
              ? '+'
              : review.state === 'CHANGES_REQUESTED'
                ? 'x'
                : '~'
          return (
            <Text key={login} color={color}>
              [{icon} {login}]
            </Text>
          )
        })}
      </Box>
    </Box>
  )
}
