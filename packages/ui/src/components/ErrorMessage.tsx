import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme';

export interface ErrorMessageProps {
  title?: string;
  message: string;
  suggestion?: string;
  theme?: Theme;
}

export function ErrorMessage({ title, message, suggestion, theme }: ErrorMessageProps): JSX.Element {
  const errorColor = theme?.removed ?? 'red';
  const mutedColor = theme?.muted ?? 'gray';

  return (
    <Box flexDirection="column" paddingX={1}>
      {title && (
        <Text color={errorColor} bold>
          ✗ {title}
        </Text>
      )}
      <Text color={errorColor}>{message}</Text>
      {suggestion && (
        <Text color={mutedColor}>
          Suggestion: {suggestion}
        </Text>
      )}
    </Box>
  );
}
