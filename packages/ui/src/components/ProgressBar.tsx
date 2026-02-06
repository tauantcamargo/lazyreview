import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme';

export interface ProgressBarProps {
  value: number;
  max?: number;
  width?: number;
  showPercentage?: boolean;
  showValue?: boolean;
  label?: string;
  theme?: Theme;
}

export function ProgressBar({
  value,
  max = 100,
  width = 20,
  showPercentage = true,
  showValue = false,
  label,
  theme,
}: ProgressBarProps): JSX.Element {
  const accentColor = theme?.accent ?? 'cyan';
  const mutedColor = theme?.muted ?? 'gray';

  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  const filledChar = '█';
  const emptyChar = '░';

  return (
    <Box>
      {label && (
        <Text color={mutedColor}>{label} </Text>
      )}
      <Text color={accentColor}>{filledChar.repeat(filled)}</Text>
      <Text color={mutedColor}>{emptyChar.repeat(empty)}</Text>
      {showPercentage && (
        <Text color={mutedColor}> {Math.round(percentage)}%</Text>
      )}
      {showValue && (
        <Text color={mutedColor}> ({value}/{max})</Text>
      )}
    </Box>
  );
}
