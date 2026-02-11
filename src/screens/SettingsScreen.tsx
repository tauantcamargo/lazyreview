import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useTheme } from '../theme/index'
import { useConfig } from '../hooks/useConfig'
import { useAuth } from '../hooks/useAuth'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import type { TokenSource } from '../services/Auth'

function SettingRow({
  label,
  value,
  isSelected,
  isEditing,
}: {
  readonly label: string
  readonly value: string
  readonly isSelected?: boolean
  readonly isEditing?: boolean
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
      <Text
        color={isEditing ? theme.colors.accent : theme.colors.text}
        inverse={isEditing}
      >
        {value}
      </Text>
    </Box>
  )
}

function TokenSourceLabel({ source }: { readonly source: TokenSource }): React.ReactElement {
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

type SettingsItem = 'token_source' | 'new_token' | 'theme' | 'page_size'

export function SettingsScreen(): React.ReactElement {
  const theme = useTheme()
  const { config, loading: configLoading, error: configError } = useConfig()
  const {
    tokenInfo,
    availableSources,
    setPreferredSource,
    saveToken,
    loading: authLoading,
  } = useAuth()

  const [selectedItem, setSelectedItem] = useState<SettingsItem>('token_source')
  const [isEditingToken, setIsEditingToken] = useState(false)
  const [newTokenValue, setNewTokenValue] = useState('')
  const [tokenMessage, setTokenMessage] = useState<string | null>(null)

  const settingsItems: SettingsItem[] = ['token_source', 'new_token', 'theme', 'page_size']

  useInput(
    (input, key) => {
      if (isEditingToken) {
        if (key.escape) {
          setIsEditingToken(false)
          setNewTokenValue('')
        } else if (key.return && newTokenValue.trim()) {
          saveToken(newTokenValue.trim())
            .then(() => {
              setTokenMessage('Token saved successfully!')
              setIsEditingToken(false)
              setNewTokenValue('')
              setTimeout(() => setTokenMessage(null), 3000)
            })
            .catch((err) => {
              setTokenMessage(`Error: ${String(err)}`)
            })
        }
        return
      }

      if (input === 'j' || key.downArrow) {
        const currentIndex = settingsItems.indexOf(selectedItem)
        const nextIndex = Math.min(currentIndex + 1, settingsItems.length - 1)
        setSelectedItem(settingsItems[nextIndex]!)
      } else if (input === 'k' || key.upArrow) {
        const currentIndex = settingsItems.indexOf(selectedItem)
        const prevIndex = Math.max(currentIndex - 1, 0)
        setSelectedItem(settingsItems[prevIndex]!)
      } else if (key.return) {
        if (selectedItem === 'token_source') {
          // Cycle through available sources
          const currentSource = tokenInfo?.source ?? 'none'
          const sourceOrder: TokenSource[] = ['gh_cli', 'env', 'manual']
          const availableInOrder = sourceOrder.filter((s) => availableSources.includes(s))

          if (availableInOrder.length > 0) {
            const currentIndex = availableInOrder.indexOf(currentSource)
            const nextIndex = (currentIndex + 1) % availableInOrder.length
            setPreferredSource(availableInOrder[nextIndex]!)
          }
        } else if (selectedItem === 'new_token') {
          setIsEditingToken(true)
        }
      }
    },
    { isActive: true },
  )

  if (configLoading || authLoading) {
    return <LoadingIndicator message="Loading settings..." />
  }

  if (configError) {
    return (
      <Box padding={1}>
        <Text color={theme.colors.error}>Error: {configError}</Text>
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

      {/* Token Section */}
      <Box flexDirection="column" paddingX={1} marginBottom={1}>
        <Text color={theme.colors.secondary} bold>
          Authentication
        </Text>
      </Box>

      <Box flexDirection="column" gap={0}>
        <Box gap={2} paddingX={2}>
          <Box width={20}>
            <Text
              color={selectedItem === 'token_source' ? theme.colors.accent : theme.colors.muted}
              bold={selectedItem === 'token_source'}
            >
              {selectedItem === 'token_source' ? '> ' : '  '}
              Token Source
            </Text>
          </Box>
          <TokenSourceLabel source={tokenInfo?.source ?? 'none'} />
          {availableSources.length > 1 && selectedItem === 'token_source' && (
            <Text color={theme.colors.muted} dimColor>
              (Enter to switch)
            </Text>
          )}
        </Box>

        <Box gap={2} paddingX={2}>
          <Box width={20}>
            <Text color={theme.colors.muted}>  Token</Text>
          </Box>
          <Text color={theme.colors.text}>
            {tokenInfo?.maskedToken ?? '(none)'}
          </Text>
        </Box>

        <Box gap={2} paddingX={2}>
          <Box width={20}>
            <Text color={theme.colors.muted}>  Available</Text>
          </Box>
          <Text color={theme.colors.muted}>
            {availableSources.length > 0
              ? availableSources.join(', ')
              : 'none'}
          </Text>
        </Box>

        <Box gap={2} paddingX={2} marginTop={1}>
          <Box width={20}>
            <Text
              color={selectedItem === 'new_token' ? theme.colors.accent : theme.colors.muted}
              bold={selectedItem === 'new_token'}
            >
              {selectedItem === 'new_token' ? '> ' : '  '}
              Set New Token
            </Text>
          </Box>
          {isEditingToken ? (
            <Box borderStyle="single" borderColor={theme.colors.accent} paddingX={1} width={40}>
              <TextInput
                defaultValue={newTokenValue}
                onChange={setNewTokenValue}
                placeholder="ghp_xxxx..."
              />
            </Box>
          ) : (
            <Text color={theme.colors.muted} dimColor>
              (Enter to add)
            </Text>
          )}
        </Box>

        {tokenMessage && (
          <Box paddingX={4} marginTop={1}>
            <Text
              color={tokenMessage.startsWith('Error') ? theme.colors.error : theme.colors.success}
            >
              {tokenMessage}
            </Text>
          </Box>
        )}
      </Box>

      {/* Config Section */}
      <Box flexDirection="column" paddingX={1} marginTop={2} marginBottom={1}>
        <Text color={theme.colors.secondary} bold>
          Configuration
        </Text>
      </Box>

      <Box flexDirection="column" gap={0}>
        <SettingRow
          label="Theme"
          value={config?.theme ?? 'tokyo-night'}
          isSelected={selectedItem === 'theme'}
        />
        <SettingRow
          label="Page Size"
          value={String(config?.pageSize ?? 30)}
          isSelected={selectedItem === 'page_size'}
        />
        <SettingRow
          label="Provider"
          value={config?.provider ?? 'github'}
        />
        <SettingRow
          label="Default Owner"
          value={config?.defaultOwner ?? '(not set)'}
        />
        <SettingRow
          label="Default Repo"
          value={config?.defaultRepo ?? '(not set)'}
        />
      </Box>

      <Box paddingX={1} paddingTop={2} flexDirection="column">
        <Text color={theme.colors.muted} dimColor>
          Config: ~/.config/lazyreview/config.yaml
        </Text>
        <Text color={theme.colors.muted} dimColor>
          Token: ~/.config/lazyreview/.token
        </Text>
      </Box>

      <Box paddingX={1} paddingTop={1}>
        <Text color={theme.colors.muted} dimColor>
          j/k: navigate | Enter: select/toggle | Esc: cancel
        </Text>
      </Box>
    </Box>
  )
}
