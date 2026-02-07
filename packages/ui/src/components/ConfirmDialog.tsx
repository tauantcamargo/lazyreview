import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme';

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmKey?: string;
  cancelKey?: string;
  destructive?: boolean;
  theme?: Theme;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmKey = 'y',
  cancelKey = 'n',
  destructive = false,
  theme,
}: ConfirmDialogProps): JSX.Element {
  const accentColor = theme?.accent ?? 'cyan';
  const mutedColor = theme?.muted ?? 'gray';
  const confirmColor = destructive ? (theme?.removed ?? 'red') : (theme?.added ?? 'green');

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={destructive ? (theme?.removed ?? 'red') : accentColor}
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color={destructive ? (theme?.removed ?? 'red') : accentColor} bold>
          {title}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>{message}</Text>
      </Box>

      <Box>
        <Text color={confirmColor}>
          [{confirmKey}] {confirmLabel}
        </Text>
        <Text color={mutedColor}> / </Text>
        <Text color={mutedColor}>
          [{cancelKey}] {cancelLabel}
        </Text>
      </Box>
    </Box>
  );
}
