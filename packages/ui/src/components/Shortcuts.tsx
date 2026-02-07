import React from 'react';
import { Box, Text } from 'ink';
import { getTheme, Theme } from '../theme';

export interface ShortcutDef {
  key: string;
  description: string;
  category?: string;
  chord?: boolean;
}

export interface ShortcutsProps {
  shortcuts: ShortcutDef[];
  columns?: number;
  showCategories?: boolean;
  compact?: boolean;
  theme?: Theme;
}

/**
 * Display keyboard shortcuts in a grid
 */
export function Shortcuts({
  shortcuts,
  columns = 2,
  showCategories = false,
  compact = false,
  theme = getTheme(),
}: ShortcutsProps): React.ReactElement {
  if (showCategories) {
    const categories = groupByCategory(shortcuts);

    return (
      <Box flexDirection="column" gap={1}>
        {Object.entries(categories).map(([category, items]) => (
          <Box key={category} flexDirection="column">
            <Text color={theme.accent} bold>{category}</Text>
            <ShortcutGrid
              shortcuts={items}
              columns={columns}
              compact={compact}
              theme={theme}
            />
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <ShortcutGrid
      shortcuts={shortcuts}
      columns={columns}
      compact={compact}
      theme={theme}
    />
  );
}

interface ShortcutGridProps {
  shortcuts: ShortcutDef[];
  columns: number;
  compact: boolean;
  theme: Theme;
}

function ShortcutGrid({
  shortcuts,
  columns,
  compact,
  theme,
}: ShortcutGridProps): React.ReactElement {
  const rows = chunkArray(shortcuts, columns);

  return (
    <Box flexDirection="column">
      {rows.map((row, rowIndex) => (
        <Box key={rowIndex} gap={compact ? 2 : 4}>
          {row.map((shortcut, colIndex) => (
            <ShortcutItem
              key={colIndex}
              shortcut={shortcut}
              compact={compact}
              theme={theme}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

interface ShortcutItemProps {
  shortcut: ShortcutDef;
  compact: boolean;
  theme: Theme;
}

function ShortcutItem({
  shortcut,
  compact,
  theme,
}: ShortcutItemProps): React.ReactElement {
  const keyWidth = compact ? 6 : 10;

  return (
    <Box width={compact ? 25 : 35}>
      <Box width={keyWidth}>
        <Text color={theme.accent} bold>
          {formatKey(shortcut.key)}
        </Text>
      </Box>
      <Text color={theme.text} wrap="truncate">
        {shortcut.description}
      </Text>
    </Box>
  );
}

export interface KeyLegendProps {
  keys: Array<{ key: string; label: string }>;
  separator?: string;
  theme?: Theme;
}

/**
 * Horizontal key legend for status bar
 */
export function KeyLegend({
  keys,
  separator = '  ',
  theme = getTheme(),
}: KeyLegendProps): React.ReactElement {
  return (
    <Box>
      {keys.map((item, index) => (
        <React.Fragment key={index}>
          <Box>
            <Text color={theme.accent} bold>{formatKey(item.key)}</Text>
            <Text color={theme.muted}> {item.label}</Text>
          </Box>
          {index < keys.length - 1 && (
            <Text color={theme.muted}>{separator}</Text>
          )}
        </React.Fragment>
      ))}
    </Box>
  );
}

export interface ChordIndicatorProps {
  chord: string;
  pending?: boolean;
  theme?: Theme;
}

/**
 * Show current chord input
 */
export function ChordIndicator({
  chord,
  pending = true,
  theme = getTheme(),
}: ChordIndicatorProps): React.ReactElement {
  if (!chord) {
    return <Text />;
  }

  return (
    <Box>
      <Text color={theme.accent}>
        {chord}
        {pending && <Text color={theme.muted}>...</Text>}
      </Text>
    </Box>
  );
}

export interface ModeIndicatorProps {
  mode: string;
  variant?: 'normal' | 'insert' | 'visual' | 'command';
  theme?: Theme;
}

/**
 * Vim-style mode indicator
 */
export function ModeIndicator({
  mode,
  variant = 'normal',
  theme = getTheme(),
}: ModeIndicatorProps): React.ReactElement {
  const variantColors: Record<string, string> = {
    normal: theme.accent,
    insert: theme.added,
    visual: '#bb9af7', // purple
    command: '#ff9e64', // orange
  };

  const color = variantColors[variant] ?? theme.accent;

  return (
    <Box paddingX={1}>
      <Text backgroundColor={color} color="#1a1b26" bold>
        {' '}{mode.toUpperCase()}{' '}
      </Text>
    </Box>
  );
}

export interface QuickActionsProps {
  actions: Array<{
    key: string;
    label: string;
    disabled?: boolean;
  }>;
  theme?: Theme;
}

/**
 * Quick action bar
 */
export function QuickActions({
  actions,
  theme = getTheme(),
}: QuickActionsProps): React.ReactElement {
  return (
    <Box gap={2}>
      {actions.map((action, index) => (
        <Box key={index}>
          <Text
            color={action.disabled ? theme.muted : theme.accent}
            bold={!action.disabled}
          >
            [{formatKey(action.key)}]
          </Text>
          <Text color={action.disabled ? theme.muted : theme.text}>
            {' '}{action.label}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

export interface VimKeysProps {
  hjkl?: boolean;
  arrows?: boolean;
  theme?: Theme;
}

/**
 * Vim navigation keys display
 */
export function VimKeys({
  hjkl = true,
  arrows = true,
  theme = getTheme(),
}: VimKeysProps): React.ReactElement {
  const keys: Array<{ key: string; label: string }> = [];

  if (hjkl) {
    keys.push(
      { key: 'h', label: '←' },
      { key: 'j', label: '↓' },
      { key: 'k', label: '↑' },
      { key: 'l', label: '→' },
    );
  }

  if (arrows) {
    keys.push(
      { key: '↑↓', label: 'navigate' },
      { key: '←→', label: 'expand/collapse' },
    );
  }

  return <KeyLegend keys={keys} theme={theme} />;
}

export interface CommandHintProps {
  command: string;
  description?: string;
  theme?: Theme;
}

/**
 * Command hint with colon prefix
 */
export function CommandHint({
  command,
  description,
  theme = getTheme(),
}: CommandHintProps): React.ReactElement {
  return (
    <Box>
      <Text color={theme.accent}>:</Text>
      <Text color={theme.accent} bold>{command}</Text>
      {description && (
        <Text color={theme.muted}> - {description}</Text>
      )}
    </Box>
  );
}

export interface ShortcutOverlayProps {
  title?: string;
  shortcuts: ShortcutDef[];
  visible: boolean;
  theme?: Theme;
}

/**
 * Overlay showing all shortcuts
 */
export function ShortcutOverlay({
  title = 'Keyboard Shortcuts',
  shortcuts,
  visible,
  theme = getTheme(),
}: ShortcutOverlayProps): React.ReactElement | null {
  if (!visible) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.accent}
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1} justifyContent="center">
        <Text color={theme.accent} bold>{title}</Text>
      </Box>
      <Shortcuts
        shortcuts={shortcuts}
        columns={2}
        showCategories={true}
        theme={theme}
      />
      <Box marginTop={1} justifyContent="center">
        <Text color={theme.muted}>Press ? to close</Text>
      </Box>
    </Box>
  );
}

/**
 * Format key for display
 */
function formatKey(key: string): string {
  return key
    .replace('ctrl+', 'C-')
    .replace('alt+', 'M-')
    .replace('shift+', 'S-')
    .replace('enter', '⏎')
    .replace('return', '⏎')
    .replace('escape', 'esc')
    .replace('space', '␣')
    .replace('tab', '⇥')
    .replace('backspace', '⌫')
    .replace('delete', '⌦')
    .replace('up', '↑')
    .replace('down', '↓')
    .replace('left', '←')
    .replace('right', '→');
}

/**
 * Group shortcuts by category
 */
function groupByCategory(shortcuts: ShortcutDef[]): Record<string, ShortcutDef[]> {
  return shortcuts.reduce<Record<string, ShortcutDef[]>>((acc, shortcut) => {
    const category = shortcut.category ?? 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category]?.push(shortcut);
    return acc;
  }, {});
}

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
