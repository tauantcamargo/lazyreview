import { describe, it, expect } from 'vitest'
import {
  addRecentRepoToList,
  removeRecentRepoFromList,
  sortByMostRecent,
} from './useRecentRepos'
import type { RecentRepo } from '../services/Config'

describe('addRecentRepoToList', () => {
  it('adds a new repo to an empty list', () => {
    const result = addRecentRepoToList([], 'facebook', 'react', '2026-01-01T00:00:00Z')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      owner: 'facebook',
      repo: 'react',
      lastUsed: '2026-01-01T00:00:00Z',
    })
  })

  it('adds a new repo to the front of the list', () => {
    const existing: RecentRepo[] = [
      { owner: 'vercel', repo: 'next.js', lastUsed: '2026-01-01T00:00:00Z' },
    ]
    const result = addRecentRepoToList(existing, 'facebook', 'react', '2026-01-02T00:00:00Z')
    expect(result).toHaveLength(2)
    expect(result[0]?.owner).toBe('facebook')
    expect(result[1]?.owner).toBe('vercel')
  })

  it('bumps existing repo to the top with updated timestamp', () => {
    const existing: RecentRepo[] = [
      { owner: 'facebook', repo: 'react', lastUsed: '2026-01-01T00:00:00Z' },
      { owner: 'vercel', repo: 'next.js', lastUsed: '2026-01-02T00:00:00Z' },
    ]
    const result = addRecentRepoToList(existing, 'vercel', 'next.js', '2026-01-03T00:00:00Z')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      owner: 'vercel',
      repo: 'next.js',
      lastUsed: '2026-01-03T00:00:00Z',
    })
    expect(result[1]?.owner).toBe('facebook')
  })

  it('caps at 10 entries, dropping the last', () => {
    const existing: RecentRepo[] = Array.from({ length: 10 }, (_, i) => ({
      owner: `owner-${i}`,
      repo: `repo-${i}`,
      lastUsed: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }))
    const result = addRecentRepoToList(existing, 'new-owner', 'new-repo', '2026-02-01T00:00:00Z')
    expect(result).toHaveLength(10)
    expect(result[0]?.owner).toBe('new-owner')
    // The last of the original 10 should be dropped
    expect(result.find((r) => r.owner === 'owner-9')).toBeUndefined()
  })

  it('does not duplicate when bumping in a full list', () => {
    const existing: RecentRepo[] = Array.from({ length: 10 }, (_, i) => ({
      owner: `owner-${i}`,
      repo: `repo-${i}`,
      lastUsed: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }))
    // Bump owner-5 to top
    const result = addRecentRepoToList(existing, 'owner-5', 'repo-5', '2026-02-01T00:00:00Z')
    expect(result).toHaveLength(10)
    expect(result[0]?.owner).toBe('owner-5')
    expect(result[0]?.lastUsed).toBe('2026-02-01T00:00:00Z')
    // owner-5 should appear only once
    expect(result.filter((r) => r.owner === 'owner-5')).toHaveLength(1)
  })

  it('does not mutate the original array', () => {
    const existing: RecentRepo[] = [
      { owner: 'facebook', repo: 'react', lastUsed: '2026-01-01T00:00:00Z' },
    ]
    addRecentRepoToList(existing, 'vercel', 'next.js', '2026-01-02T00:00:00Z')
    expect(existing).toHaveLength(1)
  })
})

describe('removeRecentRepoFromList', () => {
  it('removes a repo from the list', () => {
    const repos: RecentRepo[] = [
      { owner: 'facebook', repo: 'react', lastUsed: '2026-01-01T00:00:00Z' },
      { owner: 'vercel', repo: 'next.js', lastUsed: '2026-01-02T00:00:00Z' },
    ]
    const result = removeRecentRepoFromList(repos, 'facebook', 'react')
    expect(result).toHaveLength(1)
    expect(result[0]?.owner).toBe('vercel')
  })

  it('returns same-length list when repo not found', () => {
    const repos: RecentRepo[] = [
      { owner: 'facebook', repo: 'react', lastUsed: '2026-01-01T00:00:00Z' },
    ]
    const result = removeRecentRepoFromList(repos, 'unknown', 'repo')
    expect(result).toHaveLength(1)
  })

  it('returns empty array when removing last item', () => {
    const repos: RecentRepo[] = [
      { owner: 'facebook', repo: 'react', lastUsed: '2026-01-01T00:00:00Z' },
    ]
    const result = removeRecentRepoFromList(repos, 'facebook', 'react')
    expect(result).toHaveLength(0)
  })

  it('does not mutate the original array', () => {
    const repos: RecentRepo[] = [
      { owner: 'facebook', repo: 'react', lastUsed: '2026-01-01T00:00:00Z' },
    ]
    removeRecentRepoFromList(repos, 'facebook', 'react')
    expect(repos).toHaveLength(1)
  })
})

describe('sortByMostRecent', () => {
  it('sorts repos by lastUsed descending (most recent first)', () => {
    const repos: RecentRepo[] = [
      { owner: 'a', repo: 'a', lastUsed: '2026-01-01T00:00:00Z' },
      { owner: 'c', repo: 'c', lastUsed: '2026-01-03T00:00:00Z' },
      { owner: 'b', repo: 'b', lastUsed: '2026-01-02T00:00:00Z' },
    ]
    const result = sortByMostRecent(repos)
    expect(result[0]?.owner).toBe('c')
    expect(result[1]?.owner).toBe('b')
    expect(result[2]?.owner).toBe('a')
  })

  it('returns empty array for empty input', () => {
    const result = sortByMostRecent([])
    expect(result).toHaveLength(0)
  })

  it('does not mutate the original array', () => {
    const repos: RecentRepo[] = [
      { owner: 'b', repo: 'b', lastUsed: '2026-01-02T00:00:00Z' },
      { owner: 'a', repo: 'a', lastUsed: '2026-01-01T00:00:00Z' },
    ]
    sortByMostRecent(repos)
    expect(repos[0]?.owner).toBe('b')
  })
})
