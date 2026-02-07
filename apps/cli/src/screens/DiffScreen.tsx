import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { DiffView, FileTree, Spinner, EmptyState, SplitPane } from '@lazyreview/ui';
import { useAppStore, useSelectedPR, usePullRequests, useStatus, useSelectedRepo } from '../stores/app-store.js';
import { useDiff, usePullRequestDiff } from '../hooks/index.js';
import type { PullRequest, ProviderType } from '@lazyreview/core';

export interface DiffScreenProps {
  width?: number;
  height?: number;
}

/**
 * Diff Screen - Shows file diff viewer with file tree sidebar
 */
export function DiffScreen({ width = 80, height = 20 }: DiffScreenProps): React.ReactElement {
  const selectedPRNumber = useSelectedPR();
  const pullRequests = usePullRequests();
  const selectedRepo = useSelectedRepo();
  const status = useStatus();
  const demoMode = useAppStore((s) => s.demoMode);
  const storeDiff = useAppStore((s) => s.currentDiff);
  const setCurrentDiff = useAppStore((s) => s.setCurrentDiff);
  const setView = useAppStore((s) => s.setView);
  const selectedFileIndex = useAppStore((s) => s.selectedFileIndex);

  const [showFileTree, setShowFileTree] = useState(true);
  const [focusedPane, setFocusedPane] = useState<'tree' | 'diff'>('diff');

  // Fetch real diff when not in demo mode
  const { data: realDiff, isLoading: isDiffLoading, isError: isDiffError, error: diffError } = usePullRequestDiff({
    owner: selectedRepo?.owner ?? '',
    repo: selectedRepo?.repo ?? '',
    provider: (selectedRepo?.provider ?? 'github') as ProviderType,
    number: selectedPRNumber ?? 0,
    enabled: !demoMode && !!selectedPRNumber && !!selectedRepo,
  });

  // Sync real diff to store
  React.useEffect(() => {
    if (!demoMode && realDiff) {
      setCurrentDiff(realDiff);
    }
  }, [realDiff, demoMode, setCurrentDiff]);

  const currentDiff = demoMode ? storeDiff : (realDiff ?? storeDiff);

  // Find the selected PR
  const selectedPR = React.useMemo(
    () => pullRequests.find((pr) => pr.number === selectedPRNumber),
    [pullRequests, selectedPRNumber]
  );

  const files = selectedPR?.files ?? [];
  const selectedFile = files[selectedFileIndex];

  // Use diff hook for navigation
  const {
    currentLine,
    selectedLines,
    navigateUp,
    navigateDown,
    navigateToNextHunk,
    navigateToPrevHunk,
    toggleLineSelection,
  } = useDiff({
    diff: currentDiff,
    onLineChange: (line) => {
      // Handle line change
    },
  });

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      setView('detail');
      return;
    }

    // Toggle file tree
    if (input === 'b' || input === '\\') {
      setShowFileTree(!showFileTree);
      return;
    }

    // Switch focus between panes
    if (key.tab) {
      if (showFileTree) {
        setFocusedPane(focusedPane === 'tree' ? 'diff' : 'tree');
      }
      return;
    }

    // Navigation (only when diff is focused)
    if (focusedPane === 'diff') {
      if (key.upArrow || input === 'k') {
        navigateUp();
      } else if (key.downArrow || input === 'j') {
        navigateDown();
      } else if (input === 'n' || input === ']') {
        navigateToNextHunk();
      } else if (input === 'N' || input === '[') {
        navigateToPrevHunk();
      } else if (input === ' ') {
        toggleLineSelection(currentLine);
      }
    }
  });

  // Loading state
  if (status === 'loading' || isDiffLoading) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <Spinner label="Loading diff..." />
      </Box>
    );
  }

  // Error state
  if (isDiffError && !demoMode) {
    const errorMessage = diffError instanceof Error ? diffError.message : 'Failed to load diff';
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <EmptyState
          type="error"
          title="Error Loading Diff"
          message={errorMessage}
        />
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
          message="Select a pull request to view its diff"
        />
      </Box>
    );
  }

  // No files
  if (files.length === 0) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <EmptyState
          type="empty"
          title="No Changed Files"
          message="This PR has no file changes"
        />
      </Box>
    );
  }

  // Calculate dimensions
  const treeWidth = showFileTree ? Math.min(30, Math.floor(width * 0.3)) : 0;
  const diffWidth = width - treeWidth - (showFileTree ? 1 : 0);

  return (
    <Box flexDirection="column" width={width}>
      {/* Header */}
      <Box paddingX={1} marginBottom={1}>
        <Text bold>
          {selectedFile?.path ?? 'Select a file'}
        </Text>
        {selectedFile && (
          <Text color="gray">
            {' '}
            (+{selectedFile.additions} -{selectedFile.deletions})
          </Text>
        )}
      </Box>

      {/* Main content */}
      <Box flexDirection="row" height={height - 2}>
        {/* File tree sidebar */}
        {showFileTree && (
          <>
            <Box width={treeWidth} borderStyle="single" borderRight>
              <FileTree
                files={files.map((f) => ({
                  path: f.path,
                  status: mapFileStatus(f.status),
                  additions: f.additions,
                  deletions: f.deletions,
                }))}
                selectedIndex={selectedFileIndex}
                onSelect={(index) => {
                  useAppStore.getState().setSelectedListIndex(index);
                }}
                compact={true}
                showStats={false}
                focused={focusedPane === 'tree'}
              />
            </Box>
            <Box width={1} />
          </>
        )}

        {/* Diff viewer */}
        <Box width={diffWidth} flexDirection="column">
          {currentDiff ? (
            <DiffView
              diff={currentDiff}
              width={diffWidth}
              height={height - 3}
              currentLine={currentLine}
              selectedLines={selectedLines}
              showLineNumbers={true}
              syntaxHighlight={true}
            />
          ) : (
            <EmptyState
              type="empty"
              title="No Diff Available"
              message="Select a file to view its changes"
            />
          )}
        </Box>
      </Box>

      {/* Status bar */}
      <Box paddingX={1} marginTop={1}>
        <Text color="gray">
          j/k:scroll n/N:hunks {showFileTree ? 'b:hide tree' : 'b:show tree'} Tab:switch pane q:back
        </Text>
      </Box>
    </Box>
  );
}

// Helper functions
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

export default DiffScreen;
