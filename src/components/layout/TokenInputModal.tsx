import React from 'react'
import { Box, Text, Modal, TextInput, useTextInput } from 'tuir'
import type { ModalData } from 'tuir'
import { useTheme } from '../../theme/index'

interface TokenInputModalProps {
  readonly modal: ModalData
  readonly onSubmit: (token: string) => void
  readonly error?: string | null
}

export function TokenInputModal({
  modal,
  onSubmit,
  error,
}: TokenInputModalProps): React.ReactElement {
  const theme = useTheme()
  const { onChange } = useTextInput('')

  const handleSubmit = (submittedValue: string): void => {
    const trimmed = submittedValue.trim()
    if (trimmed) {
      onSubmit(trimmed)
    }
  }

  return (
    <Modal
      modal={modal}
      justifySelf="center"
      alignSelf="center"
      borderStyle="round"
      borderColor={theme.colors.accent}
      paddingX={2}
      paddingY={1}
    >
      <Box flexDirection="column" gap={1}>
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
          <TextInput
            onChange={onChange}
            onEnter={handleSubmit}
            cursorColor={theme.colors.accent}
            textStyle={{ color: theme.colors.text }}
          />
        </Box>
        <Box flexDirection="column">
          <Text color={theme.colors.muted} dimColor>
            The token will be saved to your shell profile.
          </Text>
          <Text color={theme.colors.muted} dimColor>
            Press Enter to submit, Ctrl+C to cancel.
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
