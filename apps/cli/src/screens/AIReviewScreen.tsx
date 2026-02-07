import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  Spinner,
  EmptyState,
  ProgressBar,
  Card,
  Section,
  StatusBadge,
  Markdown,
} from '@lazyreview/ui';
import { useAppStore, useSelectedPR, usePullRequests, useStatus } from '../stores/app-store.js';
import { useAIReview } from '../hooks/index.js';
import type { PullRequest } from '@lazyreview/core';

export interface AIReviewScreenProps {
  width?: number;
  height?: number;
}

/**
 * AI Review Screen - Shows AI-powered code review results
 */
export function AIReviewScreen({ width = 80, height = 20 }: AIReviewScreenProps): React.ReactElement {
  const selectedPRNumber = useSelectedPR();
  const pullRequests = usePullRequests();
  const appStatus = useStatus();
  const setView = useAppStore((s) => s.setView);
  const currentDiff = useAppStore((s) => s.currentDiff);

  const [selectedIssueIndex, setSelectedIssueIndex] = useState(0);

  // Find the selected PR
  const selectedPR = React.useMemo(
    () => pullRequests.find((pr) => pr.number === selectedPRNumber),
    [pullRequests, selectedPRNumber]
  );

  // Use AI review hook
  const {
    review,
    isLoading,
    error,
    progress,
    startReview,
    cancelReview,
    clearReview,
  } = useAIReview();

  // Auto-start review when screen loads with diff
  useEffect(() => {
    if (currentDiff && !review && !isLoading) {
      startReview(currentDiff);
    }
  }, [currentDiff, review, isLoading, startReview]);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      if (isLoading) {
        cancelReview();
      } else {
        setView('detail');
      }
      return;
    }

    // Navigate issues
    if (review && review.issues.length > 0) {
      if (key.upArrow || input === 'k') {
        setSelectedIssueIndex(Math.max(0, selectedIssueIndex - 1));
      } else if (key.downArrow || input === 'j') {
        setSelectedIssueIndex(Math.min(review.issues.length - 1, selectedIssueIndex + 1));
      }
    }

    // Retry review
    if (input === 'r' && !isLoading && currentDiff) {
      clearReview();
      startReview(currentDiff);
    }
  });

  // Loading state
  if (appStatus === 'loading') {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <Spinner label="Loading..." />
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
          message="Select a pull request to get AI review"
        />
      </Box>
    );
  }

  // No diff available
  if (!currentDiff) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <EmptyState
          type="empty"
          title="No Diff Available"
          message="View a file diff first to get AI review"
        />
      </Box>
    );
  }

  // AI Review loading
  if (isLoading) {
    return (
      <Box flexDirection="column" width={width} paddingX={1}>
        <Box marginBottom={1}>
          <Text bold>AI Review</Text>
          <Text color="gray"> - Analyzing code...</Text>
        </Box>

        <Box flexDirection="column" alignItems="center" marginTop={2}>
          <Spinner label="Analyzing code changes..." />
          <Box marginTop={1} width={40}>
            <ProgressBar progress={progress} showPercentage={true} />
          </Box>
          <Text color="gray" marginTop={1}>
            Press Esc to cancel
          </Text>
        </Box>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box flexDirection="column" width={width} paddingX={1}>
        <Box marginBottom={1}>
          <Text bold>AI Review</Text>
          <Text color="red"> - Error</Text>
        </Box>

        <EmptyState
          type="error"
          title="Review Failed"
          message={error}
        />

        <Box marginTop={2}>
          <Text color="gray">r:retry  q:back</Text>
        </Box>
      </Box>
    );
  }

  // Review results
  if (review) {
    const selectedIssue = review.issues[selectedIssueIndex];

    return (
      <Box flexDirection="column" width={width} paddingX={1}>
        {/* Header */}
        <Box marginBottom={1}>
          <Text bold>AI Review</Text>
          <Text color="gray"> - {review.issues.length} issues found</Text>
        </Box>

        {/* Summary */}
        <Box marginBottom={1} borderStyle="single" paddingX={1}>
          <Box marginRight={2}>
            <Text color="red">Critical: {review.summary.critical}</Text>
          </Box>
          <Box marginRight={2}>
            <Text color="yellow">Warning: {review.summary.warnings}</Text>
          </Box>
          <Box marginRight={2}>
            <Text color="blue">Suggestion: {review.summary.suggestions}</Text>
          </Box>
          <Box>
            <Text color="green">Praise: {review.summary.praise}</Text>
          </Box>
        </Box>

        {/* Issues list */}
        <Box flexDirection="row" height={height - 8}>
          {/* Issue list */}
          <Box width={Math.floor(width * 0.4)} borderStyle="single" paddingX={1}>
            <Box flexDirection="column">
              {review.issues.map((issue, idx) => (
                <Box key={idx}>
                  <Text color={idx === selectedIssueIndex ? 'blue' : undefined}>
                    {idx === selectedIssueIndex ? '▸ ' : '  '}
                    {getSeverityIcon(issue.severity)} {truncate(issue.title, 30)}
                  </Text>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Issue detail */}
          <Box width={Math.floor(width * 0.6)} paddingX={1}>
            {selectedIssue && (
              <Box flexDirection="column">
                <Box marginBottom={1}>
                  <Text bold>{selectedIssue.title}</Text>
                </Box>
                <Box marginBottom={1}>
                  <StatusBadge status={selectedIssue.severity} />
                  {selectedIssue.file && (
                    <Text color="gray"> in {selectedIssue.file}</Text>
                  )}
                  {selectedIssue.line && (
                    <Text color="gray">:{selectedIssue.line}</Text>
                  )}
                </Box>
                <Box flexDirection="column">
                  <Markdown content={selectedIssue.description} />
                </Box>
                {selectedIssue.suggestion && (
                  <Box marginTop={1} flexDirection="column">
                    <Text bold color="green">Suggestion:</Text>
                    <Markdown content={selectedIssue.suggestion} />
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>

        {/* Help */}
        <Box marginTop={1}>
          <Text color="gray">j/k:navigate  r:re-run  q:back</Text>
        </Box>
      </Box>
    );
  }

  // No review yet
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
      <EmptyState
        type="empty"
        title="No Review Available"
        message="Press 'r' to start AI review"
      />
      <Box marginTop={2}>
        <Text color="gray">r:start review  q:back</Text>
      </Box>
    </Box>
  );
}

// Helper functions
function getSeverityIcon(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical':
    case 'error':
      return '✗';
    case 'warning':
      return '⚠';
    case 'suggestion':
    case 'info':
      return '💡';
    case 'praise':
      return '✓';
    default:
      return '•';
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export default AIReviewScreen;
