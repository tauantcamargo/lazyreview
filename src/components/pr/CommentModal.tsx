import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from '../common/Modal'

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

  useInput(
    (_input, key) => {
      if (isSubmitting) return

      if (key.escape) {
        onClose()
      } else if (key.return && body.trim()) {
        onSubmit(body.trim())
      }
    },
    { isActive: true },
  )

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        // @ts-ignore
        backgroundColor={theme.colors.bg}
        paddingX={2}
        paddingY={1}
        gap={1}
        width={60}
      >
        <Text color={theme.colors.accent} bold>
          {title}
        </Text>

        {context && (
          <Text color={theme.colors.muted}>{context}</Text>
        )}

        <Box borderStyle="single" borderColor={theme.colors.border} paddingX={1}>
          <TextInput
            defaultValue={body}
            onChange={setBody}
            placeholder="Enter your comment..."
          />
        </Box>

        {isSubmitting && (
          <Text color={theme.colors.info}>Posting comment...</Text>
        )}

        {error && (
          <Text color={theme.colors.error}>{error}</Text>
        )}

        <Text color={theme.colors.muted} dimColor>
          Enter: submit | Esc: cancel
        </Text>
      </Box>
    </Modal>
  )
}
