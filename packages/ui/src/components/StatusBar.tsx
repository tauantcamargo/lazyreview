import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme';
import { defaultTheme } from '../theme';

export type KeyBinding = {
  key: string;
  label: string;
};

export type StatusBarProps = {
  bindings?: KeyBinding[];
  leftText?: string;
  rightText?: string;
  chordBuffer?: string;
  pendingChords?: string[];
  theme?: Theme;
  width?: number;
};

export function StatusBar({
  bindings = [],
  leftText,
  rightText,
  chordBuffer,
  pendingChords = [],
  theme = defaultTheme,
  width = 80,
}: StatusBarProps): JSX.Element {
  const showChord = chordBuffer && chordBuffer.length > 0;

  return (
    <Box
      width={width}
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
    >
      <Box>
        {showChord ? (
          <Box>
            <Text backgroundColor={theme.accent} color={theme.bg}>
              {' '}{chordBuffer}{' '}
            </Text>
            <Text color={theme.muted}>
              {' '}waiting for: {pendingChords.map((c) => c.slice(chordBuffer.length)).join(', ')}
            </Text>
          </Box>
        ) : leftText ? (
          <Text color={theme.muted}>{leftText}</Text>
        ) : (
          <Box>
            {bindings.map((binding, i) => (
              <Box key={binding.key} marginRight={1}>
                <Text color={theme.accent}>{binding.key}</Text>
                <Text color={theme.muted}>:{binding.label}</Text>
                {i < bindings.length - 1 && <Text color={theme.border}> │ </Text>}
              </Box>
            ))}
          </Box>
        )}
      </Box>
      {rightText && (
        <Box>
          <Text color={theme.muted}>{rightText}</Text>
        </Box>
      )}
    </Box>
  );
}
