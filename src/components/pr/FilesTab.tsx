import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { UnorderedList } from '@inkjs/ui'
import { ScrollList, type ScrollListRef } from 'ink-scroll-list'
import SyntaxHighlight from 'ink-syntax-highlight'
import { useTheme } from '../../theme/index'
import { useListNavigation } from '../../hooks/useListNavigation'
import type { FileChange } from '../../models/file-change'
import type { Hunk, DiffLine } from '../../models/diff'
import { parseDiffPatch } from '../../models/diff'
import { EmptyState } from '../common/EmptyState'

type TreeNode =
  | { type: 'dir'; name: string; children: TreeNode[] }
  | { type: 'file'; file: FileChange }

interface DirNode {
  dirs: Record<string, DirNode>
  files: FileChange[]
}

function buildFileTree(files: readonly FileChange[]): TreeNode[] {
  const root: DirNode = { dirs: {}, files: [] }
  for (const file of files) {
    const parts = file.filename.split('/')
    let current = root
    for (let i = 0; i < parts.length - 1; i++) {
      const segment = parts[i]!
      if (!current.dirs[segment]) {
        current.dirs[segment] = { dirs: {}, files: [] }
      }
      current = current.dirs[segment]
    }
    const leafName = parts[parts.length - 1] ?? file.filename
    current.files.push(file)
  }

  function toTree(node: DirNode): TreeNode[] {
    const result: TreeNode[] = []
    const dirNames = Object.keys(node.dirs).sort((a, b) => a.localeCompare(b))
    const files = [...node.files].sort((a, b) =>
      a.filename.localeCompare(b.filename),
    )
    for (const name of dirNames) {
      result.push({
        type: 'dir',
        name,
        children: toTree(node.dirs[name]!),
      })
    }
    for (const file of files) {
      result.push({ type: 'file', file })
    }
    return result
  }

  return toTree(root)
}

function flattenTreeToFiles(nodes: TreeNode[]): FileChange[] {
  const out: FileChange[] = []
  function walk(n: TreeNode[]) {
    for (const node of n) {
      if (node.type === 'file') out.push(node.file)
      else walk(node.children)
    }
  }
  walk(nodes)
  return out
}

type DisplayRow =
  | { indent: number; type: 'dir'; name: string }
  | {
      indent: number
      type: 'file'
      name: string
      file: FileChange
      fileIndex: number
    }

function buildDisplayRows(
  nodes: TreeNode[],
  indent = 0,
  fileIndexRef: { current: number },
): DisplayRow[] {
  const rows: DisplayRow[] = []
  for (const node of nodes) {
    if (node.type === 'file') {
      const parts = node.file.filename.split('/')
      const name = parts[parts.length - 1] ?? node.file.filename
      rows.push({
        indent,
        type: 'file',
        name,
        file: node.file,
        fileIndex: fileIndexRef.current,
      })
      fileIndexRef.current += 1
    } else {
      rows.push({ indent, type: 'dir', name: node.name })
      rows.push(...buildDisplayRows(node.children, indent + 1, fileIndexRef))
    }
  }
  return rows
}


function getLanguageFromFilename(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    py: 'python',
    go: 'go',
    rs: 'rust',
    css: 'css',
    scss: 'scss',
    html: 'html',
    yaml: 'yaml',
    yml: 'yaml',
  }
  return ext ? map[ext] : undefined
}

interface InlineCommentContext {
  readonly path: string
  readonly line: number
  readonly side: 'LEFT' | 'RIGHT'
  readonly startLine?: number
  readonly startSide?: 'LEFT' | 'RIGHT'
}

interface FilesTabProps {
  readonly files: readonly FileChange[]
  readonly isActive: boolean
  readonly onInlineComment?: (context: InlineCommentContext) => void
}

type FocusPanel = 'tree' | 'diff'

interface FileItemProps {
  readonly item: FileChange
  readonly isFocus: boolean
  readonly isSelected: boolean
}

