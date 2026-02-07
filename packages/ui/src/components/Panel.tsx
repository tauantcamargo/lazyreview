import React, { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { getTheme, Theme } from '../theme';

export interface PanelProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  focused?: boolean;
  borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'classic' | 'arrow' | 'none';
  width?: number | string;
  height?: number;
  padding?: number;
  headerRight?: ReactNode;
  footer?: ReactNode;
  theme?: Theme;
}

/**
 * Panel container with title and border
 */
export function Panel({
  title,
  subtitle,
  children,
  focused = false,
  borderStyle = 'single',
  width,
  height,
  padding = 1,
  headerRight,
  footer,
  theme = getTheme(),
}: PanelProps): React.ReactElement {
  const borderColor = focused ? theme.accent : theme.muted;

  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyle !== 'none' ? borderStyle : undefined}
      borderColor={borderColor}
      width={width}
      height={height}
    >
      {(title || headerRight) && (
        <Box paddingX={padding} justifyContent="space-between">
          <Box gap={1}>
            {title && (
              <Text color={focused ? theme.accent : theme.text} bold>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text color={theme.muted}>{subtitle}</Text>
            )}
          </Box>
          {headerRight}
        </Box>
      )}
      <Box paddingX={padding} paddingY={padding > 0 ? 0 : undefined} flexGrow={1}>
        {children}
      </Box>
      {footer && (
        <Box paddingX={padding} borderTop borderColor={theme.muted}>
          {footer}
        </Box>
      )}
    </Box>
  );
}

export interface CollapsiblePanelProps extends Omit<PanelProps, 'children'> {
  children: ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  collapsedHeight?: number;
}

/**
 * Panel that can be collapsed
 */
export function CollapsiblePanel({
  children,
  collapsed = false,
  onToggle,
  collapsedHeight = 1,
  title,
  ...props
}: CollapsiblePanelProps): React.ReactElement {
  const theme = props.theme ?? getTheme();

  const headerRight = (
    <Text color={theme.muted}>
      {collapsed ? '▸' : '▾'}
    </Text>
  );

  const displayTitle = title ? `${collapsed ? '▸' : '▾'} ${title}` : undefined;

  return (
    <Panel
      {...props}
      title={displayTitle}
      height={collapsed ? collapsedHeight : props.height}
    >
      {collapsed ? null : children}
    </Panel>
  );
}

export interface SectionProps {
  title?: string;
  children: ReactNode;
  marginBottom?: number;
  theme?: Theme;
}

/**
 * Simple section with optional title
 */
export function Section({
  title,
  children,
  marginBottom = 1,
  theme = getTheme(),
}: SectionProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={marginBottom}>
      {title && (
        <Box marginBottom={1}>
          <Text color={theme.accent} bold>{title}</Text>
        </Box>
      )}
      {children}
    </Box>
  );
}

export interface CardProps {
  title?: string;
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  compact?: boolean;
  theme?: Theme;
}

/**
 * Card component for displaying content blocks
 */
export function Card({
  title,
  children,
  variant = 'default',
  compact = false,
  theme = getTheme(),
}: CardProps): React.ReactElement {
  const variantColors: Record<string, string> = {
    default: theme.muted,
    success: theme.added,
    warning: '#e0af68', // yellow
    error: theme.removed,
    info: theme.accent,
  };

  const borderColor = variantColors[variant] ?? theme.muted;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={compact ? 1 : 2}
      paddingY={compact ? 0 : 1}
    >
      {title && (
        <Box marginBottom={compact ? 0 : 1}>
          <Text color={borderColor} bold>{title}</Text>
        </Box>
      )}
      {children}
    </Box>
  );
}

export interface InfoPanelProps {
  items: Array<{ label: string; value: ReactNode }>;
  columns?: 1 | 2;
  theme?: Theme;
}

/**
 * Panel for displaying key-value information
 */
