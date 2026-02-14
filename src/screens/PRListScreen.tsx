import React, { useMemo, useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { useTheme } from '../theme/index'
import { useListNavigation } from '../hooks/useListNavigation'
import { usePagination } from '../hooks/usePagination'
import { useFilter } from '../hooks/useFilter'
import { useKeybindings } from '../hooks/useKeybindings'
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
import { useReadState } from '../hooks/useReadState'
import { useNotifications } from '../hooks/useNotifications'
import { useConfig } from '../hooks/useConfig'
import { useCurrentUser } from '../hooks/useGitHub'
import { findNextUnread } from '../utils/listHelpers'
import {
  PRPreviewPanel,
  PREVIEW_PANEL_MIN_TERMINAL_WIDTH,
  PREVIEW_PANEL_WIDTH_FRACTION,
} from '../components/pr/PRPreviewPanel'
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
  readonly onSelect: (pr: PullRequest, list?: readonly PullRequest[], index?: number) => void
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
  const { isUnread } = useReadState()
  const { config } = useConfig()
  const { data: currentUser } = useCurrentUser()

  // Desktop notifications for PR activity
  const notificationsEnabled = config?.notifications ?? true
  useNotifications(
    prs.length > 0 ? prs : undefined,
    {
      enabled: notificationsEnabled,
      notifyOnNewPR: config?.notifyOnNewPR ?? true,
      notifyOnUpdate: config?.notifyOnUpdate ?? true,
      notifyOnReviewRequest: config?.notifyOnReviewRequest ?? true,
    },
    currentUser?.login,
  )

  const [showFilter, setShowFilter] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [compactMode, setCompactMode] = useState(config?.compactList ?? false)
  const [showPreview, setShowPreview] = useState(false)
  const { stdout } = useStdout()
  const terminalWidth = stdout?.columns ?? 80
  const isWideTerminal = terminalWidth >= PREVIEW_PANEL_MIN_TERMINAL_WIDTH
  const previewVisible = showPreview && isWideTerminal
  const previewWidth = previewVisible
    ? Math.floor(terminalWidth * PREVIEW_PANEL_WIDTH_FRACTION)
    : 0
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

  const displayItems = useMemo(
    () =>
      showUnreadOnly
        ? filteredItems.filter((pr) => isUnread(pr.html_url, pr.updated_at))
        : filteredItems,
    [filteredItems, showUnreadOnly, isUnread],
  )

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
  } = usePagination(displayItems, { pageSize: 18 })

  const { selectedIndex, setSelectedIndex } = useListNavigation({
    itemCount: pageItems.length,
    viewportHeight: pageItems.length,
    isActive: !showFilter && !showSort,
  })

  const { matchesAction } = useKeybindings('prList')

  useInput(
    (input, key) => {
      if (key.return && pageItems[selectedIndex]) {
        // Pass the full display list and absolute index for next/prev navigation
        const absoluteIndex = startIndex + selectedIndex
        onSelect(pageItems[selectedIndex], displayItems, absoluteIndex)
      } else if (matchesAction(input, key, 'nextPage') && hasNextPage) {
        nextPage()
      } else if (matchesAction(input, key, 'prevPage') && hasPrevPage) {
        prevPage()
      } else if (matchesAction(input, key, 'filterPRs')) {
        setShowFilter(true)
      } else if (matchesAction(input, key, 'sortPRs')) {
        setShowSort(true)
      } else if (matchesAction(input, key, 'openInBrowser') && pageItems[selectedIndex]) {
        openInBrowser(pageItems[selectedIndex].html_url)
        setStatusMessage('Opened in browser')
      } else if (matchesAction(input, key, 'copyUrl') && pageItems[selectedIndex]) {
        const url = pageItems[selectedIndex].html_url
        if (copyToClipboard(url)) {
          setStatusMessage('Copied PR URL to clipboard')
        } else {
          setStatusMessage('Failed to copy to clipboard')
        }
      } else if (matchesAction(input, key, 'toggleUnread')) {
        setShowUnreadOnly((prev) => !prev)
        setStatusMessage(showUnreadOnly ? 'Showing all PRs' : 'Showing unread PRs only')
      } else if (matchesAction(input, key, 'toggleState') && onStateChange) {
        const currentIdx = STATE_CYCLE.indexOf(stateFilter)
        const nextIdx = (currentIdx + 1) % STATE_CYCLE.length
        onStateChange(STATE_CYCLE[nextIdx]!)
      } else if (matchesAction(input, key, 'toggleCompactList')) {
        setCompactMode((prev) => !prev)
        setStatusMessage(compactMode ? 'Expanded view' : 'Compact view')
      } else if (matchesAction(input, key, 'togglePreview')) {
        if (!isWideTerminal) {
          setStatusMessage('Preview requires terminal width >= 140 columns')
        } else {
          setShowPreview((prev) => !prev)
          setStatusMessage(showPreview ? 'Preview hidden' : 'Preview shown')
        }
      } else if (matchesAction(input, key, 'jumpToUnread')) {
        const nextUnreadIndex = findNextUnread(pageItems, selectedIndex, isUnread)
        if (nextUnreadIndex >= 0) {
          setSelectedIndex(nextUnreadIndex)
          setStatusMessage(`Jumped to unread PR #${pageItems[nextUnreadIndex]!.number}`)
        } else {
          setStatusMessage('No unread PRs in current list')
        }
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

  const selectedPR = pageItems[selectedIndex]

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
          {showUnreadOnly && (
            <Text color={theme.colors.accent}>[Unread]</Text>
          )}
          {compactMode && (
            <Text color={theme.colors.info}>[Compact]</Text>
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
          totalItems={displayItems.length}
          startIndex={startIndex}
          endIndex={endIndex}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
        />
      </Box>
      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" flexGrow={1}>
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
                compact={compactMode}
              />
            ))
          )}
        </Box>
        {previewVisible && (
          <PRPreviewPanel pr={selectedPR} width={previewWidth} />
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
