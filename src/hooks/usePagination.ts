import { useState, useMemo, useCallback, useEffect, useRef } from 'react'

interface UsePaginationOptions {
  readonly pageSize?: number
}

interface UsePaginationResult<T> {
  readonly currentPage: number
  readonly totalPages: number
  readonly pageItems: readonly T[]
  readonly hasNextPage: boolean
  readonly hasPrevPage: boolean
  readonly nextPage: () => void
  readonly prevPage: () => void
  readonly goToPage: (page: number) => void
  readonly startIndex: number
  readonly endIndex: number
}

export function usePagination<T>(
  items: readonly T[],
  options: UsePaginationOptions = {},
): UsePaginationResult<T> {
  const pageSize = options.pageSize ?? 18
  const [currentPage, setCurrentPage] = useState(1)
  const prevItemsLengthRef = useRef(items.length)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / pageSize)),
    [items.length, pageSize],
  )

  // Reset to page 1 when items change (e.g., filter applied)
  useEffect(() => {
    if (items.length !== prevItemsLengthRef.current) {
      setCurrentPage(1)
      prevItemsLengthRef.current = items.length
    }
  }, [items.length])

  // Ensure current page is within bounds
  const safePage = Math.min(currentPage, totalPages)

  const startIndex = (safePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, items.length)

  const pageItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex],
  )

  const hasNextPage = safePage < totalPages
  const hasPrevPage = safePage > 1

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage((p) => p + 1)
    }
  }, [hasNextPage])

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      setCurrentPage((p) => p - 1)
    }
  }, [hasPrevPage])

  const goToPage = useCallback(
    (page: number) => {
      const clampedPage = Math.max(1, Math.min(page, totalPages))
      setCurrentPage(clampedPage)
    },
    [totalPages],
  )

  return {
    currentPage: safePage,
    totalPages,
    pageItems,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
    goToPage,
    startIndex,
    endIndex,
  }
}
