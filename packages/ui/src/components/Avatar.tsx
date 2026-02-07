import React from 'react';
import { Box, Text } from 'ink';
import { getTheme, Theme } from '../theme';

export interface AvatarProps {
  name: string;
  size?: 'small' | 'medium' | 'large';
  color?: string;
  showInitials?: boolean;
  theme?: Theme;
}

/**
 * Avatar component showing user initials
 */
export function Avatar({
  name,
  size = 'medium',
  color,
  showInitials = true,
  theme = getTheme(),
}: AvatarProps): React.ReactElement {
  const initials = getInitials(name);
  const avatarColor = color ?? getColorFromName(name, theme);

  const sizeConfig = {
    small: { width: 2, padding: 0 },
    medium: { width: 4, padding: 0 },
    large: { width: 6, padding: 1 },
  };

  const config = sizeConfig[size];

  if (!showInitials) {
    return (
      <Text color={avatarColor}>●</Text>
    );
  }

  return (
    <Box
      width={config.width}
      justifyContent="center"
    >
      <Text color={avatarColor} bold>
        {initials}
      </Text>
    </Box>
  );
}

/**
 * Get initials from a name
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);

  if (parts.length === 0 || parts[0] === '') {
    return '?';
  }

  if (parts.length === 1) {
    return (parts[0]?.[0] ?? '?').toUpperCase();
  }

  return (
    (parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')
  ).toUpperCase();
}

/**
 * Generate a consistent color from a name
 */
function getColorFromName(name: string, theme: Theme): string {
  const colors = [
    theme.accent,
    theme.added,
    theme.modified,
    '#7aa2f7', // blue
    '#bb9af7', // purple
    '#f7768e', // red
    '#ff9e64', // orange
    '#9ece6a', // green
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length] ?? theme.accent;
}

export interface AvatarGroupProps {
  users: Array<{ name: string; color?: string }>;
  max?: number;
  size?: 'small' | 'medium' | 'large';
  theme?: Theme;
}

/**
 * Group of avatars with overflow indicator
 */
export function AvatarGroup({
  users,
  max = 5,
  size = 'medium',
  theme = getTheme(),
}: AvatarGroupProps): React.ReactElement {
  const visibleUsers = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <Box gap={0}>
      {visibleUsers.map((user, index) => (
        <Avatar
          key={index}
          name={user.name}
          color={user.color}
          size={size}
          theme={theme}
        />
      ))}
      {overflow > 0 && (
        <Text color={theme.muted}>+{overflow}</Text>
      )}
    </Box>
  );
}

export interface UserBadgeProps {
  username: string;
  name?: string;
  showAvatar?: boolean;
  avatarColor?: string;
  theme?: Theme;
}

/**
 * User badge with avatar and username
 */
export function UserBadge({
  username,
  name,
  showAvatar = true,
  avatarColor,
  theme = getTheme(),
}: UserBadgeProps): React.ReactElement {
  const displayName = name ?? username;

  return (
    <Box gap={1}>
      {showAvatar && (
        <Avatar
          name={displayName}
          color={avatarColor}
          size="small"
          theme={theme}
        />
      )}
      <Text color={theme.accent}>@{username}</Text>
    </Box>
  );
}

export interface ReviewerListProps {
  reviewers: Array<{
    username: string;
    name?: string;
    state?: 'approved' | 'changes_requested' | 'commented' | 'pending';
  }>;
  theme?: Theme;
}

/**
 * List of reviewers with their review status
 */
export function ReviewerList({
  reviewers,
  theme = getTheme(),
}: ReviewerListProps): React.ReactElement {
  const getStateIndicator = (state?: string): { icon: string; color: string } => {
    switch (state) {
      case 'approved':
        return { icon: '✓', color: theme.added };
      case 'changes_requested':
        return { icon: '✗', color: theme.removed };
      case 'commented':
        return { icon: '💬', color: theme.accent };
      case 'pending':
      default:
        return { icon: '○', color: theme.muted };
    }
  };

  return (
    <Box flexDirection="column">
      {reviewers.map((reviewer, index) => {
        const state = getStateIndicator(reviewer.state);

        return (
          <Box key={index} gap={1}>
            <Text color={state.color}>{state.icon}</Text>
            <UserBadge
              username={reviewer.username}
              name={reviewer.name}
              showAvatar={true}
              theme={theme}
            />
          </Box>
        );
      })}
    </Box>
  );
}

export interface AuthorInfoProps {
  username: string;
  name?: string;
  timestamp?: string;
  action?: string;
  theme?: Theme;
}

/**
 * Author info with username and timestamp
 */
export function AuthorInfo({
  username,
  name,
  timestamp,
  action,
  theme = getTheme(),
}: AuthorInfoProps): React.ReactElement {
  return (
    <Box gap={1}>
      <Avatar name={name ?? username} size="small" theme={theme} />
      <Text color={theme.accent}>@{username}</Text>
      {action && <Text color={theme.muted}>{action}</Text>}
      {timestamp && <Text color={theme.muted}>{timestamp}</Text>}
    </Box>
  );
}
