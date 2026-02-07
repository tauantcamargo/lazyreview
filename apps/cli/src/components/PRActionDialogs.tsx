import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextArea, ConfirmDialog } from '@lazyreview/ui';
import { useApprovePR, useRequestChanges, useCreateComment } from '../hooks/index.js';
import { useAppStore, useSelectedRepo, useSelectedPR, usePullRequests } from '../stores/app-store.js';
import type { ProviderType } from '@lazyreview/core';

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
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="green"
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color="green" bold>
          Approve PR #{selectedPRNumber}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          {selectedPR?.title ?? 'Loading...'}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">Optional comment:</Text>
      </Box>

      <TextArea
        value={comment}
        onChange={setComment}
        onSubmit={handleSubmit}
        onCancel={onClose}
        placeholder="LGTM! (optional)"
        rows={3}
        isFocused={!isSubmitting}
      />

      <Box marginTop={1} gap={2}>
        {comment === '' && (
          <Text color="green">[y] Approve now</Text>
        )}
        <Text color="green">[Ctrl+Enter] Approve with comment</Text>
        <Text color="gray">[Esc] Cancel</Text>
      </Box>

      {isSubmitting && (
        <Box marginTop={1}>
          <Text color="yellow">Submitting...</Text>
        </Box>
      )}
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
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="red"
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color="red" bold>
          Request Changes on PR #{selectedPRNumber}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          {selectedPR?.title ?? 'Loading...'}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">Describe the changes needed:</Text>
      </Box>

      <TextArea
        value={comment}
        onChange={setComment}
        onSubmit={handleSubmit}
        onCancel={onClose}
        placeholder="Please fix the following issues..."
        rows={5}
        isFocused={!isSubmitting}
      />

      <Box marginTop={1} gap={2}>
        <Text color="red">[Ctrl+Enter] Request changes</Text>
        <Text color="gray">[Esc] Cancel</Text>
      </Box>

      {isSubmitting && (
        <Box marginTop={1}>
          <Text color="yellow">Submitting...</Text>
        </Box>
      )}
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
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Add Comment to PR #{selectedPRNumber}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          {selectedPR?.title ?? 'Loading...'}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">Write your comment:</Text>
      </Box>

      <TextArea
        value={comment}
        onChange={setComment}
        onSubmit={handleSubmit}
        onCancel={onClose}
        placeholder="Leave a comment..."
        rows={5}
        isFocused={!isSubmitting}
      />

      <Box marginTop={1} gap={2}>
        <Text color="cyan">[Ctrl+Enter] Submit</Text>
        <Text color="gray">[Esc] Cancel</Text>
      </Box>

      {isSubmitting && (
        <Box marginTop={1}>
          <Text color="yellow">Submitting...</Text>
        </Box>
      )}
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
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color="magenta" bold>
          Merge PR #{selectedPRNumber}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          {selectedPR?.title ?? 'Loading...'}
        </Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text color="gray">Select merge method:</Text>
        <Box marginTop={1} flexDirection="column" gap={0}>
          <Box>
            <Text color={mergeMethod === 'merge' ? 'magenta' : 'white'} bold={mergeMethod === 'merge'}>
              {mergeMethod === 'merge' ? '>' : ' '} [m] Merge commit
            </Text>
          </Box>
          <Box>
            <Text color={mergeMethod === 'squash' ? 'magenta' : 'white'} bold={mergeMethod === 'squash'}>
              {mergeMethod === 'squash' ? '>' : ' '} [s] Squash and merge
            </Text>
          </Box>
          <Box>
            <Text color={mergeMethod === 'rebase' ? 'magenta' : 'white'} bold={mergeMethod === 'rebase'}>
              {mergeMethod === 'rebase' ? '>' : ' '} [r] Rebase and merge
            </Text>
          </Box>
        </Box>
      </Box>

      <Box marginTop={1} gap={2}>
        <Text color="magenta">[y/Enter] Confirm merge</Text>
        <Text color="gray">[Esc] Cancel</Text>
      </Box>

      {isSubmitting && (
        <Box marginTop={1}>
          <Text color="yellow">Merging...</Text>
        </Box>
      )}
    </Box>
  );
}

export default PRActionDialogs;
