import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  PRDetail,
  Tabs,
  FileTree,
  CommentsPanel,
  ReviewPanel,
  Timeline,
  Spinner,
  EmptyState,
} from '@lazyreview/ui';
import { useAppStore, useSelectedPR, usePullRequests, useStatus } from '../stores/app-store.js';
import type { PullRequest } from '@lazyreview/core';

export interface PRDetailScreenProps {
  width?: number;
  height?: number;
}

type DetailTab = 'files' | 'comments' | 'timeline' | 'reviews';

/**
 * PR Detail Screen - Shows detailed view of a pull request
 */
export function PRDetailScreen({ width = 80, height = 20 }: PRDetailScreenProps): React.ReactElement {
  const selectedPRNumber = useSelectedPR();
  const pullRequests = usePullRequests();
  const status = useStatus();
  const setView = useAppStore((s) => s.setView);
  const selectPR = useAppStore((s) => s.selectPR);
  const setSelectedFileIndex = useAppStore((s) => s.selectedFileIndex);

  const [activeTab, setActiveTab] = useState<DetailTab>('files');
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);

  // Find the selected PR
  const selectedPR = React.useMemo(
    () => pullRequests.find((pr) => pr.number === selectedPRNumber),
    [pullRequests, selectedPRNumber]
  );

  // Handle keyboard navigation
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      // Go back to list view
      setView('list');
      return;
    }

    // Tab navigation
    if (input === '1') setActiveTab('files');
    else if (input === '2') setActiveTab('comments');
    else if (input === '3') setActiveTab('timeline');
    else if (input === '4') setActiveTab('reviews');

    // Tab cycling with Tab key
    if (key.tab) {
      const tabs: DetailTab[] = ['files', 'comments', 'timeline', 'reviews'];
      const currentIndex = tabs.indexOf(activeTab);
      const nextIndex = (currentIndex + 1) % tabs.length;
      setActiveTab(tabs[nextIndex]);
    }
  });

  const handleFileSelect = useCallback((index: number) => {
    setSelectedFileIdx(index);
    setView('files');
  }, [setView]);

  // Loading state
  if (status === 'loading') {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <Spinner label="Loading PR details..." />
      </Box>
    );
  }

  // No PR selected
  if (!selectedPRNumber || !selectedPR) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <EmptyState
          type="empty"
          title="No PR Selected"
          message="Select a pull request from the list"
        />
      </Box>
    );
  }

  const tabs = [
    { id: 'files', label: 'Files', shortcut: '1' },
    { id: 'comments', label: 'Comments', shortcut: '2' },
    { id: 'timeline', label: 'Timeline', shortcut: '3' },
    { id: 'reviews', label: 'Reviews', shortcut: '4' },
  ];

  // Calculate content height (subtract header and tabs)
  const contentHeight = height - 6;

  return (
    <Box flexDirection="column" width={width}>
      {/* PR Header */}
      <Box paddingX={1} marginBottom={1} flexDirection="column">
        <Box>
          <Text bold color="blue">
            #{selectedPR.number}
          </Text>
          <Text> </Text>
          <Text bold>{selectedPR.title}</Text>
        </Box>
        <Box>
          <Text color="gray">
            by @{selectedPR.author.login} • {formatBranchInfo(selectedPR)}
          </Text>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as DetailTab)}
      />

      {/* Tab Content */}
      <Box flexDirection="column" height={contentHeight} paddingTop={1}>
        {activeTab === 'files' && (
          <FilesTabContent
            pr={selectedPR}
            selectedIndex={selectedFileIdx}
            onFileSelect={handleFileSelect}
            height={contentHeight}
          />
        )}
        {activeTab === 'comments' && (
          <CommentsTabContent pr={selectedPR} height={contentHeight} />
        )}
        {activeTab === 'timeline' && (
          <TimelineTabContent pr={selectedPR} height={contentHeight} />
        )}
        {activeTab === 'reviews' && (
          <ReviewsTabContent pr={selectedPR} height={contentHeight} />
        )}
      </Box>
    </Box>
  );
}

