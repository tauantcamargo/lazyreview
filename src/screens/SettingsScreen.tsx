import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput, PasswordInput } from '@inkjs/ui'
import { useTheme } from '../theme/index'
import type { ThemeName } from '../theme/index'
import { useConfig } from '../hooks/useConfig'
import { useAuth } from '../hooks/useAuth'
import { useStatusMessage } from '../hooks/useStatusMessage'
import { useInputFocus } from '../hooks/useInputFocus'
import { useBookmarkedRepos, validateBookmarkInput } from '../hooks/useBookmarkedRepos'
import { Divider } from '../components/common/Divider'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { SettingRow, TokenSourceLabel } from '../components/settings/SettingRow'
import { getAuthProvider, setAuthProvider, getProviderTokenFilePath, getProviderMeta, getInstanceAuthStatus } from '../services/Auth'
import type { TokenSource } from '../services/Auth'
import { getConfiguredInstances } from '../services/Config'
import type { Provider, ConfiguredInstance } from '../services/Config'

const THEME_ORDER: readonly ThemeName[] = ['tokyo-night', 'dracula', 'catppuccin-mocha', 'gruvbox', 'high-contrast', 'github-light']

const PROVIDER_ORDER: readonly Provider[] = ['github', 'gitlab', 'bitbucket', 'azure', 'gitea']

const PROVIDER_LABELS: Readonly<Record<Provider, string>> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  azure: 'Azure DevOps',
  gitea: 'Gitea / Forgejo',
}

const SUPPORTED_PROVIDERS: ReadonlySet<Provider> = new Set(['github', 'gitlab', 'bitbucket', 'azure', 'gitea'])

type SettingsItem =
  | 'provider'
  | 'token_source'
  | 'new_token'
  | 'theme'
  | 'page_size'
  | 'refresh_interval'
  | 'default_owner'
  | 'default_repo'
  | 'notifications'
  | 'notify_new_pr'
  | 'notify_update'
  | 'notify_review_request'
  | 'bookmarked_repos'

type EditingField = 'page_size' | 'refresh_interval' | 'default_owner' | 'default_repo' | 'new_token' | 'bookmark_add' | null

const SETTINGS_ITEMS: readonly SettingsItem[] = [
  'provider',
  'token_source',
  'new_token',
  'theme',
  'page_size',
  'refresh_interval',
  'default_owner',
  'default_repo',
  'notifications',
  'notify_new_pr',
  'notify_update',
  'notify_review_request',
  'bookmarked_repos',
]

