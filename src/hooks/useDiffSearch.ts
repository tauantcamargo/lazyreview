import { useState, useMemo, useCallback } from 'react'
import { computeDiffSearchMatches, type DiffDisplayRow } from '../components/pr/DiffView'
import { computeSbsSearchMatches, type SideBySideRow } from '../components/pr/SideBySideDiffView'

type DiffMode = 'unified' | 'side-by-side'

export interface DiffSearchState {
  readonly isDiffSearching: boolean
  readonly diffSearchQuery: string
  readonly activeDiffSearch: string
  readonly currentSearchMatchIndex: number
  readonly diffSearchMatches: readonly number[]
  readonly diffSearchMatchSet: ReadonlySet<number>
}

export interface DiffSearchActions {
  readonly startSearch: (currentSearch: string) => void
  readonly cancelSearch: () => void
  readonly confirmSearch: (
    query: string,
    effectiveDiffMode: DiffMode,
    sideBySideRows: readonly SideBySideRow[],
    allRows: readonly DiffDisplayRow[],
    jumpToLine: (index: number) => void,
  ) => void
  readonly clearSearch: () => void
  readonly resetOnFileChange: () => void
  readonly setDiffSearchQuery: (query: string) => void
  readonly navigateNext: (jumpToLine: (index: number) => void) => void
  readonly navigatePrev: (jumpToLine: (index: number) => void) => void
}

export function useDiffSearch(
  effectiveDiffMode: DiffMode,
  allRows: readonly DiffDisplayRow[],
  sideBySideRows: readonly SideBySideRow[],
): DiffSearchState & DiffSearchActions {
  const [isDiffSearching, setIsDiffSearching] = useState(false)
  const [diffSearchQuery, setDiffSearchQuery] = useState('')
  const [activeDiffSearch, setActiveDiffSearch] = useState('')
  const [currentSearchMatchIndex, setCurrentSearchMatchIndex] = useState(0)

  const diffSearchMatches = useMemo(() => {
    if (!activeDiffSearch) return []
    if (effectiveDiffMode === 'side-by-side') {
      return computeSbsSearchMatches(sideBySideRows, activeDiffSearch)
    }
    return computeDiffSearchMatches(allRows, activeDiffSearch)
  }, [activeDiffSearch, effectiveDiffMode, allRows, sideBySideRows])

  const diffSearchMatchSet = useMemo(
    () => new Set(diffSearchMatches),
    [diffSearchMatches],
  )

  const startSearch = useCallback((currentSearch: string) => {
    setIsDiffSearching(true)
    setDiffSearchQuery(currentSearch)
  }, [])

  const cancelSearch = useCallback(() => {
    setIsDiffSearching(false)
    setDiffSearchQuery('')
    setActiveDiffSearch('')
    setCurrentSearchMatchIndex(0)
  }, [])

  const confirmSearch = useCallback(
    (
      query: string,
      mode: DiffMode,
      sbsRows: readonly SideBySideRow[],
      uniRows: readonly DiffDisplayRow[],
      jumpToLine: (index: number) => void,
    ) => {
      setIsDiffSearching(false)
      setActiveDiffSearch(query)
      if (query) {
        const matches =
          mode === 'side-by-side'
            ? computeSbsSearchMatches(sbsRows, query)
            : computeDiffSearchMatches(uniRows, query)
        if (matches.length > 0) {
          setCurrentSearchMatchIndex(0)
          jumpToLine(matches[0])
        }
      }
    },
    [],
  )

  const clearSearch = useCallback(() => {
    setActiveDiffSearch('')
    setDiffSearchQuery('')
    setCurrentSearchMatchIndex(0)
  }, [])

  const resetOnFileChange = useCallback(() => {
    setIsDiffSearching(false)
    setDiffSearchQuery('')
    setActiveDiffSearch('')
    setCurrentSearchMatchIndex(0)
  }, [])

  const navigateNext = useCallback(
    (jumpToLine: (index: number) => void) => {
      if (diffSearchMatches.length === 0) return
      const nextIndex = (currentSearchMatchIndex + 1) % diffSearchMatches.length
      setCurrentSearchMatchIndex(nextIndex)
      jumpToLine(diffSearchMatches[nextIndex])
    },
    [currentSearchMatchIndex, diffSearchMatches],
  )

  const navigatePrev = useCallback(
    (jumpToLine: (index: number) => void) => {
      if (diffSearchMatches.length === 0) return
      const prevIndex =
        (currentSearchMatchIndex - 1 + diffSearchMatches.length) %
        diffSearchMatches.length
      setCurrentSearchMatchIndex(prevIndex)
      jumpToLine(diffSearchMatches[prevIndex])
    },
    [currentSearchMatchIndex, diffSearchMatches],
  )

  return {
    isDiffSearching,
    diffSearchQuery,
    activeDiffSearch,
    currentSearchMatchIndex,
    diffSearchMatches,
    diffSearchMatchSet,
    startSearch,
    cancelSearch,
    confirmSearch,
    clearSearch,
    resetOnFileChange,
    setDiffSearchQuery,
    navigateNext,
    navigatePrev,
  }
}
