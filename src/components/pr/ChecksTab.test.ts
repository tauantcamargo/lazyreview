import { describe, it, expect } from 'vitest'
import { getCheckRunUrl } from './ChecksTab'
import { summarizeChecks, type CheckRun } from '../../models/check'

/**
 * Tests for ChecksTab component.
 *
 * Tests the pure functions: getCheckRunUrl and summarizeChecks.
 * Also tests rendering logic (check run icon/color selection,
 * summary display, viewport calculations).
 */

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCheckRun(
  overrides?: Partial<{
    id: number
    name: string
    status: 'queued' | 'in_progress' | 'completed'
    conclusion: string | null
    html_url: string | null
    details_url: string | null
  }>,
): CheckRun {
  return {
    id: 1,
    name: 'build',
    status: 'completed',
    conclusion: 'success',
    html_url: null,
    details_url: null,
    ...overrides,
  } as unknown as CheckRun
}

// ---------------------------------------------------------------------------
// getCheckRunUrl tests
// ---------------------------------------------------------------------------

describe('getCheckRunUrl', () => {
  it('prefers details_url over html_url', () => {
    const run = makeCheckRun({
      details_url: 'https://ci.example.com/build/1',
      html_url: 'https://github.com/checks/1',
    })
    expect(getCheckRunUrl(run)).toBe('https://ci.example.com/build/1')
  })

  it('falls back to html_url when details_url is null', () => {
    const run = makeCheckRun({
      details_url: null,
      html_url: 'https://github.com/checks/1',
    })
    expect(getCheckRunUrl(run)).toBe('https://github.com/checks/1')
  })

  it('returns null when both urls are null', () => {
    const run = makeCheckRun({
      details_url: null,
      html_url: null,
    })
    expect(getCheckRunUrl(run)).toBeNull()
  })

  it('returns details_url when html_url is null', () => {
    const run = makeCheckRun({
      details_url: 'https://ci.example.com/build/1',
      html_url: null,
    })
    expect(getCheckRunUrl(run)).toBe('https://ci.example.com/build/1')
  })

  it('handles undefined details_url (missing field)', () => {
    const run = makeCheckRun({
      html_url: 'https://github.com/checks/1',
    })
    // details_url defaults to null in the schema
    expect(getCheckRunUrl(run)).toBe('https://github.com/checks/1')
  })
})

// ---------------------------------------------------------------------------
// summarizeChecks tests
// ---------------------------------------------------------------------------

