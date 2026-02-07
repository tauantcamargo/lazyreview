import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme';

export interface Comment {
  id: string;
  author: string;
  body: string;
  path?: string;
  line?: number;
  createdAt: string;
  isResolved?: boolean;
  replyCount?: number;
}

export interface CommentsPanelProps {
  comments: Comment[];
  selectedIndex?: number;
  showResolved?: boolean;
  groupByFile?: boolean;
  width: number;
  height: number;
  theme?: Theme;
  onSelect?: (comment: Comment) => void;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function CommentsPanel({
  comments,
  selectedIndex = -1,
  showResolved = false,
  groupByFile = false,
  width,
  height,
  theme,
}: CommentsPanelProps): JSX.Element {
  const accentColor = theme?.accent ?? 'cyan';
  const mutedColor = theme?.muted ?? 'gray';
  const addedColor = theme?.added ?? 'green';

  const filteredComments = showResolved
    ? comments
    : comments.filter((c) => !c.isResolved);

  const resolvedCount = comments.filter((c) => c.isResolved).length;
  const unresolvedCount = comments.length - resolvedCount;

  if (filteredComments.length === 0) {
    return (
      <Box flexDirection="column" width={width} height={height} paddingX={1}>
        <Text color={accentColor} bold>
          Comments
        </Text>
        <Box marginTop={1}>
          <Text color={mutedColor} italic>
            {comments.length === 0
              ? 'No comments'
              : `All ${resolvedCount} comments resolved`}
          </Text>
        </Box>
      </Box>
    );
  }

  // Group by file if requested
  const groupedComments: Map<string, Comment[]> = new Map();
  if (groupByFile) {
    for (const comment of filteredComments) {
      const key = comment.path ?? 'General';
      const group = groupedComments.get(key) ?? [];
      group.push(comment);
      groupedComments.set(key, group);
    }
  }

  const maxBodyWidth = Math.max(20, width - 20);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box paddingX={1} justifyContent="space-between">
        <Text color={accentColor} bold>
          Comments
        </Text>
        <Text color={mutedColor}>
          {unresolvedCount} unresolved
          {resolvedCount > 0 && !showResolved && `, ${resolvedCount} resolved`}
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1} overflowY="hidden">
        {groupByFile ? (
          Array.from(groupedComments.entries()).map(([path, fileComments]) => (
            <Box key={path} flexDirection="column" marginBottom={1}>
              <Box paddingX={1}>
                <Text color={mutedColor} bold>
                  {path}
                </Text>
              </Box>
              {fileComments.map((comment, idx) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  isSelected={filteredComments.indexOf(comment) === selectedIndex}
                  maxBodyWidth={maxBodyWidth}
                  theme={theme}
                />
              ))}
            </Box>
          ))
        ) : (
          filteredComments.map((comment, idx) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              isSelected={idx === selectedIndex}
              maxBodyWidth={maxBodyWidth}
              theme={theme}
            />
          ))
        )}
      </Box>
    </Box>
  );
}

interface CommentRowProps {
  comment: Comment;
  isSelected: boolean;
  maxBodyWidth: number;
  theme?: Theme;
}

function CommentRow({ comment, isSelected, maxBodyWidth, theme }: CommentRowProps): JSX.Element {
  const mutedColor = theme?.muted ?? 'gray';
  const addedColor = theme?.added ?? 'green';

  return (
    <Box flexDirection="column" paddingX={1} marginBottom={1}>
      <Box>
        <Text inverse={isSelected}>{isSelected ? '▸' : ' '}</Text>
        <Text bold>{comment.author}</Text>
        {comment.path && (
          <>
            <Text color={mutedColor}> on </Text>
            <Text color={theme?.accent ?? 'cyan'}>
              {comment.path}
              {comment.line && `:${comment.line}`}
            </Text>
          </>
        )}
        <Text color={mutedColor}> · {formatTimeAgo(comment.createdAt)}</Text>
        {comment.isResolved && (
          <Text color={addedColor}> ✓</Text>
        )}
      </Box>
      <Box paddingLeft={2}>
        <Text wrap="wrap">{truncate(comment.body, maxBodyWidth)}</Text>
      </Box>
      {comment.replyCount !== undefined && comment.replyCount > 0 && (
        <Box paddingLeft={2}>
          <Text color={mutedColor}>
            {comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}
          </Text>
        </Box>
      )}
    </Box>
  );
}
