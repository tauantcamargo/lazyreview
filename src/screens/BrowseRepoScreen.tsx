import React, { useState, useCallback, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useTheme } from '../theme/index'
import { useInputFocus } from '../hooks/useInputFocus'
import { useRepoContext } from '../hooks/useRepoContext'
import { useRecentRepos } from '../hooks/useRecentRepos'
import { useBookmarkedRepos } from '../hooks/useBookmarkedRepos'
import { usePullRequests, type PRStateFilter } from '../hooks/useGitHub'
import { setScreenContext } from '../hooks/useScreenContext'
import { PRListScreen } from './PRListScreen'
import { Divider } from '../components/common/Divider'
import { validateOwner, validateRepo } from '../utils/sanitize'
import { parseGitRemote } from '../utils/git'
import type { PullRequest } from '../models/pull-request'

/**
 * Parse a URL or owner/repo string entered in the browse input.
 * Supports:
 *   - owner/repo (GitHub default)
 *   - group/subgroup/project (GitLab nested groups)
 *   - https://github.com/owner/repo
 *   - https://gitlab.com/group/subgroup/project
 *   - git@gitlab.com:group/project.git
 */
function parseRepoUrl(input: string): { readonly owner: string; readonly repo: string } | null {
  const trimmed = input.trim()

  // Try parsing as a git remote URL first
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('git@')) {
    const parsed = parseGitRemote(trimmed)
    if (parsed) {
      return { owner: parsed.owner, repo: parsed.repo }
    }

    // Also try parsing HTTPS URLs that might not have .git suffix
    // e.g. https://gitlab.com/group/subgroup/project
    try {
      const url = new URL(trimmed)
      const pathParts = url.pathname.split('/').filter(Boolean)
      if (pathParts.length >= 2) {
        const repo = pathParts[pathParts.length - 1] ?? ''
        const owner = pathParts.slice(0, -1).join('/')
        if (owner && repo) {
          return { owner, repo }
        }
      }
    } catch {
      // Not a URL, fall through
    }

    return null
  }

  return null
}

function validateRepoInput(input: string): { readonly valid: boolean; readonly owner: string; readonly repo: string; readonly error: string | null } {
  const trimmed = input.trim()

  // Try URL parsing first
  const urlParsed = parseRepoUrl(trimmed)
  if (urlParsed) {
    return { valid: true, owner: urlParsed.owner, repo: urlParsed.repo, error: null }
  }

  if (!trimmed.includes('/')) {
    return { valid: false, owner: '', repo: '', error: 'Format: owner/repo or full URL' }
  }

  const parts = trimmed.split('/')
  const owner = parts[0]?.trim() ?? ''
  const remainingParts = parts.slice(1)

  if (!owner) {
    return { valid: false, owner: '', repo: '', error: 'Owner cannot be empty' }
  }

  // Support GitLab nested group format: group/subgroup/project
  // The last segment is the repo, everything before is the owner/namespace
  if (remainingParts.length > 1) {
    const repo = remainingParts[remainingParts.length - 1]?.trim() ?? ''
    const fullOwner = [owner, ...remainingParts.slice(0, -1).map((p) => p.trim())].join('/')
    if (!repo) {
      return { valid: false, owner: '', repo: '', error: 'Repo cannot be empty' }
    }
    // For nested paths, validate each segment
    const allSegments = [fullOwner.split('/'), [repo]].flat()
    for (const segment of allSegments) {
      try {
        if (segment.includes('/')) {
          // validateOwner doesn't handle slashes, validate segments individually
          for (const sub of segment.split('/')) {
            validateOwner(sub)
          }
        } else {
          validateOwner(segment)
        }
      } catch {
        return { valid: false, owner: '', repo: '', error: 'Invalid characters in path' }
      }
    }
    return { valid: true, owner: fullOwner, repo, error: null }
  }

  const repo = remainingParts[0]?.trim() ?? ''
  if (!repo) {
    return { valid: false, owner: '', repo: '', error: 'Repo cannot be empty' }
  }
  try {
    validateOwner(owner)
    validateRepo(repo)
  } catch {
    return { valid: false, owner: '', repo: '', error: 'Invalid characters in owner/repo' }
  }
  return { valid: true, owner, repo, error: null }
}

interface BrowseRepoScreenProps {
  readonly onSelect: (pr: PullRequest, list?: readonly PullRequest[], index?: number) => void
  readonly isActive?: boolean
}

