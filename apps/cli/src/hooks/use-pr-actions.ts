import { useState, useCallback } from 'react';
import {
  createProvider,
  type ProviderType,
  type PullRequest,
} from '@lazyreview/core';

export type PRActionType = 'approve' | 'request-changes' | 'comment' | 'merge';
export type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

export interface PRActionResult {
  status: ActionStatus;
  error: string | null;
}

export interface UsePRActionsOptions {
  providerType: ProviderType;
  token: string;
  baseUrl: string;
  owner: string;
  repo: string;
}

export interface UsePRActionsResult {
  actionStatus: ActionStatus;
  actionError: string | null;
  approve: (pr: PullRequest, body?: string) => Promise<void>;
  requestChanges: (pr: PullRequest, body: string) => Promise<void>;
  comment: (pr: PullRequest, body: string) => Promise<void>;
  reset: () => void;
}

export function usePRActions(options: UsePRActionsOptions): UsePRActionsResult {
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

  const approve = useCallback(
    async (pr: PullRequest, body?: string): Promise<void> => {
      setActionStatus('loading');
      setActionError(null);

      try {
        const provider = getProvider();
        await provider.approveReview(owner, repo, pr.number, body);
        setActionStatus('success');
      } catch (err) {
        setActionStatus('error');
        setActionError(
          err instanceof Error ? err.message : 'Failed to approve PR'
        );
        throw err;
      }
    },
    [getProvider, owner, repo]
  );

  const requestChanges = useCallback(
    async (pr: PullRequest, body: string): Promise<void> => {
      if (!body.trim()) {
        setActionStatus('error');
        setActionError('Comment body is required when requesting changes');
        return;
      }

      setActionStatus('loading');
      setActionError(null);

      try {
        const provider = getProvider();
        await provider.requestChanges(owner, repo, pr.number, body);
        setActionStatus('success');
      } catch (err) {
        setActionStatus('error');
        setActionError(
          err instanceof Error ? err.message : 'Failed to request changes'
        );
        throw err;
      }
    },
    [getProvider, owner, repo]
  );

  const comment = useCallback(
    async (pr: PullRequest, body: string): Promise<void> => {
      if (!body.trim()) {
        setActionStatus('error');
        setActionError('Comment body is required');
        return;
      }

      setActionStatus('loading');
      setActionError(null);

      try {
        const provider = getProvider();
        await provider.createComment(owner, repo, pr.number, { body });
        setActionStatus('success');
      } catch (err) {
        setActionStatus('error');
        setActionError(
          err instanceof Error ? err.message : 'Failed to post comment'
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
    approve,
    requestChanges,
    comment,
    reset,
  };
}
