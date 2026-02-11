import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../theme/index'
import { useReviewRequests } from '../hooks/useGitHub'
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
import { openInBrowser } from '../utils/terminal'
import { useStatusMessage } from '../hooks/useStatusMessage'
import { useManualRefresh } from '../hooks/useManualRefresh'
import type { PullRequest } from '../models/pull-request'

interface ReviewRequestsScreenProps {
  readonly onSelect: (pr: PullRequest) => void
}

export function ReviewRequestsScreen({
  onSelect,
}: ReviewRequestsScreenProps): React.ReactElement {
  const theme = useTheme()
  const { data: prs = [], isLoading, error } = useReviewRequests()
  const { setStatusMessage } = useStatusMessage()
  const [showFilter, setShowFilter] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const { refresh } = useManualRefresh({
    isActive: !showFilter && !showSort,
    queryKeys: [['review-requests']],
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
      }
    },
    { isActive: !showFilter && !showSort },
  )

  if (isLoading && prs.length === 0) {
    return <LoadingIndicator message="Loading review requests..." />
  }

  if (error) {
    return <ErrorWithRetry message={String(error)} onRetry={refresh} />
  }

  if (prs.length === 0) {
    return <EmptyState message="No review requests" />
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} justifyContent="space-between">
        <Box gap={2}>
          <Text color={theme.colors.accent} bold>
            For Review
          </Text>
          {hasActiveFilters && (
            <Text color={theme.colors.warning}>(filtered)</Text>
          )}
          <Text color={theme.colors.muted}>/ filter  s sort</Text>
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
