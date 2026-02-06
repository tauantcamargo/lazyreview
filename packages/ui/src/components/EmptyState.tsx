import React, { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { getTheme, Theme } from '../theme';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  theme?: Theme;
}

/**
 * Empty state component for when there's no data to display
 */
export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
  theme = getTheme(),
}: EmptyStateProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      paddingY={2}
      gap={1}
    >
      <Text>{icon}</Text>
      <Text color={theme.text} bold>
        {title}
      </Text>
      {description && (
        <Text color={theme.muted}>{description}</Text>
      )}
      {action && <Box marginTop={1}>{action}</Box>}
    </Box>
  );
}

export type EmptyStateType =
  | 'no-prs'
  | 'no-results'
  | 'no-comments'
  | 'no-reviews'
  | 'no-favorites'
  | 'no-workspaces'
  | 'error'
  | 'offline'
  | 'loading';

export interface PresetEmptyStateProps {
  type: EmptyStateType;
  action?: ReactNode;
  customMessage?: string;
  theme?: Theme;
}

const presets: Record<EmptyStateType, { icon: string; title: string; description: string }> = {
  'no-prs': {
    icon: '📋',
    title: 'No Pull Requests',
    description: 'There are no pull requests to display',
  },
  'no-results': {
    icon: '🔍',
    title: 'No Results',
    description: 'No items match your search criteria',
  },
  'no-comments': {
    icon: '💬',
    title: 'No Comments',
    description: 'This pull request has no comments yet',
  },
  'no-reviews': {
    icon: '👀',
    title: 'No Reviews',
    description: 'No reviews have been submitted yet',
  },
  'no-favorites': {
    icon: '⭐',
    title: 'No Favorites',
    description: 'Press f to add a repository to favorites',
  },
  'no-workspaces': {
    icon: '📁',
    title: 'No Workspaces',
    description: 'Create a workspace to organize your repositories',
  },
  error: {
    icon: '❌',
    title: 'Something Went Wrong',
    description: 'An error occurred while loading data',
  },
  offline: {
    icon: '📡',
    title: 'You are Offline',
    description: 'Please check your internet connection',
  },
  loading: {
    icon: '⏳',
    title: 'Loading...',
    description: 'Please wait while we fetch the data',
  },
};

/**
 * Preset empty state with predefined messages
 */
export function PresetEmptyState({
  type,
  action,
  customMessage,
  theme = getTheme(),
}: PresetEmptyStateProps): React.ReactElement {
  const preset = presets[type];

  return (
    <EmptyState
      icon={preset.icon}
      title={preset.title}
      description={customMessage ?? preset.description}
      action={action}
      theme={theme}
    />
  );
}

export interface LoadingStateProps {
  message?: string;
  spinner?: string;
  theme?: Theme;
}

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Loading state with animated spinner
 */
export function LoadingState({
  message = 'Loading...',
  spinner,
  theme = getTheme(),
}: LoadingStateProps): React.ReactElement {
  const [frameIndex, setFrameIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % spinnerFrames.length);
    }, 80);

    return () => clearInterval(interval);
  }, []);

  const displaySpinner = spinner ?? spinnerFrames[frameIndex];

  return (
    <Box alignItems="center" gap={1}>
      <Text color={theme.accent}>{displaySpinner}</Text>
      <Text color={theme.muted}>{message}</Text>
    </Box>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  retryAction?: ReactNode;
  theme?: Theme;
}

/**
 * Error state component
 */
export function ErrorState({
  title = 'Error',
  message,
  retryAction,
  theme = getTheme(),
}: ErrorStateProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      paddingY={2}
      gap={1}
    >
      <Text color={theme.removed}>✗ {title}</Text>
      <Text color={theme.muted}>{message}</Text>
      {retryAction && <Box marginTop={1}>{retryAction}</Box>}
    </Box>
  );
}

export interface SuccessStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
  theme?: Theme;
}

/**
 * Success state component
 */
export function SuccessState({
  title = 'Success',
  message,
  action,
  theme = getTheme(),
}: SuccessStateProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      paddingY={2}
      gap={1}
    >
      <Text color={theme.added}>✓ {title}</Text>
      <Text color={theme.muted}>{message}</Text>
      {action && <Box marginTop={1}>{action}</Box>}
    </Box>
  );
}

export interface PlaceholderProps {
  lines?: number;
  width?: number;
  theme?: Theme;
}

/**
 * Placeholder component for loading skeletons
 */
export function Placeholder({
  lines = 3,
  width = 40,
  theme = getTheme(),
}: PlaceholderProps): React.ReactElement {
  const lineLengths = React.useMemo(() => {
    return Array.from({ length: lines }, () =>
      Math.floor(width * 0.5 + Math.random() * width * 0.5)
    );
  }, [lines, width]);

  return (
    <Box flexDirection="column" gap={0}>
      {lineLengths.map((length, index) => (
        <Text key={index} color={theme.muted}>
          {'░'.repeat(length)}
        </Text>
      ))}
    </Box>
  );
}
