import { useState, useCallback, useMemo } from 'react';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: number;
  read: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
  meta?: Record<string, unknown>;
}

export interface UseNotificationsOptions {
  maxNotifications?: number;
  autoExpireMs?: number;
}

export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  add: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => string;
  remove: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
  getById: (id: string) => Notification | undefined;
}

/**
 * Hook for managing in-app notifications
 */
export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsResult {
  const { maxNotifications = 100 } = options;
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  };

  const add = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): string => {
    const id = generateId();
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      read: false,
    };

    setNotifications((prev) => {
      const updated = [newNotification, ...prev];
      return updated.slice(0, maxNotifications);
    });

    return id;
  }, [maxNotifications]);

  const remove = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  const getById = useCallback((id: string): Notification | undefined => {
    return notifications.find((n) => n.id === id);
  }, [notifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    add,
    remove,
    markRead,
    markAllRead,
    clear,
    getById,
  };
}

export interface NotificationGroup {
  type: NotificationType;
  count: number;
  latest: Notification;
}

/**
 * Group notifications by type
 */
export function groupNotifications(notifications: Notification[]): NotificationGroup[] {
  const groups = new Map<NotificationType, { count: number; latest: Notification }>();

  for (const notification of notifications) {
    const existing = groups.get(notification.type);
    if (existing) {
      existing.count++;
      if (notification.timestamp > existing.latest.timestamp) {
        existing.latest = notification;
      }
    } else {
      groups.set(notification.type, { count: 1, latest: notification });
    }
  }

  return Array.from(groups.entries())
    .map(([type, { count, latest }]) => ({ type, count, latest }))
    .sort((a, b) => b.latest.timestamp - a.latest.timestamp);
}

/**
 * Format notification timestamp for display
 */
export function formatNotificationTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return 'Just now';
  }

  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }

  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  const days = Math.floor(diff / 86400000);
  return `${days}d ago`;
}

/**
 * Get icon for notification type
 */
export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'success':
      return '✓';
    case 'warning':
      return '⚠';
    case 'error':
      return '✗';
    default:
      return 'ℹ';
  }
}

/**
 * Get color for notification type
 */
export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'success':
      return '#9ece6a'; // green
    case 'warning':
      return '#e0af68'; // yellow
    case 'error':
      return '#f7768e'; // red
    default:
      return '#7aa2f7'; // blue
  }
}

export interface PRNotification {
  prNumber: number;
  prTitle: string;
  repo: string;
  eventType: 'review' | 'comment' | 'merge' | 'update' | 'approval' | 'changes_requested';
  actor?: string;
}

/**
 * Create notification for PR events
 */
export function createPRNotification(event: PRNotification): Omit<Notification, 'id' | 'timestamp' | 'read'> {
  const { prNumber, prTitle, repo, eventType, actor } = event;

  const titles: Record<string, string> = {
    review: 'New Review',
    comment: 'New Comment',
    merge: 'PR Merged',
    update: 'PR Updated',
    approval: 'PR Approved',
    changes_requested: 'Changes Requested',
  };

  const types: Record<string, NotificationType> = {
    review: 'info',
    comment: 'info',
    merge: 'success',
    update: 'info',
    approval: 'success',
    changes_requested: 'warning',
  };

  const title = titles[eventType] ?? 'PR Event';
  const type = types[eventType] ?? 'info';
  const shortTitle = prTitle.length > 50 ? `${prTitle.slice(0, 47)}...` : prTitle;

  let message = `#${prNumber}: ${shortTitle}`;
  if (actor) {
    message = `${actor} - ${message}`;
  }

  return {
    type,
    title,
    message,
    meta: {
      prNumber,
      repo,
      eventType,
      actor,
    },
  };
}