function FileItem({
  item,
  isFocus,
  isSelected,
}: FileItemProps): React.ReactElement {
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

  const parts = item.filename.split('/')
  const filename = parts[parts.length - 1] ?? item.filename

  return (
    <Box paddingX={0} gap={1} width="100%">
      <Text color={statusColor} bold>
        {statusIcon}
      </Text>
      <Text
        color={
          isFocus
            ? theme.colors.listSelectedFg
            : isSelected
              ? theme.colors.accent
              : theme.colors.text
        }
        bold={isFocus || isSelected}
        inverse={isFocus}
      >
        {filename}
      </Text>
    </Box>
  )
}

interface FileTreeProps {
  readonly nodes: TreeNode[]
  readonly fileIndexRef: { current: number }
  readonly treeSelectedIndex: number
  readonly selectedFileIndex: number
  readonly isPanelFocused: boolean
}

function FileTree({
  nodes,
  fileIndexRef,
  treeSelectedIndex,
  selectedFileIndex,
  isPanelFocused,
}: FileTreeProps): React.ReactElement {
  const theme = useTheme()
  return (
    <UnorderedList>
      {nodes.map((node) => {
        if (node.type === 'file') {
          const idx = fileIndexRef.current
          fileIndexRef.current += 1
          const isFocus = isPanelFocused && idx === treeSelectedIndex
          const isSelected = idx === selectedFileIndex
          return (
            <UnorderedList.Item key={node.file.filename}>
              <FileItem
                item={node.file}
                isFocus={isFocus}
                isSelected={isSelected}
              />
            </UnorderedList.Item>
          )
        }
        return (
          <UnorderedList.Item key={node.name}>
            <Text color={theme.colors.muted}>{node.name}/</Text>
            <FileTree
              nodes={node.children}
              fileIndexRef={fileIndexRef}
              treeSelectedIndex={treeSelectedIndex}
              selectedFileIndex={selectedFileIndex}
              isPanelFocused={isPanelFocused}
            />
          </UnorderedList.Item>
        )
      })}
    </UnorderedList>
  )
}

interface DiffLineViewProps {
  readonly line: DiffLine
  readonly lineNumber: number
  readonly isFocus: boolean
  readonly isInSelection: boolean
  readonly language?: string
}

function DiffLineView({
  line,
  lineNumber,
  isFocus,
  isInSelection,
  language,
}: DiffLineViewProps): React.ReactElement {
  const theme = useTheme()

  const bgColor = isFocus
    ? theme.colors.selection
    : isInSelection
      ? theme.colors.listSelectedBg
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

  const useSyntaxHighlight =
    line.type === 'context' && language && line.content.trim().length > 0

  return (
    <Box backgroundColor={bgColor}>
      <Box width={5}>
        <Text color={theme.colors.muted}>
          {line.type === 'header' ? '' : String(lineNumber).padStart(4, ' ')}
        </Text>
      </Box>
      {useSyntaxHighlight ? (
        <Box flexDirection="row">
          <Text color={theme.colors.text}>{prefix}</Text>
          <SyntaxHighlight code={line.content} language={language} />
        </Box>
      ) : (
        <Text color={textColor} bold={isFocus} inverse={isFocus}>
          {prefix}
          {line.content}
        </Text>
      )}
    </Box>
  )
}

interface DiffViewProps {
  readonly hunks: readonly Hunk[]
  readonly selectedLine: number
  readonly scrollOffset: number
  readonly viewportHeight: number
  readonly isActive: boolean
  readonly filename?: string
  readonly visualStart?: number | null
}

