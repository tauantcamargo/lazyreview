import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useNotifications,
  groupNotifications,
  formatNotificationTime,
  getNotificationIcon,
  getNotificationColor,
  createPRNotification,
  type Notification,
} from './use-notifications';

describe('useNotifications', () => {
  it('initializes with empty notifications', () => {
    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('adds notification', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.add({
        type: 'info',
        title: 'Test Notification',
        message: 'Test message',
      });
    });

    expect(result.current.notifications.length).toBe(1);
    expect(result.current.notifications[0]?.title).toBe('Test Notification');
    expect(result.current.notifications[0]?.read).toBe(false);
  });

  it('returns id when adding notification', () => {
    const { result } = renderHook(() => useNotifications());
    let id: string = '';

    act(() => {
      id = result.current.add({
        type: 'info',
        title: 'Test',
      });
    });

    expect(id).toBeTruthy();
    expect(result.current.notifications[0]?.id).toBe(id);
  });

  it('removes notification', () => {
    const { result } = renderHook(() => useNotifications());
    let id: string = '';

    act(() => {
      id = result.current.add({ type: 'info', title: 'Test' });
    });

    act(() => {
      result.current.remove(id);
    });

    expect(result.current.notifications.length).toBe(0);
  });

  it('marks notification as read', () => {
    const { result } = renderHook(() => useNotifications());
    let id: string = '';

    act(() => {
      id = result.current.add({ type: 'info', title: 'Test' });
    });

    expect(result.current.unreadCount).toBe(1);

    act(() => {
      result.current.markRead(id);
    });

    expect(result.current.notifications[0]?.read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('marks all notifications as read', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.add({ type: 'info', title: 'Test 1' });
    });

    act(() => {
      result.current.add({ type: 'info', title: 'Test 2' });
    });

    act(() => {
      result.current.add({ type: 'info', title: 'Test 3' });
    });

    expect(result.current.unreadCount).toBe(3);

    act(() => {
      result.current.markAllRead();
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('clears all notifications', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.add({ type: 'info', title: 'Test 1' });
    });

    act(() => {
      result.current.add({ type: 'info', title: 'Test 2' });
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.notifications.length).toBe(0);
  });

  it('gets notification by id', () => {
    const { result } = renderHook(() => useNotifications());
    let id: string = '';

    act(() => {
      id = result.current.add({ type: 'info', title: 'Test' });
    });

    const notification = result.current.getById(id);
    expect(notification?.title).toBe('Test');
  });

  it('returns undefined for unknown id', () => {
    const { result } = renderHook(() => useNotifications());

    const notification = result.current.getById('unknown');
    expect(notification).toBeUndefined();
  });

  it('respects maxNotifications limit', () => {
    const { result } = renderHook(() =>
      useNotifications({ maxNotifications: 3 })
    );

    act(() => {
      result.current.add({ type: 'info', title: 'Test 1' });
    });

    act(() => {
      result.current.add({ type: 'info', title: 'Test 2' });
    });

    act(() => {
      result.current.add({ type: 'info', title: 'Test 3' });
    });

    act(() => {
      result.current.add({ type: 'info', title: 'Test 4' });
    });

    expect(result.current.notifications.length).toBe(3);
    expect(result.current.notifications[0]?.title).toBe('Test 4');
  });

  it('adds newest notifications first', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.add({ type: 'info', title: 'First' });
    });

    act(() => {
      result.current.add({ type: 'info', title: 'Second' });
    });

    expect(result.current.notifications[0]?.title).toBe('Second');
    expect(result.current.notifications[1]?.title).toBe('First');
  });
});

