import { useCallback, useMemo, useState, useEffect } from 'react'
import { useConfig } from './useConfig'
import { useStateStore } from '../services/state/StateProvider'
import type { RecentRepo } from '../services/Config'

const MAX_RECENT_REPOS = 10

export interface UseRecentReposReturn {
  readonly recentRepos: readonly RecentRepo[]
  readonly addRecentRepo: (owner: string, repo: string) => void
  readonly removeRecentRepo: (owner: string, repo: string) => void
}

// ---------------------------------------------------------------------------
// Pure helpers (kept exported for testing)
// ---------------------------------------------------------------------------

export function addRecentRepoToList(
  repos: readonly RecentRepo[],
  owner: string,
  repo: string,
  now: string,
): readonly RecentRepo[] {
  const filtered = repos.filter(
    (r) => !(r.owner === owner && r.repo === repo),
  )
  const updated: readonly RecentRepo[] = [
    { owner, repo, lastUsed: now },
    ...filtered,
  ]
  return updated.slice(0, MAX_RECENT_REPOS)
}

export function removeRecentRepoFromList(
  repos: readonly RecentRepo[],
  owner: string,
  repo: string,
): readonly RecentRepo[] {
  return repos.filter((r) => !(r.owner === owner && r.repo === repo))
}

export function sortByMostRecent(
  repos: readonly RecentRepo[],
): readonly RecentRepo[] {
  return [...repos].sort(
    (a, b) =>
      new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime(),
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRecentRepos(): UseRecentReposReturn {
  const { config, updateConfig } = useConfig()
  const stateStore = useStateStore()
  const [revision, setRevision] = useState(0)

  // Migrate config recent repos to StateStore on first load
  useEffect(() => {
    if (!stateStore) return
    const configRepos = config?.recentRepos ?? []
    if (configRepos.length > 0) {
      for (const repo of configRepos) {
        stateStore.addRecentRepo(repo.owner, repo.repo)
      }
      updateConfig({ recentRepos: [] })
      setRevision((r) => r + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateStore])

  const rawRepos = useMemo(() => {
    if (stateStore) {
      return stateStore.getRecentRepos().map((r) => ({
        owner: r.owner,
        repo: r.repo,
        lastUsed: r.lastUsed,
      }))
    }
    return config?.recentRepos ?? []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateStore, config?.recentRepos, revision])

  const recentRepos = useMemo(() => sortByMostRecent(rawRepos), [rawRepos])

  const addRecentRepo = useCallback(
    (owner: string, repo: string) => {
      if (stateStore) {
        stateStore.addRecentRepo(owner, repo)
        setRevision((r) => r + 1)
      } else {
        const current = config?.recentRepos ?? []
        const now = new Date().toISOString()
        const updated = addRecentRepoToList(current, owner, repo, now)
        updateConfig({ recentRepos: updated as RecentRepo[] })
      }
    },
    [stateStore, config?.recentRepos, updateConfig],
  )

  const removeRecentRepo = useCallback(
    (owner: string, repo: string) => {
      const current = config?.recentRepos ?? []
      const updated = removeRecentRepoFromList(current, owner, repo)
      updateConfig({ recentRepos: updated as RecentRepo[] })
    },
    [config?.recentRepos, updateConfig],
  )

  return { recentRepos, addRecentRepo, removeRecentRepo }
}
