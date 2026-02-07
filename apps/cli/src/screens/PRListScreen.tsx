import React from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner, EmptyState } from '@lazyreview/ui';
import { formatRelativeTime, type PullRequest, type ProviderType } from '@lazyreview/core';
import { useAppStore, usePullRequests, useSelectedRepo, useStatus } from '../stores/app-store.js';
import { useNavigation, useListPullRequests } from '../hooks/index.js';

export interface PRListScreenProps {
  width?: number;
  height?: number;
  isFocused?: boolean;
}

/**
 * PR List Screen - LazyGit-style PR list matching Go version
 */
export function PRListScreen({ width = 80, height = 20, isFocused = true }: PRListScreenProps): React.ReactElement {
  const demoPullRequests = usePullRequests();
  const selectedRepo = useSelectedRepo();
  const status = useStatus();
  const demoMode = useAppStore((s) => s.demoMode);
  const selectPR = useAppStore((s) => s.selectPR);
  const selectedListIndex = useAppStore((s) => s.selectedListIndex);
  const setSelectedListIndex = useAppStore((s) => s.setSelectedListIndex);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setPullRequests = useAppStore((s) => s.setPullRequests);
  const setStatus = useAppStore((s) => s.setStatus);

  // Fetch real PRs when not in demo mode
  const { data: realPullRequests, isLoading, isError, error } = useListPullRequests({
    owner: selectedRepo?.owner ?? '',
    repo: selectedRepo?.repo ?? '',
    provider: (selectedRepo?.provider ?? 'github') as ProviderType,
    enabled: !demoMode && !!selectedRepo,
  });

  // Sync real data to store when it arrives
  React.useEffect(() => {
    if (!demoMode && realPullRequests) {
      setPullRequests(realPullRequests);
      setStatus('ready');
    }
  }, [realPullRequests, demoMode, setPullRequests, setStatus]);

  // Use demo data in demo mode, real data otherwise
  const pullRequests = demoMode ? demoPullRequests : (realPullRequests ?? []);

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

  // Handle keyboard input (only when this panel is focused)
  useInput((input, key) => {
    if (!isFocused) return;

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

  // Loading state
  if (status === 'loading' || isLoading) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <Spinner label="Loading pull requests..." />
      </Box>
    );
  }

  // Error state
  if (isError && !demoMode) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load pull requests';
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <EmptyState
          type="error"
          title="Error Loading PRs"
          message={errorMessage}
        />
      </Box>
    );
  }

  // No repo selected - show demo message
  if (!selectedRepo && filteredPRs.length === 0) {
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

  // Calculate visible items (2 lines per PR item)
  const itemHeight = 2;
  const visibleCount = Math.floor(height / itemHeight);
  const startIndex = Math.max(0, selectedListIndex - Math.floor(visibleCount / 2));
  const endIndex = Math.min(filteredPRs.length, startIndex + visibleCount);
  const visiblePRs = filteredPRs.slice(startIndex, endIndex);

  return (
    <Box flexDirection="column" width={width}>
      {visiblePRs.map((pr, idx) => {
        const actualIndex = startIndex + idx;
        const isSelected = actualIndex === selectedListIndex;
        return (
          <PRListItemLazygit
            key={pr.id}
            pr={pr}
            selected={isSelected}
            width={width}
          />
        );
      })}
      {/* Scroll indicator */}
      {filteredPRs.length > visibleCount && (
        <Box paddingX={1}>
          <Text color="gray">
            ··
          </Text>
        </Box>
      )}
    </Box>
  );
}

// PR List Item - LazyGit style (two lines per item)
interface PRListItemLazygitProps {
  pr: PullRequest;
  selected: boolean;
  width: number;
}

function PRListItemLazygit({ pr, selected, width }: PRListItemLazygitProps): React.ReactElement {
  const relativeTime = formatRelativeTime(pr.updatedAt, { abbreviated: true });
  const repoName = pr.repository ? `${pr.repository.owner}/${pr.repository.name}` : 'unknown';
  const statusText = pr.isDraft ? 'draft' : pr.state;

  // Build labels string
  const labelsText = pr.labels?.length
    ? pr.labels.map(l => `[${l.name}]`).join(' ')
    : '';

  // Truncate title if needed
  const maxTitleLen = width - 8; // Account for PR number prefix
  const displayTitle = pr.title.length > maxTitleLen
    ? pr.title.slice(0, maxTitleLen - 1) + '…'
    : pr.title;

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Line 1: PR number and title */}
      <Box>
        <Text color="gray">│</Text>
        <Text color={selected ? 'magenta' : 'gray'}>│ </Text>
        <Text color={selected ? 'yellow' : 'white'} bold={selected}>
          #{pr.number}
        </Text>
        <Text> </Text>
        <Text
          color={selected ? 'white' : 'white'}
          bold={selected}
          inverse={selected}
        >
          {displayTitle}
        </Text>
      </Box>
      {/* Line 2: repo, author, time, status, labels */}
      <Box>
        <Text color="gray">│</Text>
        <Text color="gray">│ </Text>
        <Text color="cyan">{repoName}</Text>
        <Text color="gray"> • </Text>
        <Text color="gray">by </Text>
        <Text color="white">{pr.author.login}</Text>
        <Text color="gray"> • </Text>
        <Text color="gray">{relativeTime} ago</Text>
        <Text color="gray"> • </Text>
        <Text color={getStatusColor(statusText)}>{statusText}</Text>
        {labelsText && (
          <>
            <Text color="gray"> </Text>
            <Text color="yellow">{labelsText}</Text>
          </>
        )}
      </Box>
    </Box>
  );
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'open':
      return 'green';
    case 'merged':
      return 'magenta';
    case 'closed':
      return 'red';
    case 'draft':
      return 'gray';
    default:
      return 'white';
  }
}

export default PRListScreen;
