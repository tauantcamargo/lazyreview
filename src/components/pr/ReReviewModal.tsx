import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import { Modal } from '../common/Modal'
import type { Review } from '../../models/review'

interface Reviewer {
  readonly login: string
  readonly status: string
}

interface ReReviewModalProps {
  readonly reviewers: readonly Reviewer[]
  readonly onSubmit: (reviewers: readonly string[]) => void
  readonly onClose: () => void
  readonly isSubmitting: boolean
  readonly error: string | null
}

function getStatusColor(status: string, theme: ReturnType<typeof useTheme>): string {
  switch (status) {
    case 'APPROVED':
      return theme.colors.success
    case 'CHANGES_REQUESTED':
      return theme.colors.error
    case 'COMMENTED':
      return theme.colors.info
    default:
      return theme.colors.warning
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'APPROVED':
      return 'approved'
    case 'CHANGES_REQUESTED':
      return 'changes requested'
    case 'COMMENTED':
      return 'commented'
    default:
      return 'pending'
  }
}

export function buildReviewerList(
  reviews: readonly Review[],
  requestedReviewers: readonly { readonly login: string }[],
): Reviewer[] {
  const latestByUser = new Map<string, string>()

  // Process reviews sorted by date (newest first) to get latest state per user
  const sorted = [...reviews]
    .filter((r) => r.state !== 'PENDING')
    .sort(
      (a, b) =>
        new Date(b.submitted_at ?? '').getTime() -
        new Date(a.submitted_at ?? '').getTime(),
    )

  for (const review of sorted) {
    if (!latestByUser.has(review.user.login)) {
      latestByUser.set(review.user.login, review.state)
    }
  }

  const reviewers: Reviewer[] = []
  const seen = new Set<string>()

  // Add reviewers who have already reviewed
  for (const [login, status] of latestByUser) {
    reviewers.push({ login, status })
    seen.add(login)
  }

  // Add requested reviewers who haven't reviewed yet
  for (const r of requestedReviewers) {
    if (!seen.has(r.login)) {
      reviewers.push({ login: r.login, status: 'PENDING' })
      seen.add(r.login)
    }
  }

  return reviewers
}

export function ReReviewModal({
  reviewers,
  onSubmit,
  onClose,
  isSubmitting,
  error,
}: ReReviewModalProps): React.ReactElement {
  const theme = useTheme()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useInput(
    (_input, key) => {
      if (isSubmitting) return

      if (key.escape) {
        onClose()
      } else if (_input === 'j' || key.downArrow) {
        setSelectedIndex((prev) => Math.min(prev + 1, reviewers.length - 1))
      } else if (_input === 'k' || key.upArrow) {
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (key.return && !key.ctrl && !key.meta) {
        const reviewer = reviewers[selectedIndex]
        if (reviewer) {
          setSelected((prev) => {
            if (prev.has(reviewer.login)) {
              return new Set([...prev].filter((r) => r !== reviewer.login))
            }
            return new Set([...prev, reviewer.login])
          })
        }
      } else if (key.return && (key.ctrl || key.meta)) {
        if (selected.size > 0) {
          onSubmit([...selected])
        }
      } else if (_input === 's' && key.ctrl) {
        if (selected.size > 0) {
          onSubmit([...selected])
        }
      }
    },
    { isActive: true },
  )

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        backgroundColor={theme.colors.bg}
        paddingX={2}
        paddingY={1}
        gap={1}
        width={50}
      >
        <Text color={theme.colors.accent} bold>
          Request Re-Review
        </Text>

        <Text color={theme.colors.muted}>Select reviewers:</Text>

        <Box flexDirection="column">
          {reviewers.map((reviewer, index) => {
            const isSelected = selected.has(reviewer.login)
            const isFocused = index === selectedIndex
            const statusColor = getStatusColor(reviewer.status, theme)

            return (
              <Box key={reviewer.login} gap={1}>
                <Text color={isFocused ? theme.colors.accent : theme.colors.muted}>
                  {isFocused ? '>' : ' '}
                </Text>
                <Text color={isSelected ? theme.colors.accent : theme.colors.muted}>
                  [{isSelected ? 'x' : ' '}]
                </Text>
                <Text
                  color={isFocused ? theme.colors.text : theme.colors.secondary}
                  bold={isFocused}
                >
                  {reviewer.login}
                </Text>
                <Text color={statusColor}>
                  ({getStatusLabel(reviewer.status)})
                </Text>
              </Box>
            )
          })}
        </Box>

        {selected.size > 0 && (
          <Text color={theme.colors.info}>
            {selected.size} reviewer{selected.size > 1 ? 's' : ''} selected
          </Text>
        )}

        {isSubmitting && (
          <Text color={theme.colors.info}>Requesting re-review...</Text>
        )}

        {error && (
          <Text color={theme.colors.error}>{error}</Text>
        )}

        <Text color={theme.colors.muted} dimColor>
          j/k: navigate | Enter: toggle | Ctrl+S: submit | Esc: cancel
        </Text>
      </Box>
    </Modal>
  )
}
