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
  | { indent: number; type: 'dir'; name: string }
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

interface FileItemProps {
  readonly item: FileChange
  readonly isFocus: boolean
  readonly isSelected: boolean
}

export function FileItem({
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

