import React, { useState, useCallback, useMemo, ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme, Theme } from '../theme';

export interface TreeNode<T = unknown> {
  id: string;
  label: string;
  icon?: string;
  data?: T;
  children?: TreeNode<T>[];
}

export interface TreeProps<T = unknown> {
  nodes: TreeNode<T>[];
  selectedId?: string;
  expandedIds?: string[];
  onSelect?: (node: TreeNode<T>) => void;
  onExpand?: (nodeId: string, isExpanded: boolean) => void;
  isFocused?: boolean;
  showIcons?: boolean;
  indentSize?: number;
  theme?: Theme;
}

/**
 * Tree component for hierarchical data
 */
export function Tree<T = unknown>({
  nodes,
  selectedId,
  expandedIds = [],
  onSelect,
  onExpand,
  isFocused = true,
  showIcons = true,
  indentSize = 2,
  theme = getTheme(),
}: TreeProps<T>): React.ReactElement {
  // Flatten tree for keyboard navigation
  const flatNodes = useMemo(() => {
    const result: Array<{ node: TreeNode<T>; depth: number; hasChildren: boolean }> = [];

    const flatten = (nodeList: TreeNode<T>[], depth: number) => {
      for (const node of nodeList) {
        const hasChildren = (node.children?.length ?? 0) > 0;
        result.push({ node, depth, hasChildren });

        if (hasChildren && expandedIds.includes(node.id)) {
          flatten(node.children ?? [], depth + 1);
        }
      }
    };

    flatten(nodes, 0);
    return result;
  }, [nodes, expandedIds]);

  const [highlightIndex, setHighlightIndex] = useState(() => {
    if (!selectedId) return 0;
    const idx = flatNodes.findIndex((n) => n.node.id === selectedId);
    return idx >= 0 ? idx : 0;
  });

  const highlightedNode = flatNodes[highlightIndex];

  useInput(
    (input, key) => {
      if (key.upArrow || input === 'k') {
        setHighlightIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key.downArrow || input === 'j') {
        setHighlightIndex((prev) => Math.min(flatNodes.length - 1, prev + 1));
        return;
      }

      if (key.return) {
        if (highlightedNode) {
          onSelect?.(highlightedNode.node);
        }
        return;
      }

      if (key.rightArrow || input === 'l') {
        if (highlightedNode?.hasChildren) {
          onExpand?.(highlightedNode.node.id, true);
        }
        return;
      }

      if (key.leftArrow || input === 'h') {
        if (highlightedNode?.hasChildren && expandedIds.includes(highlightedNode.node.id)) {
          onExpand?.(highlightedNode.node.id, false);
        }
        return;
      }
    },
    { isActive: isFocused }
  );

  return (
    <Box flexDirection="column">
      {flatNodes.map(({ node, depth, hasChildren }, index) => {
        const isHighlighted = index === highlightIndex;
        const isSelected = node.id === selectedId;
        const isExpanded = expandedIds.includes(node.id);

        const indent = ' '.repeat(depth * indentSize);
        const arrow = hasChildren ? (isExpanded ? '▾' : '▸') : ' ';

        return (
          <Box key={node.id}>
            <Text color={theme.muted}>{indent}</Text>
            <Text color={hasChildren ? theme.accent : theme.muted}>{arrow}</Text>
            {showIcons && node.icon && (
              <Text> {node.icon}</Text>
            )}
            <Text
              color={
                isHighlighted
                  ? theme.listSelectedForeground
                  : isSelected
                    ? theme.accent
                    : theme.text
              }
              backgroundColor={
                isHighlighted ? theme.listSelectedBackground : undefined
              }
            >
              {' '}{node.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

export interface FileTreeNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  status?: 'added' | 'modified' | 'deleted' | 'renamed';
  additions?: number;
  deletions?: number;
  children?: FileTreeNode[];
}

export interface FileTreeViewProps {
  files: FileTreeNode[];
  selectedPath?: string;
  expandedPaths?: string[];
  onSelect?: (file: FileTreeNode) => void;
  onExpand?: (path: string, isExpanded: boolean) => void;
  isFocused?: boolean;
  showStats?: boolean;
  theme?: Theme;
}

/**
 * File tree specialized for code review
 */
export function FileTreeView({
  files,
  selectedPath,
  expandedPaths = [],
  onSelect,
  onExpand,
  isFocused = true,
  showStats = true,
  theme = getTheme(),
}: FileTreeViewProps): React.ReactElement {
  const getIcon = (file: FileTreeNode): string => {
    if (file.type === 'directory') return '📁';

    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return '🔷';
      case 'js':
      case 'jsx':
        return '🟨';
      case 'json':
        return '📋';
      case 'md':
        return '📝';
      case 'css':
      case 'scss':
        return '🎨';
      case 'html':
        return '🌐';
      case 'go':
        return '🐹';
      case 'rs':
        return '🦀';
      case 'py':
        return '🐍';
      default:
        return '📄';
    }
  };

  const getStatusIndicator = (status?: string): { icon: string; color: string } => {
    switch (status) {
      case 'added':
        return { icon: '+', color: theme.added };
      case 'deleted':
        return { icon: '-', color: theme.removed };
      case 'modified':
        return { icon: '~', color: theme.modified };
      case 'renamed':
        return { icon: '→', color: theme.accent };
      default:
        return { icon: ' ', color: theme.muted };
    }
  };

  // Convert to TreeNode format
  const treeNodes = useMemo(() => {
    const convert = (fileNodes: FileTreeNode[]): TreeNode<FileTreeNode>[] => {
      return fileNodes.map((file) => ({
        id: file.path,
        label: file.name,
        icon: getIcon(file),
        data: file,
        children: file.children ? convert(file.children) : undefined,
      }));
    };

    return convert(files);
  }, [files]);

  return (
    <Box flexDirection="column">
      <Tree<FileTreeNode>
        nodes={treeNodes}
        selectedId={selectedPath}
        expandedIds={expandedPaths}
        onSelect={(node) => node.data && onSelect?.(node.data)}
        onExpand={onExpand}
        isFocused={isFocused}
        showIcons={true}
        theme={theme}
      />
    </Box>
  );
}

export interface TreeItemProps {
  label: string;
  icon?: string;
  isSelected?: boolean;
  isExpanded?: boolean;
  hasChildren?: boolean;
  depth?: number;
  suffix?: ReactNode;
  theme?: Theme;
}

/**
 * Individual tree item component
 */
export function TreeItem({
  label,
  icon,
  isSelected = false,
  isExpanded = false,
  hasChildren = false,
  depth = 0,
  suffix,
  theme = getTheme(),
}: TreeItemProps): React.ReactElement {
  const indent = ' '.repeat(depth * 2);
  const arrow = hasChildren ? (isExpanded ? '▾' : '▸') : ' ';

  return (
    <Box>
      <Text color={theme.muted}>{indent}</Text>
      <Text color={hasChildren ? theme.accent : theme.muted}>{arrow}</Text>
      {icon && <Text> {icon}</Text>}
      <Text
        color={isSelected ? theme.accent : theme.text}
        bold={isSelected}
      >
        {' '}{label}
      </Text>
      {suffix && <Text color={theme.muted}> {suffix}</Text>}
    </Box>
  );
}
