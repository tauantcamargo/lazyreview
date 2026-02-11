import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../theme/index'
import { useConfig } from '../hooks/useConfig'
import { LoadingIndicator } from '../components/common/LoadingIndicator'

function SettingRow({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}): React.ReactElement {
  const theme = useTheme()

  return (
    <Box gap={2} paddingX={2}>
      <Box width={20}>
        <Text color={theme.colors.muted}>{label}</Text>
      </Box>
      <Text color={theme.colors.text}>{value}</Text>
    </Box>
  )
}

export function SettingsScreen(): React.ReactElement {
  const theme = useTheme()
  const { config, loading, error } = useConfig()

  if (loading) {
    return <LoadingIndicator message="Loading settings..." />
  }

  if (error) {
    return (
      <Box padding={1}>
        <Text color={theme.colors.error}>Error: {error}</Text>
      </Box>
    )
  }

  if (!config) {
    return (
      <Box padding={1}>
        <Text color={theme.colors.muted}>No config loaded</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} paddingY={1}>
        <Text color={theme.colors.accent} bold>
          Settings
        </Text>
      </Box>
      <Box flexDirection="column" gap={0}>
        <SettingRow label="Provider" value={config.provider} />
        <SettingRow label="Theme" value={config.theme} />
        <SettingRow
          label="Default Owner"
          value={config.defaultOwner ?? '(not set)'}
        />
        <SettingRow
          label="Default Repo"
          value={config.defaultRepo ?? '(not set)'}
        />
        <SettingRow label="Page Size" value={String(config.pageSize)} />
      </Box>
      <Box paddingX={1} paddingTop={2}>
        <Text color={theme.colors.muted} dimColor>
          Config path: ~/.config/lazyreview/config.yaml
        </Text>
      </Box>
    </Box>
  )
}
