import { useState, useMemo, useCallback } from 'react'
import type { PullRequest } from '../models/pull-request'

export type SortField = 'updated' | 'created' | 'repo' | 'author' | 'title'
export type SortDirection = 'asc' | 'desc'

export interface FacetOption {
  readonly value: string
  readonly count: number
}

export interface FilterState {
  readonly search: string
  readonly repo: string | null
  readonly author: string | null
  readonly label: string | null
  readonly sortBy: SortField
  readonly sortDirection: SortDirection
}

const defaultFilter: FilterState = {
  search: '',
  repo: null,
  author: null,
  label: null,
  sortBy: 'updated',
  sortDirection: 'desc',
}

export function extractRepoFromUrl(url: string): string | null {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)\/pull/)
  return match?.[1] ?? null
}

export function matchesSearch(pr: PullRequest, search: string): boolean {
  if (!search) return true
  const lowerSearch = search.toLowerCase()
  return (
    pr.title.toLowerCase().includes(lowerSearch) ||
    pr.user.login.toLowerCase().includes(lowerSearch) ||
    String(pr.number).includes(lowerSearch)
  )
}

export function matchesRepo(pr: PullRequest, repo: string | null): boolean {
  if (!repo) return true
  const prRepo = extractRepoFromUrl(pr.html_url)
  return prRepo?.toLowerCase().includes(repo.toLowerCase()) ?? false
}

export function matchesAuthor(pr: PullRequest, author: string | null): boolean {
  if (!author) return true
  return pr.user.login.toLowerCase().includes(author.toLowerCase())
}

export function matchesLabel(pr: PullRequest, label: string | null): boolean {
  if (!label) return true
  const lowerLabel = label.toLowerCase()
  return pr.labels.some((l) => l.name.toLowerCase().includes(lowerLabel))
}

export function comparePRs(
  a: PullRequest,
  b: PullRequest,
  sortBy: SortField,
  sortDirection: SortDirection,
): number {
  let comparison = 0

  switch (sortBy) {
    case 'updated':
      comparison =
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      break
    case 'created':
      comparison =
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      break
    case 'repo': {
      const repoA = extractRepoFromUrl(a.html_url) ?? ''
      const repoB = extractRepoFromUrl(b.html_url) ?? ''
      comparison = repoA.localeCompare(repoB)
      break
    }
    case 'author':
      comparison = a.user.login.localeCompare(b.user.login)
      break
    case 'title':
      comparison = a.title.localeCompare(b.title)
      break
  }

  return sortDirection === 'asc' ? -comparison : comparison
}

interface UseFilterResult {
  readonly filter: FilterState
  readonly filteredItems: readonly PullRequest[]
  readonly setSearch: (search: string) => void
  readonly setRepo: (repo: string | null) => void
  readonly setAuthor: (author: string | null) => void
  readonly setLabel: (label: string | null) => void
  readonly setSortBy: (sortBy: SortField) => void
  readonly toggleSortDirection: () => void
  readonly clearFilters: () => void
  readonly hasActiveFilters: boolean
  readonly availableRepos: readonly string[]
  readonly availableAuthors: readonly string[]
  readonly availableLabels: readonly string[]
  readonly repoFacets: readonly FacetOption[]
  readonly authorFacets: readonly FacetOption[]
  readonly labelFacets: readonly FacetOption[]
}

export function useFilter(items: readonly PullRequest[]): UseFilterResult {
  const [filter, setFilter] = useState<FilterState>(defaultFilter)

  const availableRepos = useMemo(() => {
    const repos = new Set<string>()
    items.forEach((pr) => {
      const repo = extractRepoFromUrl(pr.html_url)
      if (repo) repos.add(repo)
    })
    return Array.from(repos).sort()
  }, [items])

  const availableAuthors = useMemo(() => {
    const authors = new Set<string>()
    items.forEach((pr) => authors.add(pr.user.login))
    return Array.from(authors).sort()
  }, [items])

  const availableLabels = useMemo(() => {
    const labels = new Set<string>()
    items.forEach((pr) => pr.labels.forEach((l) => labels.add(l.name)))
    return Array.from(labels).sort()
  }, [items])

  const repoFacets = useMemo((): readonly FacetOption[] => {
    const counts = new Map<string, number>()
    items.forEach((pr) => {
      const repo = extractRepoFromUrl(pr.html_url)
      if (repo) counts.set(repo, (counts.get(repo) ?? 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
  }, [items])

  const authorFacets = useMemo((): readonly FacetOption[] => {
    const counts = new Map<string, number>()
    items.forEach((pr) => {
      counts.set(pr.user.login, (counts.get(pr.user.login) ?? 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
  }, [items])

  const labelFacets = useMemo((): readonly FacetOption[] => {
    const counts = new Map<string, number>()
    items.forEach((pr) =>
      pr.labels.forEach((l) => {
        counts.set(l.name, (counts.get(l.name) ?? 0) + 1)
      }),
    )
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
  }, [items])

  const filteredItems = useMemo(() => {
    return items
      .filter((pr) => matchesSearch(pr, filter.search))
      .filter((pr) => matchesRepo(pr, filter.repo))
      .filter((pr) => matchesAuthor(pr, filter.author))
      .filter((pr) => matchesLabel(pr, filter.label))
      .sort((a, b) => comparePRs(a, b, filter.sortBy, filter.sortDirection))
  }, [items, filter])

  const setSearch = useCallback((search: string) => {
    setFilter((prev) => ({ ...prev, search }))
  }, [])

  const setRepo = useCallback((repo: string | null) => {
    setFilter((prev) => ({ ...prev, repo }))
  }, [])

  const setAuthor = useCallback((author: string | null) => {
    setFilter((prev) => ({ ...prev, author }))
  }, [])

  const setLabel = useCallback((label: string | null) => {
    setFilter((prev) => ({ ...prev, label }))
  }, [])

  const setSortBy = useCallback((sortBy: SortField) => {
    setFilter((prev) => ({ ...prev, sortBy }))
  }, [])

  const toggleSortDirection = useCallback(() => {
    setFilter((prev) => ({
      ...prev,
      sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilter(defaultFilter)
  }, [])

  const hasActiveFilters =
    filter.search !== '' ||
    filter.repo !== null ||
    filter.author !== null ||
    filter.label !== null

  return {
    filter,
    filteredItems,
    setSearch,
    setRepo,
    setAuthor,
    setLabel,
    setSortBy,
    toggleSortDirection,
    clearFilters,
    hasActiveFilters,
    availableRepos,
    availableAuthors,
    availableLabels,
    repoFacets,
    authorFacets,
    labelFacets,
  }
}