interface BrowsePickerProps {
  readonly onSelectRepo: (owner: string, repo: string) => void
  readonly isActive: boolean
}

function BrowsePicker({ onSelectRepo, isActive }: BrowsePickerProps): React.ReactElement {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const { recentRepos, removeRecentRepo } = useRecentRepos()
  const { bookmarkedRepos } = useBookmarkedRepos()
  const [inputValue, setInputValue] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Combined list: bookmarks first, then recent repos (excluding bookmarked ones)
  const bookmarkSet = new Set(bookmarkedRepos.map((b) => `${b.owner}/${b.repo}`))
  const filteredRecent = recentRepos.filter((r) => !bookmarkSet.has(`${r.owner}/${r.repo}`))
  const totalListItems = bookmarkedRepos.length + filteredRecent.length

  // Focus the input when panel becomes active, unfocus when it loses focus
  useEffect(() => {
    if (isActive) {
      setIsInputFocused(true)
    } else {
      setIsInputFocused(false)
    }
  }, [isActive])

  useEffect(() => {
    setInputActive(isInputFocused)
    return () => setInputActive(false)
  }, [isInputFocused, setInputActive])

  useEffect(() => {
    setScreenContext('browse-picker')
  }, [])

  const handleSubmitInput = useCallback(() => {
    const result = validateRepoInput(inputValue)
    if (!result.valid) {
      setInputError(result.error)
      return
    }
    setInputError(null)
    onSelectRepo(result.owner, result.repo)
  }, [inputValue, onSelectRepo])

  const handleSelectFromList = useCallback(() => {
    if (totalListItems === 0) return

    if (selectedIndex < bookmarkedRepos.length) {
      const bookmark = bookmarkedRepos[selectedIndex]
      if (bookmark) {
        onSelectRepo(bookmark.owner, bookmark.repo)
      }
    } else {
      const recentIdx = selectedIndex - bookmarkedRepos.length
      const recent = filteredRecent[recentIdx]
      if (recent) {
        onSelectRepo(recent.owner, recent.repo)
      }
    }
  }, [selectedIndex, bookmarkedRepos, filteredRecent, totalListItems, onSelectRepo])

  const handleRemoveFromList = useCallback(() => {
    // Only remove from recent repos, not bookmarks
    if (selectedIndex >= bookmarkedRepos.length) {
      const recentIdx = selectedIndex - bookmarkedRepos.length
      const recent = filteredRecent[recentIdx]
      if (recent) {
        removeRecentRepo(recent.owner, recent.repo)
        if (selectedIndex >= totalListItems - 1) {
          setSelectedIndex(Math.max(0, totalListItems - 2))
        }
      }
    }
  }, [selectedIndex, bookmarkedRepos.length, filteredRecent, totalListItems, removeRecentRepo])

  useInput(
    (input, key) => {
      if (isInputFocused) {
        if (key.return) {
          handleSubmitInput()
        } else if (key.escape) {
          if (totalListItems > 0) {
            setIsInputFocused(false)
          }
        }
        return
      }

      if (input === 'j' || key.downArrow) {
        setSelectedIndex((prev) => Math.min(prev + 1, totalListItems - 1))
      } else if (input === 'k' || key.upArrow) {
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (key.return) {
        handleSelectFromList()
      } else if (input === 'x') {
        handleRemoveFromList()
      } else if (input === '/') {
        setIsInputFocused(true)
      }
    },
    { isActive: isActive },
  )

  return (
    <Box flexDirection="column" flexGrow={1} padding={1}>
      <Text color={theme.colors.accent} bold>
        Browse Repository
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Box gap={1}>
          <Text color={theme.colors.secondary}>repo path or URL:</Text>
          <Box
            borderStyle="single"
            borderColor={isInputFocused ? theme.colors.accent : theme.colors.border}
            paddingX={1}
            width={40}
          >
            <TextInput
              defaultValue={inputValue}
              onChange={(val) => {
                setInputValue(val)
                setInputError(null)
              }}
              placeholder="e.g. owner/repo or group/subgroup/project"
            />
          </Box>
        </Box>
        {inputError && (
          <Box paddingLeft={2} marginTop={0}>
            <Text color={theme.colors.error}>{inputError}</Text>
          </Box>
        )}
      </Box>

      {bookmarkedRepos.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.colors.secondary} bold>
            Bookmarks
          </Text>
          <Divider />
          {bookmarkedRepos.map((bookmark, index) => {
            const isSelected = !isInputFocused && selectedIndex === index
            return (
              <Box key={`${bookmark.owner}/${bookmark.repo}`} paddingX={1}>
                <Text
                  color={isSelected ? theme.colors.accent : theme.colors.text}
                  bold={isSelected}
                  backgroundColor={isSelected ? theme.colors.selection : undefined}
                >
                  {isSelected ? '> ' : '  '}
                  {bookmark.owner}/{bookmark.repo}
                </Text>
              </Box>
            )
          })}
        </Box>
      )}

      {filteredRecent.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.colors.secondary} bold>
            Recent
          </Text>
          <Divider />
          {filteredRecent.map((repo, index) => {
            const listIdx = bookmarkedRepos.length + index
            const isSelected = !isInputFocused && selectedIndex === listIdx
            return (
              <Box key={`${repo.owner}/${repo.repo}`} paddingX={1} gap={2}>
                <Text
                  color={isSelected ? theme.colors.accent : theme.colors.text}
                  bold={isSelected}
                  backgroundColor={isSelected ? theme.colors.selection : undefined}
                >
                  {isSelected ? '> ' : '  '}
                  {repo.owner}/{repo.repo}
                </Text>
                <Text color={theme.colors.muted} dimColor>
                  {new Date(repo.lastUsed).toLocaleDateString()}
                </Text>
              </Box>
            )
          })}
        </Box>
      )}

      {totalListItems === 0 && (
        <Box marginTop={1} paddingX={1}>
          <Text color={theme.colors.muted}>
            No recent or bookmarked repos. Enter owner/repo above to get started.
          </Text>
        </Box>
      )}

      <Box marginTop={1} paddingX={1}>
        <Text color={theme.colors.muted} dimColor>
          {isInputFocused
            ? 'Enter:search  Esc:list'
            : 'j/k:nav  Enter:select  x:remove  /:search'}
        </Text>
      </Box>
    </Box>
  )
}

