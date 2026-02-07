import React, { useMemo, useState } from 'react';
import { Box, Text, useInput, type Key } from 'ink';
import type { Theme } from '../theme';
import { SyntaxHighlight, detectLanguage } from './SyntaxHighlight';

type DiffViewProps = {
  diff?: string;
  diffText?: string; // Legacy support
  width: number;
  height: number;
  title?: string;
  isActive?: boolean;
  theme?: Theme;
  currentLine?: number;
  selectedLines?: number[];
  showLineNumbers?: boolean;
  syntaxHighlight?: boolean;
  onSearchChange?: (query: string) => void;
};

type SearchMatch = {
  lineIndex: number;
  matchIndex: number;
  length: number;
};

type DiffLine = {
  text: string;
  kind: 'add' | 'del' | 'hunk' | 'header' | 'context';
  lineNumber?: number;
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

function highlightSearchMatches(
  text: string,
  matches: SearchMatch[],
  lineIndex: number
): React.ReactNode {
  const lineMatches = matches.filter((m) => m.lineIndex === lineIndex);

  if (lineMatches.length === 0) {
    return text;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  lineMatches.forEach((match, idx) => {
    // Add text before match
    if (match.matchIndex > lastIndex) {
      parts.push(
        <Text key={`before-${idx}`}>{text.slice(lastIndex, match.matchIndex)}</Text>
      );
    }

    // Add highlighted match
    parts.push(
      <Text key={`match-${idx}`} backgroundColor="yellow" color="black">
        {text.slice(match.matchIndex, match.matchIndex + match.length)}
      </Text>
    );

    lastIndex = match.matchIndex + match.length;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<Text key="after">{text.slice(lastIndex)}</Text>);
  }

  return parts;
}

export function DiffView({
  diff,
  diffText,
  width,
  height,
  title = 'Diff',
  isActive = false,
  theme,
  currentLine = 0,
  selectedLines = [],
  showLineNumbers = true,
  syntaxHighlight = false,
  onSearchChange,
}: DiffViewProps): JSX.Element {
  const [offset, setOffset] = useState(0);
  const [hunkIndices, setHunkIndices] = useState<number[]>([]);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [visualMode, setVisualMode] = useState(false);
  const [visualStart, setVisualStart] = useState(0);
  const [visualEnd, setVisualEnd] = useState(0);

  // Support both diff and diffText props
  const content = diff ?? diffText ?? '';

  const lines = useMemo<DiffLine[]>(() => {
    const hunks: number[] = [];
    const parsed = content.split('\n').map((text, index) => {
      const kind = classifyLine(text);
      if (kind === 'hunk') {
        hunks.push(index);
      }
      return {
        text,
        kind,
        lineNumber: index + 1,
      };
    });
    setHunkIndices(hunks);
    return parsed;
  }, [content]);

  // Search functionality
  React.useEffect(() => {
    if (!searchQuery) {
      setSearchMatches([]);
      return;
    }

    const matches: SearchMatch[] = [];
    const query = searchQuery.toLowerCase();

    lines.forEach((line, lineIndex) => {
      const text = line.text.toLowerCase();
      let matchIndex = 0;

      while ((matchIndex = text.indexOf(query, matchIndex)) !== -1) {
        matches.push({
          lineIndex,
          matchIndex,
          length: query.length,
        });
        matchIndex += query.length;
      }
    });

    setSearchMatches(matches);
    setCurrentMatchIndex(0);

    const first = matches[0];
    if (first !== undefined) {
      setOffset(first.lineIndex);
    }
  }, [searchQuery, lines]);

  // Navigate search matches
  const navigateToNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
    const match = searchMatches[nextIndex];
    if (match !== undefined) {
      setCurrentMatchIndex(nextIndex);
      setOffset(match.lineIndex);
    }
  };

  const navigateToPrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIndex = currentMatchIndex === 0 ? searchMatches.length - 1 : currentMatchIndex - 1;
    const match = searchMatches[prevIndex];
    if (match !== undefined) {
      setCurrentMatchIndex(prevIndex);
      setOffset(match.lineIndex);
    }
  };

  const headerHeight = 1;
  const statusHeight = searchMode ? 2 : 1;
  const bodyHeight = Math.max(1, height - headerHeight - statusHeight);
  const maxOffset = Math.max(0, lines.length - bodyHeight);
  const start = clamp(offset, 0, maxOffset);
  const visible = lines.slice(start, start + bodyHeight);

  // Navigate to next/previous hunk
  const navigateToNextHunk = () => {
    const nextHunk = hunkIndices.find(idx => idx > start);
    if (nextHunk !== undefined) {
      setOffset(nextHunk);
    }
  };

  const navigateToPrevHunk = () => {
    const prevHunk = [...hunkIndices].reverse().find(idx => idx < start);
    if (prevHunk !== undefined) {
      setOffset(prevHunk);
    }
  };

  useInput(
    (input: string, key: Key) => {
      if (!isActive) {
        return;
      }

      // Search mode input handling
      if (searchMode) {
        if (key.escape) {
          setSearchMode(false);
          setSearchQuery('');
          setSearchMatches([]);
          return;
        }
        if (key.return) {
          setSearchMode(false);
          return;
        }
        if (key.backspace || key.delete) {
          setSearchQuery((prev) => prev.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          setSearchQuery((prev) => prev + input);
          return;
        }
        return;
      }

      // Regular navigation
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
        return;
      }

      // Search activation
      if (input === '/') {
        setSearchMode(true);
        setSearchQuery('');
        return;
      }

      // Visual mode activation
      if (input === 'V') {
        if (visualMode) {
          // Exit visual mode
          setVisualMode(false);
          setVisualStart(0);
          setVisualEnd(0);
        } else {
          // Enter visual mode
          setVisualMode(true);
          setVisualStart(start + Math.floor(bodyHeight / 2)); // Start at current viewport center
          setVisualEnd(start + Math.floor(bodyHeight / 2));
        }
        return;
      }

      // Visual mode navigation
      if (visualMode) {
        if (key.upArrow || input === 'k') {
          setVisualEnd((prev) => Math.max(0, prev - 1));
          setOffset((prev) => clamp(visualEnd - Math.floor(bodyHeight / 2), 0, maxOffset));
          return;
        }
        if (key.downArrow || input === 'j') {
          setVisualEnd((prev) => Math.min(lines.length - 1, prev + 1));
          setOffset((prev) => clamp(visualEnd - Math.floor(bodyHeight / 2), 0, maxOffset));
          return;
        }
      }

      // Search navigation (when matches exist)
      if (searchMatches.length > 0) {
        if (input === 'n') {
          navigateToNextMatch();
          return;
        }
        if (input === 'N') {
          navigateToPrevMatch();
          return;
        }
      }

      // Hunk navigation
      if (input === '[') {
        navigateToPrevHunk();
        return;
      }
      if (input === ']') {
        navigateToNextHunk();
        return;
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
          const absoluteLineNumber = start + index + 1;
          const lineIndex = start + index;
          const lineNumber = showLineNumbers ? String(absoluteLineNumber).padStart(4, ' ') : '';
          const isCurrentLine = currentLine === absoluteLineNumber;
          const isSelected = selectedLines.includes(absoluteLineNumber);
          const isInVisualSelection = visualMode &&
            lineIndex >= Math.min(visualStart, visualEnd) &&
            lineIndex <= Math.max(visualStart, visualEnd);

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

          // Current line indicator
          const indicator = isCurrentLine ? '>' : isSelected ? '*' : isInVisualSelection ? '▸' : ' ';

          const lineContent = searchMatches.length > 0
            ? highlightSearchMatches(line.text, searchMatches, start + index)
            : line.text;

          return (
            <Box key={`${lineNumber}-${line.text}`}>
              {showLineNumbers && (
                <Text color={isCurrentLine ? 'cyan' : 'gray'}>{indicator}{lineNumber} </Text>
              )}
              <Text
                color={color}
                inverse={isCurrentLine}
                backgroundColor={isInVisualSelection ? 'blue' : undefined}
              >
                {lineContent}
              </Text>
            </Box>
          );
        })}
      </Box>
      {/* Search input bar */}
      {searchMode && (
        <Box paddingX={1}>
          <Text color={theme?.accent ?? 'cyan'}>Search: </Text>
          <Text>{searchQuery}</Text>
          <Text inverse> </Text>
          <Text dimColor> (Enter to close, Esc to cancel)</Text>
        </Box>
      )}

      {/* Status bar */}
      <Box height={1} justifyContent="space-between">
        <Text dimColor>
          {visualMode ? (
            <Text color="cyan" bold>-- VISUAL --</Text>
          ) : (
            <>/:search V:visual [/]:hunks j/k:scroll</>
          )}
          {searchMatches.length > 0 && !visualMode && ' n/N:next/prev'}
        </Text>
        <Box>
          {visualMode && (
            <Text color="cyan">
              {Math.abs(visualEnd - visualStart) + 1} lines selected{' '}
            </Text>
          )}
          {searchMatches.length > 0 && (
            <Text color="yellow">
              {currentMatchIndex + 1}/{searchMatches.length}{' '}
            </Text>
          )}
          <Text dimColor>Line {start + 1}/{lines.length}</Text>
        </Box>
      </Box>
    </Box>
  );
}
