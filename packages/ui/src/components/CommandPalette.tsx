import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Key } from 'ink';
import type { Theme } from '../theme';
import { defaultTheme } from '../theme';

export type Command = {
  id: string;
  label: string;
  shortcut?: string;
  category?: string;
  action: () => void;
};

export type CommandPaletteProps = {
  commands: Command[];
  isOpen: boolean;
  width?: number;
  maxHeight?: number;
  theme?: Theme;
  onClose: () => void;
};

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  let queryIndex = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === lowerQuery.length;
}

function highlightMatch(text: string, query: string, theme: Theme): JSX.Element {
  if (!query) {
    return <Text>{text}</Text>;
  }

  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  const parts: JSX.Element[] = [];
  let queryIndex = 0;
  let lastMatchEnd = 0;

  for (let i = 0; i < text.length; i++) {
    if (queryIndex < lowerQuery.length && lowerText[i] === lowerQuery[queryIndex]) {
      if (i > lastMatchEnd) {
        parts.push(<Text key={`text-${i}`}>{text.slice(lastMatchEnd, i)}</Text>);
      }
      parts.push(<Text key={`match-${i}`} color={theme.accent} bold>{text[i]}</Text>);
      lastMatchEnd = i + 1;
      queryIndex++;
    }
  }

  if (lastMatchEnd < text.length) {
    parts.push(<Text key="end">{text.slice(lastMatchEnd)}</Text>);
  }

  return <>{parts}</>;
}

export function CommandPalette({
  commands,
  isOpen,
  width = 50,
  maxHeight = 12,
  theme = defaultTheme,
  onClose,
}: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    return commands.filter((cmd) =>
      fuzzyMatch(query, cmd.label) || fuzzyMatch(query, cmd.category ?? '')
    );
  }, [commands, query]);

  useInput((input: string, key: Key) => {
    if (!isOpen) return;

    if (key.escape) {
      setQuery('');
      setSelectedIndex(0);
      onClose();
      return;
    }

    if (key.return) {
      const cmd = filteredCommands[selectedIndex];
      if (cmd) {
        setQuery('');
        setSelectedIndex(0);
        onClose();
        cmd.action();
      }
      return;
    }

    if (key.upArrow || (key.ctrl && input === 'p')) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow || (key.ctrl && input === 'n')) {
      setSelectedIndex((prev) => Math.min(filteredCommands.length - 1, prev + 1));
      return;
    }

    if (key.backspace || key.delete) {
      setQuery((prev) => prev.slice(0, -1));
      setSelectedIndex(0);
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setQuery((prev) => prev + input);
      setSelectedIndex(0);
    }
  });

  if (!isOpen) return null;

  const visibleCommands = filteredCommands.slice(0, maxHeight - 3);
  const hasMore = filteredCommands.length > visibleCommands.length;

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor={theme.accent}
    >
      <Box paddingX={1} borderStyle="single" borderBottom borderColor={theme.border}>
        <Text color={theme.accent}>❯ </Text>
        <Text>{query || ' '}</Text>
        <Text color={theme.muted}>│</Text>
      </Box>
      <Box flexDirection="column" paddingX={1}>
        {visibleCommands.length === 0 ? (
          <Text color={theme.muted}>No commands found</Text>
        ) : (
          visibleCommands.map((cmd, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Box key={cmd.id} justifyContent="space-between">
                <Box>
                  {isSelected ? (
                    <Text color={theme.accent}>▸ </Text>
                  ) : (
                    <Text>  </Text>
                  )}
                  <Text inverse={isSelected}>
                    {highlightMatch(cmd.label, query, theme)}
                  </Text>
                </Box>
                {cmd.shortcut && (
                  <Text color={theme.muted}>{cmd.shortcut}</Text>
                )}
              </Box>
            );
          })
        )}
        {hasMore && (
          <Text color={theme.muted} dimColor>
            ...and {filteredCommands.length - visibleCommands.length} more
          </Text>
        )}
      </Box>
    </Box>
  );
}