interface BrowseListProps {
  readonly owner: string
  readonly repo: string
  readonly onBack: () => void
  readonly onSelect: (pr: PullRequest, list?: readonly PullRequest[], index?: number) => void
}

function BrowseList({ owner, repo, onBack, onSelect }: BrowseListProps): React.ReactElement {
  const [stateFilter, setStateFilter] = useState<PRStateFilter>('open')
  const { data: prs = [], isLoading, error } = usePullRequests(owner, repo, {
    state: stateFilter === 'all' ? 'all' : stateFilter === 'closed' ? 'closed' : 'open',
  })

  useEffect(() => {
    setScreenContext('browse-list')
  }, [])

  useInput(
    (_input, key) => {
      if (key.escape) {
        onBack()
      }
    },
    { isActive: true },
  )

  return (
    <PRListScreen
      title={`${owner}/${repo}`}
      prs={prs}
      isLoading={isLoading}
      error={error}
      emptyMessage={`No ${stateFilter === 'all' ? '' : stateFilter + ' '}PRs in ${owner}/${repo}`}
      loadingMessage={`Loading PRs for ${owner}/${repo}...`}
      queryKeys={[['prs', owner, repo]]}
      stateFilter={stateFilter}
      onStateChange={setStateFilter}
      onSelect={onSelect}
    />
  )
}

export function BrowseRepoScreen({ onSelect, isActive = true }: BrowseRepoScreenProps): React.ReactElement {
  const { setBrowseRepo, clearBrowseRepo } = useRepoContext()
  const { addRecentRepo } = useRecentRepos()
  const [selectedRepo, setSelectedRepo] = useState<{ readonly owner: string; readonly repo: string } | null>(null)

  const handleSelectRepo = useCallback(
    (owner: string, repo: string) => {
      setSelectedRepo({ owner, repo })
      setBrowseRepo(owner, repo)
      addRecentRepo(owner, repo)
    },
    [setBrowseRepo, addRecentRepo],
  )

  const handleBack = useCallback(() => {
    setSelectedRepo(null)
    clearBrowseRepo()
  }, [clearBrowseRepo])

  if (selectedRepo) {
    return (
      <BrowseList
        owner={selectedRepo.owner}
        repo={selectedRepo.repo}
        onBack={handleBack}
        onSelect={onSelect}
      />
    )
  }

  return <BrowsePicker onSelectRepo={handleSelectRepo} isActive={isActive} />
}

export { validateRepoInput, parseRepoUrl }
