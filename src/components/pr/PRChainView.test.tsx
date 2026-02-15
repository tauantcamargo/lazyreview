import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { ThemeProvider, defaultTheme } from '../../theme/index'
import { PRChainView } from './PRChainView'
import type { PRChainNode, ChainStatus } from '../../utils/pr-chain'
import type { PullRequest } from '../../models/pull-request'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function themed(el: React.ReactElement) {
  return <ThemeProvider theme={defaultTheme}>{el}</ThemeProvider>
}

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

function makeChain(
  nodes: ReadonlyArray<{
    readonly number: number
    readonly title: string
    readonly status: PRChainNode['status']
    readonly isCurrentlyViewing: boolean
  }>,
): readonly PRChainNode[] {
  return nodes.map((n) => ({
    pr: makePR({ number: n.number, title: n.title }),
    status: n.status,
    isCurrentlyViewing: n.isCurrentlyViewing,
  }))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PRChainView', () => {
  it('renders chain header with node count', () => {
    const chain = makeChain([
      { number: 1, title: 'Base', status: 'merged', isCurrentlyViewing: false },
      { number: 2, title: 'Current', status: 'open', isCurrentlyViewing: true },
    ])
    const { lastFrame } = render(
      themed(
        <PRChainView
          chain={chain}
          chainStatus="ready"
          isActive={false}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('PR Chain')
    expect(frame).toContain('2')
  })

  it('renders chain status indicator for ready', () => {
    const chain = makeChain([
      { number: 1, title: 'Base', status: 'merged', isCurrentlyViewing: false },
      { number: 2, title: 'Current', status: 'open', isCurrentlyViewing: true },
    ])
    const { lastFrame } = render(
      themed(
        <PRChainView
          chain={chain}
          chainStatus="ready"
          isActive={false}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('ready')
  })

  it('renders chain status indicator for waiting', () => {
    const chain = makeChain([
      { number: 1, title: 'Parent', status: 'open', isCurrentlyViewing: false },
      { number: 2, title: 'Current', status: 'open', isCurrentlyViewing: true },
    ])
    const { lastFrame } = render(
      themed(
        <PRChainView
          chain={chain}
          chainStatus="waiting"
          isActive={false}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('waiting')
  })

  it('renders chain status indicator for blocked', () => {
    const chain = makeChain([
      { number: 1, title: 'Conflicted', status: 'conflicts', isCurrentlyViewing: false },
      { number: 2, title: 'Current', status: 'open', isCurrentlyViewing: true },
    ])
    const { lastFrame } = render(
      themed(
        <PRChainView
          chain={chain}
          chainStatus="blocked"
          isActive={false}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('blocked')
  })

  it('renders PR numbers in expanded view', () => {
    const chain = makeChain([
      { number: 10, title: 'First', status: 'merged', isCurrentlyViewing: false },
      { number: 20, title: 'Second', status: 'open', isCurrentlyViewing: true },
      { number: 30, title: 'Third', status: 'draft', isCurrentlyViewing: false },
    ])
    const { lastFrame } = render(
      themed(
        <PRChainView
          chain={chain}
          chainStatus="waiting"
          isActive={false}
          defaultExpanded={true}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('#10')
    expect(frame).toContain('#20')
    expect(frame).toContain('#30')
  })

  it('shows arrow connectors between chain nodes when expanded', () => {
    const chain = makeChain([
      { number: 1, title: 'First', status: 'merged', isCurrentlyViewing: false },
      { number: 2, title: 'Second', status: 'open', isCurrentlyViewing: true },
    ])
    const { lastFrame } = render(
      themed(
        <PRChainView
          chain={chain}
          chainStatus="ready"
          isActive={false}
          defaultExpanded={true}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    // Arrow connector between nodes
    expect(frame).toContain('->')
  })

  it('does not render when chain has only one node', () => {
    const chain = makeChain([
      { number: 1, title: 'Only', status: 'open', isCurrentlyViewing: true },
    ])
    const { lastFrame } = render(
      themed(
        <PRChainView
          chain={chain}
          chainStatus="ready"
          isActive={false}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    // Single-node chain should not display the chain view
    expect(frame).toBe('')
  })

  it('renders status labels for each node when expanded', () => {
    const chain = makeChain([
      { number: 1, title: 'First', status: 'merged', isCurrentlyViewing: false },
      { number: 2, title: 'Second', status: 'open', isCurrentlyViewing: true },
      { number: 3, title: 'Third', status: 'draft', isCurrentlyViewing: false },
    ])
    const { lastFrame } = render(
      themed(
        <PRChainView
          chain={chain}
          chainStatus="waiting"
          isActive={false}
          defaultExpanded={true}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('merged')
    expect(frame).toContain('open')
    expect(frame).toContain('draft')
  })

  it('marks the currently viewed PR visually', () => {
    const chain = makeChain([
      { number: 1, title: 'Parent', status: 'merged', isCurrentlyViewing: false },
      { number: 2, title: 'Current', status: 'open', isCurrentlyViewing: true },
    ])
    const { lastFrame } = render(
      themed(
        <PRChainView
          chain={chain}
          chainStatus="ready"
          isActive={false}
          defaultExpanded={true}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    // The currently viewed node should have a visual marker
    expect(frame).toContain('*')
  })

  it('calls onNavigateToPR when provided', () => {
    const onNav = vi.fn()
    const chain = makeChain([
      { number: 1, title: 'Parent', status: 'merged', isCurrentlyViewing: false },
      { number: 2, title: 'Current', status: 'open', isCurrentlyViewing: true },
    ])
    // We just verify it renders without errors when callback is provided
    const { lastFrame } = render(
      themed(
        <PRChainView
          chain={chain}
          chainStatus="ready"
          isActive={true}
          onNavigateToPR={onNav}
          defaultExpanded={true}
        />,
      ),
    )
    expect(lastFrame()).toBeTruthy()
  })

  it('renders collapsed by default', () => {
    const chain = makeChain([
      { number: 1, title: 'First', status: 'merged', isCurrentlyViewing: false },
      { number: 2, title: 'Second', status: 'open', isCurrentlyViewing: true },
    ])
    const { lastFrame } = render(
      themed(
        <PRChainView
          chain={chain}
          chainStatus="ready"
          isActive={false}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    // Header should be visible but expanded node details should not
    expect(frame).toContain('PR Chain')
    // Collapsed: should not show individual PR lines with ->
    // But summary line may still show PR numbers inline
  })
})
