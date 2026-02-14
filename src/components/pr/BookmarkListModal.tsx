import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from '../common/Modal'
import type { DiffBookmark } from '../../utils/diff-bookmarks'

/**
 * Truncate a filename for display, keeping the tail visible.
 */
export function truncateFilename(filename: string, maxLen: number): string {
  if (filename.length <= maxLen) return filename
  return '...' + filename.slice(filename.length - maxLen + 3)
}

interface BookmarkRowProps {
  readonly bookmark: DiffBookmark
  readonly isSelected: boolean
  readonly accentColor: string
  readonly textColor: string
  readonly mutedColor: string
  readonly selectionBg: string
  readonly selectionFg: string
  readonly maxFileLen: number
}

function BookmarkRow({
  bookmark,
  isSelected,
  accentColor,
  textColor,
  mutedColor,
  selectionBg,
  selectionFg,
  maxFileLen,
}: BookmarkRowProps): React.ReactElement {
  const displayFile = truncateFilename(bookmark.file, maxFileLen)
  const fgColor = isSelected ? selectionFg : textColor

  return (
    <Box
      gap={1}
      paddingX={1}
      backgroundColor={isSelected ? selectionBg : undefined}
    >
      <Text color={isSelected ? selectionFg : accentColor}>
        {isSelected ? '>' : ' '}
      </Text>
      <Box width={3}>
        <Text color={isSelected ? selectionFg : accentColor} bold>
          {bookmark.register}
        </Text>
      </Box>
      <Box flexGrow={1} minWidth={0} overflow="hidden">
        <Text wrap="truncate-end" color={fgColor}>
          {displayFile}
        </Text>
      </Box>
      <Box width={8} justifyContent="flex-end">
        <Text color={isSelected ? selectionFg : mutedColor}>
          L{bookmark.line}
        </Text>
      </Box>
    </Box>
  )
}

interface BookmarkListModalProps {
  readonly isOpen: boolean
  readonly bookmarks: readonly DiffBookmark[]
  readonly onJump: (bookmark: DiffBookmark) => void
  readonly onDelete: (register: string) => void
  readonly onClose: () => void
}

export function BookmarkListModal({
  isOpen,
  bookmarks,
  onJump,
  onDelete,
  onClose,
}: BookmarkListModalProps): React.ReactElement | null {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Mark input as active so global shortcuts are disabled
  useEffect(() => {
    if (isOpen) {
      setInputActive(true)
      return () => setInputActive(false)
    }
  }, [isOpen, setInputActive])

  // Clamp selection when bookmarks change (e.g., after deletion)
  useEffect(() => {
    if (bookmarks.length > 0) {
      setSelectedIndex((prev) => Math.min(prev, bookmarks.length - 1))
    } else {
      setSelectedIndex(0)
    }
  }, [bookmarks.length])

  useInput(
    (input, key) => {
      if (key.escape) {
        onClose()
        return
      }

      if (key.return) {
        const selected = bookmarks[selectedIndex]
        if (selected) {
          onJump(selected)
        }
        return
      }

      // Navigate with j/k or arrow keys
      if (input === 'j' || key.downArrow) {
        setSelectedIndex((prev) =>
          Math.min(prev + 1, bookmarks.length - 1),
        )
        return
      }
      if (input === 'k' || key.upArrow) {
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      // Delete selected bookmark
      if (input === 'd') {
        const selected = bookmarks[selectedIndex]
        if (selected) {
          onDelete(selected.register)
        }
        return
      }
    },
    { isActive: isOpen },
  )

  if (!isOpen) return null

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        backgroundColor={theme.colors.bg}
        paddingX={1}
        paddingY={1}
        width={70}
      >
        {/* Header */}
        <Box justifyContent="space-between" paddingX={1}>
          <Text color={theme.colors.accent} bold>
            Bookmarks
          </Text>
          <Text color={theme.colors.muted}>
            {bookmarks.length} mark{bookmarks.length !== 1 ? 's' : ''}
          </Text>
        </Box>

        {/* Bookmark list */}
        <Box flexDirection="column" marginTop={1}>
          {bookmarks.length === 0 ? (
            <Box paddingX={2} paddingY={1}>
              <Text color={theme.colors.muted}>
                No bookmarks set. Press m then a-z to set a bookmark.
              </Text>
            </Box>
          ) : (
            bookmarks.map((bookmark, index) => (
              <BookmarkRow
                key={bookmark.register}
                bookmark={bookmark}
                isSelected={index === selectedIndex}
                accentColor={theme.colors.accent}
                textColor={theme.colors.text}
                mutedColor={theme.colors.muted}
                selectionBg={theme.colors.listSelectedBg}
                selectionFg={theme.colors.listSelectedFg}
                maxFileLen={50}
              />
            ))
          )}
        </Box>

        {/* Footer hints */}
        <Box paddingX={1} marginTop={1}>
          <Text color={theme.colors.muted} dimColor>
            j/k: navigate | Enter: jump | d: delete | Esc: close
          </Text>
        </Box>
      </Box>
    </Modal>
  )
}
