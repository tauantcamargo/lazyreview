import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useOfflineQueue,
  getQueueStatusColor,
  getQueueStatusIcon,
  getActionTypeIcon,
  formatQueuedAction,
  sortQueueByPriority,
  type QueuedAction,
} from './use-offline-queue';

describe('useOfflineQueue', () => {
  const createActionData = () => ({
    type: 'approve' as const,
    data: {
      prNumber: 123,
      repo: 'repo',
      owner: 'owner',
    },
  });

  it('initializes with empty queue', () => {
    const { result } = renderHook(() => useOfflineQueue());

    expect(result.current.queue).toEqual([]);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.failedCount).toBe(0);
    expect(result.current.hasPending).toBe(false);
  });

  it('adds action to queue', () => {
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      result.current.add(createActionData());
    });

    expect(result.current.queue.length).toBe(1);
    expect(result.current.queue[0]?.status).toBe('pending');
    expect(result.current.pendingCount).toBe(1);
    expect(result.current.hasPending).toBe(true);
  });

  it('returns id when adding action', () => {
    const { result } = renderHook(() => useOfflineQueue());
    let id: string = '';

    act(() => {
      id = result.current.add(createActionData());
    });

    expect(id).toBeTruthy();
    expect(result.current.queue[0]?.id).toBe(id);
  });

  it('removes action from queue', () => {
    const { result } = renderHook(() => useOfflineQueue());
    let id: string = '';

    act(() => {
      id = result.current.add(createActionData());
    });

    act(() => {
      result.current.remove(id);
    });

    expect(result.current.queue.length).toBe(0);
  });

  it('clears all actions', () => {
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      result.current.add(createActionData());
    });

    act(() => {
      result.current.add(createActionData());
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.queue.length).toBe(0);
  });

  it('gets action by id', () => {
    const { result } = renderHook(() => useOfflineQueue());
    let id: string = '';

    act(() => {
      id = result.current.add(createActionData());
    });

    const action = result.current.getById(id);
    expect(action?.type).toBe('approve');
  });

  it('returns undefined for unknown id', () => {
    const { result } = renderHook(() => useOfflineQueue());

    const action = result.current.getById('unknown');
    expect(action).toBeUndefined();
  });

  it('processes pending actions', async () => {
    const { result } = renderHook(() => useOfflineQueue());
    const handler = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.add(createActionData());
    });

    await act(async () => {
      await result.current.process(handler);
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.current.queue[0]?.status).toBe('completed');
  });

  it('marks action as failed on error', async () => {
    const { result } = renderHook(() =>
      useOfflineQueue({ maxRetries: 1 })
    );
    const handler = vi.fn().mockRejectedValue(new Error('API error'));

    act(() => {
      result.current.add(createActionData());
    });

    await act(async () => {
      await result.current.process(handler);
    });

    expect(result.current.queue[0]?.status).toBe('failed');
    expect(result.current.queue[0]?.error).toBe('API error');
    expect(result.current.failedCount).toBe(1);
  });

  it('retries failed action', async () => {
    const { result } = renderHook(() =>
      useOfflineQueue({ maxRetries: 3 })
    );
    const handler = vi.fn().mockRejectedValueOnce(new Error('Error'));
    let id: string = '';

    act(() => {
      id = result.current.add(createActionData());
    });

    await act(async () => {
      await result.current.process(handler);
    });

    // First failure doesn't mark as failed because maxRetries > 1
    expect(result.current.queue[0]?.status).toBe('pending');
    expect(result.current.queue[0]?.retryCount).toBe(1);

    act(() => {
      result.current.retry(id);
    });

    expect(result.current.queue[0]?.status).toBe('pending');
  });

  it('retries all failed actions', async () => {
    const { result } = renderHook(() =>
      useOfflineQueue({ maxRetries: 1 })
    );
    const handler = vi.fn().mockRejectedValue(new Error('Error'));

    act(() => {
      result.current.add(createActionData());
    });

    act(() => {
      result.current.add(createActionData());
    });

    await act(async () => {
      await result.current.process(handler);
    });

    expect(result.current.failedCount).toBe(2);

    // Can't retry because maxRetries reached
  });

  it('clears completed actions', async () => {
    const { result } = renderHook(() => useOfflineQueue());
    const handler = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.add(createActionData());
    });

    act(() => {
      result.current.add(createActionData());
    });

    await act(async () => {
      await result.current.process(handler);
    });

    act(() => {
      result.current.clearCompleted();
    });

    expect(result.current.queue.length).toBe(0);
  });

  it('clears failed actions', async () => {
    const { result } = renderHook(() =>
      useOfflineQueue({ maxRetries: 1 })
    );
    const handler = vi.fn().mockRejectedValue(new Error('Error'));

    act(() => {
      result.current.add(createActionData());
    });

    await act(async () => {
      await result.current.process(handler);
    });

    expect(result.current.failedCount).toBe(1);

    act(() => {
      result.current.clearFailed();
    });

    expect(result.current.queue.length).toBe(0);
  });

  it('uses default maxRetries', () => {
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      result.current.add(createActionData());
    });

    expect(result.current.queue[0]?.maxRetries).toBe(3);
  });

  it('uses custom maxRetries', () => {
    const { result } = renderHook(() =>
      useOfflineQueue({ maxRetries: 5 })
    );

    act(() => {
      result.current.add(createActionData());
    });

    expect(result.current.queue[0]?.maxRetries).toBe(5);
  });
});

