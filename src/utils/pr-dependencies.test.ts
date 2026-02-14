import { describe, it, expect } from 'vitest'
import {
  parseDependencyReferences,
  buildDependencyChain,
  type DependencyNode,
} from './pr-dependencies'
import type { PullRequest } from '../models/pull-request'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makePR(overrides: Partial<Record<string, unknown>>): PullRequest {
  return {
    id: 1,
    number: 1,
    title: 'Test PR',
    body: null,
    state: 'open',
    draft: false,
    merged: false,
    user: { login: 'author', avatar_url: '', id: 1, html_url: '' },
    labels: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    html_url: 'https://github.com/owner/repo/pull/1',
    head: { ref: 'feature', sha: 'abc' },
    base: { ref: 'main', sha: 'def' },
    additions: 0,
    deletions: 0,
    changed_files: 0,
    comments: 0,
    review_comments: 0,
    requested_reviewers: [],
    assignees: [],
    ...overrides,
  } as unknown as PullRequest
}

// ---------------------------------------------------------------------------
// parseDependencyReferences
// ---------------------------------------------------------------------------

describe('parseDependencyReferences', () => {
  it('extracts "Depends on #N" references', () => {
    const body = 'This PR depends on #42 for the base types.'
    const result = parseDependencyReferences(body)
    expect(result).toEqual([42])
  })

  it('extracts "Blocked by #N" references', () => {
    const body = 'Blocked by #99 - waiting for API changes.'
    const result = parseDependencyReferences(body)
    expect(result).toEqual([99])
  })

  it('extracts "Stacks on #N" references', () => {
    const body = 'Stacks on #15 for the auth layer.'
    const result = parseDependencyReferences(body)
    expect(result).toEqual([15])
  })

  it('is case-insensitive', () => {
    const body = 'DEPENDS ON #10\nBLOCKED BY #20\nSTACKS ON #30'
    const result = parseDependencyReferences(body)
    expect(result).toEqual([10, 20, 30])
  })

  it('extracts multiple references from the same body', () => {
    const body =
      'Depends on #1 and depends on #2.\nAlso blocked by #3.'
    const result = parseDependencyReferences(body)
    expect(result).toEqual([1, 2, 3])
  })

  it('returns empty array when body has no references', () => {
    const body = 'Just a normal PR description with no dependency info.'
    const result = parseDependencyReferences(body)
    expect(result).toEqual([])
  })

  it('returns empty array for null/undefined body', () => {
    expect(parseDependencyReferences(null)).toEqual([])
    expect(parseDependencyReferences(undefined)).toEqual([])
    expect(parseDependencyReferences('')).toEqual([])
  })

  it('deduplicates repeated references', () => {
    const body = 'Depends on #5. Also depends on #5 again.'
    const result = parseDependencyReferences(body)
    expect(result).toEqual([5])
  })

  it('does not match partial patterns like "#N" alone', () => {
    const body = 'See #42 for context. PR #99 is related.'
    const result = parseDependencyReferences(body)
    expect(result).toEqual([])
  })

  it('handles "depends on" with extra whitespace', () => {
    const body = 'depends  on  #7'
    const result = parseDependencyReferences(body)
    expect(result).toEqual([7])
  })
})

// ---------------------------------------------------------------------------
// buildDependencyChain
// ---------------------------------------------------------------------------

