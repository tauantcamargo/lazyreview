import { useState, useMemo, useCallback, useRef } from 'react'
import type { FileChange } from '../models/file-change'

export interface CrossFileMatch {
  readonly filename: string
  readonly fileIndex: number
  readonly lineIndex: number
  readonly lineContent: string
}

export interface CrossFileSearchState {
  readonly query: string
  readonly matches: readonly CrossFileMatch[]
  readonly currentIndex: number
  readonly isSearching: boolean
  readonly activeQuery: string
}

export interface CrossFileSearchActions {
  readonly startSearch: () => void
  readonly cancelSearch: () => void
  readonly confirmSearch: () => CrossFileMatch | null
  readonly clearSearch: () => void
  readonly setQuery: (query: string) => void
  readonly navigateNext: () => CrossFileMatch | null
  readonly navigatePrev: () => CrossFileMatch | null
  readonly currentMatch: () => CrossFileMatch | null
  readonly matchedFileCount: () => number
}

/**
 * Build matches across all file diffs for a given query.
 * Only searches non-header diff lines. Case-insensitive.
 */
export function buildCrossFileMatches(
  files: readonly FileChange[],
  query: string,
): readonly CrossFileMatch[] {
  if (!query) return []
  const lowerQuery = query.toLowerCase()
  const matches: CrossFileMatch[] = []

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex]
    const patch = file.patch
    if (!patch) continue

    const lines = patch.split('\n')
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]
      // Skip hunk headers
      if (line.startsWith('@@')) continue
      // Check content (strip the +/-/space prefix for matching)
      const content = line.length > 0 ? line.slice(1) : ''
      if (content.toLowerCase().includes(lowerQuery)) {
        matches.push({
          filename: file.filename,
          fileIndex,
          lineIndex,
          lineContent: content,
        })
      }
    }
  }

  return matches
}

/**
 * Count how many unique files have matches.
 */
export function countMatchedFiles(
  matches: readonly CrossFileMatch[],
): number {
  const seen = new Set<number>()
  for (const match of matches) {
    seen.add(match.fileIndex)
  }
  return seen.size
}

export function useCrossFileSearch(
  files: readonly FileChange[],
): CrossFileSearchState & CrossFileSearchActions {
  const [isSearching, setIsSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const matches = useMemo(
    () => buildCrossFileMatches(files, activeQuery),
    [files, activeQuery],
  )

  const startSearch = useCallback(() => {
    setIsSearching(true)
    setQuery(activeQuery)
  }, [activeQuery])

  const cancelSearch = useCallback(() => {
    setIsSearching(false)
    setQuery('')
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const confirmSearch = useCallback((): CrossFileMatch | null => {
    setIsSearching(false)
    setActiveQuery(query)
    setCurrentIndex(0)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    // Eagerly compute matches so we can return the first one immediately
    const eagerMatches = buildCrossFileMatches(files, query)
    return eagerMatches.length > 0 ? eagerMatches[0] ?? null : null
  }, [query, files])

  const clearSearch = useCallback(() => {
    setIsSearching(false)
    setQuery('')
    setActiveQuery('')
    setCurrentIndex(0)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const setQueryWithDebounce = useCallback((newQuery: string) => {
    setQuery(newQuery)
  }, [])

  const navigateNext = useCallback((): CrossFileMatch | null => {
    if (matches.length === 0) return null
    const nextIndex = (currentIndex + 1) % matches.length
    setCurrentIndex(nextIndex)
    return matches[nextIndex] ?? null
  }, [currentIndex, matches])

  const navigatePrev = useCallback((): CrossFileMatch | null => {
    if (matches.length === 0) return null
    const prevIndex =
      (currentIndex - 1 + matches.length) % matches.length
    setCurrentIndex(prevIndex)
    return matches[prevIndex] ?? null
  }, [currentIndex, matches])

  const currentMatch = useCallback((): CrossFileMatch | null => {
    if (matches.length === 0) return null
    return matches[currentIndex] ?? null
  }, [currentIndex, matches])

  const matchedFileCount = useCallback((): number => {
    return countMatchedFiles(matches)
  }, [matches])

  return {
    query,
    matches,
    currentIndex,
    isSearching,
    activeQuery,
    startSearch,
    cancelSearch,
    confirmSearch,
    clearSearch,
    setQuery: setQueryWithDebounce,
    navigateNext,
    navigatePrev,
    currentMatch,
    matchedFileCount,
  }
}
