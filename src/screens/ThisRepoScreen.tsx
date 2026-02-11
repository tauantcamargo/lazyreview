import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../theme/index'
import { usePullRequests } from '../hooks/useGitHub'
import { useListNavigation } from '../hooks/useListNavigation'
import { usePagination } from '../hooks/usePagination'
import { useFilter } from '../hooks/useFilter'
import { PRListItem } from '../components/pr/PRListItem'
import { EmptyState } from '../components/common/EmptyState'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { PaginationBar } from '../components/common/PaginationBar'
import { FilterModal } from '../components/common/FilterModal'
import { SortModal } from '../components/common/SortModal'
import type { PullRequest } from '../models/pull-request'

interface ThisRepoScreenProps {
  readonly owner: string | null
  readonly repo: string | null
  readonly onSelect: (pr: PullRequest) => void
}

export function ThisRepoScreen({
  owner,
  repo,
  onSelect,
}: ThisRepoScreenProps): React.ReactElement {
  const theme = useTheme()
  const {
    data: prs = [],
    isLoading,
    error,
  } = usePullRequests(owner ?? '', repo ?? '', { state: 'open' })
  const [showFilter, setShowFilter] = useState(false)
  const [showSort, setShowSort] = useState(false)

  const {
    filter,
    filteredItems,
    setSearch,
    setRepo: setRepoFilter,
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
      }
    },
    { isActive: !showFilter && !showSort },
  )

  if (!owner || !repo) {
    return (
      <EmptyState message="Not in a git repository or remote not detected" />
    )
  }

  if (isLoading && prs.length === 0) {
    return <LoadingIndicator message={`Loading PRs for ${owner}/${repo}...`} />
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.colors.error}>Error: {String(error)}</Text>
      </Box>
    )
  }

  if (prs.length === 0) {
    return <EmptyState message={`No open PRs in ${owner}/${repo}`} />
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} justifyContent="space-between">
        <Box gap={2}>
          <Text color={theme.colors.accent} bold>
            {owner}/{repo}
          </Text>
          {hasActiveFilters && (
            <Text color={theme.colors.warning}>(filtered)</Text>
          )}
          <Text color={theme.colors.muted}>/ filter s sort</Text>
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
          onRepoChange={setRepoFilter}
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
