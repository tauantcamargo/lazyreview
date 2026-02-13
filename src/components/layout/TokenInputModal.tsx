import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { PasswordInput } from '@inkjs/ui'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from '../common/Modal'
import { getAuthProvider, getEnvVarName, getProviderMeta, getProviderTokenFilePath } from '../../services/Auth'

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

  const provider = getAuthProvider()
  const meta = getProviderMeta(provider)
  const envVarName = getEnvVarName(provider)
  const tokenFilePath = getProviderTokenFilePath(provider)

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
        backgroundColor={theme.colors.bg}
        paddingX={2}
        paddingY={1}
        gap={1}
      >
        <Text color={theme.colors.accent} bold>
          {meta.label} Token Required
        </Text>
        <Box flexDirection="column">
          <Text color={theme.colors.text}>
            No {meta.label} token found in your environment.
          </Text>
          <Text color={theme.colors.muted}>
            Please enter your {meta.label} Personal Access Token:
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text color={theme.colors.muted} dimColor>
            You can also set {envVarName} in your environment.
          </Text>
        </Box>
        {error && <Text color={theme.colors.error}>Error: {error}</Text>}
        <Box
          borderStyle="single"
          borderColor={theme.colors.border}
          paddingX={1}
          width={50}
        >
          <PasswordInput onChange={setValue} placeholder={meta.tokenPlaceholder} />
        </Box>
        <Box flexDirection="column">
          <Text color={theme.colors.muted} dimColor>
            The token will be saved to {tokenFilePath}
          </Text>
          <Text color={theme.colors.muted} dimColor>
            Press Enter to submit, Ctrl+C to quit.
          </Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.colors.info}>
            Get a token at: {meta.tokenUrl}
          </Text>
          <Text color={theme.colors.muted}>
            Required scopes: {meta.requiredScopes}
          </Text>
        </Box>
      </Box>
    </Modal>
  )
}
