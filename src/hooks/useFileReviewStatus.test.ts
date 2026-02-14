import { describe, it, expect } from 'vitest'
import {
  createFileReviewStatusStore,
  computeSummary,
  findNextUnreviewed,
  findPrevUnreviewed,
  type FileReviewStatus,
} from './useFileReviewStatus'

describe('createFileReviewStatusStore', () => {
  const prKey = 'owner/repo/42'

  it('returns empty statuses initially', () => {
    const store = createFileReviewStatusStore()
    const snapshot = store.getSnapshot()
    expect(snapshot.size).toBe(0)
  })

  it('sets a file status', () => {
    const store = createFileReviewStatusStore()
    store.setStatus(prKey, 'src/foo.ts', 'approved')
    const snapshot = store.getSnapshot()
    const prStatuses = snapshot.get(prKey)
    expect(prStatuses?.get('src/foo.ts')).toBe('approved')
  })

  it('overwrites an existing file status', () => {
    const store = createFileReviewStatusStore()
    store.setStatus(prKey, 'src/foo.ts', 'approved')
    store.setStatus(prKey, 'src/foo.ts', 'needs-changes')
    const prStatuses = store.getSnapshot().get(prKey)
    expect(prStatuses?.get('src/foo.ts')).toBe('needs-changes')
  })

  it('sets multiple files independently', () => {
    const store = createFileReviewStatusStore()
    store.setStatus(prKey, 'src/a.ts', 'approved')
    store.setStatus(prKey, 'src/b.ts', 'skipped')
    store.setStatus(prKey, 'src/c.ts', 'needs-changes')
    const prStatuses = store.getSnapshot().get(prKey)
    expect(prStatuses?.get('src/a.ts')).toBe('approved')
    expect(prStatuses?.get('src/b.ts')).toBe('skipped')
    expect(prStatuses?.get('src/c.ts')).toBe('needs-changes')
  })

  it('clears a single file status', () => {
    const store = createFileReviewStatusStore()
    store.setStatus(prKey, 'src/foo.ts', 'approved')
    store.clearStatus(prKey, 'src/foo.ts')
    const prStatuses = store.getSnapshot().get(prKey)
    expect(prStatuses?.has('src/foo.ts')).toBe(false)
  })

  it('clearStatus is a no-op for unset files', () => {
    const store = createFileReviewStatusStore()
    store.clearStatus(prKey, 'src/nonexistent.ts')
    expect(store.getSnapshot().get(prKey)).toBeUndefined()
  })

  it('clears all statuses for a PR', () => {
    const store = createFileReviewStatusStore()
    store.setStatus(prKey, 'src/a.ts', 'approved')
    store.setStatus(prKey, 'src/b.ts', 'skipped')
    store.clearAll(prKey)
    const prStatuses = store.getSnapshot().get(prKey)
    expect(prStatuses?.size ?? 0).toBe(0)
  })

  it('clearAll is a no-op for unknown PR', () => {
    const store = createFileReviewStatusStore()
    store.clearAll('unknown/pr/1')
    // Should not throw
    expect(store.getSnapshot().get('unknown/pr/1')).toBeUndefined()
  })

  it('scopes state per PR', () => {
    const store = createFileReviewStatusStore()
    const prKey2 = 'owner/repo/99'
    store.setStatus(prKey, 'src/foo.ts', 'approved')
    store.setStatus(prKey2, 'src/foo.ts', 'needs-changes')
    expect(store.getSnapshot().get(prKey)?.get('src/foo.ts')).toBe('approved')
    expect(store.getSnapshot().get(prKey2)?.get('src/foo.ts')).toBe('needs-changes')
  })

  it('notifies listeners on setStatus', () => {
    const store = createFileReviewStatusStore()
    let callCount = 0
    store.subscribe(() => {
      callCount++
    })
    store.setStatus(prKey, 'src/foo.ts', 'approved')
    expect(callCount).toBe(1)
  })

  it('notifies listeners on clearStatus', () => {
    const store = createFileReviewStatusStore()
    store.setStatus(prKey, 'src/foo.ts', 'approved')
    let callCount = 0
    store.subscribe(() => {
      callCount++
    })
    store.clearStatus(prKey, 'src/foo.ts')
    expect(callCount).toBe(1)
  })

  it('notifies listeners on clearAll', () => {
    const store = createFileReviewStatusStore()
    store.setStatus(prKey, 'src/foo.ts', 'approved')
    let callCount = 0
    store.subscribe(() => {
      callCount++
    })
    store.clearAll(prKey)
    expect(callCount).toBe(1)
  })

  it('unsubscribe stops notifications', () => {
    const store = createFileReviewStatusStore()
    let callCount = 0
    const unsub = store.subscribe(() => {
      callCount++
    })
    unsub()
    store.setStatus(prKey, 'src/foo.ts', 'approved')
    expect(callCount).toBe(0)
  })

  it('getStatusForPR returns empty map for unknown PR', () => {
    const store = createFileReviewStatusStore()
    expect(store.getStatusForPR(prKey).size).toBe(0)
  })

  it('getStatusForPR returns the statuses map for a known PR', () => {
    const store = createFileReviewStatusStore()
    store.setStatus(prKey, 'src/a.ts', 'approved')
    store.setStatus(prKey, 'src/b.ts', 'skipped')
    const result = store.getStatusForPR(prKey)
    expect(result.size).toBe(2)
    expect(result.get('src/a.ts')).toBe('approved')
  })
})

