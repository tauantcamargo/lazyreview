import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useTheme } from '../../theme/index'

interface TokenInputModalProps {
  readonly onClose: () => void
  readonly onSubmit: (token: string) => void
  readonly error?: string | null
}

export function TokenInputModal({
  onClose,
  onSubmit,
  error,
}: TokenInputModalProps): React.ReactElement {
  const theme = useTheme()
  const [value, setValue] = useState('')

  const handleSubmit = (): void => {
    const trimmed = value.trim()
    if (trimmed) {
      onSubmit(trimmed)
    }
  }

  useInput((input, key) => {
    if (key.return) {
      handleSubmit()
    }
  })

  return (
    <Box
      position="absolute"
      justifyContent="center"
      alignItems="center"
      width="100%"
      height="100%"
    >
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
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
    </Box>
  )
}
