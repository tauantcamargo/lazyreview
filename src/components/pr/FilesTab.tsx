import React, { useState, useEffect } from 'react'
import { Box, Text, List, useList, useListItem } from 'tuir'
import { useTheme } from '../../theme/index'
import type { FileChange } from '../../models/file-change'
import type { Hunk, DiffLine } from '../../models/diff'
import { parseDiffPatch } from '../../models/diff'
import { EmptyState } from '../common/EmptyState'

interface FilesTabProps {
  readonly files: readonly FileChange[]
}

function FileItem(): React.ReactElement {
  const theme = useTheme()
  const { item, isFocus } = useListItem<FileChange[]>()

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
    <Box
      paddingX={1}
      backgroundColor={isFocus ? theme.colors.listSelectedBg : undefined}
    >
      <Box gap={1} width="100%">
        <Text color={statusColor} bold>
          {statusIcon}
        </Text>
        <Text
          color={isFocus ? theme.colors.listSelectedFg : theme.colors.text}
          bold={isFocus}
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
  const mutableFiles = [...files]
  const { listView, control } = useList(mutableFiles, {
    navigation: 'vi-vertical',
    unitSize: 1,
  })

  const selectedFile = mutableFiles[control.currentIndex] ?? null
  const hunks = selectedFile?.patch
    ? parseDiffPatch(selectedFile.patch)
    : []

  if (files.length === 0) {
    return <EmptyState message="No files changed" />
  }

  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box flexDirection="column" width="40%">
        <List listView={listView}>
          <FileItem />
        </List>
      </Box>
      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        <DiffView hunks={hunks} />
      </Box>
    </Box>
  )
}
