import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from '../common/Modal'

interface TokenInputModalProps {
  readonly onClose: () => void
  readonly onSubmit: (token: string) => void
  readonly error?: string | null
}

export function TokenInputModal({
  onSubmit,
  error,
}: TokenInputModalProps): React.ReactElement {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const [value, setValue] = useState('')

  // Disable global shortcuts while this modal is open
  useEffect(() => {
    setInputActive(true)
    return () => setInputActive(false)
  }, [setInputActive])

  const handleSubmit = (): void => {
    const trimmed = value.trim()
    if (trimmed) {
      onSubmit(trimmed)
    }
  }

  useInput((_input, key) => {
    if (key.return) {
      handleSubmit()
    }
  })

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
      >
        <Text color={theme.colors.accent} bold>
          GitHub Token Required
        </Text>
        <Box flexDirection="column">
          <Text color={theme.colors.text}>
            No GitHub token found in your environment.
          </Text>
          <Text color={theme.colors.muted}>
            Please enter your GitHub Personal Access Token:
          </Text>
        </Box>
        {error && <Text color={theme.colors.error}>Error: {error}</Text>}
        <Box
          borderStyle="single"
          borderColor={theme.colors.border}
          paddingX={1}
          width={50}
        >
          <TextInput defaultValue={value} onChange={setValue} />
        </Box>
        <Box flexDirection="column">
          <Text color={theme.colors.muted} dimColor>
            The token will be saved to ~/.config/lazyreview/.token
          </Text>
          <Text color={theme.colors.muted} dimColor>
            Press Enter to submit, Ctrl+C to quit.
          </Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.colors.info}>
            Get a token at: github.com/settings/tokens
          </Text>
          <Text color={theme.colors.muted}>
            Required scopes: repo, read:user
          </Text>
        </Box>
      </Box>
    </Modal>
  )
}