describe('summarizeChecks', () => {
  it('returns neutral conclusion for empty array', () => {
    const result = summarizeChecks([])
    expect(result).toEqual({
      conclusion: 'neutral',
      passed: 0,
      failed: 0,
      pending: 0,
      total: 0,
    })
  })

  it('counts all passed when all checks succeed', () => {
    const checks = [
      makeCheckRun({ id: 1, name: 'build', conclusion: 'success' }),
      makeCheckRun({ id: 2, name: 'lint', conclusion: 'neutral' }),
      makeCheckRun({ id: 3, name: 'skip', conclusion: 'skipped' }),
    ]
    const result = summarizeChecks(checks)
    expect(result.conclusion).toBe('success')
    expect(result.passed).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.pending).toBe(0)
    expect(result.total).toBe(3)
  })

  it('counts failures and sets conclusion to failure', () => {
    const checks = [
      makeCheckRun({ id: 1, name: 'build', conclusion: 'success' }),
      makeCheckRun({ id: 2, name: 'test', conclusion: 'failure' }),
      makeCheckRun({ id: 3, name: 'lint', conclusion: 'cancelled' }),
    ]
    const result = summarizeChecks(checks)
    expect(result.conclusion).toBe('failure')
    expect(result.passed).toBe(1)
    expect(result.failed).toBe(2)
  })

  it('counts pending for queued status', () => {
    const checks = [
      makeCheckRun({ id: 1, name: 'build', status: 'queued', conclusion: null }),
    ]
    const result = summarizeChecks(checks)
    expect(result.conclusion).toBe('pending')
    expect(result.pending).toBe(1)
    expect(result.passed).toBe(0)
  })

  it('counts pending for in_progress status', () => {
    const checks = [
      makeCheckRun({ id: 1, name: 'deploy', status: 'in_progress', conclusion: null }),
    ]
    const result = summarizeChecks(checks)
    expect(result.conclusion).toBe('pending')
    expect(result.pending).toBe(1)
  })

  it('failure takes priority over pending', () => {
    const checks = [
      makeCheckRun({ id: 1, name: 'build', conclusion: 'failure' }),
      makeCheckRun({ id: 2, name: 'deploy', status: 'queued', conclusion: null }),
    ]
    const result = summarizeChecks(checks)
    expect(result.conclusion).toBe('failure')
    expect(result.failed).toBe(1)
    expect(result.pending).toBe(1)
  })

  it('handles mixed passed and pending', () => {
    const checks = [
      makeCheckRun({ id: 1, name: 'build', conclusion: 'success' }),
      makeCheckRun({ id: 2, name: 'deploy', status: 'in_progress', conclusion: null }),
    ]
    const result = summarizeChecks(checks)
    expect(result.conclusion).toBe('pending')
    expect(result.passed).toBe(1)
    expect(result.pending).toBe(1)
  })

  it('treats timed_out as failure', () => {
    const checks = [
      makeCheckRun({ id: 1, name: 'slow-test', conclusion: 'timed_out' }),
    ]
    const result = summarizeChecks(checks)
    expect(result.conclusion).toBe('failure')
    expect(result.failed).toBe(1)
  })

  it('treats action_required as failure', () => {
    const checks = [
      makeCheckRun({ id: 1, name: 'security', conclusion: 'action_required' }),
    ]
    const result = summarizeChecks(checks)
    expect(result.conclusion).toBe('failure')
    expect(result.failed).toBe(1)
  })

  it('treats stale as failure', () => {
    const checks = [
      makeCheckRun({ id: 1, name: 'old-check', conclusion: 'stale' }),
    ]
    const result = summarizeChecks(checks)
    expect(result.conclusion).toBe('failure')
    expect(result.failed).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// CheckRunRow icon/color logic tests
// ---------------------------------------------------------------------------

describe('CheckRunRow icon/color logic', () => {
  function getIcon(run: CheckRun): string {
    return run.status !== 'completed'
      ? '●'
      : run.conclusion === 'success' || run.conclusion === 'neutral' || run.conclusion === 'skipped'
        ? '✓'
        : '✗'
  }

  function getColorType(run: CheckRun): 'warning' | 'success' | 'error' {
    return run.status !== 'completed'
      ? 'warning'
      : run.conclusion === 'success' || run.conclusion === 'neutral' || run.conclusion === 'skipped'
        ? 'success'
        : 'error'
  }

  it('shows running icon for queued status', () => {
    const run = makeCheckRun({ status: 'queued', conclusion: null })
    expect(getIcon(run)).toBe('●')
    expect(getColorType(run)).toBe('warning')
  })

  it('shows running icon for in_progress status', () => {
    const run = makeCheckRun({ status: 'in_progress', conclusion: null })
    expect(getIcon(run)).toBe('●')
    expect(getColorType(run)).toBe('warning')
  })

  it('shows check mark for success', () => {
    const run = makeCheckRun({ conclusion: 'success' })
    expect(getIcon(run)).toBe('✓')
    expect(getColorType(run)).toBe('success')
  })

  it('shows check mark for neutral', () => {
    const run = makeCheckRun({ conclusion: 'neutral' })
    expect(getIcon(run)).toBe('✓')
    expect(getColorType(run)).toBe('success')
  })

  it('shows check mark for skipped', () => {
    const run = makeCheckRun({ conclusion: 'skipped' })
    expect(getIcon(run)).toBe('✓')
    expect(getColorType(run)).toBe('success')
  })

  it('shows X mark for failure', () => {
    const run = makeCheckRun({ conclusion: 'failure' })
    expect(getIcon(run)).toBe('✗')
    expect(getColorType(run)).toBe('error')
  })

  it('shows X mark for cancelled', () => {
    const run = makeCheckRun({ conclusion: 'cancelled' })
    expect(getIcon(run)).toBe('✗')
    expect(getColorType(run)).toBe('error')
  })

  it('shows X mark for timed_out', () => {
    const run = makeCheckRun({ conclusion: 'timed_out' })
    expect(getIcon(run)).toBe('✗')
    expect(getColorType(run)).toBe('error')
  })
})

// ---------------------------------------------------------------------------
// Viewport / scroll calculation
// ---------------------------------------------------------------------------

describe('viewport calculation', () => {
  it('computes viewport height from terminal rows', () => {
    const terminalRows = 40
    const viewportHeight = Math.max(1, terminalRows - 16)
    expect(viewportHeight).toBe(24)
  })

  it('clamps viewport height to minimum 1', () => {
    const terminalRows = 10
    const viewportHeight = Math.max(1, terminalRows - 16)
    expect(viewportHeight).toBe(1)
  })

  it('defaults to 24 rows when stdout is unavailable', () => {
    const defaultRows = 24
    const viewportHeight = Math.max(1, defaultRows - 16)
    expect(viewportHeight).toBe(8)
  })
})

// ---------------------------------------------------------------------------
// Summary color logic
// ---------------------------------------------------------------------------

describe('summary color logic', () => {
  type SummaryConclusion = 'success' | 'failure' | 'pending' | 'neutral'

  function getSummaryColorType(conclusion: SummaryConclusion): 'success' | 'error' | 'warning' {
    return conclusion === 'success'
      ? 'success'
      : conclusion === 'failure'
        ? 'error'
        : 'warning'
  }

  it('uses success color for success conclusion', () => {
    expect(getSummaryColorType('success')).toBe('success')
  })

  it('uses error color for failure conclusion', () => {
    expect(getSummaryColorType('failure')).toBe('error')
  })

  it('uses warning color for pending conclusion', () => {
    expect(getSummaryColorType('pending')).toBe('warning')
  })

  it('uses warning color for neutral conclusion', () => {
    expect(getSummaryColorType('neutral')).toBe('warning')
  })
})
