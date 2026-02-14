import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { FileChange } from '../../models/file-change'

export type TreeNode =
  | { type: 'dir'; name: string; children: TreeNode[] }
  | { type: 'file'; file: FileChange }

export interface DirNode {
  dirs: Record<string, DirNode>
  files: FileChange[]
}

export type DisplayRow =
  | { indent: number; type: 'dir'; name: string; dirPath: string; isCollapsed: boolean }
  | {
      indent: number
      type: 'file'
      name: string
      file: FileChange
      fileIndex: number
    }

export function buildFileTree(files: readonly FileChange[]): TreeNode[] {
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

export function flattenTreeToFiles(nodes: TreeNode[]): FileChange[] {
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

export function buildDisplayRows(
  nodes: TreeNode[],
  indent = 0,
  fileIndexRef: { current: number },
  collapsedDirs?: ReadonlySet<string>,
  parentPath = '',
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
      const dirPath = parentPath ? `${parentPath}/${node.name}` : node.name
      const isCollapsed = collapsedDirs?.has(dirPath) ?? false
      rows.push({ indent, type: 'dir', name: node.name, dirPath, isCollapsed })
      if (!isCollapsed) {
        rows.push(
          ...buildDisplayRows(
            node.children,
            indent + 1,
            fileIndexRef,
            collapsedDirs,
            dirPath,
          ),
        )
      } else {
        // Count files in collapsed subtree to advance fileIndexRef
        countFilesInTree(node.children, fileIndexRef)
      }
    }
  }
  return rows
}

/**
 * Advance the fileIndexRef by the number of files in a subtree.
 * Used when a directory is collapsed to keep file indices consistent.
 */
function countFilesInTree(
  nodes: TreeNode[],
  fileIndexRef: { current: number },
): void {
  for (const node of nodes) {
    if (node.type === 'file') {
      fileIndexRef.current += 1
    } else {
      countFilesInTree(node.children, fileIndexRef)
    }
  }
}

interface FileItemProps {
  readonly item: FileChange
  readonly isFocus: boolean
  readonly isSelected: boolean
  readonly isViewed?: boolean
}

export function FileItem({
  item,
  isFocus,
  isSelected,
  isViewed,
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
  const viewedIndicator = isViewed ? '\u2713' : '\u00B7'

  return (
    <Box paddingX={0} gap={1} width="100%" flexWrap="nowrap" minWidth={0}>
      <Text color={isViewed ? theme.colors.success : theme.colors.muted}>
        {viewedIndicator}
      </Text>
      <Text color={statusColor} bold>
        {statusIcon}
      </Text>
      <Box flexGrow={1} minWidth={0} overflow="hidden">
        <Text
          wrap="truncate-end"
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
    </Box>
  )
}