function DiffView({
  hunks,
  selectedLine,
  scrollOffset,
  viewportHeight,
  isActive,
  filename,
  visualStart,
}: DiffViewProps): React.ReactElement {
  const language = filename ? getLanguageFromFilename(filename) : undefined
  const theme = useTheme()

  if (hunks.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color={theme.colors.muted}>No diff available</Text>
      </Box>
    )
  }

  // Flatten all lines with line numbers
  const allLines: { line: DiffLine; lineNumber: number; hunkIndex: number }[] =
    []
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

  const visibleLines = allLines.slice(
    scrollOffset,
    scrollOffset + viewportHeight,
  )

  const selMin = visualStart != null ? Math.min(visualStart, selectedLine) : -1
  const selMax = visualStart != null ? Math.max(visualStart, selectedLine) : -1

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleLines.map((item, index) => {
        const absIndex = scrollOffset + index
        const isInSelection =
          visualStart != null && absIndex >= selMin && absIndex <= selMax
        return (
          <DiffLineView
            key={`${item.hunkIndex}-${absIndex}`}
            line={item.line}
            lineNumber={item.lineNumber}
            isFocus={isActive && absIndex === selectedLine}
            isInSelection={isInSelection}
            language={language}
          />
        )
      })}
    </Box>
  )
}

