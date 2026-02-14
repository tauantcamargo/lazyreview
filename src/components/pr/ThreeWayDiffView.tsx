import React, { useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import { buildThreeWayView, countConflicts } from '../../utils/three-way-diff'
import type { ThreeWayChunk } from '../../utils/three-way-diff'
import { useConflictNavigation } from '../../hooks/useConflictNavigation'

interface ThreeWayDiffViewProps {
  readonly content: string
  readonly filename: string
  readonly isActive: boolean
  readonly onBack: () => void
}

/**
 * Three-pane conflict visualization component.
 *
 * Displays file content split into three columns:
 * - Ours (HEAD): Changes from the current branch
 * - Base (Common): The common ancestor content
 * - Theirs (Target): Changes from the target branch
 *
 * Common (non-conflict) lines appear identically in all three columns.
 * Conflict regions are highlighted with distinct colors per column.
 *
 * Navigation: ]c / [c to move between conflicts, Escape to go back.
 */
export function ThreeWayDiffView({
  content,
  filename,
  isActive,
  onBack,
}: ThreeWayDiffViewProps): React.ReactElement {
  const theme = useTheme()

  const chunks = useMemo(() => buildThreeWayView(content), [content])
  const conflictCount = useMemo(() => countConflicts(chunks), [chunks])

  const conflictRegions = useMemo(
    () =>
      chunks
        .filter((c): c is Extract<ThreeWayChunk, { type: 'conflict' }> => c.type === 'conflict')
        .map((c) => c.region),
    [chunks],
  )

  const { currentIndex, goNext, goPrev } = useConflictNavigation(
    conflictRegions,
    isActive,
  )

  // Handle keyboard input
  useInput(
    (input, key) => {
      if (key.escape) {
        onBack()
        return
      }

      if (input === ']') {
        goNext()
        return
      }

      if (input === '[') {
        goPrev()
        return
      }
    },
    { isActive },
  )

  const shortFilename = filename.split('/').pop() ?? filename

  // No conflicts: show empty state
  if (conflictCount === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box gap={1}>
          <Text color={theme.colors.accent} bold>
            {shortFilename}
          </Text>
        </Box>
        <Box paddingY={1}>
          <Text color={theme.colors.muted}>No conflicts found in this file</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Header bar */}
      <Box
        paddingX={1}
        gap={2}
        borderStyle="single"
        borderColor={theme.colors.border}
      >
        <Text color={theme.colors.accent} bold>
          {shortFilename}
        </Text>
        <Text color={theme.colors.warning} bold>
          Conflict {currentIndex + 1}/{conflictCount}
        </Text>
        <Text color={theme.colors.muted}>
          ]c/[c navigate | Esc back
        </Text>
      </Box>

      {/* Column headers */}
      <Box flexDirection="row">
        <Box flexGrow={1} flexBasis={0} minWidth={0} justifyContent="center">
          <Text color={theme.colors.diffAdd} bold>
            Ours (HEAD)
          </Text>
        </Box>
        <Box width={1} flexShrink={0}>
          <Text color={theme.colors.border}>|</Text>
        </Box>
        <Box flexGrow={1} flexBasis={0} minWidth={0} justifyContent="center">
          <Text color={theme.colors.muted} bold>
            Base (Common)
          </Text>
        </Box>
        <Box width={1} flexShrink={0}>
          <Text color={theme.colors.border}>|</Text>
        </Box>
        <Box flexGrow={1} flexBasis={0} minWidth={0} justifyContent="center">
          <Text color={theme.colors.diffDel} bold>
            Theirs (Target)
          </Text>
        </Box>
      </Box>

      {/* Content rows */}
      <Box flexDirection="column" flexGrow={1}>
        {chunks.map((chunk, chunkIndex) => (
          <ThreeWayChunkView
            key={chunkIndex}
            chunk={chunk}
            chunkIndex={chunkIndex}
            currentConflictIndex={currentIndex}
            chunks={chunks}
          />
        ))}
      </Box>
    </Box>
  )
}

