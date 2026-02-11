import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from '../common/Modal'
import { MultiLineInput } from '../common/MultiLineInput'

interface CommentModalProps {
  readonly title: string
  readonly context?: string
  readonly onSubmit: (body: string) => void
  readonly onClose: () => void
  readonly isSubmitting: boolean
  readonly error: string | null
}

export function CommentModal({
  title,
  context,
  onSubmit,
  onClose,
  isSubmitting,
  error,
}: CommentModalProps): React.ReactElement {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const [body, setBody] = useState('')

  useEffect(() => {
    setInputActive(true)
    return () => setInputActive(false)
  }, [setInputActive])

  const handleSubmit = useCallback(() => {
    const trimmed = body.trim()
    if (trimmed && !isSubmitting) {
      onSubmit(trimmed)
    }
  }, [body, isSubmitting, onSubmit])

  useInput(
    (_input, key) => {
      if (isSubmitting) return

      if (key.escape) {
        onClose()
      } else if (key.return && (key.meta || key.ctrl)) {
        handleSubmit()
      }
    },
    { isActive: true },
  )

  const isInline = title === 'Add Inline Comment'

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
        width={70}
      >
        <Text color={theme.colors.accent} bold>
          {title}
        </Text>

        {context && (
          <Text color={theme.colors.muted}>{context}</Text>
        )}

        <Box
          borderStyle="single"
          borderColor={theme.colors.border}
          paddingX={1}
          paddingY={0}
          flexDirection="column"
        >
          <MultiLineInput
            placeholder="Write your comment... (Markdown supported)"
            onChange={setBody}
            isActive={!isSubmitting}
            minHeight={5}
          />
        </Box>

        <Box flexDirection="column" gap={0}>
          <Text color={theme.colors.muted} dimColor>
            Markdown: **bold** *italic* `code` ```lang code block```
          </Text>
          {isInline && (
            <Text color={theme.colors.muted} dimColor>
              Suggestion: ```suggestion{'\n'}replacement code{'\n'}```
            </Text>
          )}
          <Text color={theme.colors.muted} dimColor>
            Tab: indent | Enter: new line | Ctrl+Enter: submit | Esc: cancel
          </Text>
        </Box>

        {isSubmitting && (
          <Text color={theme.colors.info}>Posting comment...</Text>
        )}

        {error && (
          <Text color={theme.colors.error}>{error}</Text>
        )}
      </Box>
    </Modal>
  )
}
