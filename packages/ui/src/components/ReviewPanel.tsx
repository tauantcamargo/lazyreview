import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme';

export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

export interface ReviewComment {
  id: string;
  author: string;
  body: string;
  path?: string;
  line?: number;
  createdAt: string;
  isPending?: boolean;
}

export interface Review {
  id: string;
  author: string;
  state: ReviewEvent;
  body?: string;
  submittedAt: string;
  comments?: ReviewComment[];
}

export interface ReviewPanelProps {
  reviews: Review[];
  selectedIndex?: number;
  width: number;
  height: number;
  theme?: Theme;
}

function getReviewStateIndicator(state: ReviewEvent, theme?: Theme): { icon: string; color: string; label: string } {
  switch (state) {
    case 'APPROVE':
      return { icon: '✓', color: theme?.added ?? 'green', label: 'Approved' };
    case 'REQUEST_CHANGES':
      return { icon: '✗', color: theme?.removed ?? 'red', label: 'Changes Requested' };
    case 'COMMENT':
      return { icon: '●', color: theme?.accent ?? 'cyan', label: 'Commented' };
    default:
      return { icon: '?', color: theme?.muted ?? 'gray', label: 'Unknown' };
  }
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

export function ReviewPanel({
  reviews,
  selectedIndex = -1,
  width,
  height,
  theme,
}: ReviewPanelProps): JSX.Element {
  const accentColor = theme?.accent ?? 'cyan';
  const mutedColor = theme?.muted ?? 'gray';

  if (reviews.length === 0) {
    return (
      <Box flexDirection="column" width={width} height={height} paddingX={1}>
        <Text color={accentColor} bold>
          Reviews
        </Text>
        <Box marginTop={1}>
          <Text color={mutedColor} italic>
            No reviews yet
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box paddingX={1}>
        <Text color={accentColor} bold>
          Reviews ({reviews.length})
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1} overflowY="hidden">
        {reviews.map((review, idx) => {
          const isSelected = idx === selectedIndex;
          const state = getReviewStateIndicator(review.state, theme);

          return (
            <Box
              key={review.id}
              flexDirection="column"
              paddingX={1}
              marginBottom={1}
            >
              <Box>
                <Text inverse={isSelected}>
                  {isSelected ? '▸' : ' '}
                </Text>
                <Text color={state.color}>{state.icon}</Text>
                <Text> </Text>
                <Text bold>{review.author}</Text>
                <Text color={mutedColor}> · </Text>
                <Text color={state.color}>{state.label}</Text>
                <Text color={mutedColor}> · </Text>
                <Text color={mutedColor}>{formatTimeAgo(review.submittedAt)}</Text>
              </Box>

              {review.body && (
                <Box paddingLeft={3} marginTop={1}>
                  <Text wrap="wrap">{review.body}</Text>
                </Box>
              )}

              {review.comments && review.comments.length > 0 && (
                <Box paddingLeft={3} marginTop={1}>
                  <Text color={mutedColor}>
                    {review.comments.length} comment{review.comments.length === 1 ? '' : 's'}
                  </Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
