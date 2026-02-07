import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  PRDetail,
  Tabs,
  FileTree,
  DiffView,
  CommentsPanel,
  ReviewPanel,
  Timeline,
  Spinner,
  EmptyState,
  InputBox,
  ConfirmDialog,
  SplitPane,
  type FileChange,
} from '@lazyreview/ui';
import { formatRelativeTime, type PullRequest } from '@lazyreview/core';
import { useAppStore, useSelectedPR, usePullRequests, useStatus } from '../stores/app-store.js';
import { usePRActions, useCommentOperations, useGitStatus, useGitCheckout, isGitRepo, usePRDiff } from '../hooks/index.js';
import { parseMultiFileDiff, findFileDiff } from '../utils/diff-parser.js';

export interface PRDetailScreenProps {
  width?: number;
  height?: number;
}

type DetailTab = 'files' | 'comments' | 'timeline' | 'reviews';

/**
 * PR Detail Screen - Shows detailed view of a pull request
 */
type DialogType = 'approve' | 'request-changes' | 'comment' | 'reply' | 'edit' | 'delete' | null;

export function PRDetailScreen({ width = 80, height = 20 }: PRDetailScreenProps): React.ReactElement {
  const selectedPRNumber = useSelectedPR();
  const pullRequests = usePullRequests();
  const status = useStatus();
  const setView = useAppStore((s) => s.setView);
  const selectPR = useAppStore((s) => s.selectPR);
  const setSelectedFileIndex = useAppStore((s) => s.selectedFileIndex);
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const demoMode = useAppStore((s) => s.demoMode);

  const [activeTab, setActiveTab] = useState<DetailTab>('files');
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [selectedCommentIdx, setSelectedCommentIdx] = useState(0);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [inputValue, setInputValue] = useState('');
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [isInGitRepo, setIsInGitRepo] = useState(false);

  // Check if we're in a git repo on mount
  React.useEffect(() => {
    isGitRepo().then(setIsInGitRepo);
  }, []);

  // Get git status
  const gitStatus = useGitStatus();
  const gitCheckout = useGitCheckout();

  // Find the selected PR
  const selectedPR = React.useMemo(
    () => pullRequests.find((pr) => pr.number === selectedPRNumber),
    [pullRequests, selectedPRNumber]
  );

  // Initialize PR actions hook
  const prActions = usePRActions({
    providerType: (selectedRepo?.provider as any) ?? 'github',
    token: process.env.GITHUB_TOKEN ?? '',
    baseUrl: 'https://api.github.com',
    owner: selectedRepo?.owner ?? '',
    repo: selectedRepo?.repo ?? '',
  });

  // Initialize comment operations hook
  const commentOps = useCommentOperations({
    providerType: (selectedRepo?.provider as any) ?? 'github',
    token: process.env.GITHUB_TOKEN ?? '',
    baseUrl: 'https://api.github.com',
    owner: selectedRepo?.owner ?? '',
    repo: selectedRepo?.repo ?? '',
  });

  // Handle review actions
  const handleApprove = useCallback(async () => {
    if (!selectedPR || demoMode) return;

    try {
      await prActions.approve(selectedPR, inputValue || undefined);
      setActiveDialog(null);
      setInputValue('');
    } catch (error) {
      // Error is already handled by the hook
    }
  }, [selectedPR, prActions, inputValue, demoMode]);

  const handleRequestChanges = useCallback(async () => {
    if (!selectedPR || demoMode) return;

    try {
      await prActions.requestChanges(selectedPR, inputValue);
      setActiveDialog(null);
      setInputValue('');
    } catch (error) {
      // Error is already handled by the hook
    }
  }, [selectedPR, prActions, inputValue, demoMode]);

  const handleComment = useCallback(async () => {
    if (!selectedPR || demoMode) return;

    try {
      await prActions.comment(selectedPR, inputValue);
      setActiveDialog(null);
      setInputValue('');
    } catch (error) {
      // Error is already handled by the hook
    }
  }, [selectedPR, prActions, inputValue, demoMode]);

  const handleReply = useCallback(async () => {
    if (!selectedPR || !selectedCommentId || demoMode) return;

    try {
      await commentOps.replyToComment(selectedPR, selectedCommentId, inputValue);
      setActiveDialog(null);
      setInputValue('');
      setSelectedCommentId(null);
    } catch (error) {
      // Error is already handled by the hook
    }
  }, [selectedPR, selectedCommentId, commentOps, inputValue, demoMode]);

  const handleEdit = useCallback(async () => {
    if (!selectedPR || !selectedCommentId || demoMode) return;

    try {
      await commentOps.editComment(selectedPR, selectedCommentId, inputValue);
      setActiveDialog(null);
      setInputValue('');
      setSelectedCommentId(null);
    } catch (error) {
      // Error is already handled by the hook
    }
  }, [selectedPR, selectedCommentId, commentOps, inputValue, demoMode]);

  const handleDelete = useCallback(async () => {
    if (!selectedPR || !selectedCommentId || demoMode) return;

    try {
      await commentOps.deleteComment(selectedPR, selectedCommentId);
      setActiveDialog(null);
      setSelectedCommentId(null);
    } catch (error) {
      // Error is already handled by the hook
    }
  }, [selectedPR, selectedCommentId, commentOps, demoMode]);

  const handleResolveToggle = useCallback(async () => {
    if (!selectedPR || !selectedCommentId || demoMode) return;

    try {
      const comments = selectedPR.comments ?? [];
      const comment = comments.find(c => String(c.id) === selectedCommentId);

      if (comment?.isResolved) {
        await commentOps.unresolveThread(selectedPR, selectedCommentId);
      } else {
        await commentOps.resolveThread(selectedPR, selectedCommentId);
      }
    } catch (error) {
      // Error is already handled by the hook
    }
  }, [selectedPR, selectedCommentId, commentOps, demoMode]);

  const handleCheckoutPR = useCallback(async () => {
    if (!selectedPR || !isInGitRepo || demoMode) return;

    // Check for uncommitted changes
    if (gitStatus.status?.isDirty) {
      // TODO: Show warning dialog
      return;
    }

    try {
      // Checkout the PR branch
      await gitCheckout.checkout(selectedPR.headRef);
      gitStatus.refresh();
    } catch (error) {
      // Error is already handled by the hook
    }
  }, [selectedPR, isInGitRepo, gitStatus, gitCheckout, demoMode]);

  // Handle keyboard navigation
  useInput((input, key) => {
    // Dialog handling - takes priority
    if (activeDialog === 'delete') {
      // Handle delete confirmation
      if (input === 'y') {
        handleDelete();
      } else if (input === 'n' || key.escape) {
        setActiveDialog(null);
        setSelectedCommentId(null);
      }
      return;
    }

    if (activeDialog) {
      return; // Let InputBox handle the input
    }

    if (key.escape || input === 'q') {
      // Go back to list view
      setView('list');
      return;
    }

    // Review actions (only when not in demo mode)
    if (!demoMode) {
      if (input === 'a') {
        setActiveDialog('approve');
        return;
      }
      if (input === 'r') {
        setActiveDialog('request-changes');
        return;
      }
      if (input === 'C') {
        setActiveDialog('comment');
        return;
      }

      // Comment operations (only in comments tab)
      if (activeTab === 'comments') {
        const comments = selectedPR?.comments ?? [];
        if (comments.length > 0) {
          const selectedComment = comments[selectedCommentIdx];

          if (input === 'y') {
            // Reply to comment
            setSelectedCommentId(String(selectedComment?.id));
            setActiveDialog('reply');
            return;
          }
          if (input === 'e') {
            // Edit own comment (check if user owns it)
            setSelectedCommentId(String(selectedComment?.id));
            setInputValue(selectedComment?.body ?? '');
            setActiveDialog('edit');
            return;
          }
          if (input === 'x') {
            // Delete own comment (with confirmation)
            setSelectedCommentId(String(selectedComment?.id));
            setActiveDialog('delete');
            return;
          }
          if (input === 'z') {
            // Resolve/unresolve thread
            setSelectedCommentId(String(selectedComment?.id));
            handleResolveToggle();
            return;
          }
        }

        // Comment navigation (j/k)
        if (key.downArrow || input === 'j') {
          setSelectedCommentIdx((prev) => Math.min(prev + 1, comments.length - 1));
          return;
        }
        if (key.upArrow || input === 'k') {
          setSelectedCommentIdx((prev) => Math.max(prev - 1, 0));
          return;
        }
      }
    }

    // Tab navigation
    if (input === '1') setActiveTab('files');
    else if (input === '2') setActiveTab('comments');
    else if (input === '3') setActiveTab('timeline');
    else if (input === '4') setActiveTab('reviews');

    // Toggle timeline sidebar
    if (input === 't') {
      setShowTimeline(!showTimeline);
      return;
    }

    // Checkout PR branch (o = checkout)
    if (input === 'o' && isInGitRepo && !demoMode) {
      handleCheckoutPR();
      return;
    }

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
  const timelineWidth = showTimeline ? Math.floor(width * 0.3) : 0;
  const mainContentWidth = width - timelineWidth - (showTimeline ? 1 : 0);

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
          {isInGitRepo && gitStatus.status && (
            <>
              <Text color="gray"> • </Text>
              <Text color="cyan">
                On branch: {gitStatus.status.branch}
              </Text>
              {gitStatus.status.isDirty && (
                <Text color="yellow"> (uncommitted changes)</Text>
              )}
            </>
          )}
        </Box>
        {/* Action status */}
        {(prActions.actionStatus === 'loading' || gitCheckout.isLoading) && (
          <Box marginTop={1}>
            <Text color="yellow">
              {gitCheckout.isLoading ? 'Checking out branch...' : 'Processing...'}
            </Text>
          </Box>
        )}
        {prActions.actionStatus === 'success' && (
          <Box marginTop={1}>
            <Text color="green">Action completed successfully!</Text>
          </Box>
        )}
        {(prActions.actionStatus === 'error' && prActions.actionError) && (
          <Box marginTop={1}>
            <Text color="red">Error: {prActions.actionError}</Text>
          </Box>
        )}
        {gitCheckout.error && (
          <Box marginTop={1}>
            <Text color="red">Checkout failed: {gitCheckout.error.message}</Text>
          </Box>
        )}
      </Box>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as DetailTab)}
      />

      {/* Tab Content with optional Timeline sidebar */}
      <Box flexDirection="row" height={contentHeight} paddingTop={1}>
        {/* Main content area */}
        <Box flexDirection="column" width={mainContentWidth}>
          {activeTab === 'files' && (
            <FilesTabContent
              pr={selectedPR}
              selectedIndex={selectedFileIdx}
              onFileSelect={handleFileSelect}
              height={contentHeight}
              width={mainContentWidth}
            />
          )}
          {activeTab === 'comments' && (
            <CommentsTabContent
              pr={selectedPR}
              height={contentHeight}
              selectedIndex={selectedCommentIdx}
            />
          )}
          {activeTab === 'timeline' && (
            <TimelineTabContent pr={selectedPR} height={contentHeight} />
          )}
          {activeTab === 'reviews' && (
            <ReviewsTabContent pr={selectedPR} height={contentHeight} />
          )}
        </Box>

        {/* Timeline sidebar */}
        {showTimeline && (
          <>
            <Box width={1} borderStyle="single" borderLeft />
            <Box width={timelineWidth} flexDirection="column">
              <Box paddingX={1} borderBottom>
                <Text bold color="cyan">Timeline</Text>
              </Box>
              <TimelineTabContent pr={selectedPR} height={contentHeight - 1} />
            </Box>
          </>
        )}
      </Box>

      {/* Dialogs */}
      {activeDialog === 'approve' && (
        <Box
          position="absolute"
          left={Math.floor(width / 2) - 20}
          top={Math.floor(height / 2) - 5}
        >
          <InputBox
            label="Approve PR"
            placeholder="Optional approval message..."
            value={inputValue}
            multiline={true}
            onSubmit={handleApprove}
            onCancel={() => {
              setActiveDialog(null);
              setInputValue('');
            }}
            onChange={setInputValue}
          />
        </Box>
      )}

      {activeDialog === 'request-changes' && (
        <Box
          position="absolute"
          left={Math.floor(width / 2) - 20}
          top={Math.floor(height / 2) - 5}
        >
          <InputBox
            label="Request Changes"
            placeholder="Describe the changes needed..."
            value={inputValue}
            multiline={true}
            onSubmit={handleRequestChanges}
            onCancel={() => {
              setActiveDialog(null);
              setInputValue('');
            }}
            onChange={setInputValue}
          />
        </Box>
      )}

      {activeDialog === 'comment' && (
        <Box
          position="absolute"
          left={Math.floor(width / 2) - 20}
          top={Math.floor(height / 2) - 5}
        >
          <InputBox
            label="Add Comment"
            placeholder="Enter your comment..."
            value={inputValue}
            multiline={true}
            onSubmit={handleComment}
            onCancel={() => {
              setActiveDialog(null);
              setInputValue('');
            }}
            onChange={setInputValue}
          />
        </Box>
      )}

      {activeDialog === 'reply' && (
        <Box
          position="absolute"
          left={Math.floor(width / 2) - 20}
          top={Math.floor(height / 2) - 5}
        >
          <InputBox
            label="Reply to Comment"
            placeholder="Enter your reply..."
            value={inputValue}
            multiline={true}
            onSubmit={handleReply}
            onCancel={() => {
              setActiveDialog(null);
              setInputValue('');
              setSelectedCommentId(null);
            }}
            onChange={setInputValue}
          />
        </Box>
      )}

      {activeDialog === 'edit' && (
        <Box
          position="absolute"
          left={Math.floor(width / 2) - 20}
          top={Math.floor(height / 2) - 5}
        >
          <InputBox
            label="Edit Comment"
            placeholder="Update your comment..."
            value={inputValue}
            multiline={true}
            onSubmit={handleEdit}
            onCancel={() => {
              setActiveDialog(null);
              setInputValue('');
              setSelectedCommentId(null);
            }}
            onChange={setInputValue}
          />
        </Box>
      )}

      {activeDialog === 'delete' && (
        <Box
          position="absolute"
          left={Math.floor(width / 2) - 20}
          top={Math.floor(height / 2) - 5}
        >
          <ConfirmDialog
            title="Delete Comment"
            message="Are you sure you want to delete this comment? This cannot be undone."
            confirmLabel="Delete"
            cancelLabel="Cancel"
            confirmKey="y"
            cancelKey="n"
            destructive={true}
          />
        </Box>
      )}
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
  width = 80,
}: TabContentProps & { selectedIndex: number; onFileSelect: (index: number) => void; width?: number }): React.ReactElement {
  const files = pr.files ?? [];
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const demoMode = useAppStore((s) => s.demoMode);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [activePanel, setActivePanel] = useState<'tree' | 'diff'>('tree');

  // Theme colors
  const accentColor = '#7aa2f7';
  const borderColor = '#3b4261';
  const mutedColor = '#565f89';

  // Fetch full PR diff
  const { diff, isLoading } = usePRDiff({
    providerType: (selectedRepo?.provider as any) ?? 'github',
    token: process.env.GITHUB_TOKEN ?? '',
    baseUrl: 'https://api.github.com',
    owner: selectedRepo?.owner ?? '',
    repo: selectedRepo?.repo ?? '',
    prNumber: pr.number,
    enabled: !demoMode,
  });

  // Parse diff into individual file diffs
  const parsedDiffs = useMemo(() => {
    if (!diff) return [];
    return parseMultiFileDiff(diff);
  }, [diff]);

  // Get diff for selected file
  const selectedFileDiff = useMemo(() => {
    if (!selectedFile) return null;
    const fileDiff = findFileDiff(parsedDiffs, selectedFile.path);
    return fileDiff?.diff ?? null;
  }, [selectedFile, parsedDiffs]);

  // Handle file selection - FileTree passes (file, index)
  const handleFileSelect = useCallback((file: FileChange, _index: number) => {
    setSelectedFile(file);
    setActivePanel('diff');
  }, []);

  // Handle keyboard navigation between panels
  useInput((input, key) => {
    if (key.tab) {
      setActivePanel((prev) => prev === 'tree' ? 'diff' : 'tree');
    }
    if (input === 'h' && activePanel === 'diff') {
      setActivePanel('tree');
    }
    if (input === 'l' && activePanel === 'tree' && selectedFile) {
      setActivePanel('diff');
    }
  });

  if (files.length === 0) {
    return (
      <EmptyState
        type="empty"
        title="No Files"
        message="This PR has no changed files"
      />
    );
  }

  if (isLoading) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={height}>
        <Spinner label="Loading diff..." />
      </Box>
    );
  }

  const fileTreeData: FileChange[] = files.map((f) => ({
    path: f.path,
    status: mapFileStatus(f.status),
    additions: f.additions,
    deletions: f.deletions,
  }));

  // Calculate widths
  const treeWidth = Math.floor(width * 0.35);
  const diffWidth = width - treeWidth - 1;

  return (
    <Box flexDirection="row" width={width} height={height}>
      {/* File Tree Panel */}
      <Box
        width={treeWidth}
        height={height}
        flexDirection="column"
        borderStyle="round"
        borderColor={activePanel === 'tree' ? accentColor : borderColor}
      >
        <FileTree
          title="Files"
          files={fileTreeData}
          width={treeWidth - 2}
          height={height - 2}
          isActive={activePanel === 'tree'}
          onSelect={handleFileSelect}
        />
      </Box>

      {/* Diff Panel */}
      <Box
        width={diffWidth}
        height={height}
        flexDirection="column"
        borderStyle="round"
        borderColor={activePanel === 'diff' ? accentColor : borderColor}
        marginLeft={1}
      >
        {selectedFile && selectedFileDiff ? (
          <DiffView
            title={selectedFile.path}
            diff={selectedFileDiff}
            width={diffWidth - 2}
            height={height - 2}
            isActive={activePanel === 'diff'}
            syntaxHighlight={true}
          />
        ) : (
          <Box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            width={diffWidth - 2}
            height={height - 2}
          >
            <Text color={mutedColor}>Select a file to view diff</Text>
            <Text color={mutedColor}>←/h to focus files, Enter to select</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function CommentsTabContent({
  pr,
  height,
  selectedIndex = 0,
}: TabContentProps & { selectedIndex?: number }): React.ReactElement {
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
        createdAt: formatRelativeTime(c.createdAt, { addSuffix: true }),
        isResolved: c.isResolved,
      }))}
      selectedIndex={selectedIndex}
      height={height}
      width={80}
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
        timestamp: formatRelativeTime(e.createdAt, { addSuffix: true }),
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
        submittedAt: formatRelativeTime(r.submittedAt, { addSuffix: true }),
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

export default PRDetailScreen;
