import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { useTheme } from '../../theme/index'

const DEFAULT_LINE_LENGTH = 36

export function Divider({ title }: { readonly title?: string }): React.ReactElement {
  const theme = useTheme()
  const { stdout } = useStdout()
  const cols = stdout?.columns ?? 80
  const len = Math.min(DEFAULT_LINE_LENGTH, Math.max(10, cols - 8))
  const line = '─'.repeat(len)

  if (title) {
    const pad = Math.max(0, len - title.length - 2)
    const left = Math.floor(pad / 2)
    const right = pad - left
    const text = '─'.repeat(left) + ` ${title} ` + '─'.repeat(right)
    return (
      <Box paddingY={0}>
        <Text color={theme.colors.border}>{text}</Text>
      </Box>
    )
  }

  return (
    <Box paddingY={0}>
      <Text color={theme.colors.border}>{line}</Text>
    </Box>
  )
}
