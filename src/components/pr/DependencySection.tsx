/**
 * Collapsible section displaying PR dependency chain.
 *
 * Shows stacked PRs, depends-on, and blocks relationships
 * with color-coded status indicators. Enter on a dependency
 * calls the navigation callback.
 *
 * Collapsed by default; toggle with 'd' keybinding.
 * Hidden entirely when no dependencies are detected (handled by parent).
 */
import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import type { DependencyNode } from '../../utils/pr-dependencies'
import type { ThemeColors } from '../../theme/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DependencySectionProps {
  readonly dependencies: readonly DependencyNode[]
  readonly isActive: boolean
  readonly onNavigate?: (prNumber: number) => void
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function formatRelationshipLabel(
  relationship: 'depends-on' | 'blocks' | 'stacked-on',
): string {
  const labels: Record<string, string> = {
    'depends-on': 'depends on',
    'stacked-on': 'stacked on',
    blocks: 'blocks',
  }
  return labels[relationship] ?? relationship
}

function getStateColor(
  state: 'open' | 'closed' | 'merged',
  colors: ThemeColors,
): string {
  const colorMap: Record<string, string> = {
    open: colors.success,
    merged: colors.info,
    closed: colors.error,
  }
  return colorMap[state] ?? colors.muted
}

function getStateIcon(state: 'open' | 'closed' | 'merged'): string {
  const iconMap: Record<string, string> = {
    open: '*',
    merged: '~',
    closed: 'x',
  }
  return iconMap[state] ?? '?'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DependencySection({
  dependencies,
  isActive,
  onNavigate,
}: DependencySectionProps): React.ReactElement | null {
  const theme = useTheme()
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  useInput(
    (input, key) => {
      if (input === 'd' && !key.ctrl && !key.meta) {
        setIsExpanded((prev) => !prev)
      }
      if (isExpanded) {
        if (input === 'j' || key.downArrow) {
          setSelectedIndex((prev) =>
            Math.min(prev + 1, dependencies.length - 1),
          )
        }
        if (input === 'k' || key.upArrow) {
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
        }
        if (key.return && onNavigate && dependencies[selectedIndex]) {
          onNavigate(dependencies[selectedIndex].prNumber)
        }
      }
    },
    { isActive },
  )

  const toggleHint = isExpanded ? '[d: collapse]' : '[d: expand]'

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      borderStyle="single"
      borderColor={theme.colors.border}
      overflow="hidden"
    >
      {/* Header row */}
      <Box flexDirection="row" gap={1}>
        <Text color={theme.colors.info} bold>
          Dependencies ({dependencies.length})
        </Text>
        <Text color={theme.colors.muted} dimColor>
          {toggleHint}
        </Text>
      </Box>

      {/* Expanded content */}
      {isExpanded && (
        <Box flexDirection="column" paddingTop={1} paddingLeft={1}>
          {dependencies.map((dep, index) => {
            const isSelected = index === selectedIndex
            const stateColor = getStateColor(dep.state, theme.colors)
            const stateIcon = getStateIcon(dep.state)
            const relationLabel = formatRelationshipLabel(dep.relationship)

            return (
              <Box key={dep.prNumber} flexDirection="row" gap={1}>
                <Text color={isSelected ? theme.colors.accent : theme.colors.muted}>
                  {isSelected ? '>' : ' '}
                </Text>
                <Text color={stateColor}>{stateIcon}</Text>
                <Text color={theme.colors.secondary} bold>
                  #{dep.prNumber}
                </Text>
                <Text color={theme.colors.text}>{dep.title}</Text>
                <Text color={stateColor}>[{dep.state}]</Text>
                <Text color={theme.colors.muted} dimColor>
                  ({relationLabel})
                </Text>
              </Box>
            )
          })}
          {onNavigate && dependencies.length > 0 && (
            <Box paddingTop={1}>
              <Text color={theme.colors.muted} dimColor>
                <Text color={theme.colors.accent}>Enter</Text> go to PR
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
