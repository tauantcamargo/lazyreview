import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Key } from 'ink';
import type { Theme } from '../theme';
import { defaultTheme } from '../theme';

export type FileChange = {
  path: string;
  additions: number;
  deletions: number;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
};

export type FileTreeProps = {
  title?: string;
  files: FileChange[];
  width?: number;
  height?: number;
  isActive?: boolean;
  theme?: Theme;
  onSelect?: (file: FileChange, index: number) => void;
};

type TreeNode = {
  name: string;
  path: string;
  isDirectory: boolean;
  expanded: boolean;
  children: TreeNode[];
  file?: FileChange;
  depth: number;
};

function buildTree(files: FileChange[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] ?? '';
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      let node = current.find((n) => n.name === part);
      if (!node) {
        node = {
          name: part,
          path: currentPath,
          isDirectory: !isLast,
          expanded: true,
          children: [],
          file: isLast ? file : undefined,
          depth: i,
        };
        current.push(node);
      }
      current = node.children;
    }
  }

  return root;
}

function flattenTree(nodes: TreeNode[], depth = 0): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    result.push({ ...node, depth });
    if (node.isDirectory && node.expanded && node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1));
    }
  }
  return result;
}

function getFileIcon(file: FileChange): string {
  const ext = file.path.split('.').pop()?.toLowerCase() ?? '';
  const icons: Record<string, string> = {
    ts: '󰛦',
    tsx: '󰜈',
    js: '󰌞',
    jsx: '󰌞',
    json: '󰘦',
    md: '󰍔',
    css: '󰌜',
    scss: '󰌜',
    html: '󰌝',
    go: '󰟓',
    py: '󰌠',
    rs: '󱘗',
    yaml: '󰈙',
    yml: '󰈙',
    sh: '󰆍',
    sql: '󰆼',
  };
  return icons[ext] ?? '󰈔';
}

function getStatusColor(status: FileChange['status'], theme: Theme): string {
  switch (status) {
    case 'added':
      return theme.added;
    case 'deleted':
      return theme.removed;
    case 'renamed':
      return theme.accent;
    default:
      return theme.modified;
  }
}

export function FileTree({
  title = 'Files',
  files,
  width = 30,
  height = 20,
  isActive = false,
  theme = defaultTheme,
  onSelect,
}: FileTreeProps): JSX.Element {
  const tree = useMemo(() => buildTree(files), [files]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  const flatNodes = useMemo(() => {
    function flatten(nodes: TreeNode[], depth = 0): TreeNode[] {
      const result: TreeNode[] = [];
      for (const node of nodes) {
        const isExpanded = expandedPaths.has(node.path) || (!expandedPaths.has(`collapsed:${node.path}`) && node.isDirectory);
        result.push({ ...node, depth, expanded: isExpanded });
        if (node.isDirectory && isExpanded && node.children.length > 0) {
          result.push(...flatten(node.children, depth + 1));
        }
      }
      return result;
    }
    return flatten(tree);
  }, [tree, expandedPaths]);

  const visibleHeight = Math.max(1, height - 2);

  useInput((input: string, key: Key) => {
    if (!isActive) return;

    if (key.downArrow || input === 'j') {
      const nextIndex = Math.min(selectedIndex + 1, flatNodes.length - 1);
      setSelectedIndex(nextIndex);
      if (nextIndex >= scrollOffset + visibleHeight) {
        setScrollOffset(nextIndex - visibleHeight + 1);
      }
    }

    if (key.upArrow || input === 'k') {
      const nextIndex = Math.max(selectedIndex - 1, 0);
      setSelectedIndex(nextIndex);
      if (nextIndex < scrollOffset) {
        setScrollOffset(nextIndex);
      }
    }

    if (key.return || input === 'l') {
      const node = flatNodes[selectedIndex];
      if (node) {
        if (node.isDirectory) {
          setExpandedPaths((prev) => {
            const next = new Set(prev);
            if (node.expanded) {
              next.delete(node.path);
              next.add(`collapsed:${node.path}`);
            } else {
              next.add(node.path);
              next.delete(`collapsed:${node.path}`);
            }
            return next;
          });
        } else if (node.file) {
          onSelect?.(node.file, selectedIndex);
        }
      }
    }

    if (input === 'h') {
      const node = flatNodes[selectedIndex];
      if (node?.isDirectory && node.expanded) {
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(node.path);
          next.add(`collapsed:${node.path}`);
          return next;
        });
      }
    }
  });

  const visibleNodes = flatNodes.slice(scrollOffset, scrollOffset + visibleHeight);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="single"
      borderColor={isActive ? theme.accent : theme.border}
    >
      <Box paddingX={1}>
        <Text bold color={theme.accent}>
          {title}
        </Text>
        <Text color={theme.muted}> ({files.length})</Text>
      </Box>
      <Box flexDirection="column" paddingX={1}>
        {visibleNodes.map((node, i) => {
          const actualIndex = scrollOffset + i;
          const isSelected = actualIndex === selectedIndex;
          const indent = node.depth * 2;

          if (node.isDirectory) {
            return (
              <Box key={node.path}>
                <Text>
                  {''.padStart(indent)}
                  <Text color={theme.muted}>{node.expanded ? '▾' : '▸'} </Text>
                  <Text bold={isSelected} inverse={isSelected && isActive} color={theme.text}>
                    {node.name}/
                  </Text>
                </Text>
              </Box>
            );
          }

          const file = node.file;
          if (!file) return null;

          const statusColor = getStatusColor(file.status, theme);
          const icon = getFileIcon(file);
          const maxNameLen = width - indent - 12;
          const displayName = node.name.length > maxNameLen
            ? `${node.name.slice(0, maxNameLen - 1)}…`
            : node.name;

          return (
            <Box key={node.path}>
              <Text>
                {''.padStart(indent)}
                <Text color={statusColor}>{icon} </Text>
                <Text bold={isSelected} inverse={isSelected && isActive} color={theme.text}>
                  {displayName}
                </Text>
                <Text color={theme.added}> +{file.additions}</Text>
                <Text color={theme.removed}> -{file.deletions}</Text>
              </Text>
            </Box>
          );
        })}
      </Box>
      {flatNodes.length > visibleHeight && (
        <Box justifyContent="flex-end" paddingX={1}>
          <Text dimColor>
            {scrollOffset + 1}-{Math.min(scrollOffset + visibleHeight, flatNodes.length)}/
            {flatNodes.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}
