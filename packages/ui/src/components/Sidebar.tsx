import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Key } from 'ink';
import type { Theme } from '../theme';
import { defaultTheme } from '../theme';

export type SidebarItem = {
  id: string;
  label: string;
  count?: number;
  indent?: number;
  icon?: string;
  expanded?: boolean;
  children?: SidebarItem[];
};

export type SidebarProps = {
  title?: string;
  items: SidebarItem[];
  width?: number;
  height?: number;
  isActive?: boolean;
  theme?: Theme;
  onSelect?: (item: SidebarItem, index: number) => void;
  onToggle?: (item: SidebarItem, index: number) => void;
};

function flattenItems(items: SidebarItem[], parentExpanded = true): SidebarItem[] {
  const result: SidebarItem[] = [];
  for (const item of items) {
    if (parentExpanded) {
      result.push(item);
    }
    if (item.children && item.expanded !== false) {
      const childItems = flattenItems(item.children, parentExpanded && item.expanded !== false);
      result.push(...childItems);
    }
  }
  return result;
}

export function Sidebar({
  title = 'Repositories',
  items,
  width = 20,
  height = 20,
  isActive = false,
  theme = defaultTheme,
  onSelect,
  onToggle,
}: SidebarProps): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  const flatItems = flattenItems(items);
  const visibleHeight = Math.max(1, height - 2);

  useInput((input: string, key: Key) => {
    if (!isActive) return;

    if (key.downArrow || input === 'j') {
      const nextIndex = Math.min(selectedIndex + 1, flatItems.length - 1);
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
      const item = flatItems[selectedIndex];
      if (item) {
        if (item.children && item.children.length > 0) {
          onToggle?.(item, selectedIndex);
        } else {
          onSelect?.(item, selectedIndex);
        }
      }
    }

    if (input === 'h') {
      const item = flatItems[selectedIndex];
      if (item && item.children && item.expanded !== false) {
        onToggle?.(item, selectedIndex);
      }
    }
  });

  const visibleItems = flatItems.slice(scrollOffset, scrollOffset + visibleHeight);

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
      </Box>
      <Box flexDirection="column" paddingX={1}>
        {visibleItems.map((item, i) => {
          const actualIndex = scrollOffset + i;
          const isSelected = actualIndex === selectedIndex;
          const indent = (item.indent ?? 0) * 2;
          const icon = item.children
            ? item.expanded !== false
              ? '▾'
              : '▸'
            : ' ';

          return (
            <Box key={item.id}>
              <Text>
                {''.padStart(indent)}
                <Text color={isSelected && isActive ? theme.accent : theme.muted}>
                  {icon}{' '}
                </Text>
                <Text
                  bold={isSelected}
                  inverse={isSelected && isActive}
                  color={isSelected ? theme.text : theme.muted}
                >
                  {item.label.slice(0, width - indent - 8)}
                </Text>
                {item.count !== undefined && (
                  <Text color={theme.muted}> ({item.count})</Text>
                )}
              </Text>
            </Box>
          );
        })}
      </Box>
      {flatItems.length > visibleHeight && (
        <Box justifyContent="flex-end" paddingX={1}>
          <Text dimColor>
            {scrollOffset + 1}-{Math.min(scrollOffset + visibleHeight, flatItems.length)}/
            {flatItems.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}
