import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  toDate,
  formatRelativeTime,
  formatRelativeTimeFull,
  formatInTimezone,
  formatISOUTC,
  formatDate,
  formatDateTime,
  toUTC,
  fromUTC,
  getLocalTimezone,
} from './date';

describe('date utils', () => {
  beforeEach(() => {
    // Mock Date.now() to a fixed timestamp: 2026-02-06T12:00:00.000Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-06T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('toDate', () => {
    it('returns same Date object if given a Date', () => {
      const date = new Date('2026-02-06T10:00:00.000Z');
      expect(toDate(date)).toBe(date);
    });

    it('converts timestamp number to Date', () => {
      const timestamp = new Date('2026-02-06T10:00:00.000Z').getTime();
      const result = toDate(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(timestamp);
    });

    it('parses ISO string to Date', () => {
      const result = toDate('2026-02-06T10:00:00.000Z');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2026-02-06T10:00:00.000Z');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns "now" for times less than 1 minute ago', () => {
      const date = new Date('2026-02-06T11:59:30.000Z'); // 30 seconds ago
      expect(formatRelativeTime(date)).toBe('now');
    });

    it('returns minutes for times less than 1 hour ago', () => {
      const date = new Date('2026-02-06T11:30:00.000Z'); // 30 minutes ago
      expect(formatRelativeTime(date)).toBe('30m');
    });

    it('returns hours for times less than 24 hours ago', () => {
      const date = new Date('2026-02-06T06:00:00.000Z'); // 6 hours ago
      expect(formatRelativeTime(date)).toBe('6h');
    });

    it('returns days for times less than 7 days ago', () => {
      const date = new Date('2026-02-03T12:00:00.000Z'); // 3 days ago
      expect(formatRelativeTime(date)).toBe('3d');
    });

    it('returns weeks for times less than 4 weeks ago', () => {
      const date = new Date('2026-01-23T12:00:00.000Z'); // 2 weeks ago
      expect(formatRelativeTime(date)).toBe('2w');
    });

    it('returns months for times less than 12 months ago', () => {
      const date = new Date('2025-12-06T12:00:00.000Z'); // 2 months ago
      expect(formatRelativeTime(date)).toBe('2mo');
    });

    it('returns years for times more than 12 months ago', () => {
      const date = new Date('2024-02-06T12:00:00.000Z'); // 2 years ago
      expect(formatRelativeTime(date)).toBe('2y');
    });

    it('adds suffix when addSuffix option is true', () => {
      const date = new Date('2026-02-06T11:00:00.000Z'); // 1 hour ago
      expect(formatRelativeTime(date, { addSuffix: true })).toBe('1h ago');
    });

    it('does not add suffix to "now"', () => {
      const date = new Date('2026-02-06T11:59:30.000Z');
      expect(formatRelativeTime(date, { addSuffix: true })).toBe('now');
    });

    it('works with string dates', () => {
      expect(formatRelativeTime('2026-02-06T06:00:00.000Z')).toBe('6h');
    });
  });

  describe('formatDate', () => {
    it('formats date with default format', () => {
      const date = new Date('2026-02-06T10:00:00.000Z');
      expect(formatDate(date)).toBe('Feb 6, 2026');
    });

    it('formats date with custom format', () => {
      const date = new Date('2026-02-06T10:00:00.000Z');
      expect(formatDate(date, 'yyyy-MM-dd')).toBe('2026-02-06');
    });
  });

  describe('formatISOUTC', () => {
    it('formats date as ISO string in UTC', () => {
      const date = new Date('2026-02-06T10:30:45.000Z');
      expect(formatISOUTC(date)).toBe('2026-02-06T10:30:45Z');
    });
  });

  describe('formatDateTime', () => {
    it('formats date and time in UTC', () => {
      const date = new Date('2026-02-06T14:30:00.000Z');
      expect(formatDateTime(date, 'UTC')).toBe('Feb 6, 2026 2:30 PM');
    });
  });

  describe('formatInTimezone', () => {
    it('formats date in specified timezone', () => {
      const date = new Date('2026-02-06T12:00:00.000Z');
      expect(formatInTimezone(date, 'HH:mm', 'America/New_York')).toBe('07:00');
    });
  });

  describe('getLocalTimezone', () => {
    it('returns a valid timezone string', () => {
      const tz = getLocalTimezone();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });
  });
});
