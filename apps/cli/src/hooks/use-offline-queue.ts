import { useState, useCallback, useMemo } from 'react';

export type QueuedActionType =
  | 'approve'
  | 'request-changes'
  | 'comment'
  | 'merge'
  | 'close'
  | 'reopen'
  | 'label'
  | 'assign';

export type QueuedActionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueuedAction {
  id: string;
  type: QueuedActionType;
  status: QueuedActionStatus;
  createdAt: number;
  processedAt?: number;
  error?: string;
  retryCount: number;
  maxRetries: number;
  data: {
    prNumber: number;
    repo: string;
    owner: string;
    body?: string;
    labels?: string[];
    assignees?: string[];
  };
}

export interface UseOfflineQueueOptions {
  maxRetries?: number;
  persistKey?: string;
}

export interface UseOfflineQueueResult {
  queue: QueuedAction[];
  pendingCount: number;
  failedCount: number;
  add: (action: Omit<QueuedAction, 'id' | 'status' | 'createdAt' | 'retryCount' | 'maxRetries'>) => string;
  remove: (id: string) => void;
  retry: (id: string) => void;
  retryAll: () => void;
  clear: () => void;
  clearCompleted: () => void;
  clearFailed: () => void;
  process: (handler: (action: QueuedAction) => Promise<void>) => Promise<void>;
  getById: (id: string) => QueuedAction | undefined;
  hasPending: boolean;
}

/**
 * Hook for managing an offline action queue
 */
export function useOfflineQueue(options: UseOfflineQueueOptions = {}): UseOfflineQueueResult {
  const { maxRetries = 3 } = options;
  const [queue, setQueue] = useState<QueuedAction[]>([]);

  const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  };

  const add = useCallback((action: Omit<QueuedAction, 'id' | 'status' | 'createdAt' | 'retryCount' | 'maxRetries'>): string => {
    const id = generateId();
    const newAction: QueuedAction = {
      ...action,
      id,
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries,
    };

    setQueue((prev) => [...prev, newAction]);
    return id;
  }, [maxRetries]);

  const remove = useCallback((id: string) => {
    setQueue((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const updateAction = useCallback((id: string, updates: Partial<QueuedAction>) => {
    setQueue((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const retry = useCallback((id: string) => {
    setQueue((prev) =>
      prev.map((a) =>
        a.id === id && a.status === 'failed' && a.retryCount < a.maxRetries
          ? { ...a, status: 'pending' as const, error: undefined }
          : a
      )
    );
  }, []);

  const retryAll = useCallback(() => {
    setQueue((prev) =>
      prev.map((a) =>
        a.status === 'failed' && a.retryCount < a.maxRetries
          ? { ...a, status: 'pending' as const, error: undefined }
          : a
      )
    );
  }, []);

  const clear = useCallback(() => {
    setQueue([]);
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue((prev) => prev.filter((a) => a.status !== 'completed'));
  }, []);

  const clearFailed = useCallback(() => {
    setQueue((prev) => prev.filter((a) => a.status !== 'failed'));
  }, []);

  const process = useCallback(async (handler: (action: QueuedAction) => Promise<void>) => {
    const pending = queue.filter((a) => a.status === 'pending');

    for (const action of pending) {
      updateAction(action.id, { status: 'processing' });

      try {
        await handler(action);
        updateAction(action.id, {
          status: 'completed',
          processedAt: Date.now(),
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        const newRetryCount = action.retryCount + 1;
        const status = newRetryCount >= action.maxRetries ? 'failed' : 'pending';

        updateAction(action.id, {
          status,
          error,
          retryCount: newRetryCount,
        });
      }
    }
  }, [queue, updateAction]);

  const getById = useCallback((id: string): QueuedAction | undefined => {
    return queue.find((a) => a.id === id);
  }, [queue]);

  const pendingCount = useMemo(() => {
    return queue.filter((a) => a.status === 'pending' || a.status === 'processing').length;
  }, [queue]);

  const failedCount = useMemo(() => {
    return queue.filter((a) => a.status === 'failed').length;
  }, [queue]);

  const hasPending = pendingCount > 0;

  return {
    queue,
    pendingCount,
    failedCount,
    add,
    remove,
    retry,
    retryAll,
    clear,
    clearCompleted,
    clearFailed,
    process,
    getById,
    hasPending,
  };
}

/**
 * Get color for action status
 */
export function getQueueStatusColor(status: QueuedActionStatus): string {
  switch (status) {
    case 'completed':
      return '#9ece6a'; // green
    case 'processing':
      return '#7aa2f7'; // blue
    case 'failed':
      return '#f7768e'; // red
    default:
      return '#e0af68'; // yellow
  }
}

/**
 * Get icon for action status
 */
export function getQueueStatusIcon(status: QueuedActionStatus): string {
  switch (status) {
    case 'completed':
      return '✓';
    case 'processing':
      return '⟳';
    case 'failed':
      return '✗';
    default:
      return '○';
  }
}

/**
 * Get icon for action type
 */
export function getActionTypeIcon(type: QueuedActionType): string {
  switch (type) {
    case 'approve':
      return '✓';
    case 'request-changes':
      return '⚠';
    case 'comment':
      return '💬';
    case 'merge':
      return '🔀';
    case 'close':
      return '✗';
    case 'reopen':
      return '↩';
    case 'label':
      return '🏷';
    case 'assign':
      return '👤';
    default:
      return '•';
  }
}

/**
 * Format action for display
 */
export function formatQueuedAction(action: QueuedAction): string {
  const { type, data } = action;
  const prRef = `${data.owner}/${data.repo}#${data.prNumber}`;

  switch (type) {
    case 'approve':
      return `Approve ${prRef}`;
    case 'request-changes':
      return `Request changes on ${prRef}`;
    case 'comment':
      return `Comment on ${prRef}`;
    case 'merge':
      return `Merge ${prRef}`;
    case 'close':
      return `Close ${prRef}`;
    case 'reopen':
      return `Reopen ${prRef}`;
    case 'label':
      return `Label ${prRef}`;
    case 'assign':
      return `Assign ${prRef}`;
    default:
      return `Action on ${prRef}`;
  }
}

/**
 * Sort queue by priority (pending first, then by creation time)
 */
export function sortQueueByPriority(queue: QueuedAction[]): QueuedAction[] {
  return [...queue].sort((a, b) => {
    // Status priority: pending > processing > failed > completed
    const statusOrder: Record<QueuedActionStatus, number> = {
      pending: 0,
      processing: 1,
      failed: 2,
      completed: 3,
    };

    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;

    // Then by creation time (oldest first)
    return a.createdAt - b.createdAt;
  });
}
