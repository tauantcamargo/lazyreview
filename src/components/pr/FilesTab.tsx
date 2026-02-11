import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { useTheme } from '../../theme/index'
import { useListNavigation } from '../../hooks/useListNavigation'
import type { FileChange } from '../../models/file-change'
import type { Hunk } from '../../models/diff'
import { parseDiffPatch } from '../../models/diff'
import { EmptyState } from '../common/EmptyState'

interface FilesTabProps {
  readonly files: readonly FileChange[]
}

interface FileItemProps {
  readonly item: FileChange
  readonly isFocus: boolean
}

function FileItem({ item, isFocus }: FileItemProps): React.ReactElement {
  const theme = useTheme()

  const statusColor =
    item.status === 'added'
      ? theme.colors.diffAdd
      : item.status === 'removed'
        ? theme.colors.diffDel
        : theme.colors.warning

  const statusIcon =
    item.status === 'added'
      ? 'A'
      : item.status === 'removed'
        ? 'D'
        : item.status === 'renamed'
          ? 'R'
          : 'M'

  return (
    <Box paddingX={1}>
      <Box gap={1} width="100%">
        <Text color={statusColor} bold>
          {statusIcon}
        </Text>
        <Text
          color={isFocus ? theme.colors.listSelectedFg : theme.colors.text}
          bold={isFocus}
          inverse={isFocus}
        >
          {item.filename}
        </Text>
        <Box flexGrow={1} />
        <Text color={theme.colors.diffAdd}>+{item.additions}</Text>
        <Text color={theme.colors.diffDel}>-{item.deletions}</Text>
      </Box>
    </Box>
  )
}

function DiffView({
  hunks,
}: {
  readonly hunks: readonly Hunk[]
}): React.ReactElement {
  const theme = useTheme()

  if (hunks.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color={theme.colors.muted}>No diff available</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {hunks.map((hunk, hunkIndex) => (
        <Box key={hunkIndex} flexDirection="column">
          {hunk.lines.map((line, lineIndex) => {
            const color =
              line.type === 'add'
                ? theme.colors.diffAdd
                : line.type === 'del'
                  ? theme.colors.diffDel
                  : line.type === 'header'
                    ? theme.colors.info
                    : theme.colors.text

            const prefix =
              line.type === 'add'
                ? '+'
                : line.type === 'del'
                  ? '-'
                  : line.type === 'header'
                    ? ''
                    : ' '

            return (
              <Text key={`${hunkIndex}-${lineIndex}`} color={color}>
                {prefix}
                {line.content}
              </Text>
            )
          })}
        </Box>
      ))}
    </Box>
  )
}

export function FilesTab({ files }: FilesTabProps): React.ReactElement {
  const { stdout } = useStdout()
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - 10)

  const { selectedIndex, scrollOffset } = useListNavigation({
    itemCount: files.length,
    viewportHeight,
    isActive: true,
  })

  const selectedFile = files[selectedIndex] ?? null
  const hunks = selectedFile?.patch ? parseDiffPatch(selectedFile.patch) : []

  if (files.length === 0) {
    return <EmptyState message="No files changed" />
  }

  const visibleFiles = files.slice(scrollOffset, scrollOffset + viewportHeight)

  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box flexDirection="column" width="40%">
        {visibleFiles.map((file, index) => (
          <FileItem
            key={file.sha ?? file.filename}
            item={file}
            isFocus={scrollOffset + index === selectedIndex}
          />
        ))}
      </Box>
      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        <DiffView hunks={hunks} />
      </Box>
    </Box>
  )
}
