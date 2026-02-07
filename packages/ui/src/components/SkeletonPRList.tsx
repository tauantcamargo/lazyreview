import React from 'react';
import { Box, Text } from 'ink';
import { getTheme, type Theme } from '../theme';

export interface SkeletonPRListProps {
  /**
   * Number of skeleton items to display
   */
  count?: number;

  /**
   * Width of the skeleton list
   */
  width?: number;

  /**
   * Custom theme
   */
  theme?: Theme;
}

/**
 * SkeletonPRList - Displays placeholder skeleton for PR list while loading
 *
 * Shows gray placeholder bars that simulate the structure of actual PR list items
 */
export function SkeletonPRList({
  count = 5,
  width = 80,
  theme = getTheme(),
}: SkeletonPRListProps): React.ReactElement {
  return (
    <Box flexDirection="column" width={width}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonPRItem key={index} width={width} theme={theme} />
      ))}
    </Box>
  );
}

interface SkeletonPRItemProps {
  width: number;
  theme: Theme;
}

function SkeletonPRItem({ width, theme }: SkeletonPRItemProps): React.ReactElement {
  // Create skeleton bars of different lengths to simulate PR item structure
  const titleWidth = Math.floor(width * 0.6);
  const metaWidth = Math.floor(width * 0.4);

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Title bar */}
      <Box>
        <Text color={theme.muted} dimColor>
          {' '.repeat(titleWidth)}
        </Text>
      </Box>

      {/* Metadata bar */}
      <Box marginTop={0}>
        <Text color={theme.border} dimColor>
          {' '.repeat(metaWidth)}
        </Text>
      </Box>
    </Box>
  );
}

export interface SkeletonProps {
  /**
   * Width of the skeleton bar (characters or percentage)
   */
  width?: number | string;

  /**
   * Height in lines
   */
  height?: number;

  /**
   * Custom theme
   */
  theme?: Theme;
}

/**
 * Generic Skeleton component for creating placeholder UI
 */
export function Skeleton({ width = '100%', height = 1, theme = getTheme() }: SkeletonProps): React.ReactElement {
  const lines = Array.from({ length: height });
  const barWidth = typeof width === 'number' ? width : 80;

  return (
    <Box flexDirection="column">
      {lines.map((_, index) => (
        <Text key={index} color={theme.border} dimColor>
          {' '.repeat(barWidth)}
        </Text>
      ))}
    </Box>
  );
}
