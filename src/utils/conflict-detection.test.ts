import { describe, it, expect } from 'vitest'
import { detectConflictState } from './conflict-detection'

function makePR(
  mergeable: boolean | null,
  mergeable_state: string | null,
): { readonly mergeable: boolean | null; readonly mergeable_state: string | null } {
  return { mergeable, mergeable_state }
}

describe('detectConflictState', () => {
  it('returns no conflicts when mergeable is true and state is clean', () => {
    const result = detectConflictState(makePR(true, 'clean'))
    expect(result.hasConflicts).toBe(false)
    expect(result.mergeableState).toBe('clean')
    expect(result.conflictMessage).toBe('')
  })

  it('returns conflicts when mergeable is false and state is dirty', () => {
    const result = detectConflictState(makePR(false, 'dirty'))
    expect(result.hasConflicts).toBe(true)
    expect(result.mergeableState).toBe('dirty')
    expect(result.conflictMessage).toContain('merge conflicts')
  })

  it('returns no conflicts but CI failing for unstable state', () => {
    const result = detectConflictState(makePR(true, 'unstable'))
    expect(result.hasConflicts).toBe(false)
    expect(result.mergeableState).toBe('unstable')
    expect(result.conflictMessage).toContain('CI')
  })

  it('returns no conflicts but blocked for blocked state', () => {
    const result = detectConflictState(makePR(true, 'blocked'))
    expect(result.hasConflicts).toBe(false)
    expect(result.mergeableState).toBe('blocked')
    expect(result.conflictMessage).toContain('blocked')
  })

  it('returns no conflicts but needs update for behind state', () => {
    const result = detectConflictState(makePR(true, 'behind'))
    expect(result.hasConflicts).toBe(false)
    expect(result.mergeableState).toBe('behind')
    expect(result.conflictMessage).toContain('behind')
  })

  it('returns computing state when mergeable is null', () => {
    const result = detectConflictState(makePR(null, null))
    expect(result.hasConflicts).toBe(false)
    expect(result.mergeableState).toBe(null)
    expect(result.conflictMessage).toContain('computing')
  })

  it('returns computing state when mergeable is null even with unknown state', () => {
    const result = detectConflictState(makePR(null, 'unknown'))
    expect(result.hasConflicts).toBe(false)
    expect(result.mergeableState).toBe('unknown')
    expect(result.conflictMessage).toContain('computing')
  })

  it('returns no conflicts when mergeable is true and state is null', () => {
    const result = detectConflictState(makePR(true, null))
    expect(result.hasConflicts).toBe(false)
    expect(result.mergeableState).toBe(null)
    expect(result.conflictMessage).toBe('')
  })

  it('returns conflicts when mergeable is false and state is null', () => {
    const result = detectConflictState(makePR(false, null))
    expect(result.hasConflicts).toBe(true)
    expect(result.mergeableState).toBe(null)
    expect(result.conflictMessage).toContain('merge conflicts')
  })

  it('returns conflicts when mergeable is false regardless of state string', () => {
    const result = detectConflictState(makePR(false, 'clean'))
    expect(result.hasConflicts).toBe(true)
    expect(result.conflictMessage).toContain('merge conflicts')
  })

  it('handles unknown mergeable_state gracefully', () => {
    const result = detectConflictState(makePR(true, 'some_future_state'))
    expect(result.hasConflicts).toBe(false)
    expect(result.mergeableState).toBe('some_future_state')
    expect(result.conflictMessage).toBe('')
  })
})
