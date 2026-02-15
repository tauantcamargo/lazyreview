import { describe, it, expect } from 'vitest'
import {
  detectPRChain,
  computeChainStatus,
  findCurrentInChain,
  type PRChainNode,
  type ChainStatus,
} from './pr-chain'
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
    mergeable: null,
    mergeable_state: null,
    ...overrides,
  } as unknown as PullRequest
}

// ---------------------------------------------------------------------------
// detectPRChain
// ---------------------------------------------------------------------------

describe('detectPRChain', () => {
  it('returns a single-node chain when the PR has no relationships', () => {
    const pr = makePR({ number: 1 })
    const chain = detectPRChain(pr, [pr])
    expect(chain).toHaveLength(1)
    expect(chain[0].pr.number).toBe(1)
    expect(chain[0].isCurrentlyViewing).toBe(true)
  })

  it('detects a two-PR chain via branch stacking (parent -> child)', () => {
    const parent = makePR({
      number: 1,
      title: 'Parent PR',
      head: { ref: 'feature-a', sha: 'a1' },
      base: { ref: 'main', sha: 'b1' },
    })
    const child = makePR({
      number: 2,
      title: 'Child PR',
      head: { ref: 'feature-b', sha: 'a2' },
      base: { ref: 'feature-a', sha: 'b2' },
    })
    const allPRs = [parent, child]

    // When viewing the child, chain should be parent -> child
    const chain = detectPRChain(child, allPRs)
    expect(chain).toHaveLength(2)
    expect(chain[0].pr.number).toBe(1)
    expect(chain[1].pr.number).toBe(2)
    expect(chain[1].isCurrentlyViewing).toBe(true)
    expect(chain[0].isCurrentlyViewing).toBe(false)
  })

  it('detects a three-PR chain via branch stacking', () => {
    const pr1 = makePR({
      number: 1,
      title: 'Base',
      head: { ref: 'feature-a', sha: 'a1' },
      base: { ref: 'main', sha: 'b1' },
      merged: true,
      state: 'closed',
    })
    const pr2 = makePR({
      number: 2,
      title: 'Middle',
      head: { ref: 'feature-b', sha: 'a2' },
      base: { ref: 'feature-a', sha: 'b2' },
    })
    const pr3 = makePR({
      number: 3,
      title: 'Top',
      head: { ref: 'feature-c', sha: 'a3' },
      base: { ref: 'feature-b', sha: 'b3' },
      draft: true,
    })
    const allPRs = [pr1, pr2, pr3]

    const chain = detectPRChain(pr2, allPRs)
    expect(chain).toHaveLength(3)
    expect(chain[0].pr.number).toBe(1)
    expect(chain[1].pr.number).toBe(2)
    expect(chain[2].pr.number).toBe(3)
    expect(chain[1].isCurrentlyViewing).toBe(true)
  })

  it('detects chain from description references (Depends on #N)', () => {
    const pr1 = makePR({
      number: 10,
      title: 'Dep target',
      head: { ref: 'feat-x', sha: 'a1' },
      base: { ref: 'main', sha: 'b1' },
    })
    const pr2 = makePR({
      number: 20,
      title: 'Current',
      body: 'Depends on #10',
      head: { ref: 'feat-y', sha: 'a2' },
      base: { ref: 'main', sha: 'b2' },
    })
    const allPRs = [pr1, pr2]

    const chain = detectPRChain(pr2, allPRs)
    expect(chain).toHaveLength(2)
    expect(chain[0].pr.number).toBe(10)
    expect(chain[1].pr.number).toBe(20)
  })

  it('returns ordered chain when viewing from the middle', () => {
    const pr1 = makePR({
      number: 1,
      head: { ref: 'a', sha: '1' },
      base: { ref: 'main', sha: '0' },
    })
    const pr2 = makePR({
      number: 2,
      head: { ref: 'b', sha: '2' },
      base: { ref: 'a', sha: '1' },
    })
    const pr3 = makePR({
      number: 3,
      head: { ref: 'c', sha: '3' },
      base: { ref: 'b', sha: '2' },
    })
    const chain = detectPRChain(pr2, [pr1, pr2, pr3])
    expect(chain.map((n) => n.pr.number)).toEqual([1, 2, 3])
    expect(chain[1].isCurrentlyViewing).toBe(true)
  })

  it('assigns correct status for merged PRs', () => {
    const pr1 = makePR({
      number: 1,
      state: 'closed',
      merged: true,
      head: { ref: 'a', sha: '1' },
      base: { ref: 'main', sha: '0' },
    })
    const pr2 = makePR({
      number: 2,
      head: { ref: 'b', sha: '2' },
      base: { ref: 'a', sha: '1' },
    })
    const chain = detectPRChain(pr2, [pr1, pr2])
    expect(chain[0].status).toBe('merged')
  })

  it('assigns draft status for draft PRs', () => {
    const pr1 = makePR({
      number: 1,
      head: { ref: 'a', sha: '1' },
      base: { ref: 'main', sha: '0' },
    })
    const pr2 = makePR({
      number: 2,
      draft: true,
      head: { ref: 'b', sha: '2' },
      base: { ref: 'a', sha: '1' },
    })
    const chain = detectPRChain(pr2, [pr1, pr2])
    expect(chain[1].status).toBe('draft')
  })

  it('assigns conflicts status for PRs with mergeable_state "dirty"', () => {
    const pr1 = makePR({
      number: 1,
      head: { ref: 'a', sha: '1' },
      base: { ref: 'main', sha: '0' },
    })
    const pr2 = makePR({
      number: 2,
      mergeable: false,
      mergeable_state: 'dirty',
      head: { ref: 'b', sha: '2' },
      base: { ref: 'a', sha: '1' },
    })
    const chain = detectPRChain(pr2, [pr1, pr2])
    expect(chain[1].status).toBe('conflicts')
  })

  it('does not duplicate PRs in the chain', () => {
    // Body reference matches the same PR as branch stacking
    const pr1 = makePR({
      number: 1,
      head: { ref: 'a', sha: '1' },
      base: { ref: 'main', sha: '0' },
    })
    const pr2 = makePR({
      number: 2,
      body: 'Depends on #1',
      head: { ref: 'b', sha: '2' },
      base: { ref: 'a', sha: '1' },
    })
    const chain = detectPRChain(pr2, [pr1, pr2])
    expect(chain).toHaveLength(2)
  })

  it('returns single node for PR with no allPRs context', () => {
    const pr = makePR({ number: 5 })
    const chain = detectPRChain(pr, [pr])
    expect(chain).toHaveLength(1)
    expect(chain[0].pr.number).toBe(5)
    expect(chain[0].isCurrentlyViewing).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// computeChainStatus
// ---------------------------------------------------------------------------

describe('computeChainStatus', () => {
  it('returns "ready" when all parents are merged', () => {
    const chain: readonly PRChainNode[] = [
      {
        pr: makePR({ number: 1, state: 'closed', merged: true }),
        status: 'merged',
        isCurrentlyViewing: false,
      },
      {
        pr: makePR({ number: 2 }),
        status: 'open',
        isCurrentlyViewing: true,
      },
    ]
    expect(computeChainStatus(chain)).toBe('ready')
  })

  it('returns "waiting" when parent is open but no conflicts', () => {
    const chain: readonly PRChainNode[] = [
      {
        pr: makePR({ number: 1 }),
        status: 'open',
        isCurrentlyViewing: false,
      },
      {
        pr: makePR({ number: 2 }),
        status: 'open',
        isCurrentlyViewing: true,
      },
    ]
    expect(computeChainStatus(chain)).toBe('waiting')
  })

  it('returns "blocked" when any PR in chain has conflicts', () => {
    const chain: readonly PRChainNode[] = [
      {
        pr: makePR({ number: 1 }),
        status: 'conflicts',
        isCurrentlyViewing: false,
      },
      {
        pr: makePR({ number: 2 }),
        status: 'open',
        isCurrentlyViewing: true,
      },
    ]
    expect(computeChainStatus(chain)).toBe('blocked')
  })

  it('returns "ready" for a single-node chain', () => {
    const chain: readonly PRChainNode[] = [
      {
        pr: makePR({ number: 1 }),
        status: 'open',
        isCurrentlyViewing: true,
      },
    ]
    expect(computeChainStatus(chain)).toBe('ready')
  })

  it('returns "waiting" when parent is in draft status', () => {
    const chain: readonly PRChainNode[] = [
      {
        pr: makePR({ number: 1, draft: true }),
        status: 'draft',
        isCurrentlyViewing: false,
      },
      {
        pr: makePR({ number: 2 }),
        status: 'open',
        isCurrentlyViewing: true,
      },
    ]
    expect(computeChainStatus(chain)).toBe('waiting')
  })
})

// ---------------------------------------------------------------------------
// findCurrentInChain
// ---------------------------------------------------------------------------

describe('findCurrentInChain', () => {
  it('returns the index of the currently viewed PR', () => {
    const currentPR = makePR({ number: 2 })
    const chain: readonly PRChainNode[] = [
      { pr: makePR({ number: 1 }), status: 'merged', isCurrentlyViewing: false },
      { pr: currentPR, status: 'open', isCurrentlyViewing: true },
      { pr: makePR({ number: 3 }), status: 'draft', isCurrentlyViewing: false },
    ]
    expect(findCurrentInChain(chain, currentPR)).toBe(1)
  })

  it('returns -1 when the PR is not in the chain', () => {
    const currentPR = makePR({ number: 99 })
    const chain: readonly PRChainNode[] = [
      { pr: makePR({ number: 1 }), status: 'open', isCurrentlyViewing: false },
    ]
    expect(findCurrentInChain(chain, currentPR)).toBe(-1)
  })

  it('returns 0 for a single-node chain', () => {
    const pr = makePR({ number: 5 })
    const chain: readonly PRChainNode[] = [
      { pr, status: 'open', isCurrentlyViewing: true },
    ]
    expect(findCurrentInChain(chain, pr)).toBe(0)
  })
})
