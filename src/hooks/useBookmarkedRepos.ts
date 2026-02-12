import { useCallback, useMemo } from 'react'
import { useConfig } from './useConfig'
import type { BookmarkedRepo } from '../services/Config'

export interface UseBookmarkedReposReturn {
  readonly bookmarkedRepos: readonly BookmarkedRepo[]
  readonly addBookmark: (owner: string, repo: string) => void
  readonly removeBookmark: (owner: string, repo: string) => void
}

export function validateBookmarkInput(input: string): { readonly valid: boolean; readonly error: string | null } {
  const trimmed = input.trim()
  if (!trimmed.includes('/')) {
    return { valid: false, error: 'Format: owner/repo' }
  }
  const parts = trimmed.split('/')
  const owner = parts[0]?.trim() ?? ''
  const repo = parts.slice(1).join('/').trim()
  if (!owner || !repo) {
    return { valid: false, error: 'Owner and repo cannot be empty' }
  }
  return { valid: true, error: null }
}

export function addBookmarkToList(
  repos: readonly BookmarkedRepo[],
  owner: string,
  repo: string,
): readonly BookmarkedRepo[] {
  const exists = repos.some((r) => r.owner === owner && r.repo === repo)
  if (exists) return repos
  return [...repos, { owner, repo }]
}

export function removeBookmarkFromList(
  repos: readonly BookmarkedRepo[],
  owner: string,
  repo: string,
): readonly BookmarkedRepo[] {
  return repos.filter((r) => !(r.owner === owner && r.repo === repo))
}

export function useBookmarkedRepos(): UseBookmarkedReposReturn {
  const { config, updateConfig } = useConfig()

  const bookmarkedRepos = useMemo(
    () => config?.bookmarkedRepos ?? [],
    [config?.bookmarkedRepos],
  )

  const addBookmark = useCallback(
    (owner: string, repo: string) => {
      const current = config?.bookmarkedRepos ?? []
      const updated = addBookmarkToList(current, owner, repo)
      if (updated !== current) {
        updateConfig({ bookmarkedRepos: updated as BookmarkedRepo[] })
      }
    },
    [config?.bookmarkedRepos, updateConfig],
  )

  const removeBookmark = useCallback(
    (owner: string, repo: string) => {
      const current = config?.bookmarkedRepos ?? []
      const updated = removeBookmarkFromList(current, owner, repo)
      updateConfig({ bookmarkedRepos: updated as BookmarkedRepo[] })
    },
    [config?.bookmarkedRepos, updateConfig],
  )

  return { bookmarkedRepos, addBookmark, removeBookmark }
}
