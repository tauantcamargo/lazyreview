import React from 'react';
import { Box, Text } from 'ink';
import { defaultTheme, type Theme } from '../theme';

export interface DiffStatsProps {
  additions: number;
  deletions: number;
  files?: number;
  showBar?: boolean;
  barWidth?: number;
  compact?: boolean;
  theme?: Theme;
}

const MAX_BAR_BLOCKS = 5;

export function DiffStats({
  additions,
  deletions,
  files,
  showBar = true,
  barWidth = MAX_BAR_BLOCKS,
  compact = false,
  theme = defaultTheme,
}: DiffStatsProps): JSX.Element {
  const total = additions + deletions;

  if (compact) {
    return (
      <Box>
        <Text color={theme.success}>+{additions}</Text>
        <Text color={theme.muted}>/</Text>
        <Text color={theme.error}>-{deletions}</Text>
      </Box>
    );
  }

  // Calculate proportional bar
  let addBlocks = 0;
  let delBlocks = 0;

  if (total > 0) {
    const ratio = additions / total;
    addBlocks = Math.round(ratio * barWidth);
    delBlocks = barWidth - addBlocks;

    // Ensure at least 1 block for non-zero values
    if (additions > 0 && addBlocks === 0) addBlocks = 1;
    if (deletions > 0 && delBlocks === 0) delBlocks = 1;

    // Adjust if we exceeded barWidth
    if (addBlocks + delBlocks > barWidth) {
      if (additions > deletions) {
        delBlocks = barWidth - addBlocks;
      } else {
        addBlocks = barWidth - delBlocks;
      }
    }
  }

  const addBar = '█'.repeat(addBlocks);
  const delBar = '█'.repeat(delBlocks);

  return (
    <Box>
      {files !== undefined && (
        <>
          <Text color={theme.muted}>{files} files</Text>
          <Text color={theme.muted}> </Text>
        </>
      )}
      <Text color={theme.success}>+{additions}</Text>
      <Text color={theme.muted}> </Text>
      <Text color={theme.error}>-{deletions}</Text>
      {showBar && total > 0 && (
        <>
          <Text color={theme.muted}> </Text>
          <Text color={theme.success}>{addBar}</Text>
          <Text color={theme.error}>{delBar}</Text>
        </>
      )}
    </Box>
  );
}

export interface FileStatsProps {
  path: string;
  additions: number;
  deletions: number;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  isSelected?: boolean;
  theme?: Theme;
}

export function FileStats({
  path,
  additions,
  deletions,
  status,
  isSelected = false,
  theme = defaultTheme,
}: FileStatsProps): JSX.Element {
  const statusIcon = {
    added: '+',
    modified: '~',
    deleted: '-',
    renamed: '→',
  }[status];

  const statusColor = {
    added: theme.success,
    modified: theme.warning,
    deleted: theme.error,
    renamed: theme.info,
  }[status];

  return (
    <Box>
      <Text
        color={statusColor}
        backgroundColor={isSelected ? theme.selection : undefined}
      >
        {statusIcon}
      </Text>
      <Text
        color={isSelected ? theme.primary : theme.text}
        backgroundColor={isSelected ? theme.selection : undefined}
      >
        {' '}{path}
      </Text>
      <Text color={theme.muted}> </Text>
      <DiffStats additions={additions} deletions={deletions} compact theme={theme} />
    </Box>
  );
}