describe('computeSummary', () => {
  it('returns all zeros for empty statuses and empty files', () => {
    const statuses = new Map<string, FileReviewStatus>()
    const summary = computeSummary(statuses, 0)
    expect(summary).toEqual({
      total: 0,
      approved: 0,
      needsChanges: 0,
      skipped: 0,
      pending: 0,
    })
  })

  it('counts pending files as total minus reviewed', () => {
    const statuses = new Map<string, FileReviewStatus>()
    const summary = computeSummary(statuses, 5)
    expect(summary).toEqual({
      total: 5,
      approved: 0,
      needsChanges: 0,
      skipped: 0,
      pending: 5,
    })
  })

  it('correctly tallies all status types', () => {
    const statuses = new Map<string, FileReviewStatus>([
      ['a.ts', 'approved'],
      ['b.ts', 'approved'],
      ['c.ts', 'needs-changes'],
      ['d.ts', 'skipped'],
      ['e.ts', 'skipped'],
      ['f.ts', 'skipped'],
    ])
    const summary = computeSummary(statuses, 10)
    expect(summary).toEqual({
      total: 10,
      approved: 2,
      needsChanges: 1,
      skipped: 3,
      pending: 4,
    })
  })

  it('handles all files reviewed', () => {
    const statuses = new Map<string, FileReviewStatus>([
      ['a.ts', 'approved'],
      ['b.ts', 'needs-changes'],
    ])
    const summary = computeSummary(statuses, 2)
    expect(summary).toEqual({
      total: 2,
      approved: 1,
      needsChanges: 1,
      skipped: 0,
      pending: 0,
    })
  })
})

describe('findNextUnreviewed', () => {
  const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts']

  it('returns the next unreviewed file after current', () => {
    const statuses = new Map<string, FileReviewStatus>([
      ['a.ts', 'approved'],
      ['b.ts', 'approved'],
      ['d.ts', 'skipped'],
    ])
    // Current is b.ts (index 1), next unreviewed is c.ts (index 2)
    const result = findNextUnreviewed('b.ts', files, statuses)
    expect(result).toBe('c.ts')
  })

  it('wraps around to find unreviewed file', () => {
    const statuses = new Map<string, FileReviewStatus>([
      ['b.ts', 'approved'],
      ['c.ts', 'approved'],
      ['d.ts', 'approved'],
      ['e.ts', 'approved'],
    ])
    // Current is c.ts (index 2), only a.ts is unreviewed, wraps around
    const result = findNextUnreviewed('c.ts', files, statuses)
    expect(result).toBe('a.ts')
  })

  it('returns null when all files are reviewed', () => {
    const statuses = new Map<string, FileReviewStatus>([
      ['a.ts', 'approved'],
      ['b.ts', 'needs-changes'],
      ['c.ts', 'skipped'],
      ['d.ts', 'approved'],
      ['e.ts', 'skipped'],
    ])
    const result = findNextUnreviewed('a.ts', files, statuses)
    expect(result).toBeNull()
  })

  it('returns null for empty files list', () => {
    const result = findNextUnreviewed('a.ts', [], new Map())
    expect(result).toBeNull()
  })

  it('returns next unreviewed when current file is not in list', () => {
    const statuses = new Map<string, FileReviewStatus>([
      ['a.ts', 'approved'],
    ])
    const result = findNextUnreviewed('z.ts', files, statuses)
    expect(result).toBe('b.ts')
  })

  it('skips the current file even if it is unreviewed', () => {
    const statuses = new Map<string, FileReviewStatus>()
    // All unreviewed, current is a.ts - should return b.ts
    const result = findNextUnreviewed('a.ts', files, statuses)
    expect(result).toBe('b.ts')
  })

  it('returns the only unreviewed file that is not current', () => {
    const statuses = new Map<string, FileReviewStatus>([
      ['a.ts', 'approved'],
      ['c.ts', 'approved'],
      ['d.ts', 'approved'],
      ['e.ts', 'approved'],
    ])
    const result = findNextUnreviewed('a.ts', files, statuses)
    expect(result).toBe('b.ts')
  })
})

describe('findPrevUnreviewed', () => {
  const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts']

  it('returns the previous unreviewed file before current', () => {
    const statuses = new Map<string, FileReviewStatus>([
      ['b.ts', 'approved'],
      ['c.ts', 'approved'],
    ])
    // Current is d.ts (index 3), prev unreviewed is a.ts (index 0)
    const result = findPrevUnreviewed('d.ts', files, statuses)
    expect(result).toBe('a.ts')
  })

  it('wraps around backwards to find unreviewed file', () => {
    const statuses = new Map<string, FileReviewStatus>([
      ['a.ts', 'approved'],
      ['b.ts', 'approved'],
      ['c.ts', 'approved'],
    ])
    // Current is b.ts (index 1), wraps backwards: e.ts then d.ts -> d.ts is unreviewed
    const result = findPrevUnreviewed('b.ts', files, statuses)
    expect(result).toBe('e.ts')
  })

  it('returns null when all files are reviewed', () => {
    const statuses = new Map<string, FileReviewStatus>([
      ['a.ts', 'approved'],
      ['b.ts', 'approved'],
      ['c.ts', 'approved'],
      ['d.ts', 'approved'],
      ['e.ts', 'approved'],
    ])
    const result = findPrevUnreviewed('c.ts', files, statuses)
    expect(result).toBeNull()
  })

  it('returns null for empty files list', () => {
    const result = findPrevUnreviewed('a.ts', [], new Map())
    expect(result).toBeNull()
  })

  it('skips the current file even if it is unreviewed', () => {
    const statuses = new Map<string, FileReviewStatus>()
    // All unreviewed, current is c.ts - should return b.ts (prev)
    const result = findPrevUnreviewed('c.ts', files, statuses)
    expect(result).toBe('b.ts')
  })
})
