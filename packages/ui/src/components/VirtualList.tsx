import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput, type Key } from 'ink';
import type { Theme } from '../theme';

export type VirtualListItem = {
  id: string;
  title: string;
  description?: string;
};

type VirtualListProps = {
  items: VirtualListItem[];
  width: number;
  height: number;
  buffer?: number;
  itemHeight?: number;
  title?: string;
  isActive?: boolean;
  theme?: Theme;
  onSelect?: (item: VirtualListItem, index: number) => void;
};

const DEFAULT_ITEM_HEIGHT = 2;
const DEFAULT_BUFFER = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function VirtualList({
  items,
  width,
  height,
  buffer = DEFAULT_BUFFER,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  title = 'List',
  isActive = false,
  theme,
  onSelect,
}: VirtualListProps): JSX.Element {
  const [cursor, setCursor] = useState(0);
  const [filtering, setFiltering] = useState(false);
  const [query, setQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return items;
    }

    const lowered = query.trim().toLowerCase();
    return items.filter((item) => {
      const titleMatch = item.title.toLowerCase().includes(lowered);
      const descMatch = item.description?.toLowerCase().includes(lowered) ?? false;
      return titleMatch || descMatch;
    });
  }, [items, query]);

  const headerHeight = 2;
  const statusHeight = 1;
  const bodyHeight = Math.max(1, height - headerHeight - statusHeight);
  const visibleCount = Math.max(1, Math.floor(bodyHeight / itemHeight));
  const maxStart = Math.max(0, filteredItems.length - visibleCount);
  const start = clamp(cursor - Math.floor(visibleCount / 2), 0, maxStart);
  const bufferedStart = clamp(start - buffer, 0, maxStart);
  const bufferedEnd = clamp(start + visibleCount + buffer, 0, filteredItems.length);
  const visibleItems = filteredItems.slice(bufferedStart, bufferedEnd);

  useEffect(() => {
    if (cursor >= filteredItems.length) {
      setCursor(Math.max(0, filteredItems.length - 1));
    }
  }, [cursor, filteredItems.length]);

  useInput(
    (input: string, key: Key) => {
      if (!isActive) {
        return;
      }

      if (filtering) {
        if (key.escape) {
          setFiltering(false);
          setQuery('');
          return;
        }
        if (key.return) {
          setFiltering(false);
          return;
        }
        if (key.backspace || key.delete) {
          setQuery((prev) => prev.slice(0, -1));
          return;
        }
        if (input) {
          setQuery((prev) => prev + input);
        }
        return;
      }

      if (key.upArrow || input === 'k') {
        setCursor((prev) => clamp(prev - 1, 0, Math.max(filteredItems.length - 1, 0)));
        return;
      }
      if (key.downArrow || input === 'j') {
        setCursor((prev) => clamp(prev + 1, 0, Math.max(filteredItems.length - 1, 0)));
        return;
      }
      if (key.pageUp || input === 'u') {
        setCursor((prev) => clamp(prev - visibleCount, 0, Math.max(filteredItems.length - 1, 0)));
        return;
      }
      if (key.pageDown || input === 'd') {
        setCursor((prev) => clamp(prev + visibleCount, 0, Math.max(filteredItems.length - 1, 0)));
        return;
      }
      if (input === 'g') {
        setCursor(0);
        return;
      }
      if (input === 'G') {
        setCursor(Math.max(filteredItems.length - 1, 0));
        return;
      }
      if (input === '/') {
        setFiltering(true);
        setQuery('');
        return;
      }
      if (key.return) {
        const item = filteredItems[cursor];
        if (item) {
          onSelect?.(item, cursor);
        }
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box height={1} justifyContent="space-between">
        <Text color={theme?.listTitle ?? 'magenta'}>{title}</Text>
        <Text dimColor>
          {filteredItems.length} item{filteredItems.length === 1 ? '' : 's'}
        </Text>
      </Box>
      <Box height={1}>
        {filtering ? (
          <Text color="cyan">Filter: {query || ' '}</Text>
        ) : (
          <Text dimColor>Press / to filter</Text>
        )}
      </Box>
      <Box flexDirection="column" height={bodyHeight}>
        {visibleItems.length === 0 ? (
          <Text dimColor>No results</Text>
        ) : (
          visibleItems.map((item, index) => {
            const actualIndex = bufferedStart + index;
            const isSelected = actualIndex === cursor;

            return (
              <Box key={item.id} flexDirection="column">
                <Text
                  color={isSelected ? theme?.listSelectedForeground ?? 'black' : theme?.listNormalForeground ?? 'white'}
                  backgroundColor={isSelected ? theme?.listSelectedBackground ?? 'magenta' : undefined}
                >
                  {item.title}
                </Text>
                <Text
                  color={isSelected ? theme?.listSelectedForeground ?? 'black' : theme?.listNormalSecondary ?? 'gray'}
                  backgroundColor={isSelected ? theme?.listSelectedBackground ?? 'magenta' : undefined}
                >
                  {item.description ?? ' '}
                </Text>
              </Box>
            );
          })
        )}
      </Box>
      <Box height={1} justifyContent="space-between">
        <Text dimColor>
          {cursor + 1}/{Math.max(filteredItems.length, 1)}
        </Text>
        <Text dimColor>j/k, /, Enter</Text>
      </Box>
    </Box>
  );
}
