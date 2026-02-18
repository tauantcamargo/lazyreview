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

const DOT_THRESHOLD = 5

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
    <Box paddingX={1} gap={1} alignItems="center">
      {/* prev arrow */}
      <Text color={hasPrevPage ? theme.colors.accent : theme.colors.muted} bold={hasPrevPage}>
        {'‹'}
      </Text>

      {/* range display */}
      <Text color={theme.colors.muted}>
        {startIndex + 1}-{endIndex} of {totalItems}
      </Text>

      {/* page indicator: dots for ≤5 pages, numeric otherwise */}
      {totalPages <= DOT_THRESHOLD ? (
        <Box gap={0}>
          {Array.from({ length: totalPages }, (_, i) => (
            <Text
              key={i}
              color={i + 1 === currentPage ? theme.colors.accent : theme.colors.muted}
            >
              {i + 1 === currentPage ? '●' : '○'}
            </Text>
          ))}
        </Box>
      ) : (
        <Text color={theme.colors.muted}>{currentPage}/{totalPages}</Text>
      )}

      {/* next arrow */}
      <Text color={hasNextPage ? theme.colors.accent : theme.colors.muted} bold={hasNextPage}>
        {'›'}
      </Text>
    </Box>
  )
}
