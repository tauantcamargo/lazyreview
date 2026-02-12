import { useCallback, useMemo } from 'react'
import { useConfig } from './useConfig'
import type { RecentRepo } from '../services/Config'

const MAX_RECENT_REPOS = 10

export interface UseRecentReposReturn {
  readonly recentRepos: readonly RecentRepo[]
  readonly addRecentRepo: (owner: string, repo: string) => void
  readonly removeRecentRepo: (owner: string, repo: string) => void
}

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

export function sortByMostRecent(repos: readonly RecentRepo[]): readonly RecentRepo[] {
  return [...repos].sort(
    (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime(),
  )
}

export function useRecentRepos(): UseRecentReposReturn {
  const { config, updateConfig } = useConfig()

  const rawRepos = config?.recentRepos ?? []

  const recentRepos = useMemo(() => sortByMostRecent(rawRepos), [rawRepos])

  const addRecentRepo = useCallback(
    (owner: string, repo: string) => {
      const current = config?.recentRepos ?? []
      const now = new Date().toISOString()
      const updated = addRecentRepoToList(current, owner, repo, now)
      updateConfig({ recentRepos: updated as RecentRepo[] })
    },
    [config?.recentRepos, updateConfig],
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