describe('buildDependencyChain', () => {
  it('detects stacked-on relationship via base branch matching', () => {
    const pr = makePR({
      number: 2,
      base: { ref: 'feature-a', sha: 'x' },
      head: { ref: 'feature-b', sha: 'y' },
      body: null,
    })
    const allPRs: readonly PullRequest[] = [
      makePR({
        number: 1,
        title: 'Feature A',
        state: 'open',
        head: { ref: 'feature-a', sha: 'z' },
        base: { ref: 'main', sha: 'w' },
      }),
      pr,
    ]
    const result = buildDependencyChain(pr, allPRs)
    expect(result).toEqual([
      {
        prNumber: 1,
        title: 'Feature A',
        state: 'open',
        relationship: 'stacked-on',
      },
    ])
  })

  it('detects blocks relationship (another PR is based on this PR head)', () => {
    const pr = makePR({
      number: 1,
      head: { ref: 'feature-a', sha: 'x' },
      base: { ref: 'main', sha: 'y' },
      body: null,
    })
    const allPRs: readonly PullRequest[] = [
      pr,
      makePR({
        number: 2,
        title: 'Feature B (stacked)',
        state: 'open',
        head: { ref: 'feature-b', sha: 'z' },
        base: { ref: 'feature-a', sha: 'w' },
      }),
    ]
    const result = buildDependencyChain(pr, allPRs)
    expect(result).toEqual([
      {
        prNumber: 2,
        title: 'Feature B (stacked)',
        state: 'open',
        relationship: 'blocks',
      },
    ])
  })

  it('detects depends-on from body references', () => {
    const pr = makePR({
      number: 3,
      body: 'Depends on #1',
      base: { ref: 'main', sha: 'a' },
      head: { ref: 'feature-c', sha: 'b' },
    })
    const allPRs: readonly PullRequest[] = [
      makePR({
        number: 1,
        title: 'Base feature',
        state: 'merged',
        merged: true,
        head: { ref: 'feature-a', sha: 'c' },
        base: { ref: 'main', sha: 'd' },
      }),
      pr,
    ]
    const result = buildDependencyChain(pr, allPRs)
    expect(result).toEqual([
      {
        prNumber: 1,
        title: 'Base feature',
        state: 'merged',
        relationship: 'depends-on',
      },
    ])
  })

  it('combines branch-based and body-based dependencies', () => {
    const pr = makePR({
      number: 3,
      body: 'Depends on #1',
      base: { ref: 'feature-b', sha: 'a' },
      head: { ref: 'feature-c', sha: 'b' },
    })
    const allPRs: readonly PullRequest[] = [
      makePR({
        number: 1,
        title: 'Base types',
        state: 'open',
        head: { ref: 'feature-a', sha: 'c' },
        base: { ref: 'main', sha: 'd' },
      }),
      makePR({
        number: 2,
        title: 'Feature B',
        state: 'open',
        head: { ref: 'feature-b', sha: 'e' },
        base: { ref: 'feature-a', sha: 'f' },
      }),
      pr,
    ]
    const result = buildDependencyChain(pr, allPRs)
    expect(result).toHaveLength(2)
    expect(result).toContainEqual({
      prNumber: 2,
      title: 'Feature B',
      state: 'open',
      relationship: 'stacked-on',
    })
    expect(result).toContainEqual({
      prNumber: 1,
      title: 'Base types',
      state: 'open',
      relationship: 'depends-on',
    })
  })

  it('returns empty array when no dependencies found', () => {
    const pr = makePR({
      number: 1,
      body: 'Just a normal PR',
      base: { ref: 'main', sha: 'a' },
      head: { ref: 'feature', sha: 'b' },
    })
    const allPRs: readonly PullRequest[] = [pr]
    const result = buildDependencyChain(pr, allPRs)
    expect(result).toEqual([])
  })

  it('does not include self-references', () => {
    const pr = makePR({
      number: 5,
      body: 'Depends on #5',
      base: { ref: 'main', sha: 'a' },
      head: { ref: 'feature', sha: 'b' },
    })
    const allPRs: readonly PullRequest[] = [pr]
    const result = buildDependencyChain(pr, allPRs)
    expect(result).toEqual([])
  })

  it('deduplicates when body and branch both point to same PR', () => {
    const pr = makePR({
      number: 2,
      body: 'Depends on #1',
      base: { ref: 'feature-a', sha: 'x' },
      head: { ref: 'feature-b', sha: 'y' },
    })
    const allPRs: readonly PullRequest[] = [
      makePR({
        number: 1,
        title: 'Feature A',
        state: 'open',
        head: { ref: 'feature-a', sha: 'z' },
        base: { ref: 'main', sha: 'w' },
      }),
      pr,
    ]
    const result = buildDependencyChain(pr, allPRs)
    // Should only appear once; branch-based stacked-on takes priority
    expect(result).toHaveLength(1)
    expect(result[0].prNumber).toBe(1)
  })

  it('uses merged state for closed+merged PRs', () => {
    const pr = makePR({
      number: 2,
      body: 'Depends on #1',
      base: { ref: 'main', sha: 'a' },
      head: { ref: 'feature-b', sha: 'b' },
    })
    const allPRs: readonly PullRequest[] = [
      makePR({
        number: 1,
        title: 'Already merged',
        state: 'closed',
        merged: true,
        head: { ref: 'feature-a', sha: 'c' },
        base: { ref: 'main', sha: 'd' },
      }),
      pr,
    ]
    const result = buildDependencyChain(pr, allPRs)
    expect(result).toEqual([
      {
        prNumber: 1,
        title: 'Already merged',
        state: 'merged',
        relationship: 'depends-on',
      },
    ])
  })

  it('skips body references not found in allPRs', () => {
    const pr = makePR({
      number: 2,
      body: 'Depends on #999',
      base: { ref: 'main', sha: 'a' },
      head: { ref: 'feature', sha: 'b' },
    })
    const allPRs: readonly PullRequest[] = [pr]
    const result = buildDependencyChain(pr, allPRs)
    expect(result).toEqual([])
  })

  it('handles PR with empty head/base refs gracefully', () => {
    const pr = makePR({
      number: 1,
      body: null,
      base: { ref: '', sha: '' },
      head: { ref: '', sha: '' },
    })
    const allPRs: readonly PullRequest[] = [pr]
    const result = buildDependencyChain(pr, allPRs)
    expect(result).toEqual([])
  })
})
