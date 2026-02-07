import React from 'react';
import { Box, Text } from 'ink';
import { defaultTheme, type Theme } from '../theme';

export type TimelineEventType =
  | 'commit'
  | 'comment'
  | 'review'
  | 'approval'
  | 'changes_requested'
  | 'merged'
  | 'closed'
  | 'reopened'
  | 'assigned'
  | 'labeled';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  author: string;
  timestamp: string;
  title?: string;
  body?: string;
}

export interface TimelineProps {
  events: TimelineEvent[];
  selectedIndex?: number;
  width?: number;
  height?: number;
  showConnectors?: boolean;
  theme?: Theme;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString();
}

function getEventIcon(type: TimelineEventType): string {
  switch (type) {
    case 'commit':
      return '●';
    case 'comment':
      return '💬';
    case 'review':
      return '👁';
    case 'approval':
      return '✓';
    case 'changes_requested':
      return '✗';
    case 'merged':
      return '◆';
    case 'closed':
      return '○';
    case 'reopened':
      return '↺';
    case 'assigned':
      return '→';
    case 'labeled':
      return '◉';
    default:
      return '•';
  }
}

function getEventColor(type: TimelineEventType, theme: Theme): string {
  switch (type) {
    case 'commit':
      return theme.info;
    case 'comment':
      return theme.muted;
    case 'review':
      return theme.warning;
    case 'approval':
      return theme.success;
    case 'changes_requested':
      return theme.error;
    case 'merged':
      return theme.info;
    case 'closed':
      return theme.error;
    case 'reopened':
      return theme.success;
    case 'assigned':
      return theme.warning;
    case 'labeled':
      return theme.accent;
    default:
      return theme.muted;
  }
}

function getEventTitle(event: TimelineEvent): string {
  if (event.title) return event.title;

  switch (event.type) {
    case 'commit':
      return 'pushed a commit';
    case 'comment':
      return 'commented';
    case 'review':
      return 'reviewed';
    case 'approval':
      return 'approved';
    case 'changes_requested':
      return 'requested changes';
    case 'merged':
      return 'merged';
    case 'closed':
      return 'closed';
    case 'reopened':
      return 'reopened';
    case 'assigned':
      return 'was assigned';
    case 'labeled':
      return 'added a label';
    default:
      return 'updated';
  }
}

export interface TimelineItemProps {
  event: TimelineEvent;
  isSelected?: boolean;
  isLast?: boolean;
  showConnector?: boolean;
  width?: number;
  theme?: Theme;
}

export function TimelineItem({
  event,
  isSelected = false,
  isLast = false,
  showConnector = true,
  width = 60,
  theme = defaultTheme,
}: TimelineItemProps): JSX.Element {
  const icon = getEventIcon(event.type);
  const color = getEventColor(event.type, theme);
  const title = getEventTitle(event);
  const time = formatTimestamp(event.timestamp);

  const bodyMaxWidth = width - 10;
  const displayBody = event.body && event.body.length > bodyMaxWidth
    ? event.body.slice(0, bodyMaxWidth - 3) + '...'
    : event.body;

  return (
    <Box flexDirection="column">
      <Box>
        {/* Icon/connector column */}
        <Box flexDirection="column" width={3}>
          <Text color={color}>{icon}</Text>
          {showConnector && !isLast && (
            <Text color={theme.border}>│</Text>
          )}
        </Box>

        {/* Content */}
        <Box flexDirection="column" width={width - 3}>
          <Box>
            <Text
              color={isSelected ? theme.primary : theme.text}
              bold={isSelected}
            >
              {event.author}
            </Text>
            <Text color={theme.muted}> {title}</Text>
            <Box flexGrow={1} />
            <Text color={theme.muted}>{time}</Text>
          </Box>

          {displayBody && (
            <Box marginTop={0}>
              <Text color={theme.muted}>{displayBody}</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Connector line to next item */}
      {showConnector && !isLast && (
        <Box>
          <Box width={3}>
            <Text color={theme.border}>│</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export function Timeline({
  events,
  selectedIndex,
  width = 60,
  height,
  showConnectors = true,
  theme = defaultTheme,
}: TimelineProps): JSX.Element {
  if (events.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color={theme.muted}>No timeline events</Text>
      </Box>
    );
  }

  // Simple height-based slicing (could be enhanced with virtual scrolling)
  const visibleEvents = height && height > 0
    ? events.slice(0, Math.floor(height / 2))
    : events;

  return (
    <Box flexDirection="column" width={width} height={height}>
      {visibleEvents.map((event, index) => (
        <TimelineItem
          key={event.id}
          event={event}
          isSelected={selectedIndex === index}
          isLast={index === visibleEvents.length - 1}
          showConnector={showConnectors}
          width={width}
          theme={theme}
        />
      ))}
    </Box>
  );
}
