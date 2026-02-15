// ---------------------------------------------------------------------------
// Review session types and pure aggregation/filtering functions
// ---------------------------------------------------------------------------

/**
 * A single review session recorded when the user views a PR detail screen.
 */
export interface ReviewSession {
  /** PR key in format "owner/repo#number" */
  readonly prKey: string
  /** Duration of the session in milliseconds */
  readonly durationMs: number
  /** ISO 8601 timestamp of when the session started */
  readonly timestamp: string
  /** Number of files the user viewed during this session */
  readonly filesReviewed: number
}

/**
 * Aggregated statistics computed from a list of review sessions.
 */
export interface ReviewStats {
  /** Number of sessions */
  readonly count: number
  /** Total time spent reviewing in milliseconds */
  readonly totalMs: number
  /** Average time per session in milliseconds */
  readonly avgMs: number
  /** Total files reviewed across all sessions */
  readonly filesReviewed: number
}

const EMPTY_STATS: ReviewStats = {
  count: 0,
  totalMs: 0,
  avgMs: 0,
  filesReviewed: 0,
}

/**
 * Aggregate a list of review sessions into summary statistics.
 * Returns zero-stats for an empty list.
 */
export function aggregateStats(sessions: readonly ReviewSession[]): ReviewStats {
  if (sessions.length === 0) {
    return EMPTY_STATS
  }

  const totalMs = sessions.reduce((sum, s) => sum + s.durationMs, 0)
  const filesReviewed = sessions.reduce((sum, s) => sum + s.filesReviewed, 0)

  return {
    count: sessions.length,
    totalMs,
    avgMs: Math.round(totalMs / sessions.length),
    filesReviewed,
  }
}

/**
 * Get the start-of-day timestamp for a given date (local time, midnight).
 */
function startOfDay(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Get the start-of-week timestamp (Monday at midnight, local time).
 */
function startOfWeek(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  // Shift so Monday = 0: (day + 6) % 7
  const diff = (day + 6) % 7
  d.setDate(d.getDate() - diff)
  return d.getTime()
}

export type DateRange = 'today' | 'week' | 'all'

/**
 * Filter review sessions by a date range relative to a reference date.
 *
 * - `'today'` — sessions from today (midnight to now)
 * - `'week'` — sessions from Monday of the current week to now
 * - `'all'` — all sessions (no filtering)
 *
 * The `now` parameter defaults to the current date and can be overridden
 * for deterministic testing.
 */
export function filterByRange(
  sessions: readonly ReviewSession[],
  range: DateRange,
  now: Date = new Date(),
): readonly ReviewSession[] {
  if (range === 'all') {
    return sessions
  }

  const cutoff = range === 'today' ? startOfDay(now) : startOfWeek(now)

  return sessions.filter((s) => {
    const ts = new Date(s.timestamp).getTime()
    return ts >= cutoff
  })
}

/**
 * Format milliseconds as a human-readable duration string.
 *
 * - Under 60s: "42s"
 * - Under 60m: "12m 34s"
 * - 60m+: "1h 23m"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

/**
 * Format elapsed seconds as a compact timer display: "MM:SS" or "H:MM:SS".
 */
export function formatTimer(elapsedSeconds: number): string {
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60

  const pad = (n: number): string => String(n).padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}

/**
 * Serialize a ReviewSession to a JSON string for KV storage.
 */
export function serializeSession(session: ReviewSession): string {
  return JSON.stringify(session)
}

/**
 * Deserialize a ReviewSession from a JSON string.
 * Returns null if parsing fails.
 */
export function deserializeSession(json: string): ReviewSession | null {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>
    if (
      typeof parsed.prKey === 'string' &&
      typeof parsed.durationMs === 'number' &&
      typeof parsed.timestamp === 'string' &&
      typeof parsed.filesReviewed === 'number'
    ) {
      return {
        prKey: parsed.prKey,
        durationMs: parsed.durationMs,
        timestamp: parsed.timestamp,
        filesReviewed: parsed.filesReviewed,
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Deserialize a list of sessions stored as a JSON array string.
 * Filters out any entries that fail to parse.
 */
export function deserializeSessions(json: string): readonly ReviewSession[] {
  try {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item: unknown) => {
        if (typeof item !== 'object' || item === null) return null
        const obj = item as Record<string, unknown>
        if (
          typeof obj.prKey === 'string' &&
          typeof obj.durationMs === 'number' &&
          typeof obj.timestamp === 'string' &&
          typeof obj.filesReviewed === 'number'
        ) {
          return {
            prKey: obj.prKey,
            durationMs: obj.durationMs,
            timestamp: obj.timestamp,
            filesReviewed: obj.filesReviewed,
          }
        }
        return null
      })
      .filter((s): s is ReviewSession => s !== null)
  } catch {
    return []
  }
}

/**
 * Serialize a list of sessions to a JSON array string for KV storage.
 */
export function serializeSessions(sessions: readonly ReviewSession[]): string {
  return JSON.stringify(sessions)
}
