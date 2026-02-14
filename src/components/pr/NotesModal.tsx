import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from '../common/Modal'
import { MultiLineInput } from '../common/MultiLineInput'

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Returns the appropriate modal title based on whether a note already exists. */
export function getNotesModalTitle(isEditing: boolean): string {
  return isEditing ? 'Edit Note' : 'Add Note'
}

/** Compute the character count for the note content. */
export function computeCharCount(content: string): number {
  return content.length
}

/** Build the keyboard hint text shown at the bottom of the modal. */
export function getNotesHintText(hasExistingNote: boolean): string {
  const parts = [
    'Enter: new line',
    'Ctrl+S: save',
    'Esc: cancel',
  ]
  if (hasExistingNote) {
    parts.push('Ctrl+D: delete')
  }
  return parts.join(' | ')
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotesModalProps {
  /** Whether the modal is open */
  readonly isOpen: boolean
  /** Existing note content (null for new note) */
  readonly initialContent: string | null
  /** Called with the note content when saved */
  readonly onSave: (content: string) => void
  /** Called when the note should be deleted */
  readonly onDelete: () => void
  /** Called when the modal is cancelled */
  readonly onClose: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotesModal({
  isOpen,
  initialContent,
  onSave,
  onDelete,
  onClose,
}: NotesModalProps): React.ReactElement | null {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const [content, setContent] = useState(initialContent ?? '')
  const isEditing = initialContent !== null

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent ?? '')
      setInputActive(true)
    }
    return () => setInputActive(false)
  }, [isOpen, initialContent, setInputActive])

  const handleSave = useCallback(() => {
    const trimmed = content.trim()
    if (trimmed.length > 0) {
      onSave(trimmed)
    }
  }, [content, onSave])

  useInput(
    (_input, key) => {
      if (!isOpen) return

      if (key.escape) {
        onClose()
      } else if (_input === 's' && key.ctrl) {
        handleSave()
      } else if (_input === 'd' && key.ctrl && isEditing) {
        onDelete()
      }
    },
  )

  if (!isOpen) return null

  const charCount = computeCharCount(content)
  const title = getNotesModalTitle(isEditing)
  const hintText = getNotesHintText(isEditing)

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
        width={60}
      >
        {/* Title bar */}
        <Box gap={1}>
          <Text color={theme.colors.accent} bold>
            {title}
          </Text>
          <Text color={theme.colors.muted}>
            (private, local only)
          </Text>
        </Box>

        {/* Editor */}
        <Box
          borderStyle="single"
          borderColor={theme.colors.border}
          paddingX={1}
          paddingY={0}
          flexDirection="column"
        >
          <MultiLineInput
            placeholder="Write your notes here..."
            defaultValue={initialContent ?? ''}
            onChange={setContent}
            isActive={isOpen}
            minHeight={5}
          />
        </Box>

        {/* Character count */}
        <Box justifyContent="flex-end">
          <Text color={theme.colors.muted} dimColor>
            {charCount} character{charCount !== 1 ? 's' : ''}
          </Text>
        </Box>

        {/* Keyboard hints */}
        <Text color={theme.colors.muted} dimColor>
          {hintText}
        </Text>
      </Box>
    </Modal>
  )
}
