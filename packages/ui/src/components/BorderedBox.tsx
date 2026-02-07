import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { defaultTheme, type Theme } from '../theme';

export interface BorderedBoxProps {
  title: string;
  width: number;
  height: number;
  isActive: boolean;
  children: ReactNode;
  theme?: Theme;
}

export function BorderedBox({
  title,
  width,
  height,
  isActive,
  children,
  theme = defaultTheme,
}: BorderedBoxProps): JSX.Element {
  const innerWidth = Math.max(0, width - 2);
  const innerHeight = Math.max(0, height - 2);

  const titleStr = ` ${title} `;
  const remaining = Math.max(0, innerWidth - titleStr.length - 1);
  const topLine = `┌─${titleStr}${'─'.repeat(remaining)}┐`;
  const bottomLine = `└${'─'.repeat(innerWidth)}┘`;

  const borderColor = isActive ? theme.primary : theme.border;

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold={isActive} color={borderColor}>
        {topLine}
      </Text>
      <Box flexDirection="row" height={innerHeight}>
        <Text color={borderColor}>
          {'│\n'.repeat(innerHeight).trimEnd()}
        </Text>
        <Box flexDirection="column" width={innerWidth}>
          {children}
        </Box>
        <Text color={borderColor}>
          {'│\n'.repeat(innerHeight).trimEnd()}
        </Text>
      </Box>
      <Text color={borderColor}>
        {bottomLine}
      </Text>
    </Box>
  );
}