describe('groupNotifications', () => {
  it('groups notifications by type', () => {
    const notifications: Notification[] = [
      { id: '1', type: 'info', title: 'Info 1', timestamp: 1000, read: false },
      { id: '2', type: 'success', title: 'Success 1', timestamp: 2000, read: false },
      { id: '3', type: 'info', title: 'Info 2', timestamp: 3000, read: false },
    ];

    const groups = groupNotifications(notifications);

    expect(groups.length).toBe(2);
    expect(groups.find(g => g.type === 'info')?.count).toBe(2);
    expect(groups.find(g => g.type === 'success')?.count).toBe(1);
  });

  it('returns latest notification in group', () => {
    const notifications: Notification[] = [
      { id: '1', type: 'info', title: 'Old', timestamp: 1000, read: false },
      { id: '2', type: 'info', title: 'New', timestamp: 2000, read: false },
    ];

    const groups = groupNotifications(notifications);

    expect(groups[0]?.latest.title).toBe('New');
  });

  it('sorts groups by latest timestamp', () => {
    const notifications: Notification[] = [
      { id: '1', type: 'info', title: 'Info', timestamp: 1000, read: false },
      { id: '2', type: 'success', title: 'Success', timestamp: 3000, read: false },
      { id: '3', type: 'error', title: 'Error', timestamp: 2000, read: false },
    ];

    const groups = groupNotifications(notifications);

    expect(groups[0]?.type).toBe('success');
    expect(groups[1]?.type).toBe('error');
    expect(groups[2]?.type).toBe('info');
  });
});

describe('formatNotificationTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats just now', () => {
    const now = Date.now();
    expect(formatNotificationTime(now)).toBe('Just now');
  });

  it('formats minutes ago', () => {
    const now = Date.now();
    expect(formatNotificationTime(now - 5 * 60000)).toBe('5m ago');
  });

  it('formats hours ago', () => {
    const now = Date.now();
    expect(formatNotificationTime(now - 3 * 3600000)).toBe('3h ago');
  });

  it('formats days ago', () => {
    const now = Date.now();
    expect(formatNotificationTime(now - 2 * 86400000)).toBe('2d ago');
  });
});

describe('getNotificationIcon', () => {
  it('returns checkmark for success', () => {
    expect(getNotificationIcon('success')).toBe('✓');
  });

  it('returns warning for warning', () => {
    expect(getNotificationIcon('warning')).toBe('⚠');
  });

  it('returns x for error', () => {
    expect(getNotificationIcon('error')).toBe('✗');
  });

  it('returns info for info', () => {
    expect(getNotificationIcon('info')).toBe('ℹ');
  });
});

describe('getNotificationColor', () => {
  it('returns green for success', () => {
    expect(getNotificationColor('success')).toBe('#9ece6a');
  });

  it('returns yellow for warning', () => {
    expect(getNotificationColor('warning')).toBe('#e0af68');
  });

  it('returns red for error', () => {
    expect(getNotificationColor('error')).toBe('#f7768e');
  });

  it('returns blue for info', () => {
    expect(getNotificationColor('info')).toBe('#7aa2f7');
  });
});

describe('createPRNotification', () => {
  it('creates review notification', () => {
    const notification = createPRNotification({
      prNumber: 123,
      prTitle: 'Add new feature',
      repo: 'owner/repo',
      eventType: 'review',
      actor: 'alice',
    });

    expect(notification.title).toBe('New Review');
    expect(notification.type).toBe('info');
    expect(notification.message).toContain('#123');
    expect(notification.message).toContain('alice');
  });

  it('creates merge notification', () => {
    const notification = createPRNotification({
      prNumber: 456,
      prTitle: 'Fix bug',
      repo: 'owner/repo',
      eventType: 'merge',
    });

    expect(notification.title).toBe('PR Merged');
    expect(notification.type).toBe('success');
  });

  it('creates changes requested notification', () => {
    const notification = createPRNotification({
      prNumber: 789,
      prTitle: 'Update docs',
      repo: 'owner/repo',
      eventType: 'changes_requested',
      actor: 'bob',
    });

    expect(notification.title).toBe('Changes Requested');
    expect(notification.type).toBe('warning');
  });

  it('truncates long titles', () => {
    const longTitle = 'A'.repeat(100);
    const notification = createPRNotification({
      prNumber: 1,
      prTitle: longTitle,
      repo: 'owner/repo',
      eventType: 'comment',
    });

    expect(notification.message?.length).toBeLessThan(100);
    expect(notification.message).toContain('...');
  });

  it('includes metadata', () => {
    const notification = createPRNotification({
      prNumber: 123,
      prTitle: 'Test',
      repo: 'owner/repo',
      eventType: 'approval',
      actor: 'alice',
    });

    expect(notification.meta?.prNumber).toBe(123);
    expect(notification.meta?.repo).toBe('owner/repo');
    expect(notification.meta?.eventType).toBe('approval');
    expect(notification.meta?.actor).toBe('alice');
  });
});
