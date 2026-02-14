import React, { useMemo } from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { FileChange } from '../../models/file-change'

interface DiffStats {
  readonly totalFiles: number
  readonly totalAdditions: number
  readonly totalDeletions: number
}

interface ExtensionEntry {
  readonly ext: string
  readonly count: number
}

interface TopFileEntry {
  readonly filename: string
  readonly totalChanges: number
}

export function computeDiffStats(files: readonly FileChange[]): DiffStats {
  let totalAdditions = 0
  let totalDeletions = 0
  for (const file of files) {
    totalAdditions += file.additions
    totalDeletions += file.deletions
  }
  return {
    totalFiles: files.length,
    totalAdditions,
    totalDeletions,
  }
}

function getFileExtension(filename: string): string {
  const basename = filename.split('/').pop() ?? filename
  const dotIndex = basename.lastIndexOf('.')
  if (dotIndex <= 0) return '(no ext)'
  return basename.slice(dotIndex)
}

export function getExtensionBreakdown(
  files: readonly FileChange[],
): readonly ExtensionEntry[] {
  if (files.length === 0) return []

  const counts = new Map<string, number>()
  for (const file of files) {
    const ext = getFileExtension(file.filename)
    counts.set(ext, (counts.get(ext) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([ext, count]) => ({ ext, count }))
    .sort((a, b) => b.count - a.count)
}

export function getTopFilesByChanges(
  files: readonly FileChange[],
  n: number,
): readonly TopFileEntry[] {
  if (files.length === 0) return []

  return [...files]
    .map((f) => ({
      filename: f.filename.split('/').pop() ?? f.filename,
      totalChanges: f.additions + f.deletions,
    }))
    .sort((a, b) => b.totalChanges - a.totalChanges)
    .slice(0, n)
}

export function formatExtensionBreakdown(
  breakdown: readonly ExtensionEntry[],
): string {
  if (breakdown.length === 0) return ''
  return breakdown.map((e) => `${e.count} ${e.ext}`).join(', ')
}

export function formatTopFiles(top: readonly TopFileEntry[]): string {
  if (top.length === 0) return ''
  return top.map((f) => `${f.filename} (${f.totalChanges})`).join(', ')
}

interface DiffStatsSummaryProps {
  readonly files: readonly FileChange[]
}

export function DiffStatsSummary({
  files,
}: DiffStatsSummaryProps): React.ReactElement | null {
  const theme = useTheme()

  const stats = useMemo(() => computeDiffStats(files), [files])
  const extensionBreakdown = useMemo(
    () => getExtensionBreakdown(files),
    [files],
  )
  const topFiles = useMemo(() => getTopFilesByChanges(files, 3), [files])

  if (files.length === 0) return null

  const extText = formatExtensionBreakdown(extensionBreakdown)
  const topText = formatTopFiles(topFiles)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box gap={1} flexWrap="nowrap">
        <Text color={theme.colors.accent} bold>
          {stats.totalFiles} files
        </Text>
        <Text color={theme.colors.success}>+{stats.totalAdditions}</Text>
        <Text color={theme.colors.error}>-{stats.totalDeletions}</Text>
        <Text color={theme.colors.muted}>|</Text>
        <Text color={theme.colors.text} wrap="truncate-end">
          {extText}
        </Text>
        {topText && (
          <>
            <Text color={theme.colors.muted}>|</Text>
            <Text color={theme.colors.muted} wrap="truncate-end">
              Top: {topText}
            </Text>
          </>
        )}
      </Box>
    </Box>
  )
}
