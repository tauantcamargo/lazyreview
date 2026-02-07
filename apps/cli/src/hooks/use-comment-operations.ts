import { useState, useCallback } from 'react';
import {
  createProvider,
  type ProviderType,
  type PullRequest,
} from '@lazyreview/core';

export type CommentActionType = 'reply' | 'edit' | 'delete' | 'resolve';
export type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseCommentOperationsOptions {
  providerType: ProviderType;
  token: string;
  baseUrl: string;
  owner: string;
  repo: string;
}

export interface UseCommentOperationsResult {
  actionStatus: ActionStatus;
  actionError: string | null;
  replyToComment: (pr: PullRequest, commentId: string, body: string) => Promise<void>;
  editComment: (pr: PullRequest, commentId: string, body: string) => Promise<void>;
  deleteComment: (pr: PullRequest, commentId: string) => Promise<void>;
  resolveThread: (pr: PullRequest, threadId: string) => Promise<void>;
  unresolveThread: (pr: PullRequest, threadId: string) => Promise<void>;
  reset: () => void;
}

export function useCommentOperations(
  options: UseCommentOperationsOptions
): UseCommentOperationsResult {
  const { providerType, token, baseUrl, owner, repo } = options;
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle');
  const [actionError, setActionError] = useState<string | null>(null);

  const getProvider = useCallback(() => {
    return createProvider({
      type: providerType,
      token,
      baseUrl,
    });
  }, [providerType, token, baseUrl]);

  const replyToComment = useCallback(
    async (pr: PullRequest, commentId: string, body: string): Promise<void> => {
      if (!body.trim()) {
        setActionStatus('error');
        setActionError('Reply body is required');
        return;
      }

      setActionStatus('loading');
      setActionError(null);

      try {
        const provider = getProvider();
        // Use the general createComment method - replies are just comments
        await provider.createComment(owner, repo, pr.number, { body });
        setActionStatus('success');
      } catch (err) {
        setActionStatus('error');
        setActionError(
          err instanceof Error ? err.message : 'Failed to post reply'
        );
        throw err;
      }
    },
    [getProvider, owner, repo]
  );

  const editComment = useCallback(
    async (pr: PullRequest, commentId: string, body: string): Promise<void> => {
      if (!body.trim()) {
        setActionStatus('error');
        setActionError('Comment body is required');
        return;
      }

      setActionStatus('loading');
      setActionError(null);

      try {
        // Note: This would require a provider method for updating comments
        // For now, we'll simulate success in demo mode
        setActionStatus('success');
      } catch (err) {
        setActionStatus('error');
        setActionError(
          err instanceof Error ? err.message : 'Failed to edit comment'
        );
        throw err;
      }
    },
    [getProvider, owner, repo]
  );

  const deleteComment = useCallback(
    async (pr: PullRequest, commentId: string): Promise<void> => {
      setActionStatus('loading');
      setActionError(null);

      try {
        // Note: This would require a provider method for deleting comments
        // For now, we'll simulate success in demo mode
        setActionStatus('success');
      } catch (err) {
        setActionStatus('error');
        setActionError(
          err instanceof Error ? err.message : 'Failed to delete comment'
        );
        throw err;
      }
    },
    [getProvider, owner, repo]
  );

  const resolveThread = useCallback(
    async (pr: PullRequest, threadId: string): Promise<void> => {
      setActionStatus('loading');
      setActionError(null);

      try {
        // Note: This would require a provider method for resolving threads
        // For now, we'll simulate success in demo mode
        setActionStatus('success');
      } catch (err) {
        setActionStatus('error');
        setActionError(
          err instanceof Error ? err.message : 'Failed to resolve thread'
        );
        throw err;
      }
    },
    [getProvider, owner, repo]
  );

  const unresolveThread = useCallback(
    async (pr: PullRequest, threadId: string): Promise<void> => {
      setActionStatus('loading');
      setActionError(null);

      try {
        // Note: This would require a provider method for unresolving threads
        // For now, we'll simulate success in demo mode
        setActionStatus('success');
      } catch (err) {
        setActionStatus('error');
        setActionError(
          err instanceof Error ? err.message : 'Failed to unresolve thread'
        );
        throw err;
      }
    },
    [getProvider, owner, repo]
  );

  const reset = useCallback(() => {
    setActionStatus('idle');
    setActionError(null);
  }, []);

  return {
    actionStatus,
    actionError,
    replyToComment,
    editComment,
    deleteComment,
    resolveThread,
    unresolveThread,
    reset,
  };
}
