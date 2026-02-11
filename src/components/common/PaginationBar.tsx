import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'

interface PaginationBarProps {
  readonly currentPage: number
  readonly totalPages: number
  readonly totalItems: number
  readonly startIndex: number
  readonly endIndex: number
  readonly hasNextPage: boolean
  readonly hasPrevPage: boolean
}

export function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  hasNextPage,
  hasPrevPage,
}: PaginationBarProps): React.ReactElement {
  const theme = useTheme()

  if (totalPages <= 1) {
    return (
      <Box paddingX={1}>
        <Text color={theme.colors.muted}>
          {totalItems} item{totalItems !== 1 ? 's' : ''}
        </Text>
      </Box>
    )
  }

  return (
    <Box paddingX={1} gap={2}>
      <Text color={theme.colors.muted}>
        {startIndex + 1}-{endIndex} of {totalItems}
      </Text>
      <Box gap={1}>
        <Text color={hasPrevPage ? theme.colors.accent : theme.colors.muted}>
          {hasPrevPage ? '← [p]rev' : '← prev'}
        </Text>
        <Text color={theme.colors.muted}>│</Text>
        <Text color={theme.colors.text}>
          Page {currentPage}/{totalPages}
        </Text>
        <Text color={theme.colors.muted}>│</Text>
        <Text color={hasNextPage ? theme.colors.accent : theme.colors.muted}>
          {hasNextPage ? '[n]ext →' : 'next →'}
        </Text>
      </Box>
    </Box>
  )
}
