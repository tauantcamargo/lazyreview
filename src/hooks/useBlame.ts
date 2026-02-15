import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Effect } from 'effect'
import { CodeReviewApi } from '../services/GitHubApi'
import { runEffect } from '../utils/effect'
import type { BlameInfo } from '../models/blame'

export interface UseBlameOptions {
  readonly owner: string
  readonly repo: string
  readonly path: string | null
  readonly ref: string
  readonly supportsBlame: boolean
}

export interface UseBlameResult {
  readonly blameData: ReadonlyMap<number, BlameInfo>
  readonly isLoading: boolean
  readonly isEnabled: boolean
  readonly isSupported: boolean
  readonly toggleBlame: () => void
  readonly error: Error | null
}

/**
 * Hook for fetching and caching blame data per file.
 *
 * Blame is lazily fetched: the request is only made when the user toggles
 * blame on. Data is cached per file path so navigating away and back
 * does not re-fetch.
 *
 * When the provider does not support blame, `isSupported` is false and
 * toggling blame on is a no-op.
 */
export function useBlame({
  owner,
  repo,
  path,
  ref,
  supportsBlame,
}: UseBlameOptions): UseBlameResult {
  const [isEnabled, setIsEnabled] = useState(false)

  const toggleBlame = useCallback(() => {
    if (!supportsBlame) return
    setIsEnabled((prev) => !prev)
  }, [supportsBlame])

  const query = useQuery<readonly BlameInfo[], Error>({
    queryKey: ['file-blame', owner, repo, path, ref],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          if (api.getFileBlame) {
            return yield* api.getFileBlame(owner, repo, path!, ref)
          }
          return [] as readonly BlameInfo[]
        }),
      ),
    enabled: isEnabled && supportsBlame && !!owner && !!repo && !!path && !!ref,
    staleTime: 5 * 60 * 1000, // 5 minutes - blame data changes infrequently
  })

  const blameData: ReadonlyMap<number, BlameInfo> = useMemo(() => {
    if (!query.data) return new Map<number, BlameInfo>()
    const map = new Map<number, BlameInfo>()
    for (const entry of query.data) {
      map.set(entry.line, entry)
    }
    return map
  }, [query.data])

  return {
    blameData,
    isLoading: query.isLoading && isEnabled,
    isEnabled,
    isSupported: supportsBlame,
    toggleBlame,
    error: query.error ?? null,
  }
}
