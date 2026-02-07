import React, { useMemo, useState } from 'react';
import { Box, Text, useInput, type Key } from 'ink';
import type { Theme } from '../theme';

type DiffViewProps = {
  diffText: string;
  width: number;
  height: number;
  title?: string;
  isActive?: boolean;
  theme?: Theme;
};

type DiffLine = {
  text: string;
  kind: 'add' | 'del' | 'hunk' | 'header' | 'context';
};

function classifyLine(line: string): DiffLine['kind'] {
  if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('+++') || line.startsWith('---')) {
    return 'header';
  }
  if (line.startsWith('@@')) {
    return 'hunk';
  }
  if (line.startsWith('+')) {
    return 'add';
  }
  if (line.startsWith('-')) {
    return 'del';
  }
  return 'context';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function DiffView({
  diffText,
  width,
  height,
  title = 'Diff',
  isActive = false,
  theme,
}: DiffViewProps): JSX.Element {
  const [offset, setOffset] = useState(0);

  const lines = useMemo<DiffLine[]>(() => {
    return diffText.split('\n').map((text) => ({
      text,
      kind: classifyLine(text),
    }));
  }, [diffText]);

  const headerHeight = 1;
  const statusHeight = 1;
  const bodyHeight = Math.max(1, height - headerHeight - statusHeight);
  const maxOffset = Math.max(0, lines.length - bodyHeight);
  const start = clamp(offset, 0, maxOffset);
  const visible = lines.slice(start, start + bodyHeight);

  useInput(
    (input: string, key: Key) => {
      if (!isActive) {
        return;
      }

      if (key.upArrow || input === 'k') {
        setOffset((prev) => clamp(prev - 1, 0, maxOffset));
        return;
      }
      if (key.downArrow || input === 'j') {
        setOffset((prev) => clamp(prev + 1, 0, maxOffset));
        return;
      }
      if (key.pageUp || input === 'u') {
        setOffset((prev) => clamp(prev - Math.floor(bodyHeight / 2), 0, maxOffset));
        return;
      }
      if (key.pageDown || input === 'd') {
        setOffset((prev) => clamp(prev + Math.floor(bodyHeight / 2), 0, maxOffset));
        return;
      }
      if (input === 'g') {
        setOffset(0);
        return;
      }
      if (input === 'G') {
        setOffset(maxOffset);
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box height={1} justifyContent="space-between">
        <Text color={theme?.diffHeader ?? 'cyan'}>{title}</Text>
        <Text dimColor>
          {start + 1}-{Math.min(start + bodyHeight, lines.length)} / {lines.length}
        </Text>
      </Box>
      <Box flexDirection="column" height={bodyHeight}>
        {visible.map((line, index) => {
          const lineNumber = String(start + index + 1).padStart(4, ' ');
          let color: string | undefined;
          if (line.kind === 'add') {
            color = theme?.diffAdd ?? 'green';
          } else if (line.kind === 'del') {
            color = theme?.diffDel ?? 'red';
          } else if (line.kind === 'hunk') {
            color = theme?.diffHunk ?? 'yellow';
          } else if (line.kind === 'header') {
            color = theme?.diffHeader ?? 'magenta';
          }

          return (
            <Text key={`${lineNumber}-${line.text}`} color={color}>
              {lineNumber} {line.text}
            </Text>
          );
        })}
      </Box>
      <Box height={1} justifyContent="space-between">
        <Text dimColor>j/k, u/d, g/G</Text>
        <Text dimColor>Offset {start}</Text>
      </Box>
    </Box>
  );
}