// Tab content components
interface TabContentProps {
  pr: PullRequest;
  height: number;
}

function FilesTabContent({
  pr,
  selectedIndex,
  onFileSelect,
  height,
}: TabContentProps & { selectedIndex: number; onFileSelect: (index: number) => void }): React.ReactElement {
  const files = pr.files ?? [];

  if (files.length === 0) {
    return (
      <EmptyState
        type="empty"
        title="No Files"
        message="This PR has no changed files"
      />
    );
  }

  return (
    <FileTree
      files={files.map((f) => ({
        path: f.path,
        status: mapFileStatus(f.status),
        additions: f.additions,
        deletions: f.deletions,
      }))}
      selectedIndex={selectedIndex}
      onSelect={onFileSelect}
      showStats={true}
    />
  );
}

function CommentsTabContent({ pr, height }: TabContentProps): React.ReactElement {
  const comments = pr.comments ?? [];

  if (comments.length === 0) {
    return (
      <EmptyState
        type="empty"
        title="No Comments"
        message="No comments on this PR yet"
      />
    );
  }

  return (
    <CommentsPanel
      comments={comments.map((c) => ({
        id: String(c.id),
        author: c.author.login,
        body: c.body,
        createdAt: formatRelativeTime(c.createdAt),
        isResolved: c.isResolved,
      }))}
      height={height}
    />
  );
}

function TimelineTabContent({ pr, height }: TabContentProps): React.ReactElement {
  const events = pr.timeline ?? [];

  if (events.length === 0) {
    return (
      <EmptyState
        type="empty"
        title="No Events"
        message="No timeline events for this PR"
      />
    );
  }

  return (
    <Timeline
      events={events.map((e) => ({
        id: String(e.id),
        type: mapEventType(e.type),
        actor: e.actor.login,
        timestamp: formatRelativeTime(e.createdAt),
        message: e.message,
      }))}
    />
  );
}

function ReviewsTabContent({ pr, height }: TabContentProps): React.ReactElement {
  const reviews = pr.reviews ?? [];

  if (reviews.length === 0) {
    return (
      <EmptyState
        type="empty"
        title="No Reviews"
        message="No reviews on this PR yet"
      />
    );
  }

  return (
    <ReviewPanel
      reviews={reviews.map((r) => ({
        id: String(r.id),
        author: r.author.login,
        state: mapReviewState(r.state),
        body: r.body,
        submittedAt: formatRelativeTime(r.submittedAt),
      }))}
      height={height}
    />
  );
}

// Helper functions
function formatBranchInfo(pr: PullRequest): string {
  return `${pr.headRef} → ${pr.baseRef}`;
}

function mapFileStatus(status: string): 'added' | 'modified' | 'deleted' | 'renamed' {
  switch (status.toLowerCase()) {
    case 'added':
      return 'added';
    case 'deleted':
    case 'removed':
      return 'deleted';
    case 'renamed':
      return 'renamed';
    default:
      return 'modified';
  }
}

function mapEventType(
  type: string
): 'commit' | 'comment' | 'review' | 'merge' | 'close' | 'reopen' | 'assign' | 'label' {
  switch (type.toLowerCase()) {
    case 'commit':
    case 'pushevent':
      return 'commit';
    case 'comment':
    case 'issuecomment':
      return 'comment';
    case 'review':
    case 'pullrequestreview':
      return 'review';
    case 'merge':
    case 'merged':
      return 'merge';
    case 'close':
    case 'closed':
      return 'close';
    case 'reopen':
    case 'reopened':
      return 'reopen';
    case 'assign':
    case 'assigned':
      return 'assign';
    case 'label':
    case 'labeled':
      return 'label';
    default:
      return 'comment';
  }
}

function mapReviewState(state: string): 'approved' | 'changes_requested' | 'commented' | 'pending' {
  switch (state.toLowerCase()) {
    case 'approved':
      return 'approved';
    case 'changes_requested':
    case 'request_changes':
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

export default PRDetailScreen;