interface ThreeWayChunkViewProps {
  readonly chunk: ThreeWayChunk
  readonly chunkIndex: number
  readonly currentConflictIndex: number
  readonly chunks: readonly ThreeWayChunk[]
}

/**
 * Renders a single chunk -- either common lines across all three columns,
 * or a conflict region with separate ours/base/theirs content.
 */
function ThreeWayChunkView({
  chunk,
  chunkIndex,
  currentConflictIndex,
  chunks,
}: ThreeWayChunkViewProps): React.ReactElement {
  const theme = useTheme()

  if (chunk.type === 'common') {
    return (
      <Box flexDirection="column">
        {chunk.lines.map((line, lineIndex) => (
          <Box key={`common-${chunkIndex}-${lineIndex}`} flexDirection="row">
            <Box flexGrow={1} flexBasis={0} minWidth={0} overflow="hidden">
              <Text color={theme.colors.text} wrap="truncate-end">
                {line}
              </Text>
            </Box>
            <Box width={1} flexShrink={0}>
              <Text color={theme.colors.border}>|</Text>
            </Box>
            <Box flexGrow={1} flexBasis={0} minWidth={0} overflow="hidden">
              <Text color={theme.colors.text} wrap="truncate-end">
                {line}
              </Text>
            </Box>
            <Box width={1} flexShrink={0}>
              <Text color={theme.colors.border}>|</Text>
            </Box>
            <Box flexGrow={1} flexBasis={0} minWidth={0} overflow="hidden">
              <Text color={theme.colors.text} wrap="truncate-end">
                {line}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
    )
  }

  // Conflict chunk: determine if this is the currently focused conflict
  const conflictIndex = getConflictIndex(chunks, chunkIndex)
  const isFocused = conflictIndex === currentConflictIndex

  const { ours, base, theirs } = chunk.region
  const maxLines = Math.max(ours.length, base.length, theirs.length, 1)

  return (
    <Box
      flexDirection="column"
      borderStyle={isFocused ? 'bold' : undefined}
      borderColor={isFocused ? theme.colors.warning : undefined}
    >
      {Array.from({ length: maxLines }, (_, lineIndex) => {
        const oursLine = ours[lineIndex]
        const baseLine = base[lineIndex]
        const theirsLine = theirs[lineIndex]

        return (
          <Box key={`conflict-${chunkIndex}-${lineIndex}`} flexDirection="row">
            <Box
              flexGrow={1}
              flexBasis={0}
              minWidth={0}
              overflow="hidden"
              backgroundColor={theme.colors.diffAddHighlight}
            >
              <Text
                color={theme.colors.diffAdd}
                wrap="truncate-end"
              >
                {oursLine ?? ''}
              </Text>
            </Box>
            <Box width={1} flexShrink={0}>
              <Text color={theme.colors.border}>|</Text>
            </Box>
            <Box
              flexGrow={1}
              flexBasis={0}
              minWidth={0}
              overflow="hidden"
            >
              <Text
                color={theme.colors.muted}
                wrap="truncate-end"
              >
                {baseLine ?? ''}
              </Text>
            </Box>
            <Box width={1} flexShrink={0}>
              <Text color={theme.colors.border}>|</Text>
            </Box>
            <Box
              flexGrow={1}
              flexBasis={0}
              minWidth={0}
              overflow="hidden"
              backgroundColor={theme.colors.diffDelHighlight}
            >
              <Text
                color={theme.colors.diffDel}
                wrap="truncate-end"
              >
                {theirsLine ?? ''}
              </Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

/**
 * Get the conflict index for a given chunk position within the chunks array.
 * Only counts conflict-type chunks up to the given position.
 */
function getConflictIndex(
  chunks: readonly ThreeWayChunk[],
  targetChunkIndex: number,
): number {
  let conflictIdx = 0
  for (let i = 0; i < chunks.length; i++) {
    if (i === targetChunkIndex) return conflictIdx
    if (chunks[i]!.type === 'conflict') conflictIdx++
  }
  return conflictIdx
}
