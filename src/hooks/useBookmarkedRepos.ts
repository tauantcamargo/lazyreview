import { useCallback, useMemo, useState, useEffect } from 'react'
import { useConfig } from './useConfig'
import { useStateStore } from '../services/state/StateProvider'
import type { BookmarkedRepo } from '../services/Config'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UseBookmarkedReposReturn {
  readonly bookmarkedRepos: readonly BookmarkedRepo[]
  readonly addBookmark: (owner: string, repo: string) => void
  readonly removeBookmark: (owner: string, repo: string) => void
}

// ---------------------------------------------------------------------------
// Pure helpers (kept exported for testing)
// ---------------------------------------------------------------------------

export function validateBookmarkInput(input: string): {
  readonly valid: boolean
  readonly error: string | null
} {
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBookmarkedRepos(): UseBookmarkedReposReturn {
  const { config, updateConfig } = useConfig()
  const stateStore = useStateStore()
  const [revision, setRevision] = useState(0)

  // Migrate config bookmarks to StateStore on first load
  useEffect(() => {
    if (!stateStore) return
    const configBookmarks = config?.bookmarkedRepos ?? []
    if (configBookmarks.length > 0) {
      const existing = stateStore.getBookmarkedRepos()
      for (const bm of configBookmarks) {
        const alreadyExists = existing.some(
          (e) => e.owner === bm.owner && e.repo === bm.repo,
        )
        if (!alreadyExists) {
          stateStore.addBookmarkedRepo(bm.owner, bm.repo)
        }
      }
      updateConfig({ bookmarkedRepos: [] })
      setRevision((r) => r + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateStore])

  const bookmarkedRepos = useMemo(() => {
    if (stateStore) {
      return stateStore.getBookmarkedRepos().map((r) => ({
        owner: r.owner,
        repo: r.repo,
      }))
    }
    return config?.bookmarkedRepos ?? []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateStore, config?.bookmarkedRepos, revision])

  const addBookmark = useCallback(
    (owner: string, repo: string) => {
      if (stateStore) {
        stateStore.addBookmarkedRepo(owner, repo)
        setRevision((r) => r + 1)
      } else {
        const current = config?.bookmarkedRepos ?? []
        const updated = addBookmarkToList(current, owner, repo)
        if (updated !== current) {
          updateConfig({ bookmarkedRepos: updated as BookmarkedRepo[] })
        }
      }
    },
    [stateStore, config?.bookmarkedRepos, updateConfig],
  )

  const removeBookmark = useCallback(
    (owner: string, repo: string) => {
      if (stateStore) {
        stateStore.removeBookmarkedRepo(owner, repo)
        setRevision((r) => r + 1)
      } else {
        const current = config?.bookmarkedRepos ?? []
        const updated = removeBookmarkFromList(current, owner, repo)
        updateConfig({ bookmarkedRepos: updated as BookmarkedRepo[] })
      }
    },
    [stateStore, config?.bookmarkedRepos, updateConfig],
  )

  return { bookmarkedRepos, addBookmark, removeBookmark }
}
