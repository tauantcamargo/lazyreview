import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../theme/index'
import { useListNavigation } from '../hooks/useListNavigation'
import { usePagination } from '../hooks/usePagination'
import { useFilter } from '../hooks/useFilter'
import { PRListItem } from '../components/pr/PRListItem'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorWithRetry } from '../components/common/ErrorWithRetry'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { PaginationBar } from '../components/common/PaginationBar'
import { FilterModal } from '../components/common/FilterModal'
import { SortModal } from '../components/common/SortModal'
import { openInBrowser, copyToClipboard } from '../utils/terminal'
import { useStatusMessage } from '../hooks/useStatusMessage'
import { useManualRefresh } from '../hooks/useManualRefresh'
import type { PullRequest } from '../models/pull-request'
import type { PRStateFilter } from '../hooks/useGitHub'

const STATE_LABELS: Record<PRStateFilter, string> = {
  open: 'Open',
  closed: 'Closed',
  all: 'All',
}

const STATE_CYCLE: readonly PRStateFilter[] = ['open', 'closed', 'all']

interface PRListScreenProps {
  readonly title: string
  readonly prs: readonly PullRequest[]
  readonly isLoading: boolean
  readonly error: Error | null
  readonly emptyMessage: string
  readonly loadingMessage: string
  readonly queryKeys: readonly string[][]
  readonly stateFilter?: PRStateFilter
  readonly onStateChange?: (state: PRStateFilter) => void
  readonly onSelect: (pr: PullRequest) => void
}

export function PRListScreen({
  title,
  prs,
  isLoading,
  error,
  emptyMessage,
  loadingMessage,
  queryKeys,
  stateFilter = 'open',
  onStateChange,
  onSelect,
}: PRListScreenProps): React.ReactElement {
  const theme = useTheme()
  const { setStatusMessage } = useStatusMessage()
  const [showFilter, setShowFilter] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const { refresh } = useManualRefresh({
    isActive: !showFilter && !showSort,
    queryKeys,
  })

  const {
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
  } = useFilter(prs)

  const {
    currentPage,
    totalPages,
    pageItems,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
    startIndex,
    endIndex,
  } = usePagination(filteredItems, { pageSize: 18 })

  const { selectedIndex } = useListNavigation({
    itemCount: pageItems.length,
    viewportHeight: pageItems.length,
    isActive: !showFilter && !showSort,
  })

  useInput(
    (input, key) => {
      if (key.return && pageItems[selectedIndex]) {
        onSelect(pageItems[selectedIndex])
      } else if (input === 'n' && hasNextPage) {
        nextPage()
      } else if (input === 'p' && hasPrevPage) {
        prevPage()
      } else if (input === '/') {
        setShowFilter(true)
      } else if (input === 's') {
        setShowSort(true)
      } else if (input === 'o' && pageItems[selectedIndex]) {
        openInBrowser(pageItems[selectedIndex].html_url)
        setStatusMessage('Opened in browser')
      } else if (input === 'y' && pageItems[selectedIndex]) {
        const url = pageItems[selectedIndex].html_url
        if (copyToClipboard(url)) {
          setStatusMessage('Copied PR URL to clipboard')
        } else {
          setStatusMessage('Failed to copy to clipboard')
        }
      } else if (input === 't' && onStateChange) {
        const currentIdx = STATE_CYCLE.indexOf(stateFilter)
        const nextIdx = (currentIdx + 1) % STATE_CYCLE.length
        onStateChange(STATE_CYCLE[nextIdx]!)
      }
    },
    { isActive: !showFilter && !showSort },
  )

  if (isLoading && prs.length === 0) {
    return <LoadingIndicator message={loadingMessage} />
  }

  if (error) {
    return <ErrorWithRetry message={String(error)} onRetry={refresh} />
  }

  if (prs.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} justifyContent="space-between">
        <Box gap={2}>
          <Text color={theme.colors.accent} bold>
            {title}
          </Text>
          {onStateChange && (
            <Text color={stateFilter === 'open' ? theme.colors.success : stateFilter === 'closed' ? theme.colors.error : theme.colors.info}>
              [{STATE_LABELS[stateFilter]}]
            </Text>
          )}
          {hasActiveFilters && (
            <Text color={theme.colors.warning}>(filtered)</Text>
          )}
          <Text color={theme.colors.muted}>
            / filter  s sort{onStateChange ? '  t state' : ''}
          </Text>
        </Box>
        <PaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredItems.length}
          startIndex={startIndex}
          endIndex={endIndex}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
        />
      </Box>
      <Box flexDirection="column">
        {pageItems.length === 0 ? (
          <Box padding={1}>
            <Text color={theme.colors.muted}>
              No PRs match the current filters
            </Text>
          </Box>
        ) : (
          pageItems.map((pr, index) => (
            <PRListItem
              key={pr.id}
              item={pr}
              isFocus={index === selectedIndex}
            />
          ))
        )}
      </Box>
      {showFilter && (
        <FilterModal
          filter={filter}
          availableRepos={availableRepos}
          availableAuthors={availableAuthors}
          availableLabels={availableLabels}
          repoFacets={repoFacets}
          authorFacets={authorFacets}
          labelFacets={labelFacets}
          onSearchChange={setSearch}
          onRepoChange={setRepo}
          onAuthorChange={setAuthor}
          onLabelChange={setLabel}
          onSortChange={setSortBy}
          onSortDirectionToggle={toggleSortDirection}
          onClear={clearFilters}
          onClose={() => setShowFilter(false)}
        />
      )}
      {showSort && (
        <SortModal
          currentSort={filter.sortBy}
          sortDirection={filter.sortDirection}
          onSortChange={setSortBy}
          onSortDirectionToggle={toggleSortDirection}
          onClose={() => setShowSort(false)}
        />
      )}
    </Box>
  )
}
