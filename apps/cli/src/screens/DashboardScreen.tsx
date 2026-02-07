import React from 'react';
import { Box, Text, useInput } from 'ink';
import {
  Dashboard,
  StatusBadge,
  CountBadge,
  Spinner,
  EmptyState,
} from '@lazyreview/ui';
import { useAppStore, usePullRequests, useStatus } from '../stores/app-store.js';
import type { PullRequest } from '@lazyreview/core';

export interface DashboardScreenProps {
  width?: number;
  height?: number;
}

interface DashboardStats {
  totalPRs: number;
  openPRs: number;
  draftPRs: number;
  mergedPRs: number;
  closedPRs: number;
  needsReview: number;
  approved: number;
  changesRequested: number;
  myPRs: number;
  assignedToMe: number;
}

/**
 * Dashboard Screen - Overview of PR statistics and quick actions
 */
export function DashboardScreen({ width = 80, height = 20 }: DashboardScreenProps): React.ReactElement {
  const pullRequests = usePullRequests();
  const status = useStatus();
  const setView = useAppStore((s) => s.setView);
  const setFilters = useAppStore((s) => s.setFilters);

  // Calculate statistics
  const stats = React.useMemo<DashboardStats>(() => {
    return {
      totalPRs: pullRequests.length,
      openPRs: pullRequests.filter((pr) => pr.state === 'open' && !pr.isDraft).length,
      draftPRs: pullRequests.filter((pr) => pr.isDraft).length,
      mergedPRs: pullRequests.filter((pr) => pr.state === 'merged').length,
      closedPRs: pullRequests.filter((pr) => pr.state === 'closed').length,
      needsReview: pullRequests.filter(
        (pr) => pr.state === 'open' && !pr.reviewDecision
      ).length,
      approved: pullRequests.filter(
        (pr) => pr.reviewDecision === 'APPROVED'
      ).length,
      changesRequested: pullRequests.filter(
        (pr) => pr.reviewDecision === 'CHANGES_REQUESTED'
      ).length,
      myPRs: 0, // Would need current user
      assignedToMe: 0, // Would need current user
    };
  }, [pullRequests]);

  // Recent activity
  const recentPRs = React.useMemo(() => {
    return [...pullRequests]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [pullRequests]);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      setView('list');
      return;
    }

    // Quick filters
    if (input === '1') {
      setFilters({ state: 'open' });
      setView('list');
    } else if (input === '2') {
      setFilters({ state: 'all' });
      setView('list');
    } else if (input === '3') {
      setFilters({ state: 'closed' });
      setView('list');
    }
  });

  // Loading state
  if (status === 'loading') {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <Spinner label="Loading dashboard..." />
      </Box>
    );
  }

  // Empty state
  if (pullRequests.length === 0) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <EmptyState
          type="empty"
          title="No Pull Requests"
          message="No pull requests found. Select a repository to get started."
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width} paddingX={1}>
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold>Dashboard</Text>
      </Box>

      {/* Stats Grid */}
      <Box flexDirection="row" marginBottom={1}>
        {/* Status Column */}
        <Box flexDirection="column" width={Math.floor(width / 3)} marginRight={2}>
          <Text bold underline>Status</Text>
          <Box marginTop={1} flexDirection="column">
            <StatRow label="Open" value={stats.openPRs} color="green" />
            <StatRow label="Draft" value={stats.draftPRs} color="yellow" />
            <StatRow label="Merged" value={stats.mergedPRs} color="magenta" />
            <StatRow label="Closed" value={stats.closedPRs} color="red" />
          </Box>
        </Box>

        {/* Review Column */}
        <Box flexDirection="column" width={Math.floor(width / 3)} marginRight={2}>
          <Text bold underline>Reviews</Text>
          <Box marginTop={1} flexDirection="column">
            <StatRow label="Needs Review" value={stats.needsReview} color="yellow" />
            <StatRow label="Approved" value={stats.approved} color="green" />
            <StatRow label="Changes Requested" value={stats.changesRequested} color="red" />
          </Box>
        </Box>

        {/* Summary Column */}
        <Box flexDirection="column" width={Math.floor(width / 3)}>
          <Text bold underline>Summary</Text>
          <Box marginTop={1} flexDirection="column">
            <StatRow label="Total PRs" value={stats.totalPRs} color="blue" />
          </Box>
        </Box>
      </Box>

      {/* Recent Activity */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold underline>Recent Activity</Text>
        <Box marginTop={1} flexDirection="column">
          {recentPRs.map((pr) => (
            <Box key={pr.number}>
              <Text color="blue">#{pr.number}</Text>
              <Text> </Text>
              <Text>{truncate(pr.title, 40)}</Text>
              <Text color="gray"> by @{pr.author.login}</Text>
              <Text color="gray"> • {formatRelativeTime(pr.updatedAt)}</Text>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Quick Actions */}
      <Box marginTop={2}>
        <Text color="gray">
          1:Open PRs  2:All PRs  3:Closed PRs  q:Back
        </Text>
      </Box>
    </Box>
  );
}

// Helper component for stat rows
interface StatRowProps {
  label: string;
  value: number;
  color?: string;
}

function StatRow({ label, value, color }: StatRowProps): React.ReactElement {
  return (
    <Box>
      <Box width={20}>
        <Text>{label}:</Text>
      </Box>
      <Text color={color as any} bold>{value}</Text>
    </Box>
  );
}

// Helper functions
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

export default DashboardScreen;
