import React, { useState, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import { Modal } from '../common/Modal'
import type { User } from '../../models/user'

interface AssigneePickerModalProps {
  readonly collaborators: readonly User[]
  readonly currentAssignees: readonly string[]
  readonly onSubmit: (assignees: readonly string[]) => void
  readonly onClose: () => void
  readonly isSubmitting: boolean
  readonly isLoading: boolean
  readonly error: string | null
}

/**
 * Filter collaborators by search query, matching against login name.
 */
function filterCollaborators(
  collaborators: readonly User[],
  query: string,
): readonly User[] {
  if (!query.trim()) return collaborators
  const lower = query.toLowerCase()
  return collaborators.filter((c) => c.login.toLowerCase().includes(lower))
}

/**
 * Detect whether the assignee set has changed from the original.
 */
function hasChanges(
  currentAssignees: readonly string[],
  selectedAssignees: ReadonlySet<string>,
): boolean {
  const currentSet = new Set(currentAssignees)
  if (currentSet.size !== selectedAssignees.size) return true
  for (const assignee of selectedAssignees) {
    if (!currentSet.has(assignee)) return true
  }
  return false
}

export function AssigneePickerModal({
  collaborators,
  currentAssignees,
  onSubmit,
  onClose,
  isSubmitting,
  isLoading,
  error,
}: AssigneePickerModalProps): React.ReactElement {
  const theme = useTheme()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [selectedAssignees, setSelectedAssignees] = useState<ReadonlySet<string>>(
    () => new Set(currentAssignees),
  )

  const filteredCollaborators = useMemo(
    () => filterCollaborators(collaborators, searchQuery),
    [collaborators, searchQuery],
  )

  const changed = useMemo(
    () => hasChanges(currentAssignees, selectedAssignees),
    [currentAssignees, selectedAssignees],
  )

  // Reset selected index when search changes
  React.useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  useInput(
    (input, key) => {
      if (isSubmitting || isLoading) return

      if (isSearching) {
        if (key.escape) {
          if (searchQuery) {
            setSearchQuery('')
          } else {
            setIsSearching(false)
          }
        } else if (key.return) {
          setIsSearching(false)
        } else if (key.backspace || key.delete) {
          setSearchQuery((prev) => prev.slice(0, -1))
        } else if (input && !key.ctrl && !key.meta) {
          setSearchQuery((prev) => prev + input)
        }
        return
      }

      if (key.escape) {
        onClose()
      } else if (input === '/' || input === 'f') {
        setIsSearching(true)
      } else if (input === 'j' || key.downArrow) {
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredCollaborators.length - 1),
        )
      } else if (input === 'k' || key.upArrow) {
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (input === ' ') {
        toggleSelectedCollaborator()
      } else if (key.return && !key.ctrl && !key.meta) {
        toggleSelectedCollaborator()
      } else if (input === 's' && key.ctrl) {
        if (changed) {
          onSubmit([...selectedAssignees])
        }
      }
    },
    { isActive: true },
  )

  function toggleSelectedCollaborator(): void {
    const user = filteredCollaborators[selectedIndex]
    if (user) {
      setSelectedAssignees((prev) => {
        if (prev.has(user.login)) {
          return new Set([...prev].filter((l) => l !== user.login))
        }
        return new Set([...prev, user.login])
      })
    }
  }

  if (isLoading) {
    return (
      <Modal>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.colors.accent}
          backgroundColor={theme.colors.bg}
          paddingX={2}
          paddingY={1}
          gap={1}
          width={50}
        >
          <Text color={theme.colors.accent} bold>
            Assignees
          </Text>
          <Text color={theme.colors.muted}>Loading collaborators...</Text>
          <Text color={theme.colors.muted} dimColor>
            Esc: cancel
          </Text>
        </Box>
      </Modal>
    )
  }

  if (collaborators.length === 0) {
    return (
      <Modal>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.colors.accent}
          backgroundColor={theme.colors.bg}
          paddingX={2}
          paddingY={1}
          gap={1}
          width={50}
        >
          <Text color={theme.colors.accent} bold>
            Assignees
          </Text>
          <Text color={theme.colors.muted}>No collaborators available for this repository.</Text>
          <Text color={theme.colors.muted} dimColor>
            Esc: close
          </Text>
        </Box>
      </Modal>
    )
  }

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        backgroundColor={theme.colors.bg}
        paddingX={2}
        paddingY={1}
        gap={1}
        width={55}
      >
        <Text color={theme.colors.accent} bold>
          Assignees
        </Text>

        <Text color={theme.colors.muted}>
          Toggle assignees for this PR:
        </Text>

        {isSearching && (
          <Box>
            <Text color={theme.colors.accent}>Search: </Text>
            <Text color={theme.colors.text}>{searchQuery}</Text>
            <Text color={theme.colors.muted}>|</Text>
          </Box>
        )}

        {searchQuery && !isSearching && (
          <Text color={theme.colors.muted} dimColor>
            Filter: {searchQuery} ({filteredCollaborators.length} results)
          </Text>
        )}

        <Box flexDirection="column">
          {filteredCollaborators.map((user, index) => {
            const isChecked = selectedAssignees.has(user.login)
            const isFocused = index === selectedIndex
            const isCurrent = currentAssignees.includes(user.login)

            return (
              <Box key={user.login} gap={1}>
                <Text color={isFocused ? theme.colors.accent : theme.colors.muted}>
                  {isFocused ? '>' : ' '}
                </Text>
                <Text color={isChecked ? theme.colors.accent : theme.colors.muted}>
                  [{isChecked ? 'x' : ' '}]
                </Text>
                <Text
                  color={isFocused ? theme.colors.accent : theme.colors.text}
                  bold={isFocused}
                >
                  {user.login}
                </Text>
                {isCurrent && (
                  <Text color={theme.colors.muted} dimColor>
                    (current)
                  </Text>
                )}
              </Box>
            )
          })}
        </Box>

        {filteredCollaborators.length === 0 && searchQuery && (
          <Text color={theme.colors.muted}>No collaborators match &quot;{searchQuery}&quot;</Text>
        )}

        {changed && (
          <Text color={theme.colors.info}>
            {selectedAssignees.size} assignee{selectedAssignees.size !== 1 ? 's' : ''} selected
          </Text>
        )}

        {isSubmitting && (
          <Text color={theme.colors.info}>Updating assignees...</Text>
        )}

        {error && (
          <Text color={theme.colors.error}>{error}</Text>
        )}

        <Text color={theme.colors.muted} dimColor>
          j/k: navigate | Space/Enter: toggle | /: search | Ctrl+S: apply | Esc: cancel
        </Text>
      </Box>
    </Modal>
  )
}

export { filterCollaborators, hasChanges }
