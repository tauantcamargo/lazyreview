import React, { useState, useCallback } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { Box, Text, useApp, useInput, useStdout } from 'ink'
import { ThemeProvider, getThemeByName } from './theme/index'
import type { ThemeName } from './theme/index'
import { TopBar } from './components/layout/TopBar'
import { Sidebar, SIDEBAR_ITEMS } from './components/layout/Sidebar'
import { MainPanel } from './components/layout/MainPanel'
import { StatusBar } from './components/layout/StatusBar'
import { useScreenContext, setScreenContext } from './hooks/useScreenContext'
import { HelpModal } from './components/layout/HelpModal'
import { TokenInputModal } from './components/layout/TokenInputModal'
import { OnboardingScreen } from './components/layout/OnboardingScreen'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { PRDetailScreen } from './screens/PRDetailScreen'
import { MyPRsScreen } from './screens/MyPRsScreen'
import { ReviewRequestsScreen } from './screens/ReviewRequestsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { InvolvedScreen } from './screens/InvolvedScreen'
import { ThisRepoScreen } from './screens/ThisRepoScreen'
import { BrowseRepoScreen } from './screens/BrowseRepoScreen'
import { Match } from 'effect'
import { parseGitHubPRUrl } from './utils/git'
import type { ProviderType } from './utils/git'
import { useAuth } from './hooks/useAuth'
import { useConfig } from './hooks/useConfig'
import { setAuthProvider, setAuthBaseUrl } from './services/Auth'
import type { Provider } from './services/Config'
import { useListNavigation } from './hooks/useListNavigation'
import { useActivePanel } from './hooks/useActivePanel'
import { useKeybindings } from './hooks/useKeybindings'
import { InputFocusProvider, useInputFocus } from './hooks/useInputFocus'
import { RepoContextProvider, useRepoContext } from './hooks/useRepoContext'
import { useSidebarCounts } from './hooks/useSidebarCounts'
import { useReadState } from './hooks/useReadState'
import { useRateLimit } from './hooks/useRateLimit'
import { useSidebarSections, getItemIndex } from './hooks/useSidebarSections'
import { useTokenExpired, clearTokenExpired } from './hooks/useTokenExpired'
import type { ConnectionStatus } from './components/layout/TopBar'
import type { PullRequest } from './models/pull-request'

type AppScreen =
  | { readonly type: 'list' }
  | {
      readonly type: 'detail'
      readonly pr: PullRequest
      readonly prList: readonly PullRequest[]
      readonly prIndex: number
    }

interface AppContentProps {
  readonly repoOwner: string | null
  readonly repoName: string | null
  readonly activeProvider: Provider
}

