import {
  formatDistanceToNow,
  formatDistanceToNowStrict,
  format,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears,
  parseISO,
  isValid,
} from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Format options for relative time display
 */
export interface RelativeTimeOptions {
  /** Whether to use abbreviated format (1h vs 1 hour) */
  abbreviated?: boolean;
  /** Whether to add "ago" suffix */
  addSuffix?: boolean;
  /** Timezone for display (default: UTC) */
  timezone?: string;
}

/**
 * Convert a date input to a Date object
 */
export function toDate(date: Date | string | number): Date {
  if (date instanceof Date) {
    return date;
  }
  if (typeof date === 'number') {
    return new Date(date);
  }
  // Try parsing ISO string first
  const parsed = parseISO(date);
  if (isValid(parsed)) {
    return parsed;
  }
  // Fall back to Date constructor
  return new Date(date);
}

/**
 * Format a date as relative time with abbreviations
 * Examples: "now", "5m", "2h", "3d", "1w", "2mo", "1y"
 */
export function formatRelativeTime(
  date: Date | string | number,
  options: RelativeTimeOptions = {}
): string {
  const { abbreviated = true, addSuffix = false, timezone = 'UTC' } = options;

  const now = new Date();
  const then = toDate(date);

  // Convert to specified timezone for comparison
  const nowInTz = toZonedTime(now, timezone);
  const thenInTz = toZonedTime(then, timezone);

  const diffMins = differenceInMinutes(nowInTz, thenInTz);
  const diffHours = differenceInHours(nowInTz, thenInTz);
  const diffDays = differenceInDays(nowInTz, thenInTz);
  const diffWeeks = differenceInWeeks(nowInTz, thenInTz);
  const diffMonths = differenceInMonths(nowInTz, thenInTz);
  const diffYears = differenceInYears(nowInTz, thenInTz);

  let result: string;

  if (abbreviated) {
    if (diffMins < 1) {
      result = 'now';
    } else if (diffMins < 60) {
      result = `${diffMins}m`;
    } else if (diffHours < 24) {
      result = `${diffHours}h`;
    } else if (diffDays < 7) {
      result = `${diffDays}d`;
    } else if (diffWeeks < 4) {
      result = `${diffWeeks}w`;
    } else if (diffMonths < 12) {
      result = `${diffMonths}mo`;
    } else {
      result = `${diffYears}y`;
    }
  } else {
    result = formatDistanceToNowStrict(thenInTz);
  }

  if (addSuffix && result !== 'now') {
    result += ' ago';
  }

  return result;
}

/**
 * Format a date as relative time with full words
 * Examples: "just now", "5 minutes ago", "2 hours ago"
 */
export function formatRelativeTimeFull(
  date: Date | string | number,
  options: { timezone?: string } = {}
): string {
  const then = toDate(date);
  const thenInTz = toZonedTime(then, options.timezone || 'UTC');
  return formatDistanceToNow(thenInTz, { addSuffix: true });
}

/**
 * Format a date in a specific timezone
 */
export function formatInTimezone(
  date: Date | string | number,
  formatStr: string,
  timezone: string = 'UTC'
): string {
  const then = toDate(date);
  return formatInTimeZone(then, timezone, formatStr);
}

/**
 * Format a date as ISO string in UTC
 */
export function formatISOUTC(date: Date | string | number): string {
  const then = toDate(date);
  return formatInTimeZone(then, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

/**
 * Format a date for display with optional timezone
 */
export function formatDate(
  date: Date | string | number,
  formatStr: string = 'MMM d, yyyy',
  timezone?: string
): string {
  const then = toDate(date);
  if (timezone) {
    return formatInTimeZone(then, timezone, formatStr);
  }
  return format(then, formatStr);
}

/**
 * Format a date and time for display
 */
export function formatDateTime(
  date: Date | string | number,
  timezone: string = 'UTC'
): string {
  return formatInTimezone(date, 'MMM d, yyyy h:mm a', timezone);
}

/**
 * Convert a date to UTC
 */
export function toUTC(date: Date | string | number, sourceTimezone: string): Date {
  const then = toDate(date);
  return fromZonedTime(then, sourceTimezone);
}

/**
 * Convert a date from UTC to a specific timezone
 */
export function fromUTC(date: Date | string | number, targetTimezone: string): Date {
  const then = toDate(date);
  return toZonedTime(then, targetTimezone);
}

/**
 * Get the user's local timezone
 */
export function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
