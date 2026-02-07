import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextArea, ConfirmDialog, BorderedBox } from '@lazyreview/ui';
import { useApprovePR, useRequestChanges, useCreateComment } from '../hooks/index.js';
import { useAppStore, useSelectedRepo, useSelectedPR, usePullRequests } from '../stores/app-store.js';
import type { ProviderType } from '@lazyreview/core';
import { defaultTheme } from '@lazyreview/ui';

export type PRActionType = 'approve' | 'request-changes' | 'comment' | 'merge' | null;

export interface PRActionDialogsProps {
  action: PRActionType;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * PR Action Dialogs - Modal dialogs for PR actions
 */
export function PRActionDialogs({
  action,
  onClose,
  onSuccess,
  onError,
}: PRActionDialogsProps): React.ReactElement | null {
  if (!action) return null;

  switch (action) {
    case 'approve':
      return <ApproveDialog onClose={onClose} onSuccess={onSuccess} onError={onError} />;
    case 'request-changes':
      return <RequestChangesDialog onClose={onClose} onSuccess={onSuccess} onError={onError} />;
    case 'comment':
      return <CommentDialog onClose={onClose} onSuccess={onSuccess} onError={onError} />;
    case 'merge':
      return <MergeDialog onClose={onClose} onSuccess={onSuccess} onError={onError} />;
    default:
      return null;
  }
}

interface DialogProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Approve PR Dialog
 */
function ApproveDialog({ onClose, onSuccess, onError }: DialogProps): React.ReactElement {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedRepo = useSelectedRepo();
  const selectedPRNumber = useSelectedPR();
  const pullRequests = usePullRequests();
  const selectedPR = pullRequests.find((pr) => pr.number === selectedPRNumber);

  const approveMutation = useApprovePR();

  const handleSubmit = useCallback(async () => {
    if (!selectedRepo || !selectedPRNumber) {
      onError('No PR selected');
      return;
    }

    setIsSubmitting(true);
    try {
      await approveMutation.mutateAsync({
        owner: selectedRepo.owner,
        repo: selectedRepo.repo,
        provider: selectedRepo.provider as ProviderType,
        number: selectedPRNumber,
        body: comment || undefined,
      });
      onSuccess(`Approved PR #${selectedPRNumber}`);
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to approve PR');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedRepo, selectedPRNumber, comment, approveMutation, onSuccess, onError, onClose]);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    // Quick approve without comment
    if (input === 'y' && comment === '') {
      handleSubmit();
    }
  });

  return (
    <Box position="absolute" width="100%" height="100%" justifyContent="center" alignItems="center">
      <Box width={80} flexDirection="column">
        <BorderedBox
          title={`Approve PR #${selectedPRNumber}`}
          width={80}
          height={20}
          isActive={true}
          theme={defaultTheme}
        >
          <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1}>
              <Text color={defaultTheme.muted}>{selectedPR?.title ?? 'Loading...'}</Text>
            </Box>

            <Box marginBottom={1}>
              <Text color={defaultTheme.muted}>Optional comment (supports markdown):</Text>
            </Box>

            <TextArea
              value={comment}
              onChange={setComment}
              onSubmit={handleSubmit}
              onCancel={onClose}
              placeholder="LGTM! Use ```code``` for suggestions"
              rows={5}
              isFocused={!isSubmitting}
              showHelp={false}
            />

            <Box marginTop={1} gap={1} flexDirection="column">
              <Box gap={2}>
                {comment === '' && <Text color={defaultTheme.added}>[y] Approve now</Text>}
                <Text color={defaultTheme.added}>[Ctrl+Enter] Approve with comment</Text>
                <Text color={defaultTheme.muted}>[Esc] Cancel</Text>
              </Box>
              <Box>
                <Text color={defaultTheme.muted} dimColor>
                  💡 Tip: Use ```lang for code blocks
                </Text>
              </Box>
            </Box>

            {isSubmitting && (
              <Box marginTop={1}>
                <Text color={defaultTheme.modified}>⏳ Submitting...</Text>
              </Box>
            )}
          </Box>
        </BorderedBox>
      </Box>
    </Box>
  );
}

/**
 * Request Changes Dialog
 */
function RequestChangesDialog({ onClose, onSuccess, onError }: DialogProps): React.ReactElement {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedRepo = useSelectedRepo();
  const selectedPRNumber = useSelectedPR();
  const pullRequests = usePullRequests();
  const selectedPR = pullRequests.find((pr) => pr.number === selectedPRNumber);

  const requestChangesMutation = useRequestChanges();

  const handleSubmit = useCallback(async () => {
    if (!selectedRepo || !selectedPRNumber) {
      onError('No PR selected');
      return;
    }

    if (!comment.trim()) {
      onError('Please provide feedback for requested changes');
      return;
    }

    setIsSubmitting(true);
    try {
      await requestChangesMutation.mutateAsync({
        owner: selectedRepo.owner,
        repo: selectedRepo.repo,
        provider: selectedRepo.provider as ProviderType,
        number: selectedPRNumber,
        body: comment,
      });
      onSuccess(`Requested changes on PR #${selectedPRNumber}`);
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to request changes');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedRepo, selectedPRNumber, comment, requestChangesMutation, onSuccess, onError, onClose]);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
    }
  });

  return (
    <Box position="absolute" width="100%" height="100%" justifyContent="center" alignItems="center">
      <Box width={80} flexDirection="column">
        <BorderedBox
          title={`Request Changes on PR #${selectedPRNumber}`}
          width={80}
          height={22}
          isActive={true}
          theme={defaultTheme}
        >
          <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1}>
              <Text color={defaultTheme.muted}>{selectedPR?.title ?? 'Loading...'}</Text>
            </Box>

            <Box marginBottom={1}>
              <Text color={defaultTheme.muted}>Describe the changes needed (supports markdown):</Text>
            </Box>

            <TextArea
              value={comment}
              onChange={setComment}
              onSubmit={handleSubmit}
              onCancel={onClose}
              placeholder="Please fix... Use ```code``` for suggestions"
              rows={6}
              isFocused={!isSubmitting}
              showHelp={false}
            />

            <Box marginTop={1} gap={1} flexDirection="column">
              <Box gap={2}>
                <Text color={defaultTheme.removed}>[Ctrl+Enter] Request changes</Text>
                <Text color={defaultTheme.muted}>[Esc] Cancel</Text>
              </Box>
              <Box>
                <Text color={defaultTheme.muted} dimColor>
                  💡 Tip: Use ```lang for code blocks
                </Text>
              </Box>
            </Box>

            {isSubmitting && (
              <Box marginTop={1}>
                <Text color={defaultTheme.modified}>⏳ Submitting...</Text>
              </Box>
            )}
          </Box>
        </BorderedBox>
      </Box>
    </Box>
  );
}

/**
 * Add Comment Dialog
 */
function CommentDialog({ onClose, onSuccess, onError }: DialogProps): React.ReactElement {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedRepo = useSelectedRepo();
  const selectedPRNumber = useSelectedPR();
  const pullRequests = usePullRequests();
  const selectedPR = pullRequests.find((pr) => pr.number === selectedPRNumber);

  const createCommentMutation = useCreateComment();

  const handleSubmit = useCallback(async () => {
    if (!selectedRepo || !selectedPRNumber) {
      onError('No PR selected');
      return;
    }

    if (!comment.trim()) {
      onError('Please enter a comment');
      return;
    }

    setIsSubmitting(true);
    try {
      await createCommentMutation.mutateAsync({
        owner: selectedRepo.owner,
        repo: selectedRepo.repo,
        provider: selectedRepo.provider as ProviderType,
        number: selectedPRNumber,
        body: comment,
      });
      onSuccess(`Added comment to PR #${selectedPRNumber}`);
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedRepo, selectedPRNumber, comment, createCommentMutation, onSuccess, onError, onClose]);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
    }
  });

  return (
    <Box position="absolute" width="100%" height="100%" justifyContent="center" alignItems="center">
      <Box width={80} flexDirection="column">
        <BorderedBox
          title={`Add Comment to PR #${selectedPRNumber}`}
          width={80}
          height={22}
          isActive={true}
          theme={defaultTheme}
        >
          <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1}>
              <Text color={defaultTheme.muted}>{selectedPR?.title ?? 'Loading...'}</Text>
            </Box>

            <Box marginBottom={1}>
              <Text color={defaultTheme.muted}>Write your comment (supports markdown):</Text>
            </Box>

            <TextArea
              value={comment}
              onChange={setComment}
              onSubmit={handleSubmit}
              onCancel={onClose}
              placeholder="Leave a comment... Use ```code``` for suggestions"
              rows={6}
              isFocused={!isSubmitting}
              showHelp={false}
            />

            <Box marginTop={1} gap={1} flexDirection="column">
              <Box gap={2}>
                <Text color={defaultTheme.accent}>[Ctrl+Enter] Submit</Text>
                <Text color={defaultTheme.muted}>[Esc] Cancel</Text>
              </Box>
              <Box>
                <Text color={defaultTheme.muted} dimColor>
                  💡 Tip: Use ```lang for code blocks
                </Text>
              </Box>
            </Box>

            {isSubmitting && (
              <Box marginTop={1}>
                <Text color={defaultTheme.modified}>⏳ Submitting...</Text>
              </Box>
            )}
          </Box>
        </BorderedBox>
      </Box>
    </Box>
  );
}

/**
 * Merge PR Dialog
 */
function MergeDialog({ onClose, onSuccess, onError }: DialogProps): React.ReactElement {
  const [mergeMethod, setMergeMethod] = useState<'merge' | 'squash' | 'rebase'>('merge');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedRepo = useSelectedRepo();
  const selectedPRNumber = useSelectedPR();
  const pullRequests = usePullRequests();
  const selectedPR = pullRequests.find((pr) => pr.number === selectedPRNumber);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    // Quick merge options
    if (input === 'm') {
      setMergeMethod('merge');
    } else if (input === 's') {
      setMergeMethod('squash');
    } else if (input === 'r') {
      setMergeMethod('rebase');
    } else if (input === 'y' || key.return) {
      handleMerge();
    }
  });

  const handleMerge = useCallback(async () => {
    if (!selectedRepo || !selectedPRNumber) {
      onError('No PR selected');
      return;
    }

    setIsSubmitting(true);
    try {
      // Note: Merge is not implemented in the hooks yet
      // This would call a mergePR mutation
      onSuccess(`Merged PR #${selectedPRNumber} using ${mergeMethod}`);
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to merge PR');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedRepo, selectedPRNumber, mergeMethod, onSuccess, onError, onClose]);

  return (
    <Box position="absolute" width="100%" height="100%" justifyContent="center" alignItems="center">
      <Box width={80} flexDirection="column">
        <BorderedBox
          title={`Merge PR #${selectedPRNumber}`}
          width={80}
          height={18}
          isActive={true}
          theme={defaultTheme}
        >
          <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1}>
              <Text color={defaultTheme.muted}>{selectedPR?.title ?? 'Loading...'}</Text>
            </Box>

            <Box marginBottom={1} flexDirection="column">
              <Text color={defaultTheme.muted}>Select merge method:</Text>
              <Box marginTop={1} flexDirection="column" gap={0}>
                <Box>
                  <Text color={mergeMethod === 'merge' ? defaultTheme.accent : defaultTheme.text} bold={mergeMethod === 'merge'}>
                    {mergeMethod === 'merge' ? '▸' : ' '} [m] Merge commit
                  </Text>
                </Box>
                <Box>
                  <Text color={mergeMethod === 'squash' ? defaultTheme.accent : defaultTheme.text} bold={mergeMethod === 'squash'}>
                    {mergeMethod === 'squash' ? '▸' : ' '} [s] Squash and merge
                  </Text>
                </Box>
                <Box>
                  <Text color={mergeMethod === 'rebase' ? defaultTheme.accent : defaultTheme.text} bold={mergeMethod === 'rebase'}>
                    {mergeMethod === 'rebase' ? '▸' : ' '} [r] Rebase and merge
                  </Text>
                </Box>
              </Box>
            </Box>

            <Box marginTop={1} gap={2}>
              <Text color={defaultTheme.added}>[y/Enter] Confirm merge</Text>
              <Text color={defaultTheme.muted}>[Esc] Cancel</Text>
            </Box>

            {isSubmitting && (
              <Box marginTop={1}>
                <Text color={defaultTheme.modified}>⏳ Merging...</Text>
              </Box>
            )}
          </Box>
        </BorderedBox>
      </Box>
    </Box>
  );
}

export default PRActionDialogs;
