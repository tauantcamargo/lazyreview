import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme';

export interface DashboardSection {
  id: string;
  title: string;
  items: DashboardItem[];
  emptyMessage?: string;
}

export interface DashboardItem {
  id: string;
  repo: string;
  title: string;
  author: string;
  status: 'open' | 'draft' | 'merged' | 'closed';
  updatedAt: string;
}

export interface DashboardProps {
  sections: DashboardSection[];
  selectedSection?: number;
  selectedItem?: number;
  width: number;
  height: number;
  theme?: Theme;
  onSelect?: (sectionId: string, itemId: string) => void;
}

function getStatusIndicator(status: DashboardItem['status'], theme?: Theme): { char: string; color: string } {
  switch (status) {
    case 'open':
      return { char: '●', color: theme?.added ?? 'green' };
    case 'draft':
      return { char: '○', color: theme?.muted ?? 'yellow' };
    case 'merged':
      return { char: '✓', color: theme?.accent ?? 'magenta' };
    case 'closed':
      return { char: '✗', color: theme?.removed ?? 'red' };
    default:
      return { char: '?', color: theme?.muted ?? 'gray' };
  }
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
}

export function Dashboard({
  sections,
  selectedSection = 0,
  selectedItem = 0,
  width,
  height,
  theme,
}: DashboardProps): JSX.Element {
  const accentColor = theme?.accent ?? 'cyan';
  const mutedColor = theme?.muted ?? 'gray';

  const sectionCount = sections.length || 1;
  const availableHeight = height - 2;
  const itemsPerSection = Math.max(3, Math.floor(availableHeight / sectionCount) - 2);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box paddingX={1}>
        <Text color={accentColor} bold>
          Dashboard
        </Text>
      </Box>

      {sections.map((section, sectionIdx) => {
        const isSelectedSection = sectionIdx === selectedSection;
        const visibleItems = section.items.slice(0, itemsPerSection);

        return (
          <Box key={section.id} flexDirection="column" marginTop={1}>
            <Box paddingX={1}>
              <Text color={mutedColor}>
                ─── {section.title} ({section.items.length}) ───
              </Text>
            </Box>

            {visibleItems.length === 0 ? (
              <Box paddingX={2}>
                <Text color={mutedColor} italic>
                  {section.emptyMessage ?? 'No items'}
                </Text>
              </Box>
            ) : (
              visibleItems.map((item, itemIdx) => {
                const isSelected = isSelectedSection && itemIdx === selectedItem;
                const status = getStatusIndicator(item.status, theme);
                const repoWidth = 20;
                const titleWidth = Math.max(10, width - repoWidth - 25);

                return (
                  <Box key={item.id} paddingX={1}>
                    <Text inverse={isSelected}>{isSelected ? '▸' : ' '}</Text>
                    <Text color={mutedColor}>{item.repo.padEnd(repoWidth).slice(0, repoWidth)}</Text>
                    <Text>{item.title.slice(0, titleWidth).padEnd(titleWidth)}</Text>
                    <Text color={mutedColor}>{item.author.slice(0, 10).padStart(10)}</Text>
                    <Text> </Text>
                    <Text color={status.color}>{status.char}</Text>
                    <Text color={mutedColor}> {formatTimeAgo(item.updatedAt).padStart(3)}</Text>
                  </Box>
                );
              })
            )}

            {section.items.length > itemsPerSection && (
              <Box paddingX={2}>
                <Text color={mutedColor}>... and {section.items.length - itemsPerSection} more</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