function AppContent({
  repoOwner,
  repoName,
  activeProvider,
}: AppContentProps): React.ReactElement {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const { user, isAuthenticated, loading, saveToken, error } = useAuth()
  const { config, updateConfig } = useConfig()
  const queryClient = useQueryClient()
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [currentScreen, setCurrentScreen] = useState<AppScreen>({
    type: 'list',
  })
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  // Start with modal hidden, show only after auth check fails
  const [showTokenInput, setShowTokenInput] = useState(false)
  // First-run onboarding
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Global 401 detection — shows token modal when token expires mid-session
  const { isTokenExpired } = useTokenExpired()

  // Input focus tracking (for disabling shortcuts when typing)
  const { isInputActive } = useInputFocus()

  // Panel focus management
  const { activePanel, setActivePanel } = useActivePanel({
    hasSelection: currentScreen.type === 'detail',
    isInputActive,
  })

  // Sidebar sections (collapsible groups)
  const { collapsedSections, toggleSection, navigableEntries } = useSidebarSections()

  // Sidebar navigation over navigable entries (section headers + visible items)
  const { selectedIndex: navIndex } = useListNavigation({
    itemCount: navigableEntries.length,
    viewportHeight: navigableEntries.length,
    isActive: activePanel === 'sidebar' && !showHelp && !showTokenInput && !showOnboarding && !isInputActive,
  })

  // Map navigation index to actual sidebar item index
  const currentEntry = navigableEntries[navIndex]
  const sidebarIndex = currentEntry ? (getItemIndex(currentEntry) ?? 0) : 0

  // Sidebar counts from query cache
  const { isUnread } = useReadState()
  const sidebarCounts = useSidebarCounts(isUnread)

  // Show token modal when not authenticated (covers invalid token case)
  React.useEffect(() => {
    if (!loading && !isAuthenticated && !showTokenInput) {
      setShowTokenInput(true)
    } else if (isAuthenticated && showTokenInput && !isTokenExpired) {
      setShowTokenInput(false)
    }
  }, [loading, isAuthenticated, showTokenInput, isTokenExpired])

  // Show token modal when token expires mid-session (401 detected)
  React.useEffect(() => {
    if (isTokenExpired && !showTokenInput) {
      setShowTokenInput(true)
    }
  }, [isTokenExpired, showTokenInput])

  // Show onboarding for first-time users
  React.useEffect(() => {
    if (config && !config.hasOnboarded && !showOnboarding) {
      setShowOnboarding(true)
    }
  }, [config, showOnboarding])

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false)
    updateConfig({ hasOnboarded: true })
  }, [updateConfig])

  const handleTokenSubmit = useCallback(
    async (token: string) => {
      try {
        setTokenError(null)
        await saveToken(token)
        // Clear token expiration flag and retry all failed queries
        clearTokenExpired()
        queryClient.invalidateQueries()
      } catch (err) {
        setTokenError(String(err))
      }
    },
    [saveToken, queryClient],
  )

  // Global keyboard shortcuts (using configurable keybindings)
  const { matchesAction } = useKeybindings('global')

  useInput(
    (input, key) => {
      // Handle modals first
      if (showHelp || showTokenInput || showOnboarding) {
        if (key.escape || (showHelp && matchesAction(input, key, 'toggleHelp'))) {
          setShowHelp(false)
        }
        return
      }

      if (matchesAction(input, key, 'toggleSidebar')) {
        setSidebarVisible((prev) => !prev)
      } else if (matchesAction(input, key, 'toggleHelp')) {
        setShowHelp(true)
      } else if (input === 'q') {
        if (currentScreen.type === 'detail') {
          setCurrentScreen({ type: 'list' })
        } else {
          exit()
        }
      } else if (key.return && activePanel === 'sidebar') {
        if (currentEntry?.type === 'section') {
          toggleSection(currentEntry.sectionName)
        } else {
          setActivePanel('list')
        }
      }
    },
    { isActive: !showTokenInput && !showOnboarding && !isInputActive },
  )

  const handleSelectPR = useCallback(
    (pr: PullRequest, list?: readonly PullRequest[], index?: number) => {
      setCurrentScreen({
        type: 'detail',
        pr,
        prList: list ?? [pr],
        prIndex: index ?? 0,
      })
    },
    [],
  )

  const handleBackToList = useCallback(() => {
    setCurrentScreen({ type: 'list' })
  }, [])

  const handleNavigatePR = useCallback(
    (direction: 'next' | 'prev') => {
      if (currentScreen.type !== 'detail') return
      const { prList, prIndex } = currentScreen
      if (prList.length <= 1) return

      const newIndex =
        direction === 'next'
          ? (prIndex + 1) % prList.length
          : (prIndex - 1 + prList.length) % prList.length

      const newPR = prList[newIndex]
      if (newPR) {
        setCurrentScreen({
          type: 'detail',
          pr: newPR,
          prList,
          prIndex: newIndex,
        })
      }
    },
    [currentScreen],
  )

  function renderScreen(): React.ReactElement {
    if (currentScreen.type === 'detail') {
      // Extract owner/repo from PR URL for detail view
      const parsed = parseGitHubPRUrl(currentScreen.pr.html_url)
      const prOwner = parsed?.owner ?? repoOwner ?? ''
      const prRepo = parsed?.repo ?? repoName ?? ''

      return (
        <PRDetailScreen
          pr={currentScreen.pr}
          owner={prOwner}
          repo={prRepo}
          onBack={handleBackToList}
          onNavigate={handleNavigatePR}
          prIndex={currentScreen.prIndex}
          prTotal={currentScreen.prList.length}
        />
      )
    }

    // Navigation:
    // 0 - Involved (all PRs user is involved in)
    // 1 - My PRs (PRs user created)
    // 2 - For Review (PRs requesting user's review)
    // 3 - This Repo (PRs from current git directory)
    // 4 - Browse (browse arbitrary repos)
    // 5 - Settings
    return Match.value(sidebarIndex).pipe(
      Match.when(0, () => <InvolvedScreen onSelect={handleSelectPR} />),
      Match.when(1, () => <MyPRsScreen onSelect={handleSelectPR} />),
      Match.when(2, () => <ReviewRequestsScreen onSelect={handleSelectPR} />),
      Match.when(3, () => (
        <ThisRepoScreen
          owner={repoOwner}
          repo={repoName}
          onSelect={handleSelectPR}
        />
      )),
      Match.when(4, () => (
        <BrowseRepoScreen onSelect={handleSelectPR} isActive={activePanel !== 'sidebar'} />
      )),
      Match.when(5, () => <SettingsScreen />),
      Match.orElse(() => <InvolvedScreen onSelect={handleSelectPR} />),
    )
  }

  const terminalHeight = stdout?.rows ?? 24

  const { browseRepo } = useRepoContext()

  const repoPath =
    repoOwner && repoName ? `${repoOwner}/${repoName}` : undefined
  const browseRepoPath = browseRepo
    ? `${browseRepo.owner}/${browseRepo.repo}`
    : undefined

  // Set screen context for list-level screens
  // PRDetailScreen sets its own context based on active tab
  React.useEffect(() => {
    if (currentScreen.type !== 'detail') {
      if (sidebarIndex === 5) {
        setScreenContext('settings')
      } else if (sidebarIndex === 4) {
        setScreenContext('browse-picker')
      } else {
        setScreenContext('pr-list')
      }
    }
  }, [currentScreen.type, sidebarIndex])

  const screenContext = useScreenContext()

  // Connection status from rate limit + auth
  const rateLimit = useRateLimit()
  const connectionStatus: ConnectionStatus = !isAuthenticated
    ? 'error'
    : rateLimit.remaining < 100
      ? 'rate-limited'
      : 'connected'

  // Screen name from sidebar context
  const screenNames: readonly string[] = [
    'Involved',
    'My PRs',
    'For Review',
    'This Repo',
    'Browse',
    'Settings',
  ]
  const currentScreenName =
    currentScreen.type === 'list' ? screenNames[sidebarIndex] : screenNames[sidebarIndex]

  // PR detail info for breadcrumbs
  const prTitle = currentScreen.type === 'detail' ? currentScreen.pr.title : undefined
  const prNumber = currentScreen.type === 'detail' ? currentScreen.pr.number : undefined

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <TopBar
        username={user?.login ?? 'anonymous'}
        provider={activeProvider}
        repoPath={repoPath}
        browseRepoPath={browseRepoPath}
        screenName={currentScreenName}
        prTitle={prTitle}
        prNumber={prNumber}
        connectionStatus={connectionStatus}
      />
      <Box flexDirection="row" flexGrow={1}>
        <Sidebar
          selectedIndex={sidebarIndex}
          visible={sidebarVisible}
          isActive={activePanel === 'sidebar'}
          counts={sidebarCounts}
          collapsedSections={collapsedSections}
          navigableEntries={navigableEntries}
          navIndex={navIndex}
        />
        <MainPanel isActive={activePanel === 'list'}>
          {renderScreen()}
        </MainPanel>
      </Box>
      <StatusBar activePanel={activePanel} screenContext={screenContext} />
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showOnboarding && (
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      )}
      {showTokenInput && !showOnboarding && (
        <TokenInputModal
          onSubmit={handleTokenSubmit}
          onClose={() => setShowTokenInput(false)}
          error={tokenError ?? error}
        />
      )}
    </Box>
  )
}

