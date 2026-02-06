import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme';

export interface PRDetailData {
  id: string;
  number: number;
  title: string;
  repo: string;
  author: string;
  state: 'open' | 'draft' | 'merged' | 'closed';
  sourceBranch: string;
  targetBranch: string;
  createdAt: string;
  updatedAt: string;
  body?: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  labels?: string[];
  reviewers?: string[];
}

export interface PRDetailProps {
  pr: PRDetailData;
  width: number;
  height: number;
  theme?: Theme;
}

function getStateIndicator(state: PRDetailData['state'], theme?: Theme): { label: string; color: string } {
  switch (state) {
    case 'open':
      return { label: 'Open', color: theme?.added ?? 'green' };
    case 'draft':
      return { label: 'Draft', color: theme?.muted ?? 'yellow' };
    case 'merged':
      return { label: 'Merged', color: theme?.accent ?? 'magenta' };
    case 'closed':
      return { label: 'Closed', color: theme?.removed ?? 'red' };
    default:
      return { label: 'Unknown', color: theme?.muted ?? 'gray' };
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

export function PRDetail({ pr, width, theme }: PRDetailProps): JSX.Element {
  const accentColor = theme?.accent ?? 'cyan';
  const mutedColor = theme?.muted ?? 'gray';
  const addedColor = theme?.added ?? 'green';
  const removedColor = theme?.removed ?? 'red';
  const state = getStateIndicator(pr.state, theme);

  const labelWidth = 14;

  return (
    <Box flexDirection="column" width={width} paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={accentColor} bold>
          #{pr.number}
        </Text>
        <Text> </Text>
        <Text bold>{pr.title}</Text>
      </Box>

      {/* State badge */}
      <Box marginBottom={1}>
        <Text color={state.color} bold>
          ● {state.label}
        </Text>
        <Text color={mutedColor}> · </Text>
        <Text color={mutedColor}>{pr.repo}</Text>
      </Box>

      {/* Branch info */}
      <Box marginBottom={1}>
        <Text color={mutedColor}>{'Branch:'.padEnd(labelWidth)}</Text>
        <Text color={accentColor}>{pr.sourceBranch}</Text>
        <Text color={mutedColor}> → </Text>
        <Text color={accentColor}>{pr.targetBranch}</Text>
      </Box>

      {/* Author */}
      <Box>
        <Text color={mutedColor}>{'Author:'.padEnd(labelWidth)}</Text>
        <Text>{pr.author}</Text>
      </Box>

      {/* Created/Updated */}
      <Box>
        <Text color={mutedColor}>{'Created:'.padEnd(labelWidth)}</Text>
        <Text>{formatDate(pr.createdAt)}</Text>
        <Text color={mutedColor}> ({formatTimeAgo(pr.createdAt)})</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color={mutedColor}>{'Updated:'.padEnd(labelWidth)}</Text>
        <Text>{formatDate(pr.updatedAt)}</Text>
        <Text color={mutedColor}> ({formatTimeAgo(pr.updatedAt)})</Text>
      </Box>

      {/* Stats */}
      {(pr.additions !== undefined || pr.deletions !== undefined) && (
        <Box marginBottom={1}>
          <Text color={mutedColor}>{'Changes:'.padEnd(labelWidth)}</Text>
          {pr.changedFiles !== undefined && (
            <Text>{pr.changedFiles} files </Text>
          )}
          {pr.additions !== undefined && (
            <Text color={addedColor}>+{pr.additions}</Text>
          )}
          {pr.deletions !== undefined && (
            <>
              <Text> </Text>
              <Text color={removedColor}>-{pr.deletions}</Text>
            </>
          )}
        </Box>
      )}

      {/* Labels */}
      {pr.labels && pr.labels.length > 0 && (
        <Box marginBottom={1}>
          <Text color={mutedColor}>{'Labels:'.padEnd(labelWidth)}</Text>
          <Text>{pr.labels.join(', ')}</Text>
        </Box>
      )}

      {/* Reviewers */}
      {pr.reviewers && pr.reviewers.length > 0 && (
        <Box marginBottom={1}>
          <Text color={mutedColor}>{'Reviewers:'.padEnd(labelWidth)}</Text>
          <Text>{pr.reviewers.join(', ')}</Text>
        </Box>
      )}

      {/* Body/Description */}
      {pr.body && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={mutedColor} bold>
            Description
          </Text>
          <Box marginTop={1} paddingX={1}>
            <Text wrap="wrap">{pr.body}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
