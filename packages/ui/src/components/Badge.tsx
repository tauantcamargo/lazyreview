import React from 'react';
import { Box, Text } from 'ink';
import { defaultTheme, type Theme } from '../theme';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'muted';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  icon?: string;
  outlined?: boolean;
  theme?: Theme;
}

function getVariantColor(variant: BadgeVariant, theme: Theme): string {
  switch (variant) {
    case 'success':
      return theme.success;
    case 'warning':
      return theme.warning;
    case 'error':
      return theme.error;
    case 'info':
      return theme.info;
    case 'muted':
      return theme.muted;
    default:
      return theme.accent;
  }
}

export function Badge({
  children,
  variant = 'default',
  icon,
  outlined = false,
  theme = defaultTheme,
}: BadgeProps): JSX.Element {
  const color = getVariantColor(variant, theme);

  if (outlined) {
    return (
      <Box>
        <Text color={color}>[</Text>
        {icon && <Text color={color}>{icon} </Text>}
        <Text color={color}>{children}</Text>
        <Text color={color}>]</Text>
      </Box>
    );
  }

  return (
    <Box>
      {icon && <Text color={color}>{icon} </Text>}
      <Text color={color} bold>
        {children}
      </Text>
    </Box>
  );
}

export interface StatusBadgeProps {
  status: 'open' | 'closed' | 'merged' | 'draft' | 'pending' | 'approved' | 'rejected';
  showIcon?: boolean;
  theme?: Theme;
}

const statusConfig: Record<
  StatusBadgeProps['status'],
  { icon: string; variant: BadgeVariant; label: string }
> = {
  open: { icon: '●', variant: 'success', label: 'Open' },
  closed: { icon: '○', variant: 'error', label: 'Closed' },
  merged: { icon: '◆', variant: 'info', label: 'Merged' },
  draft: { icon: '◐', variant: 'warning', label: 'Draft' },
  pending: { icon: '○', variant: 'warning', label: 'Pending' },
  approved: { icon: '✓', variant: 'success', label: 'Approved' },
  rejected: { icon: '✗', variant: 'error', label: 'Rejected' },
};

export function StatusBadge({
  status,
  showIcon = true,
  theme = defaultTheme,
}: StatusBadgeProps): JSX.Element {
  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      icon={showIcon ? config.icon : undefined}
      theme={theme}
    >
      {config.label}
    </Badge>
  );
}

export interface LabelBadgeProps {
  name: string;
  color?: string;
  theme?: Theme;
}

export function LabelBadge({
  name,
  color,
  theme = defaultTheme,
}: LabelBadgeProps): JSX.Element {
  return (
    <Box>
      <Text color={color ?? theme.accent}>◉ </Text>
      <Text color={color ?? theme.text}>{name}</Text>
    </Box>
  );
}

export interface CountBadgeProps {
  count: number;
  label?: string;
  variant?: BadgeVariant;
  showZero?: boolean;
  maxDisplay?: number;
  theme?: Theme;
}

export function CountBadge({
  count,
  label,
  variant = 'default',
  showZero = false,
  maxDisplay = 99,
  theme = defaultTheme,
}: CountBadgeProps): JSX.Element | null {
  if (count <= 0 && !showZero) {
    return null;
  }

  const displayCount = count > maxDisplay ? `${maxDisplay}+` : String(count);

  return (
    <Badge variant={variant} theme={theme}>
      {displayCount}
      {label && ` ${label}`}
    </Badge>
  );
}

export interface TagListProps {
  tags: Array<{ name: string; color?: string }>;
  maxVisible?: number;
  separator?: string;
  theme?: Theme;
}

export function TagList({
  tags,
  maxVisible,
  separator = ' ',
  theme = defaultTheme,
}: TagListProps): JSX.Element {
  const visibleTags = maxVisible ? tags.slice(0, maxVisible) : tags;
  const hiddenCount = maxVisible ? Math.max(0, tags.length - maxVisible) : 0;

  return (
    <Box>
      {visibleTags.map((tag, index) => (
        <React.Fragment key={tag.name}>
          {index > 0 && <Text>{separator}</Text>}
          <LabelBadge name={tag.name} color={tag.color} theme={theme} />
        </React.Fragment>
      ))}
      {hiddenCount > 0 && (
        <>
          <Text>{separator}</Text>
          <Text color={theme.muted}>+{hiddenCount} more</Text>
        </>
      )}
    </Box>
  );
}