export function SettingsScreen(): React.ReactElement {
  const theme = useTheme()
  const { config, loading: configLoading, error: configError, updateConfig } = useConfig()
  const {
    tokenInfo,
    availableSources,
    setPreferredSource,
    saveToken,
    loading: authLoading,
    refetch,
  } = useAuth()

  const { setStatusMessage } = useStatusMessage()
  const { setInputActive } = useInputFocus()
  const { bookmarkedRepos, addBookmark, removeBookmark } = useBookmarkedRepos()
  const [selectedItem, setSelectedItem] = useState<SettingsItem>('token_source')
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [editValue, setEditValue] = useState('')
  const [tokenMessage, setTokenMessage] = useState<string | null>(null)
  const [bookmarkSelectedIndex, setBookmarkSelectedIndex] = useState(0)
  const [bookmarkError, setBookmarkError] = useState<string | null>(null)
  const [instanceStatuses, setInstanceStatuses] = useState<
    ReadonlyMap<string, { readonly hasToken: boolean; readonly source: TokenSource }>
  >(new Map())

  // Compute configured instances from config
  const configuredInstances: readonly ConfiguredInstance[] = config
    ? getConfiguredInstances(config)
    : []

  // Load auth status for each configured instance
  useEffect(() => {
    if (!config) return
    const instances = getConfiguredInstances(config)
    // Only check non-default instances (default ones are covered by the main auth display)
    const nonDefaultInstances = instances.filter((i) => !i.isDefault)
    if (nonDefaultInstances.length === 0) return

    let cancelled = false
    const loadStatuses = async (): Promise<void> => {
      const entries: Array<[string, { hasToken: boolean; source: TokenSource }]> = []
      for (const inst of nonDefaultInstances) {
        const status = await getInstanceAuthStatus(inst.provider, inst.host)
        entries.push([`${inst.provider}:${inst.host}`, status])
      }
      if (!cancelled) {
        setInstanceStatuses(new Map(entries))
      }
    }
    loadStatuses()
    return () => { cancelled = true }
  }, [config])

  const isEditing = editingField !== null
  const isBookmarkSection = selectedItem === 'bookmarked_repos'

  const cycleProvider = (): void => {
    const currentProvider = (config?.provider ?? 'github') as Provider
    const currentIndex = PROVIDER_ORDER.indexOf(currentProvider)
    // Only cycle through supported providers
    const supportedProviders = PROVIDER_ORDER.filter((p) => SUPPORTED_PROVIDERS.has(p))
    const currentSupportedIndex = supportedProviders.indexOf(currentProvider)
    const nextIndex = (currentSupportedIndex + 1) % supportedProviders.length
    const nextProvider = supportedProviders[nextIndex]
    if (nextProvider) {
      updateConfig({ provider: nextProvider })
      setAuthProvider(nextProvider)
      // Invalidate auth queries so token re-check occurs
      refetch()
      setStatusMessage(`Provider switched to ${PROVIDER_LABELS[nextProvider]}`)
    }
  }

  const cycleTheme = (): void => {
    const currentTheme = (config?.theme ?? 'tokyo-night') as ThemeName
    const currentIndex = THEME_ORDER.indexOf(currentTheme)
    const nextIndex = (currentIndex + 1) % THEME_ORDER.length
    updateConfig({ theme: THEME_ORDER[nextIndex] })
    setStatusMessage('Saved')
  }

  const startEditing = (field: EditingField): void => {
    if (field === 'page_size') {
      setEditValue(String(config?.pageSize ?? 30))
    } else if (field === 'refresh_interval') {
      setEditValue(String(config?.refreshInterval ?? 60))
    } else if (field === 'default_owner') {
      setEditValue(config?.defaultOwner ?? '')
    } else if (field === 'default_repo') {
      setEditValue(config?.defaultRepo ?? '')
    } else if (field === 'new_token') {
      setEditValue('')
    } else if (field === 'bookmark_add') {
      setEditValue('')
      setBookmarkError(null)
    }
    setEditingField(field)
    setInputActive(true)
  }

  const cancelEditing = (): void => {
    setEditingField(null)
    setEditValue('')
    setBookmarkError(null)
    setInputActive(false)
  }

  const commitEdit = (): void => {
    const trimmed = editValue.trim()

    if (editingField === 'page_size') {
      const num = parseInt(trimmed, 10)
      if (!Number.isNaN(num) && num >= 1 && num <= 100) {
        updateConfig({ pageSize: num })
        setStatusMessage('Saved')
      }
    } else if (editingField === 'refresh_interval') {
      const num = parseInt(trimmed, 10)
      if (!Number.isNaN(num) && num >= 10 && num <= 600) {
        updateConfig({ refreshInterval: num })
        setStatusMessage('Saved')
      }
    } else if (editingField === 'default_owner') {
      updateConfig({ defaultOwner: trimmed || undefined })
      setStatusMessage('Saved')
    } else if (editingField === 'default_repo') {
      updateConfig({ defaultRepo: trimmed || undefined })
      setStatusMessage('Saved')
    } else if (editingField === 'new_token' && trimmed) {
      saveToken(trimmed)
        .then(() => {
          setTokenMessage('Token saved successfully!')
          cancelEditing()
          setTimeout(() => setTokenMessage(null), 3000)
        })
        .catch((err: unknown) => {
          setTokenMessage(`Error: ${String(err)}`)
          cancelEditing()
        })
      return
    } else if (editingField === 'bookmark_add' && trimmed) {
      const validation = validateBookmarkInput(trimmed)
      if (!validation.valid) {
        setBookmarkError(validation.error)
        return
      }
      const parts = trimmed.split('/')
      const owner = parts[0]?.trim() ?? ''
      const repo = parts.slice(1).join('/').trim()
      addBookmark(owner, repo)
      setStatusMessage('Bookmark added')
    }

    cancelEditing()
  }

  useInput(
    (input, key) => {
      if (isEditing) {
        if (key.escape) {
          cancelEditing()
        } else if (key.return) {
          commitEdit()
        }
        return
      }

      if (input === 'j' || key.downArrow) {
        const currentIndex = SETTINGS_ITEMS.indexOf(selectedItem)
        const nextIndex = Math.min(currentIndex + 1, SETTINGS_ITEMS.length - 1)
        setSelectedItem(SETTINGS_ITEMS[nextIndex]!)
      } else if (input === 'k' || key.upArrow) {
        const currentIndex = SETTINGS_ITEMS.indexOf(selectedItem)
        const prevIndex = Math.max(currentIndex - 1, 0)
        setSelectedItem(SETTINGS_ITEMS[prevIndex]!)
      } else if (key.return) {
        if (selectedItem === 'provider') {
          cycleProvider()
        } else if (selectedItem === 'token_source') {
          const currentSource = tokenInfo?.source ?? 'none'
          const sourceOrder: TokenSource[] = ['gh_cli', 'env', 'manual']
          const availableInOrder = sourceOrder.filter((s) => availableSources.includes(s))

          if (availableInOrder.length > 0) {
            const currentIndex = availableInOrder.indexOf(currentSource)
            const nextIndex = (currentIndex + 1) % availableInOrder.length
            setPreferredSource(availableInOrder[nextIndex]!)
          }
        } else if (selectedItem === 'new_token') {
          startEditing('new_token')
        } else if (selectedItem === 'theme') {
          cycleTheme()
        } else if (selectedItem === 'page_size') {
          startEditing('page_size')
        } else if (selectedItem === 'refresh_interval') {
          startEditing('refresh_interval')
        } else if (selectedItem === 'default_owner') {
          startEditing('default_owner')
        } else if (selectedItem === 'default_repo') {
          startEditing('default_repo')
        } else if (selectedItem === 'notifications') {
          const current = config?.notifications ?? true
          updateConfig({ notifications: !current })
          setStatusMessage(`Notifications ${!current ? 'enabled' : 'disabled'}`)
        } else if (selectedItem === 'notify_new_pr') {
          const current = config?.notifyOnNewPR ?? true
          updateConfig({ notifyOnNewPR: !current })
          setStatusMessage('Saved')
        } else if (selectedItem === 'notify_update') {
          const current = config?.notifyOnUpdate ?? true
          updateConfig({ notifyOnUpdate: !current })
          setStatusMessage('Saved')
        } else if (selectedItem === 'notify_review_request') {
          const current = config?.notifyOnReviewRequest ?? true
          updateConfig({ notifyOnReviewRequest: !current })
          setStatusMessage('Saved')
        }
      } else if (isBookmarkSection && input === 'a') {
        startEditing('bookmark_add')
      } else if (isBookmarkSection && (input === 'x' || input === 'd')) {
        const bookmark = bookmarkedRepos[bookmarkSelectedIndex]
        if (bookmark) {
          removeBookmark(bookmark.owner, bookmark.repo)
          setStatusMessage('Bookmark removed')
          if (bookmarkSelectedIndex >= bookmarkedRepos.length - 1) {
            setBookmarkSelectedIndex(Math.max(0, bookmarkedRepos.length - 2))
          }
        }
      }
    },
    { isActive: true },
  )

  // Sub-navigation for bookmark list when bookmark section is selected
  useInput(
    (input, key) => {
      if (input === 'J' || (key.downArrow && key.shift)) {
        setBookmarkSelectedIndex((prev) => Math.min(prev + 1, bookmarkedRepos.length - 1))
      } else if (input === 'K' || (key.upArrow && key.shift)) {
        setBookmarkSelectedIndex((prev) => Math.max(prev - 1, 0))
      }
    },
    { isActive: isBookmarkSection && !isEditing && bookmarkedRepos.length > 0 },
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

  const renderEditableField = (
    field: EditingField,
    placeholder: string,
  ): React.ReactElement => {
    if (editingField === field) {
      return (
        <Box borderStyle="single" borderColor={theme.colors.accent} paddingX={1} width={40}>
          {field === 'new_token' ? (
            <PasswordInput
              onChange={setEditValue}
              placeholder={placeholder}
            />
          ) : (
            <TextInput
              defaultValue={editValue}
              onChange={setEditValue}
              placeholder={placeholder}
            />
          )}
        </Box>
      )
    }
    return <></>
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} paddingY={1}>
        <Text color={theme.colors.accent} bold>
          Settings
        </Text>
      </Box>
      <Box paddingX={1}>
        <Divider />
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
          {editingField === 'new_token' ? (
            renderEditableField('new_token', getProviderMeta(getAuthProvider()).tokenPlaceholder)
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

      {/* Provider Instances Section */}
      {configuredInstances.filter((i) => !i.isDefault).length > 0 && (
        <>
          <Box paddingX={1} marginTop={1}>
            <Divider title="Provider Instances" />
          </Box>
          <Box flexDirection="column" paddingX={1} marginTop={0} marginBottom={1}>
            <Text color={theme.colors.secondary} bold>
              Configured Instances
            </Text>
          </Box>
          <Box flexDirection="column" gap={0}>
            {configuredInstances
              .filter((inst) => !inst.isDefault)
              .map((inst) => {
                const key = `${inst.provider}:${inst.host}`
                const status = instanceStatuses.get(key)
                const statusText = status?.hasToken
                  ? status.source === 'env' ? 'env' : status.source === 'gh_cli' ? 'cli' : 'token'
                  : 'no token'
                const statusColor = status?.hasToken ? theme.colors.success : theme.colors.error
                return (
                  <Box key={key} gap={2} paddingX={2}>
                    <Box width={20}>
                      <Text color={theme.colors.muted}>
                        {'  '}{PROVIDER_LABELS[inst.provider] ?? inst.provider}
                      </Text>
                    </Box>
                    <Text color={theme.colors.text}>{inst.host}</Text>
                    <Text color={statusColor}>[{statusText}]</Text>
                  </Box>
                )
              })}
          </Box>
        </>
      )}

      <Box paddingX={1} marginTop={1}>
        <Divider title="Configuration" />
      </Box>
      {/* Config Section */}
      <Box flexDirection="column" paddingX={1} marginTop={0} marginBottom={1}>
        <Text color={theme.colors.secondary} bold>
          Configuration
        </Text>
      </Box>

      <Box flexDirection="column" gap={0}>
        <SettingRow
          label="Provider"
          value={PROVIDER_LABELS[config?.provider ?? 'github'] ?? config?.provider ?? 'github'}
          isSelected={selectedItem === 'provider'}
          hint="Enter to switch"
        />
        <SettingRow
          label="Theme"
          value={config?.theme ?? 'tokyo-night'}
          isSelected={selectedItem === 'theme'}
          hint="Enter to cycle"
        />
        <SettingRow
          label="Page Size"
          value={String(config?.pageSize ?? 30)}
          isSelected={selectedItem === 'page_size'}
          isEditing={editingField === 'page_size'}
          hint="Enter to edit"
        >
          {editingField === 'page_size'
            ? renderEditableField('page_size', '1-100')
            : undefined}
        </SettingRow>
        <SettingRow
          label="Refresh Interval"
          value={`${config?.refreshInterval ?? 60}s`}
          isSelected={selectedItem === 'refresh_interval'}
          isEditing={editingField === 'refresh_interval'}
          hint="Enter to edit (10-600s)"
        >
          {editingField === 'refresh_interval'
            ? renderEditableField('refresh_interval', '10-600')
            : undefined}
        </SettingRow>
        <SettingRow
          label="Default Owner"
          value={config?.defaultOwner ?? '(not set)'}
          isSelected={selectedItem === 'default_owner'}
          isEditing={editingField === 'default_owner'}
          hint="Enter to edit"
        >
          {editingField === 'default_owner'
            ? renderEditableField('default_owner', 'owner')
            : undefined}
        </SettingRow>
        <SettingRow
          label="Default Repo"
          value={config?.defaultRepo ?? '(not set)'}
          isSelected={selectedItem === 'default_repo'}
          isEditing={editingField === 'default_repo'}
          hint="Enter to edit"
        >
          {editingField === 'default_repo'
            ? renderEditableField('default_repo', 'repo')
            : undefined}
        </SettingRow>
      </Box>

      <Box paddingX={1} marginTop={1}>
        <Divider title="Notifications" />
      </Box>
      {/* Notifications Section */}
      <Box flexDirection="column" paddingX={1} marginTop={0} marginBottom={1}>
        <Text color={theme.colors.secondary} bold>
          Notifications
        </Text>
      </Box>

      <Box flexDirection="column" gap={0}>
        <SettingRow
          label="Notifications"
          value={(config?.notifications ?? true) ? 'On' : 'Off'}
          isSelected={selectedItem === 'notifications'}
          hint="Enter to toggle"
        />
        <SettingRow
          label="New PRs"
          value={(config?.notifyOnNewPR ?? true) ? 'On' : 'Off'}
          isSelected={selectedItem === 'notify_new_pr'}
          hint="Enter to toggle"
        />
        <SettingRow
          label="PR Updates"
          value={(config?.notifyOnUpdate ?? true) ? 'On' : 'Off'}
          isSelected={selectedItem === 'notify_update'}
          hint="Enter to toggle"
        />
        <SettingRow
          label="Review Requests"
          value={(config?.notifyOnReviewRequest ?? true) ? 'On' : 'Off'}
          isSelected={selectedItem === 'notify_review_request'}
          hint="Enter to toggle"
        />
      </Box>

      <Box paddingX={1} marginTop={1}>
        <Divider title="Bookmarked Repos" />
      </Box>
      {/* Bookmarked Repos Section */}
      <Box flexDirection="column" paddingX={1} marginTop={0} marginBottom={1}>
        <Box gap={2}>
          <Text
            color={isBookmarkSection ? theme.colors.accent : theme.colors.secondary}
            bold
          >
            {isBookmarkSection ? '> ' : '  '}
            Bookmarked Repos
          </Text>
          {isBookmarkSection && (
            <Text color={theme.colors.muted} dimColor>
              a:add  x:remove  J/K:select
            </Text>
          )}
        </Box>
      </Box>

      {editingField === 'bookmark_add' && (
        <Box paddingX={2} flexDirection="column">
          <Box gap={1}>
            <Text color={theme.colors.secondary}>owner/repo:</Text>
            {renderEditableField('bookmark_add', 'e.g. facebook/react')}
          </Box>
          {bookmarkError && (
            <Box paddingLeft={2}>
              <Text color={theme.colors.error}>{bookmarkError}</Text>
            </Box>
          )}
        </Box>
      )}

      <Box flexDirection="column" paddingX={2}>
        {bookmarkedRepos.length === 0 ? (
          <Box paddingX={1}>
            <Text color={theme.colors.muted} dimColor>
              No bookmarked repos. {isBookmarkSection ? 'Press a to add.' : ''}
            </Text>
          </Box>
        ) : (
          bookmarkedRepos.map((bookmark, index) => {
            const isBmSelected = isBookmarkSection && index === bookmarkSelectedIndex
            return (
              <Box key={`${bookmark.owner}/${bookmark.repo}`} paddingX={1}>
                <Text
                  color={isBmSelected ? theme.colors.accent : theme.colors.text}
                  bold={isBmSelected}
                  backgroundColor={isBmSelected ? theme.colors.selection : undefined}
                >
                  {isBmSelected ? '> ' : '  '}
                  {bookmark.owner}/{bookmark.repo}
                </Text>
              </Box>
            )
          })
        )}
      </Box>

      <Box paddingX={1} paddingTop={2} flexDirection="column">
        <Text color={theme.colors.muted} dimColor>
          Config: ~/.config/lazyreview/config.yaml
        </Text>
        <Text color={theme.colors.muted} dimColor>
          Token: {getProviderTokenFilePath(getAuthProvider()).replace(process.env['HOME'] ?? '', '~')}
        </Text>
        <Text color={theme.colors.muted} dimColor>
          Keybindings: add keybindingOverrides to config.yaml (see ? help for defaults)
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
