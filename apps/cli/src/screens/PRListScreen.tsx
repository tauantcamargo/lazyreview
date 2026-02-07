import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { VirtualList, PRListItem, EmptyState, Spinner } from '@lazyreview/ui';
import { useAppStore, usePullRequests, useSelectedRepo, useStatus } from '../stores/app-store.js';
import { useNavigation, useKeyboard } from '../hooks/index.js';
import type { PullRequest } from '@lazyreview/core';

export interface PRListScreenProps {
  width?: number;
  height?: number;
}

/**
 * PR List Screen - Main screen showing list of pull requests
 */
export function PRListScreen({ width = 80, height = 20 }: PRListScreenProps): React.ReactElement {
  const pullRequests = usePullRequests();
  const selectedRepo = useSelectedRepo();
  const status = useStatus();
  const selectPR = useAppStore((s) => s.selectPR);
  const selectedListIndex = useAppStore((s) => s.selectedListIndex);
  const setSelectedListIndex = useAppStore((s) => s.setSelectedListIndex);
  const searchQuery = useAppStore((s) => s.searchQuery);

  const { navigateUp, navigateDown, navigateToTop, navigateToBottom } = useNavigation({
    itemCount: pullRequests.length,
    selectedIndex: selectedListIndex,
    onIndexChange: setSelectedListIndex,
  });

  // Filter PRs by search query
  const filteredPRs = React.useMemo(() => {
    if (!searchQuery) return pullRequests;
    const query = searchQuery.toLowerCase();
    return pullRequests.filter(
      (pr) =>
        pr.title.toLowerCase().includes(query) ||
        pr.author.login.toLowerCase().includes(query) ||
        String(pr.number).includes(query)
    );
  }, [pullRequests, searchQuery]);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      navigateUp();
    } else if (key.downArrow || input === 'j') {
      navigateDown();
    } else if (input === 'G') {
      navigateToBottom();
    } else if (key.return) {
      const selectedPR = filteredPRs[selectedListIndex];
      if (selectedPR) {
        selectPR(selectedPR.number);
      }
    }
  });

  // Handle gg chord for going to top
  const handleChord = useCallback(
    (chord: string) => {
      if (chord === 'gg') {
        navigateToTop();
      }
    },
    [navigateToTop]
  );

  // Loading state
  if (status === 'loading') {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <Spinner label="Loading pull requests..." />
      </Box>
    );
  }

  // No repo selected
  if (!selectedRepo) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <EmptyState
          type="empty"
          title="No Repository Selected"
          message="Select a repository from the sidebar to view pull requests"
        />
      </Box>
    );
  }

  // Empty state
  if (filteredPRs.length === 0) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <EmptyState
          type="empty"
          title={searchQuery ? 'No Matching PRs' : 'No Pull Requests'}
          message={
            searchQuery
              ? `No pull requests match "${searchQuery}"`
              : 'No open pull requests in this repository'
          }
        />
      </Box>
    );
  }

  // Calculate visible height for virtual list (subtract header)
  const listHeight = height - 2;

  return (
    <Box flexDirection="column" width={width}>
      {/* Header */}
      <Box paddingX={1} marginBottom={1}>
        <Text bold>
          Pull Requests ({filteredPRs.length})
          {searchQuery && <Text color="gray"> - filtered by "{searchQuery}"</Text>}
        </Text>
      </Box>

      {/* PR List */}
      <VirtualList
        items={filteredPRs}
        itemHeight={1}
        height={listHeight}
        width={width}
        selectedIndex={selectedListIndex}
        renderItem={(pr: PullRequest, index: number) => (
          <PRListItem
            title={pr.title}
            number={pr.number}
            author={pr.author.login}
            status={mapPRStatus(pr.state, pr.isDraft)}
            reviewStatus={mapReviewStatus(pr.reviewDecision)}
            selected={index === selectedListIndex}
            updatedAt={formatRelativeTime(pr.updatedAt)}
            labels={pr.labels?.map((l) => ({ name: l.name, color: l.color })) ?? []}
          />
        )}
        keyExtractor={(pr: PullRequest) => String(pr.number)}
      />
    </Box>
  );
}

// Helper functions
function mapPRStatus(state: string, isDraft: boolean): 'open' | 'merged' | 'closed' | 'draft' {
  if (isDraft) return 'draft';
  switch (state.toLowerCase()) {
    case 'merged':
      return 'merged';
    case 'closed':
      return 'closed';
    default:
      return 'open';
  }
}

function mapReviewStatus(
  decision?: string
): 'approved' | 'changes_requested' | 'pending' | 'commented' | undefined {
  if (!decision) return undefined;
  switch (decision.toLowerCase()) {
    case 'approved':
      return 'approved';
    case 'changes_requested':
      return 'changes_requested';
    case 'commented':
      return 'commented';
    default:
      return 'pending';
  }
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

export default PRListScreen;