export function InfoPanel({
  items,
  columns = 1,
  theme = getTheme(),
}: InfoPanelProps): React.ReactElement {
  if (columns === 2) {
    const midpoint = Math.ceil(items.length / 2);
    const leftItems = items.slice(0, midpoint);
    const rightItems = items.slice(midpoint);

    return (
      <Box gap={4}>
        <Box flexDirection="column" flexGrow={1}>
          {leftItems.map((item, index) => (
            <InfoItem key={index} label={item.label} value={item.value} theme={theme} />
          ))}
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {rightItems.map((item, index) => (
            <InfoItem key={index} label={item.label} value={item.value} theme={theme} />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {items.map((item, index) => (
        <InfoItem key={index} label={item.label} value={item.value} theme={theme} />
      ))}
    </Box>
  );
}

interface InfoItemProps {
  label: string;
  value: ReactNode;
  theme: Theme;
}

function InfoItem({ label, value, theme }: InfoItemProps): React.ReactElement {
  return (
    <Box gap={1}>
      <Text color={theme.muted}>{label}:</Text>
      {typeof value === 'string' ? (
        <Text color={theme.text}>{value}</Text>
      ) : (
        value
      )}
    </Box>
  );
}

export interface StatsRowProps {
  stats: Array<{ label: string; value: string | number; color?: string }>;
  separator?: string;
  theme?: Theme;
}

/**
 * Row of statistics
 */
export function StatsRow({
  stats,
  separator = '  │  ',
  theme = getTheme(),
}: StatsRowProps): React.ReactElement {
  return (
    <Box>
      {stats.map((stat, index) => (
        <React.Fragment key={index}>
          <Box gap={1}>
            <Text color={theme.muted}>{stat.label}:</Text>
            <Text color={stat.color ?? theme.text} bold>{stat.value}</Text>
          </Box>
          {index < stats.length - 1 && (
            <Text color={theme.muted}>{separator}</Text>
          )}
        </React.Fragment>
      ))}
    </Box>
  );
}

export interface HeaderBarProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  theme?: Theme;
}

/**
 * Header bar with title and optional right content
 */
export function HeaderBar({
  title,
  subtitle,
  right,
  theme = getTheme(),
}: HeaderBarProps): React.ReactElement {
  return (
    <Box
      justifyContent="space-between"
      borderBottom
      borderColor={theme.muted}
      paddingBottom={1}
      marginBottom={1}
    >
      <Box gap={2}>
        <Text color={theme.accent} bold>{title}</Text>
        {subtitle && <Text color={theme.muted}>{subtitle}</Text>}
      </Box>
      {right}
    </Box>
  );
}

export interface FooterBarProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  theme?: Theme;
}

/**
 * Footer bar with left/center/right sections
 */
export function FooterBar({
  left,
  center,
  right,
  theme = getTheme(),
}: FooterBarProps): React.ReactElement {
  return (
    <Box
      justifyContent="space-between"
      borderTop
      borderColor={theme.muted}
      paddingTop={1}
      marginTop={1}
    >
      <Box flexGrow={1}>{left}</Box>
      <Box flexGrow={1} justifyContent="center">{center}</Box>
      <Box flexGrow={1} justifyContent="flex-end">{right}</Box>
    </Box>
  );
}

export interface DividerProps {
  label?: string;
  style?: 'solid' | 'dashed' | 'dotted';
  theme?: Theme;
}

/**
 * Horizontal divider with optional label
 */
export function Divider({
  label,
  style = 'solid',
  theme = getTheme(),
}: DividerProps): React.ReactElement {
  const chars: Record<string, string> = {
    solid: '─',
    dashed: '╌',
    dotted: '┄',
  };

  const char = chars[style] ?? '─';
  const line = char.repeat(20);

  if (label) {
    return (
      <Box marginY={1}>
        <Text color={theme.muted}>{line} </Text>
        <Text color={theme.muted}>{label}</Text>
        <Text color={theme.muted}> {line}</Text>
      </Box>
    );
  }

  return (
    <Box marginY={1}>
      <Text color={theme.muted}>{char.repeat(60)}</Text>
    </Box>
  );
}
