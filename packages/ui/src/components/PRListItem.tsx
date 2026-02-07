import React from 'react';
import { Box, Text } from 'ink';
import { defaultTheme, type Theme } from '../theme';

export type PRStatus = 'open' | 'draft' | 'merged' | 'closed';
export type ReviewStatus = 'pending' | 'approved' | 'changes_requested' | 'commented';

export interface PRListItemProps {
  number: number;
  title: string;
  author: string;
  repo: string;
  status: PRStatus;
  reviewStatus?: ReviewStatus;
  updatedAt: string;
  commentCount?: number;
  additions?: number;
  deletions?: number;
  isSelected?: boolean;
  width?: number;
  theme?: Theme;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  return `${Math.floor(diffDays / 30)}mo`;
}

function getStatusColor(status: PRStatus, theme: Theme): string {
  switch (status) {
    case 'open':
      return theme.success;
    case 'draft':
      return theme.warning;
    case 'merged':
      return theme.info;
    case 'closed':
      return theme.error;
    default:
      return theme.muted;
  }
}

function getStatusIcon(status: PRStatus): string {
  switch (status) {
    case 'open':
      return '●';
    case 'draft':
      return '◐';
    case 'merged':
      return '◆';
    case 'closed':
      return '○';
    default:
      return '?';
  }
}

function getReviewIcon(status: ReviewStatus | undefined, theme: Theme): { icon: string; color: string } | null {
  if (!status) return null;

  switch (status) {
    case 'approved':
      return { icon: '✓', color: theme.success };
    case 'changes_requested':
      return { icon: '✗', color: theme.error };
    case 'commented':
      return { icon: '💬', color: theme.info };
    case 'pending':
      return { icon: '○', color: theme.warning };
    default:
      return null;
  }
}

export function PRListItem({
  number,
  title,
  author,
  repo,
  status,
  reviewStatus,
  updatedAt,
  commentCount = 0,
  additions,
  deletions,
  isSelected = false,
  width = 80,
  theme = defaultTheme,
}: PRListItemProps): JSX.Element {
  const statusColor = getStatusColor(status, theme);
  const statusIcon = getStatusIcon(status);
  const reviewInfo = getReviewIcon(reviewStatus, theme);
  const relativeTime = formatRelativeTime(updatedAt);

  // Calculate title max width
  const authorWidth = Math.min(author.length, 12) + 1; // @author
  const numberWidth = String(number).length + 1; // #123
  const timeWidth = relativeTime.length + 1;
  const statusWidth = 2; // icon + space
  const reviewWidth = reviewInfo ? 2 : 0;
  const statsWidth = additions !== undefined || deletions !== undefined ? 12 : 0;
  const commentWidth = commentCount > 0 ? 4 : 0;
  const fixedWidth = authorWidth + numberWidth + timeWidth + statusWidth + reviewWidth + statsWidth + commentWidth + 4;
  const titleMaxWidth = Math.max(width - fixedWidth, 10);
  const displayTitle = title.length > titleMaxWidth
    ? title.slice(0, titleMaxWidth - 1) + '…'
    : title;

  return (
    <Box
      width={width}
      paddingX={1}
    >
      {/* Status indicator */}
      <Text color={statusColor}>{statusIcon} </Text>

      {/* Author */}
      <Text color={isSelected ? theme.accent : theme.muted}>
        @{author.slice(0, 12).padEnd(12)}
      </Text>
      <Text> </Text>

      {/* PR number and title */}
      <Text
        color={isSelected ? theme.primary : theme.text}
        bold={isSelected}
      >
        #{number}
      </Text>
      <Text color={theme.muted}> </Text>
      <Text
        color={isSelected ? theme.primary : theme.text}
      >
        {displayTitle}
      </Text>

      {/* Spacer */}
      <Box flexGrow={1} />

      {/* Review status */}
      {reviewInfo && (
        <Text color={reviewInfo.color}>{reviewInfo.icon} </Text>
      )}

      {/* Comment count */}
      {commentCount > 0 && (
        <Text color={theme.muted}>💬{commentCount} </Text>
      )}

      {/* Stats */}
      {(additions !== undefined || deletions !== undefined) && (
        <>
          <Text color={theme.success}>+{additions ?? 0}</Text>
          <Text color={theme.muted}>/</Text>
          <Text color={theme.error}>-{deletions ?? 0}</Text>
          <Text> </Text>
        </>
      )}

      {/* Time */}
      <Text color={theme.muted}>{relativeTime}</Text>
    </Box>
  );
}

export interface PRListHeaderProps {
  width?: number;
  theme?: Theme;
}

export function PRListHeader({
  width = 80,
  theme = defaultTheme,
}: PRListHeaderProps): JSX.Element {
  return (
    <Box width={width} paddingX={1} borderBottom>
      <Text color={theme.muted}>  Author        </Text>
      <Text color={theme.muted}>Title</Text>
      <Box flexGrow={1} />
      <Text color={theme.muted}>Stats     Updated</Text>
    </Box>
  );
}
