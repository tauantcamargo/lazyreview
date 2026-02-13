import { describe, it, expect } from 'vitest'
import { Schema as S } from 'effect'
import { CheckRun, CheckRunsResponse, summarizeChecks } from './check'
import { getCheckRunUrl } from '../components/pr/ChecksTab'

describe('CheckRun schema', () => {
  const decode = S.decodeUnknownSync(CheckRun)

  it('decodes a completed check run', () => {
    const result = decode({
      id: 1,
      name: 'build',
      status: 'completed',
      conclusion: 'success',
    })
    expect(result.name).toBe('build')
    expect(result.conclusion).toBe('success')
    expect(result.details_url).toBeNull()
  })

  it('decodes check run with html_url and details_url', () => {
    const result = decode({
      id: 1,
      name: 'build',
      status: 'completed',
      conclusion: 'success',
      html_url: 'https://github.com/checks/1',
      details_url: 'https://ci.example.com/build/1',
    })
    expect(result.html_url).toBe('https://github.com/checks/1')
    expect(result.details_url).toBe('https://ci.example.com/build/1')
  })

  it('decodes check run with null details_url', () => {
    const result = decode({
      id: 1,
      name: 'build',
      status: 'completed',
      conclusion: 'success',
      html_url: 'https://github.com/checks/1',
      details_url: null,
    })
    expect(result.details_url).toBeNull()
  })

  it('decodes a queued check run', () => {
    const result = decode({
      id: 1,
      name: 'test',
      status: 'queued',
    })
    expect(result.status).toBe('queued')
    expect(result.conclusion).toBeNull()
  })

  it('decodes all valid conclusions', () => {
    const conclusions = [
      'success', 'failure', 'neutral', 'cancelled',
      'skipped', 'timed_out', 'action_required', 'stale',
    ] as const
    for (const conclusion of conclusions) {
      const result = decode({ id: 1, name: 'ci', status: 'completed', conclusion })
      expect(result.conclusion).toBe(conclusion)
    }
  })

  it('rejects invalid status', () => {
    expect(() => decode({ id: 1, name: 'ci', status: 'done' })).toThrow()
  })
})

describe('CheckRunsResponse schema', () => {
  const decode = S.decodeUnknownSync(CheckRunsResponse)

  it('decodes a valid response', () => {
    const result = decode({
      total_count: 2,
      check_runs: [
        { id: 1, name: 'build', status: 'completed', conclusion: 'success' },
        { id: 2, name: 'test', status: 'in_progress' },
      ],
    })
    expect(result.total_count).toBe(2)
    expect(result.check_runs).toHaveLength(2)
  })
})

describe('summarizeChecks', () => {
  it('returns neutral for empty array', () => {
    const result = summarizeChecks([])
    expect(result.conclusion).toBe('neutral')
    expect(result.total).toBe(0)
  })

  it('returns success when all checks pass', () => {
    const checks = [
      { id: 1, name: 'build', status: 'completed' as const, conclusion: 'success' as const, html_url: null },
      { id: 2, name: 'lint', status: 'completed' as const, conclusion: 'neutral' as const, html_url: null },
      { id: 3, name: 'skip', status: 'completed' as const, conclusion: 'skipped' as const, html_url: null },
    ]
    const result = summarizeChecks(checks)
    expect(result.conclusion).toBe('success')
    expect(result.passed).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.pending).toBe(0)
  })

  it('returns failure when any check fails', () => {
    const checks = [
      { id: 1, name: 'build', status: 'completed' as const, conclusion: 'success' as const, html_url: null },
      { id: 2, name: 'test', status: 'completed' as const, conclusion: 'failure' as const, html_url: null },
    ]
    const result = summarizeChecks(checks)
    expect(result.conclusion).toBe('failure')
    expect(result.passed).toBe(1)
    expect(result.failed).toBe(1)
  })

  it('returns pending when any check is in progress', () => {
    const checks = [
      { id: 1, name: 'build', status: 'completed' as const, conclusion: 'success' as const, html_url: null },
      { id: 2, name: 'deploy', status: 'in_progress' as const, conclusion: null, html_url: null },
    ]
    const result = summarizeChecks(checks)
    expect(result.conclusion).toBe('pending')
    expect(result.pending).toBe(1)
  })

  it('failure takes priority over pending', () => {
    const checks = [
      { id: 1, name: 'build', status: 'completed' as const, conclusion: 'failure' as const, html_url: null },
      { id: 2, name: 'deploy', status: 'queued' as const, conclusion: null, html_url: null },
    ]
    const result = summarizeChecks(checks)
    expect(result.conclusion).toBe('failure')
  })
})

describe('getCheckRunUrl', () => {
  it('returns details_url when available', () => {
    const run = {
      id: 1,
      name: 'build',
      status: 'completed' as const,
      conclusion: 'success' as const,
      html_url: 'https://github.com/checks/1',
      details_url: 'https://ci.example.com/build/1',
    }
    expect(getCheckRunUrl(run)).toBe('https://ci.example.com/build/1')
  })

  it('falls back to html_url when details_url is null', () => {
    const run = {
      id: 1,
      name: 'build',
      status: 'completed' as const,
      conclusion: 'success' as const,
      html_url: 'https://github.com/checks/1',
      details_url: null,
    }
    expect(getCheckRunUrl(run)).toBe('https://github.com/checks/1')
  })

  it('returns null when both urls are null', () => {
    const run = {
      id: 1,
      name: 'build',
      status: 'completed' as const,
      conclusion: null,
      html_url: null,
      details_url: null,
    }
    expect(getCheckRunUrl(run)).toBeNull()
  })

  it('returns html_url when details_url is missing', () => {
    const run = {
      id: 1,
      name: 'build',
      status: 'completed' as const,
      conclusion: 'success' as const,
      html_url: 'https://github.com/checks/1',
    }
    expect(getCheckRunUrl(run as CheckRun)).toBe('https://github.com/checks/1')
  })
})