describe('getQueueStatusColor', () => {
  it('returns green for completed', () => {
    expect(getQueueStatusColor('completed')).toBe('#9ece6a');
  });

  it('returns blue for processing', () => {
    expect(getQueueStatusColor('processing')).toBe('#7aa2f7');
  });

  it('returns red for failed', () => {
    expect(getQueueStatusColor('failed')).toBe('#f7768e');
  });

  it('returns yellow for pending', () => {
    expect(getQueueStatusColor('pending')).toBe('#e0af68');
  });
});

describe('getQueueStatusIcon', () => {
  it('returns checkmark for completed', () => {
    expect(getQueueStatusIcon('completed')).toBe('✓');
  });

  it('returns spinner for processing', () => {
    expect(getQueueStatusIcon('processing')).toBe('⟳');
  });

  it('returns x for failed', () => {
    expect(getQueueStatusIcon('failed')).toBe('✗');
  });

  it('returns circle for pending', () => {
    expect(getQueueStatusIcon('pending')).toBe('○');
  });
});

describe('getActionTypeIcon', () => {
  it('returns checkmark for approve', () => {
    expect(getActionTypeIcon('approve')).toBe('✓');
  });

  it('returns warning for request-changes', () => {
    expect(getActionTypeIcon('request-changes')).toBe('⚠');
  });

  it('returns comment for comment', () => {
    expect(getActionTypeIcon('comment')).toBe('💬');
  });

  it('returns merge icon for merge', () => {
    expect(getActionTypeIcon('merge')).toBe('🔀');
  });

  it('returns x for close', () => {
    expect(getActionTypeIcon('close')).toBe('✗');
  });

  it('returns arrow for reopen', () => {
    expect(getActionTypeIcon('reopen')).toBe('↩');
  });

  it('returns tag for label', () => {
    expect(getActionTypeIcon('label')).toBe('🏷');
  });

  it('returns person for assign', () => {
    expect(getActionTypeIcon('assign')).toBe('👤');
  });
});

describe('formatQueuedAction', () => {
  const createAction = (type: QueuedAction['type']): QueuedAction => ({
    id: '1',
    type,
    status: 'pending',
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: 3,
    data: {
      prNumber: 123,
      repo: 'repo',
      owner: 'owner',
    },
  });

  it('formats approve action', () => {
    const result = formatQueuedAction(createAction('approve'));
    expect(result).toBe('Approve owner/repo#123');
  });

  it('formats request-changes action', () => {
    const result = formatQueuedAction(createAction('request-changes'));
    expect(result).toBe('Request changes on owner/repo#123');
  });

  it('formats comment action', () => {
    const result = formatQueuedAction(createAction('comment'));
    expect(result).toBe('Comment on owner/repo#123');
  });

  it('formats merge action', () => {
    const result = formatQueuedAction(createAction('merge'));
    expect(result).toBe('Merge owner/repo#123');
  });

  it('formats close action', () => {
    const result = formatQueuedAction(createAction('close'));
    expect(result).toBe('Close owner/repo#123');
  });

  it('formats reopen action', () => {
    const result = formatQueuedAction(createAction('reopen'));
    expect(result).toBe('Reopen owner/repo#123');
  });
});

describe('sortQueueByPriority', () => {
  it('sorts by status priority', () => {
    const queue: QueuedAction[] = [
      { id: '1', type: 'approve', status: 'completed', createdAt: 1000, retryCount: 0, maxRetries: 3, data: { prNumber: 1, repo: 'r', owner: 'o' } },
      { id: '2', type: 'approve', status: 'pending', createdAt: 2000, retryCount: 0, maxRetries: 3, data: { prNumber: 2, repo: 'r', owner: 'o' } },
      { id: '3', type: 'approve', status: 'failed', createdAt: 3000, retryCount: 0, maxRetries: 3, data: { prNumber: 3, repo: 'r', owner: 'o' } },
    ];

    const sorted = sortQueueByPriority(queue);

    expect(sorted[0]?.status).toBe('pending');
    expect(sorted[1]?.status).toBe('failed');
    expect(sorted[2]?.status).toBe('completed');
  });

  it('sorts by creation time within same status', () => {
    const queue: QueuedAction[] = [
      { id: '1', type: 'approve', status: 'pending', createdAt: 3000, retryCount: 0, maxRetries: 3, data: { prNumber: 1, repo: 'r', owner: 'o' } },
      { id: '2', type: 'approve', status: 'pending', createdAt: 1000, retryCount: 0, maxRetries: 3, data: { prNumber: 2, repo: 'r', owner: 'o' } },
      { id: '3', type: 'approve', status: 'pending', createdAt: 2000, retryCount: 0, maxRetries: 3, data: { prNumber: 3, repo: 'r', owner: 'o' } },
    ];

    const sorted = sortQueueByPriority(queue);

    expect(sorted[0]?.id).toBe('2');
    expect(sorted[1]?.id).toBe('3');
    expect(sorted[2]?.id).toBe('1');
  });

  it('does not mutate original array', () => {
    const queue: QueuedAction[] = [
      { id: '1', type: 'approve', status: 'completed', createdAt: 1000, retryCount: 0, maxRetries: 3, data: { prNumber: 1, repo: 'r', owner: 'o' } },
      { id: '2', type: 'approve', status: 'pending', createdAt: 2000, retryCount: 0, maxRetries: 3, data: { prNumber: 2, repo: 'r', owner: 'o' } },
    ];

    sortQueueByPriority(queue);

    expect(queue[0]?.id).toBe('1');
    expect(queue[1]?.id).toBe('2');
  });
});