import { shouldRetryQuery, getRetryDelay } from './utils/retryConfig'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: shouldRetryQuery,
      retryDelay: getRetryDelay,
    },
  },
})

interface AppProps {
  readonly repoOwner: string | null
  readonly repoName: string | null
  readonly detectedProvider?: ProviderType | null
  readonly detectedBaseUrl?: string | null
}

/**
 * Map a ProviderType from git detection to the Config Provider type.
 * Falls back to 'github' for unknown providers.
 */
function toConfigProvider(providerType: ProviderType | null | undefined): Provider | null {
  if (!providerType) return null
  switch (providerType) {
    case 'github':
    case 'gitlab':
    case 'bitbucket':
    case 'azure':
    case 'gitea':
      return providerType
    default:
      return null
  }
}

function AppWithTheme({
  repoOwner,
  repoName,
  detectedProvider,
  detectedBaseUrl,
}: AppProps): React.ReactElement {
  const { config } = useConfig()
  const themeName = (config?.theme ?? 'tokyo-night') as ThemeName
  const theme = getThemeByName(themeName)

  // Determine the active provider:
  // 1. Config takes precedence (user explicitly chose a provider)
  // 2. Git remote detection is used as fallback
  // 3. Default to 'github'
  const configProvider = config?.provider ?? null
  const gitDetectedProvider = toConfigProvider(detectedProvider)
  const activeProvider: Provider = configProvider ?? gitDetectedProvider ?? 'github'

  // Sync auth module with the active provider and base URL
  React.useEffect(() => {
    setAuthProvider(activeProvider)
    if (detectedBaseUrl && activeProvider === gitDetectedProvider) {
      setAuthBaseUrl(detectedBaseUrl)
    }
  }, [activeProvider, detectedBaseUrl, gitDetectedProvider])

  const localRepo =
    repoOwner && repoName ? { owner: repoOwner, repo: repoName } : null

  return (
    <ThemeProvider theme={theme}>
      <RepoContextProvider localRepo={localRepo}>
        <ErrorBoundary>
          <AppContent
            repoOwner={repoOwner}
            repoName={repoName}
            activeProvider={activeProvider}
          />
        </ErrorBoundary>
      </RepoContextProvider>
    </ThemeProvider>
  )
}

export function App({
  repoOwner,
  repoName,
  detectedProvider,
  detectedBaseUrl,
}: AppProps): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <InputFocusProvider>
        <AppWithTheme
          repoOwner={repoOwner}
          repoName={repoName}
          detectedProvider={detectedProvider}
          detectedBaseUrl={detectedBaseUrl}
        />
      </InputFocusProvider>
    </QueryClientProvider>
  )
}
