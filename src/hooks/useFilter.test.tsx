import React, { useEffect } from 'react'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { Text, Box } from 'ink'
import type { PullRequest } from '../models/pull-request'
import { useFilter } from './useFilter'

function makePR(overrides: Partial<Record<string, unknown>> = {}): PullRequest {
  return {
    id: 1,
    number: 42,
    title: 'Test PR',
    body: null,
    state: 'open',
    draft: false,
    merged: false,
    user: { login: 'alice', avatar_url: '' },
    labels: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    html_url: 'https://github.com/owner/repo/pull/42',
    head: { ref: 'feature', sha: 'abc' },
    base: { ref: 'main', sha: 'def' },
    additions: 0,
    deletions: 0,
    changed_files: 0,
    comments: 0,
    review_comments: 0,
    requested_reviewers: [],
    ...overrides,
  } as unknown as PullRequest
}

const testItems: readonly PullRequest[] = [
  makePR({ id: 1, number: 1, title: 'Fix login bug', user: { login: 'alice', avatar_url: '' }, html_url: 'https://github.com/org/frontend/pull/1', labels: [{ id: 1, name: 'bug', color: 'ff0000', description: null }], updated_at: '2025-01-03T00:00:00Z' }),
  makePR({ id: 2, number: 2, title: 'Add dashboard', user: { login: 'bob', avatar_url: '' }, html_url: 'https://github.com/org/frontend/pull/2', labels: [{ id: 2, name: 'feature', color: '00ff00', description: null }], updated_at: '2025-01-04T00:00:00Z' }),
  makePR({ id: 3, number: 3, title: 'Refactor API', user: { login: 'alice', avatar_url: '' }, html_url: 'https://github.com/org/backend/pull/3', labels: [{ id: 1, name: 'bug', color: 'ff0000', description: null }, { id: 3, name: 'refactor', color: '0000ff', description: null }], updated_at: '2025-01-05T00:00:00Z' }),
]

