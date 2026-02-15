/**
 * Vertical chain visualization for stacked/dependent PRs.
 *
 * Renders an ordered sequence of PRs with color-coded status indicators,
 * arrow connectors, and navigation support.
 *
 * Collapsed by default; toggle with 'D' (or configurable key).
 * j/k navigates chain nodes when expanded and active.
 * Enter on a node navigates to that PR.
 *
 * Hidden entirely when chain has fewer than 2 nodes (handled internally).
 */
import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import type { ThemeColors } from '../../theme/types'
import type { PRChainNode, ChainStatus } from '../../utils/pr-chain'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PRChainViewProps {
  readonly chain: readonly PRChainNode[]
  readonly chainStatus: ChainStatus
  readonly isActive: boolean
  readonly onNavigateToPR?: (prNumber: number) => void
  readonly defaultExpanded?: boolean
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function getStatusColor(
  status: PRChainNode['status'],
  colors: ThemeColors,
): string {
  const colorMap: Record<PRChainNode['status'], string> = {
    merged: colors.info,
    approved: colors.success,
    open: colors.warning,
    draft: colors.muted,
    conflicts: colors.error,
  }
  return colorMap[status]
}

function getChainStatusColor(
  chainStatus: ChainStatus,
  colors: ThemeColors,
): string {
  const colorMap: Record<ChainStatus, string> = {
    ready: colors.success,
    waiting: colors.warning,
    blocked: colors.error,
  }
  return colorMap[chainStatus]
}

function getStatusIcon(status: PRChainNode['status']): string {
  const iconMap: Record<PRChainNode['status'], string> = {
    merged: '~',
    approved: '+',
    open: '*',
    draft: '-',
    conflicts: '!',
  }
  return iconMap[status]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PRChainView({
  chain,
  chainStatus,
  isActive,
  onNavigateToPR,
  defaultExpanded = false,
}: PRChainViewProps): React.ReactElement | null {
  const theme = useTheme()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const currentIdx = chain.findIndex((n) => n.isCurrentlyViewing)
    return currentIdx >= 0 ? currentIdx : 0
  })

  useInput(
    (input, key) => {
      // Toggle expand/collapse with 'D' (shift+d)
      if (input === 'D' && !key.ctrl && !key.meta) {
        setIsExpanded((prev) => !prev)
        return
      }

      if (!isExpanded) return

      // Navigate chain nodes
      if (input === 'j' || key.downArrow) {
        setSelectedIndex((prev) => Math.min(prev + 1, chain.length - 1))
        return
      }
      if (input === 'k' || key.upArrow) {
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      // Navigate to selected PR
      if (key.return && onNavigateToPR && chain[selectedIndex]) {
        onNavigateToPR(chain[selectedIndex].pr.number)
      }
    },
    { isActive },
  )

  // Don't render for single-node chains (no stacking)
  if (chain.length < 2) {
    return null
  }

  const toggleHint = isExpanded ? '[D: collapse]' : '[D: expand]'
  const statusColor = getChainStatusColor(chainStatus, theme.colors)

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      borderStyle="single"
      borderColor={theme.colors.border}
      overflow="hidden"
    >
      {/* Header */}
      <Box flexDirection="row" gap={1}>
        <Text color={theme.colors.info} bold>
          PR Chain ({chain.length})
        </Text>
        <Text color={statusColor} bold>
          [{chainStatus}]
        </Text>
        <Text color={theme.colors.muted} dimColor>
          {toggleHint}
        </Text>
      </Box>

      {/* Collapsed summary: inline chain */}
      {!isExpanded && (
        <Box flexDirection="row" paddingTop={1} paddingLeft={1} gap={0}>
          {chain.map((node, index) => {
            const color = getStatusColor(node.status, theme.colors)
            const icon = getStatusIcon(node.status)
            const isLast = index === chain.length - 1
            const marker = node.isCurrentlyViewing ? '*' : ''

            return (
              <Box key={node.pr.number} flexDirection="row">
                <Text color={color}>
                  {icon}#{node.pr.number}{marker}
                </Text>
                {!isLast && (
                  <Text color={theme.colors.muted}>{' -> '}</Text>
                )}
              </Box>
            )
          })}
        </Box>
      )}

      {/* Expanded view: vertical list */}
      {isExpanded && (
        <Box flexDirection="column" paddingTop={1} paddingLeft={1}>
          {chain.map((node, index) => {
            const isSelected = index === selectedIndex
            const color = getStatusColor(node.status, theme.colors)
            const icon = getStatusIcon(node.status)
            const isLast = index === chain.length - 1
            const marker = node.isCurrentlyViewing ? '*' : ' '

            return (
              <Box key={node.pr.number} flexDirection="column">
                <Box flexDirection="row" gap={1}>
                  <Text color={isSelected ? theme.colors.accent : theme.colors.muted}>
                    {isSelected ? '>' : ' '}
                  </Text>
                  <Text color={color}>{icon}</Text>
                  <Text color={theme.colors.secondary} bold>
                    #{node.pr.number}
                  </Text>
                  <Text color={theme.colors.text}>
                    {node.pr.title}
                  </Text>
                  <Text color={color}>[{node.status}]</Text>
                  <Text color={theme.colors.accent}>{marker}</Text>
                </Box>
                {!isLast && (
                  <Box paddingLeft={2}>
                    <Text color={theme.colors.muted}>{'  -> '}</Text>
                  </Box>
                )}
              </Box>
            )
          })}
          {onNavigateToPR && (
            <Box paddingTop={1}>
              <Text color={theme.colors.muted} dimColor>
                <Text color={theme.colors.accent}>Enter</Text> go to PR{' '}
                <Text color={theme.colors.accent}>[d/]d</Text> prev/next dep
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
