import React, { useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { useTheme } from '../../theme/index'
import { useListNavigation } from '../../hooks/useListNavigation'
import type { FileChange } from '../../models/file-change'
import type { Hunk, DiffLine } from '../../models/diff'
import { parseDiffPatch } from '../../models/diff'
import { EmptyState } from '../common/EmptyState'

interface FilesTabProps {
  readonly files: readonly FileChange[]
  readonly isActive: boolean
}

type FocusPanel = 'tree' | 'diff'

interface FileItemProps {
  readonly item: FileChange
  readonly isFocus: boolean
  readonly isSelected: boolean
}

function FileItem({ item, isFocus, isSelected }: FileItemProps): React.ReactElement {
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

  // Get just the filename from the full path
  const parts = item.filename.split('/')
  const filename = parts[parts.length - 1] ?? item.filename

  return (
    <Box paddingX={1}>
      <Box gap={1} width="100%">
        <Text color={statusColor} bold>
          {statusIcon}
        </Text>
        <Text
          color={isFocus ? theme.colors.listSelectedFg : isSelected ? theme.colors.accent : theme.colors.text}
          bold={isFocus || isSelected}
          inverse={isFocus}
        >
          {filename}
        </Text>
      </Box>
    </Box>
  )
}

interface DiffLineViewProps {
  readonly line: DiffLine
  readonly lineNumber: number
  readonly isFocus: boolean
}

function DiffLineView({ line, lineNumber, isFocus }: DiffLineViewProps): React.ReactElement {
  const theme = useTheme()

  const bgColor = isFocus
    ? theme.colors.selection
    : line.type === 'add'
      ? undefined
      : line.type === 'del'
        ? undefined
        : undefined

  const textColor =
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
    <Box
      // @ts-ignore
      backgroundColor={bgColor}
    >
      <Box width={5}>
        <Text color={theme.colors.muted}>
          {line.type === 'header' ? '' : String(lineNumber).padStart(4, ' ')}
        </Text>
      </Box>
      <Text color={textColor} bold={isFocus} inverse={isFocus}>
        {prefix}
        {line.content}
      </Text>
    </Box>
  )
}

interface DiffViewProps {
  readonly hunks: readonly Hunk[]
  readonly selectedLine: number
  readonly scrollOffset: number
  readonly viewportHeight: number
  readonly isActive: boolean
}

function DiffView({
  hunks,
  selectedLine,
  scrollOffset,
  viewportHeight,
  isActive,
}: DiffViewProps): React.ReactElement {
  const theme = useTheme()

  if (hunks.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color={theme.colors.muted}>No diff available</Text>
      </Box>
    )
  }

  // Flatten all lines with line numbers
  const allLines: { line: DiffLine; lineNumber: number; hunkIndex: number }[] = []
  let lineNumber = 1

  for (let hunkIndex = 0; hunkIndex < hunks.length; hunkIndex++) {
    const hunk = hunks[hunkIndex]
    for (const line of hunk.lines) {
      allLines.push({ line, lineNumber, hunkIndex })
      if (line.type !== 'header') {
        lineNumber++
      }
    }
  }

  const visibleLines = allLines.slice(scrollOffset, scrollOffset + viewportHeight)

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleLines.map((item, index) => (
        <DiffLineView
          key={`${item.hunkIndex}-${scrollOffset + index}`}
          line={item.line}
          lineNumber={item.lineNumber}
          isFocus={isActive && scrollOffset + index === selectedLine}
        />
      ))}
    </Box>
  )
}

export function FilesTab({ files, isActive }: FilesTabProps): React.ReactElement {
  const { stdout } = useStdout()
  const theme = useTheme()
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - 10)

  const [focusPanel, setFocusPanel] = useState<FocusPanel>('tree')
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)

  // File tree navigation
  const {
    selectedIndex: treeSelectedIndex,
    scrollOffset: treeScrollOffset,
  } = useListNavigation({
    itemCount: files.length,
    viewportHeight,
    isActive: isActive && focusPanel === 'tree',
  })

  // Update selected file when tree selection changes
  React.useEffect(() => {
    if (focusPanel === 'tree') {
      setSelectedFileIndex(treeSelectedIndex)
    }
  }, [treeSelectedIndex, focusPanel])

  const selectedFile = files[selectedFileIndex] ?? null
  const hunks = selectedFile?.patch ? parseDiffPatch(selectedFile.patch) : []

  // Calculate total lines for diff navigation
  const totalDiffLines = hunks.reduce((sum, hunk) => sum + hunk.lines.length, 0)

  // Diff view navigation
  const {
    selectedIndex: diffSelectedLine,
    scrollOffset: diffScrollOffset,
  } = useListNavigation({
    itemCount: totalDiffLines,
    viewportHeight,
    isActive: isActive && focusPanel === 'diff',
  })

  // Handle Tab to switch between panels
  useInput(
    (input, key) => {
      if (key.tab) {
        setFocusPanel((prev) => (prev === 'tree' ? 'diff' : 'tree'))
      } else if (input === 'h' || key.leftArrow) {
        setFocusPanel('tree')
      } else if (input === 'l' || key.rightArrow) {
        setFocusPanel('diff')
      }
    },
    { isActive },
  )

  if (files.length === 0) {
    return <EmptyState message="No files changed" />
  }

  const visibleFiles = files.slice(treeScrollOffset, treeScrollOffset + viewportHeight)

  return (
    <Box flexDirection="row" flexGrow={1}>
      {/* File tree panel */}
      <Box
        flexDirection="column"
        width="30%"
        borderStyle="single"
        borderColor={focusPanel === 'tree' && isActive ? theme.colors.accent : theme.colors.border}
      >
        <Box paddingX={1} paddingY={0}>
          <Text color={theme.colors.accent} bold>
            Files ({files.length})
          </Text>
        </Box>
        <Box flexDirection="column">
          {visibleFiles.map((file, index) => {
            const actualIndex = treeScrollOffset + index
            return (
              <FileItem
                key={file.sha ?? file.filename}
                item={file}
                isFocus={focusPanel === 'tree' && actualIndex === treeSelectedIndex}
                isSelected={actualIndex === selectedFileIndex}
              />
            )
          })}
        </Box>
      </Box>

      {/* Diff panel */}
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="single"
        borderColor={focusPanel === 'diff' && isActive ? theme.colors.accent : theme.colors.border}
      >
        <Box paddingX={1} paddingY={0} gap={2}>
          <Text color={theme.colors.accent} bold>
            {selectedFile?.filename ?? 'No file selected'}
          </Text>
          {selectedFile && (
            <Box gap={1}>
              <Text color={theme.colors.diffAdd}>+{selectedFile.additions}</Text>
              <Text color={theme.colors.diffDel}>-{selectedFile.deletions}</Text>
            </Box>
          )}
        </Box>
        <Box flexDirection="column" flexGrow={1} overflowY="hidden">
          <DiffView
            hunks={hunks}
            selectedLine={diffSelectedLine}
            scrollOffset={diffScrollOffset}
            viewportHeight={viewportHeight - 2}
            isActive={isActive && focusPanel === 'diff'}
          />
        </Box>
      </Box>
    </Box>
  )
}
