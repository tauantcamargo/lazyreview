import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { TokenSource } from '../../services/Auth'

export function SettingRow({
  label,
  value,
  isSelected,
  isEditing,
  hint,
  children,
}: {
  readonly label: string
  readonly value: string
  readonly isSelected?: boolean
  readonly isEditing?: boolean
  readonly hint?: string
  readonly children?: React.ReactNode
}): React.ReactElement {
  const theme = useTheme()

  return (
    <Box gap={2} paddingX={2}>
      <Box width={20}>
        <Text
          color={isSelected ? theme.colors.accent : theme.colors.muted}
          bold={isSelected}
        >
          {isSelected ? '> ' : '  '}
          {label}
        </Text>
      </Box>
      {children ?? (
        <Text
          color={isEditing ? theme.colors.accent : theme.colors.text}
          inverse={isEditing}
        >
          {value}
        </Text>
      )}
      {hint && isSelected && !isEditing && (
        <Text color={theme.colors.muted} dimColor>
          ({hint})
        </Text>
      )}
    </Box>
  )
}

export function TokenSourceLabel({ source }: { readonly source: TokenSource }): React.ReactElement {
  const theme = useTheme()

  const labels: Record<TokenSource, { text: string; color: string }> = {
    manual: { text: 'Manual Token', color: theme.colors.warning },
    env: { text: 'Environment Variable', color: theme.colors.success },
    gh_cli: { text: 'GitHub CLI (gh)', color: theme.colors.info },
    none: { text: 'Not configured', color: theme.colors.error },
  }

  const { text, color } = labels[source]
  return <Text color={color}>{text}</Text>
}