function FilterTestComponent({
  items,
  action,
}: {
  readonly items: readonly PullRequest[]
  readonly action?: (hooks: ReturnType<typeof useFilter>) => void
}): React.ReactElement {
  const hooks = useFilter(items)

  useEffect(() => {
    if (action) {
      action(hooks)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box flexDirection="column">
      <Text>filtered:{hooks.filteredItems.length}</Text>
      <Text>active:{hooks.hasActiveFilters ? 'yes' : 'no'}</Text>
      <Text>sort:{hooks.filter.sortDirection}</Text>
      <Text>sortBy:{hooks.filter.sortBy}</Text>
      <Text>search:{hooks.filter.search || 'none'}</Text>
      <Text>repo:{hooks.filter.repo ?? 'none'}</Text>
      <Text>author:{hooks.filter.author ?? 'none'}</Text>
      <Text>label:{hooks.filter.label ?? 'none'}</Text>
      <Text>repos:{hooks.availableRepos.join(',')}</Text>
      <Text>authors:{hooks.availableAuthors.join(',')}</Text>
      <Text>labels:{hooks.availableLabels.join(',')}</Text>
      <Text>repoFacets:{hooks.repoFacets.map((f) => `${f.value}(${f.count})`).join(',')}</Text>
      <Text>authorFacets:{hooks.authorFacets.map((f) => `${f.value}(${f.count})`).join(',')}</Text>
      <Text>labelFacets:{hooks.labelFacets.map((f) => `${f.value}(${f.count})`).join(',')}</Text>
    </Box>
  )
}

function extractValue(frame: string | undefined, key: string): string {
  const match = frame?.match(new RegExp(`${key}:(.+)`))
  return match?.[1]?.trim() ?? ''
}

function delay(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('useFilter hook', () => {
  it('returns all items with no filters', () => {
    const { lastFrame } = render(
      <FilterTestComponent items={testItems} />,
    )
    expect(extractValue(lastFrame(), 'filtered')).toBe('3')
    expect(extractValue(lastFrame(), 'active')).toBe('no')
  })

  it('filters items when setSearch is called', async () => {
    const { lastFrame } = render(
      <FilterTestComponent
        items={testItems}
        action={(hooks) => hooks.setSearch('login')}
      />,
    )
    await delay()
    expect(extractValue(lastFrame(), 'filtered')).toBe('1')
    expect(extractValue(lastFrame(), 'search')).toBe('login')
    expect(extractValue(lastFrame(), 'active')).toBe('yes')
  })

  it('filters items when setRepo is called', async () => {
    const { lastFrame } = render(
      <FilterTestComponent
        items={testItems}
        action={(hooks) => hooks.setRepo('org/backend')}
      />,
    )
    await delay()
    expect(extractValue(lastFrame(), 'filtered')).toBe('1')
    expect(extractValue(lastFrame(), 'repo')).toBe('org/backend')
    expect(extractValue(lastFrame(), 'active')).toBe('yes')
  })

  it('filters items when setAuthor is called', async () => {
    const { lastFrame } = render(
      <FilterTestComponent
        items={testItems}
        action={(hooks) => hooks.setAuthor('bob')}
      />,
    )
    await delay()
    expect(extractValue(lastFrame(), 'filtered')).toBe('1')
    expect(extractValue(lastFrame(), 'author')).toBe('bob')
    expect(extractValue(lastFrame(), 'active')).toBe('yes')
  })

  it('filters items when setLabel is called', async () => {
    const { lastFrame } = render(
      <FilterTestComponent
        items={testItems}
        action={(hooks) => hooks.setLabel('feature')}
      />,
    )
    await delay()
    expect(extractValue(lastFrame(), 'filtered')).toBe('1')
    expect(extractValue(lastFrame(), 'label')).toBe('feature')
    expect(extractValue(lastFrame(), 'active')).toBe('yes')
  })

  it('clears all filters with clearFilters', async () => {
    const { lastFrame } = render(
      <FilterTestComponent
        items={testItems}
        action={(hooks) => {
          hooks.setSearch('login')
          hooks.setRepo('org/frontend')
          hooks.clearFilters()
        }}
      />,
    )
    await delay()
    expect(extractValue(lastFrame(), 'filtered')).toBe('3')
    expect(extractValue(lastFrame(), 'active')).toBe('no')
    expect(extractValue(lastFrame(), 'search')).toBe('none')
    expect(extractValue(lastFrame(), 'repo')).toBe('none')
  })

  it('toggles sort direction', async () => {
    const { lastFrame } = render(
      <FilterTestComponent
        items={testItems}
        action={(hooks) => hooks.toggleSortDirection()}
      />,
    )
    await delay()
    expect(extractValue(lastFrame(), 'sort')).toBe('asc')
  })

  it('toggles sort direction back to desc', async () => {
    const { lastFrame } = render(
      <FilterTestComponent
        items={testItems}
        action={(hooks) => {
          hooks.toggleSortDirection()
          hooks.toggleSortDirection()
        }}
      />,
    )
    await delay()
    expect(extractValue(lastFrame(), 'sort')).toBe('desc')
  })

  it('changes sort field with setSortBy', async () => {
    const { lastFrame } = render(
      <FilterTestComponent
        items={testItems}
        action={(hooks) => hooks.setSortBy('created')}
      />,
    )
    await delay()
    expect(extractValue(lastFrame(), 'sortBy')).toBe('created')
  })

  it('computes available repos', () => {
    const { lastFrame } = render(
      <FilterTestComponent items={testItems} />,
    )
    const repos = extractValue(lastFrame(), 'repos')
    expect(repos).toContain('org/backend')
    expect(repos).toContain('org/frontend')
  })

  it('computes available authors', () => {
    const { lastFrame } = render(
      <FilterTestComponent items={testItems} />,
    )
    const authors = extractValue(lastFrame(), 'authors')
    expect(authors).toContain('alice')
    expect(authors).toContain('bob')
  })

  it('computes available labels', () => {
    const { lastFrame } = render(
      <FilterTestComponent items={testItems} />,
    )
    const labels = extractValue(lastFrame(), 'labels')
    expect(labels).toContain('bug')
    expect(labels).toContain('feature')
    expect(labels).toContain('refactor')
  })

  it('computes repo facets with counts', () => {
    const { lastFrame } = render(
      <FilterTestComponent items={testItems} />,
    )
    const facets = extractValue(lastFrame(), 'repoFacets')
    expect(facets).toContain('org/frontend(2)')
    expect(facets).toContain('org/backend(1)')
  })

  it('computes author facets with counts', () => {
    const { lastFrame } = render(
      <FilterTestComponent items={testItems} />,
    )
    const facets = extractValue(lastFrame(), 'authorFacets')
    expect(facets).toContain('alice(2)')
    expect(facets).toContain('bob(1)')
  })

  it('computes label facets with counts', () => {
    const { lastFrame } = render(
      <FilterTestComponent items={testItems} />,
    )
    const facets = extractValue(lastFrame(), 'labelFacets')
    expect(facets).toContain('bug(2)')
    expect(facets).toContain('feature(1)')
    expect(facets).toContain('refactor(1)')
  })

  it('hasActiveFilters is false with default state', () => {
    const { lastFrame } = render(
      <FilterTestComponent items={testItems} />,
    )
    expect(extractValue(lastFrame(), 'active')).toBe('no')
  })

  it('hasActiveFilters is true when search is set', async () => {
    const { lastFrame } = render(
      <FilterTestComponent
        items={testItems}
        action={(hooks) => hooks.setSearch('test')}
      />,
    )
    await delay()
    expect(extractValue(lastFrame(), 'active')).toBe('yes')
  })

  it('hasActiveFilters is true when author is set', async () => {
    const { lastFrame } = render(
      <FilterTestComponent
        items={testItems}
        action={(hooks) => hooks.setAuthor('alice')}
      />,
    )
    await delay()
    expect(extractValue(lastFrame(), 'active')).toBe('yes')
  })

  it('hasActiveFilters is true when label is set', async () => {
    const { lastFrame } = render(
      <FilterTestComponent
        items={testItems}
        action={(hooks) => hooks.setLabel('bug')}
      />,
    )
    await delay()
    expect(extractValue(lastFrame(), 'active')).toBe('yes')
  })

  it('returns empty arrays for empty items', () => {
    const { lastFrame } = render(
      <FilterTestComponent items={[]} />,
    )
    expect(extractValue(lastFrame(), 'filtered')).toBe('0')
    expect(extractValue(lastFrame(), 'repos')).toBe('')
    expect(extractValue(lastFrame(), 'authors')).toBe('')
    expect(extractValue(lastFrame(), 'labels')).toBe('')
  })

  it('hasActiveFilters is true when repo is set', async () => {
    const { lastFrame } = render(
      <FilterTestComponent
        items={testItems}
        action={(hooks) => hooks.setRepo('org/frontend')}
      />,
    )
    await delay()
    expect(extractValue(lastFrame(), 'active')).toBe('yes')
  })

  it('clearFilters resets sort fields too', async () => {
    const { lastFrame } = render(
      <FilterTestComponent
        items={testItems}
        action={(hooks) => {
          hooks.setSortBy('title')
          hooks.toggleSortDirection()
          hooks.clearFilters()
        }}
      />,
    )
    await delay()
    expect(extractValue(lastFrame(), 'sortBy')).toBe('updated')
    expect(extractValue(lastFrame(), 'sort')).toBe('desc')
  })
})
