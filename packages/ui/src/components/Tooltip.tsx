import React, { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { getTheme, Theme } from '../theme';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: string;
  children: ReactNode;
  visible?: boolean;
  position?: TooltipPosition;
  theme?: Theme;
}

/**
 * Tooltip component for showing additional information
 */
export function Tooltip({
  content,
  children,
  visible = false,
  position = 'top',
  theme = getTheme(),
}: TooltipProps): React.ReactElement {
  if (!visible) {
    return <>{children}</>;
  }

  const tooltipContent = (
    <Box
      borderStyle="round"
      borderColor={theme.border}
      paddingX={1}
    >
      <Text color={theme.muted}>{content}</Text>
    </Box>
  );

  if (position === 'top') {
    return (
      <Box flexDirection="column">
        {tooltipContent}
        {children}
      </Box>
    );
  }

  if (position === 'bottom') {
    return (
      <Box flexDirection="column">
        {children}
        {tooltipContent}
      </Box>
    );
  }

  if (position === 'left') {
    return (
      <Box flexDirection="row">
        {tooltipContent}
        {children}
      </Box>
    );
  }

  // right
  return (
    <Box flexDirection="row">
      {children}
      {tooltipContent}
    </Box>
  );
}

export interface KeyHintProps {
  keyName: string;
  description: string;
  theme?: Theme;
}

/**
 * Component for displaying a key hint (e.g., "j - move down")
 */
export function KeyHint({
  keyName,
  description,
  theme = getTheme(),
}: KeyHintProps): React.ReactElement {
  return (
    <Box gap={1}>
      <Text color={theme.accent} bold>
        {keyName}
      </Text>
      <Text color={theme.muted}>{description}</Text>
    </Box>
  );
}

export interface KeyHintGroupProps {
  hints: Array<{ key: string; description: string }>;
  separator?: string;
  theme?: Theme;
}

/**
 * Component for displaying a group of key hints
 */
export function KeyHintGroup({
  hints,
  separator = '  ',
  theme = getTheme(),
}: KeyHintGroupProps): React.ReactElement {
  return (
    <Box flexDirection="row" gap={0}>
      {hints.map((hint, index) => (
        <Box key={hint.key}>
          <KeyHint
            keyName={hint.key}
            description={hint.description}
            theme={theme}
          />
          {index < hints.length - 1 && (
            <Text color={theme.muted}>{separator}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

export interface InfoBoxProps {
  title?: string;
  children: ReactNode;
  type?: 'info' | 'warning' | 'error' | 'success';
  theme?: Theme;
}

/**
 * Component for displaying an information box
 */
export function InfoBox({
  title,
  children,
  type = 'info',
  theme = getTheme(),
}: InfoBoxProps): React.ReactElement {
  const colors = {
    info: theme.accent,
    warning: theme.modified,
    error: theme.removed,
    success: theme.added,
  };

  const icons = {
    info: 'ℹ',
    warning: '⚠',
    error: '✗',
    success: '✓',
  };

  const color = colors[type];
  const icon = icons[type];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      paddingX={1}
    >
      {title && (
        <Box gap={1}>
          <Text color={color}>{icon}</Text>
          <Text color={color} bold>
            {title}
          </Text>
        </Box>
      )}
      <Box>{children}</Box>
    </Box>
  );
}

export interface HotkeyListProps {
  hotkeys: Array<{
    key: string;
    description: string;
    category?: string;
  }>;
  showCategories?: boolean;
  theme?: Theme;
}

/**
 * Component for displaying a list of hotkeys
 */
export function HotkeyList({
  hotkeys,
  showCategories = false,
  theme = getTheme(),
}: HotkeyListProps): React.ReactElement {
  if (!showCategories) {
    return (
      <Box flexDirection="column">
        {hotkeys.map((hotkey) => (
          <Box key={hotkey.key} gap={2}>
            <Box width={8}>
              <Text color={theme.accent} bold>
                {hotkey.key}
              </Text>
            </Box>
            <Text color={theme.text}>{hotkey.description}</Text>
          </Box>
        ))}
      </Box>
    );
  }

  // Group by category
  const grouped = hotkeys.reduce<Record<string, typeof hotkeys>>((acc, hotkey) => {
    const category = hotkey.category ?? 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(hotkey);
    return acc;
  }, {});

  return (
    <Box flexDirection="column" gap={1}>
      {Object.entries(grouped).map(([category, items]) => (
        <Box key={category} flexDirection="column">
          <Text color={theme.muted} bold>
            {category}
          </Text>
          <Box flexDirection="column" marginLeft={2}>
            {items.map((hotkey) => (
              <Box key={hotkey.key} gap={2}>
                <Box width={8}>
                  <Text color={theme.accent}>{hotkey.key}</Text>
                </Box>
                <Text color={theme.text}>{hotkey.description}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