export function FilesTab({
  files,
  isActive,
  onInlineComment,
}: FilesTabProps): React.ReactElement {
  const { stdout } = useStdout()
  const theme = useTheme()
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - 10)

  const [focusPanel, setFocusPanel] = useState<FocusPanel>('tree')
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [visualStart, setVisualStart] = useState<number | null>(null)

  const tree = useMemo(() => buildFileTree(files), [files])
  const fileOrder = useMemo(() => flattenTreeToFiles(tree), [tree])
  const displayRows = useMemo(
    () => buildDisplayRows(tree, 0, { current: 0 }),
    [tree],
  )

  const { selectedIndex: treeSelectedIndex } = useListNavigation({
    itemCount: fileOrder.length,
    viewportHeight,
    isActive: isActive && focusPanel === 'tree',
  })

  const treeViewportHeight = viewportHeight - 2
  const fileTreeListRef = useRef<ScrollListRef>(null)
  const selectedRowIndex = displayRows.findIndex(
    (r) => r.type === 'file' && r.fileIndex === treeSelectedIndex,
  )
  const effectiveRowIndex = selectedRowIndex >= 0 ? selectedRowIndex : 0

  useEffect(() => {
    const handleResize = (): void => fileTreeListRef.current?.remeasure()
    stdout?.on('resize', handleResize)
    return () => {
      stdout?.off('resize', handleResize)
    }
  }, [stdout])

  React.useEffect(() => {
    if (focusPanel === 'tree') {
      setSelectedFileIndex(treeSelectedIndex)
    }
  }, [treeSelectedIndex, focusPanel])

  const selectedFile = fileOrder[selectedFileIndex] ?? fileOrder[0] ?? null
  const hunks = selectedFile?.patch ? parseDiffPatch(selectedFile.patch) : []

  const totalDiffLines = hunks.reduce((sum, hunk) => sum + hunk.lines.length, 0)

  const { selectedIndex: diffSelectedLine, scrollOffset: diffScrollOffset } =
    useListNavigation({
      itemCount: totalDiffLines,
      viewportHeight,
      isActive: isActive && focusPanel === 'diff',
    })

  useInput(
    (input, key) => {
      if (key.escape && visualStart != null) {
        setVisualStart(null)
        return
      }

      if (key.tab) {
        setVisualStart(null)
        setFocusPanel((prev) => (prev === 'tree' ? 'diff' : 'tree'))
      } else if (input === 'h' || key.leftArrow) {
        setVisualStart(null)
        setFocusPanel('tree')
      } else if (input === 'l' || key.rightArrow) {
        setFocusPanel('diff')
      } else if (input === 'v' && focusPanel === 'diff') {
        if (visualStart != null) {
          setVisualStart(null)
        } else {
          setVisualStart(diffSelectedLine)
        }
      } else if (input === 'c' && focusPanel === 'diff' && onInlineComment && selectedFile) {
        const allLines: { line: DiffLine; lineNumber: number }[] = []
        let ln = 1
        for (const hunk of hunks) {
          for (const line of hunk.lines) {
            allLines.push({ line, lineNumber: ln })
            if (line.type !== 'header') ln++
          }
        }

        if (visualStart != null) {
          const selMin = Math.min(visualStart, diffSelectedLine)
          const selMax = Math.max(visualStart, diffSelectedLine)
          const startItem = allLines[selMin]
          const endItem = allLines[selMax]
          if (startItem && endItem && startItem.line.type !== 'header' && endItem.line.type !== 'header') {
            const endSide = endItem.line.type === 'del' ? 'LEFT' as const : 'RIGHT' as const
            const startSide = startItem.line.type === 'del' ? 'LEFT' as const : 'RIGHT' as const
            onInlineComment({
              path: selectedFile.filename,
              line: endItem.lineNumber,
              side: endSide,
              startLine: startItem.lineNumber,
              startSide,
            })
            setVisualStart(null)
          }
        } else {
          const selected = allLines[diffSelectedLine]
          if (selected && selected.line.type !== 'header') {
            const side = selected.line.type === 'del' ? 'LEFT' as const : 'RIGHT' as const
            onInlineComment({
              path: selectedFile.filename,
              line: selected.lineNumber,
              side,
            })
          }
        }
      }
    },
    { isActive },
  )

  if (files.length === 0) {
    return <EmptyState message="No files changed" />
  }

  const isPanelFocused = focusPanel === 'tree' && isActive

  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box
        flexDirection="column"
        width="30%"
        borderStyle="single"
        borderColor={
          focusPanel === 'tree' && isActive
            ? theme.colors.accent
            : theme.colors.border
        }
      >
        <Box paddingX={1} paddingY={0}>
          <Text color={theme.colors.accent} bold>
            Files ({files.length})
          </Text>
        </Box>
        <Box
          flexDirection="column"
          paddingX={1}
          overflow="hidden"
          height={treeViewportHeight}
          minHeight={treeViewportHeight}
          flexShrink={0}
        >
          <ScrollList
            ref={fileTreeListRef}
            selectedIndex={effectiveRowIndex}
            scrollAlignment="auto"
          >
            {displayRows.map((row, rowIndex) =>
              row.type === 'dir' ? (
                <Box key={`row-${rowIndex}`} paddingLeft={row.indent * 2}>
                  <Text color={theme.colors.muted}>{row.name}/</Text>
                </Box>
              ) : (
                <Box key={`row-${rowIndex}`} paddingLeft={row.indent * 2}>
                  <FileItem
                    item={row.file}
                    isFocus={
                      isPanelFocused && row.fileIndex === treeSelectedIndex
                    }
                    isSelected={row.fileIndex === selectedFileIndex}
                  />
                </Box>
              ),
            )}
          </ScrollList>
        </Box>
      </Box>

      {/* Diff panel */}
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="single"
        borderColor={
          focusPanel === 'diff' && isActive
            ? theme.colors.accent
            : theme.colors.border
        }
      >
        <Box paddingX={1} paddingY={0} gap={2}>
          <Text color={theme.colors.accent} bold>
            {selectedFile?.filename ?? 'No file selected'}
          </Text>
          {selectedFile && (
            <Box gap={1}>
              <Text color={theme.colors.diffAdd}>
                +{selectedFile.additions}
              </Text>
              <Text color={theme.colors.diffDel}>
                -{selectedFile.deletions}
              </Text>
            </Box>
          )}
          {visualStart != null && focusPanel === 'diff' && (
            <Text color={theme.colors.warning} bold>
              -- VISUAL LINE --
            </Text>
          )}
        </Box>
        <Box flexDirection="column" flexGrow={1} overflowY="hidden">
          <DiffView
            hunks={hunks}
            selectedLine={diffSelectedLine}
            scrollOffset={diffScrollOffset}
            viewportHeight={viewportHeight - 2}
            isActive={isActive && focusPanel === 'diff'}
            filename={selectedFile?.filename}
            visualStart={focusPanel === 'diff' ? visualStart : null}
          />
        </Box>
      </Box>
    </Box>
  )
}
