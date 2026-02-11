import React, { useState, useCallback } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Box, useApp, useInput, useStdout } from 'ink'
import { ThemeProvider, getThemeByName } from './theme/index'
import type { ThemeName } from './theme/index'
import { TopBar } from './components/layout/TopBar'
import { Sidebar, SIDEBAR_ITEMS } from './components/layout/Sidebar'
import { MainPanel } from './components/layout/MainPanel'
import { StatusBar } from './components/layout/StatusBar'
import { useScreenContext, setScreenContext } from './hooks/useScreenContext'
import { HelpModal } from './components/layout/HelpModal'
import { TokenInputModal } from './components/layout/TokenInputModal'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { PRDetailScreen } from './screens/PRDetailScreen'
import { MyPRsScreen } from './screens/MyPRsScreen'
import { ReviewRequestsScreen } from './screens/ReviewRequestsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { InvolvedScreen } from './screens/InvolvedScreen'
import { ThisRepoScreen } from './screens/ThisRepoScreen'
import { Match } from 'effect'
import { useAuth } from './hooks/useAuth'
import { useConfig } from './hooks/useConfig'
import { useListNavigation } from './hooks/useListNavigation'
import { useActivePanel } from './hooks/useActivePanel'
import { InputFocusProvider, useInputFocus } from './hooks/useInputFocus'
import type { PullRequest } from './models/pull-request'

type AppScreen =
  | { readonly type: 'list' }
  | { readonly type: 'detail'; readonly pr: PullRequest }

interface AppContentProps {
  readonly repoOwner: string | null
  readonly repoName: string | null
}

function AppContent({
  repoOwner,
  repoName,
}: AppContentProps): React.ReactElement {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const { user, isAuthenticated, loading, saveToken, error } = useAuth()
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [currentScreen, setCurrentScreen] = useState<AppScreen>({
    type: 'list',
  })
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  // Start with modal hidden, show only after auth check fails
  const [showTokenInput, setShowTokenInput] = useState(false)

  // Panel focus management
  const { activePanel, setActivePanel } = useActivePanel({
    hasSelection: currentScreen.type === 'detail',
  })

  // Input focus tracking (for disabling shortcuts when typing)
  const { isInputActive } = useInputFocus()

  // Sidebar navigation
  const { selectedIndex: sidebarIndex } = useListNavigation({
    itemCount: SIDEBAR_ITEMS.length,
    viewportHeight: SIDEBAR_ITEMS.length,
    isActive: activePanel === 'sidebar' && !showHelp && !showTokenInput,
  })

  // Show token modal when not authenticated (covers invalid token case)
  React.useEffect(() => {
    if (!loading && !isAuthenticated && !showTokenInput) {
      setShowTokenInput(true)
    } else if (isAuthenticated && showTokenInput) {
      setShowTokenInput(false)
    }
  }, [loading, isAuthenticated, showTokenInput])

  const handleTokenSubmit = useCallback(
    async (token: string) => {
      try {
        setTokenError(null)
        await saveToken(token)
      } catch (err) {
        setTokenError(String(err))
      }
    },
    [saveToken],
  )

  // Global keyboard shortcuts
  useInput(
    (input, key) => {
      // Handle modals first
      if (showHelp || showTokenInput) {
        if (key.escape || (showHelp && input === '?')) {
          setShowHelp(false)
        }
        return
      }

      if (input === 'b') {
        setSidebarVisible((prev) => !prev)
      } else if (input === '?') {
        setShowHelp(true)
      } else if (input === 'q') {
        if (currentScreen.type === 'detail') {
          setCurrentScreen({ type: 'list' })
        } else {
          exit()
        }
      } else if (key.return && activePanel === 'sidebar') {
        setActivePanel('list')
      }
    },
    { isActive: !showTokenInput && !isInputActive },
  )

  const handleSelectPR = useCallback((pr: PullRequest) => {
    setCurrentScreen({ type: 'detail', pr })
  }, [])

  const handleBackToList = useCallback(() => {
    setCurrentScreen({ type: 'list' })
  }, [])

  function renderScreen(): React.ReactElement {
    if (currentScreen.type === 'detail') {
      // Extract owner/repo from PR URL for detail view
      const prUrl = currentScreen.pr.html_url
      const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull/)
      const prOwner = match?.[1] ?? repoOwner ?? ''
      const prRepo = match?.[2] ?? repoName ?? ''

      return (
        <PRDetailScreen
          pr={currentScreen.pr}
          owner={prOwner}
          repo={prRepo}
          onBack={handleBackToList}
        />
      )
    }

    // Navigation:
    // 0 - Involved (all PRs user is involved in)
    // 1 - My PRs (PRs user created)
    // 2 - For Review (PRs requesting user's review)
    // 3 - This Repo (PRs from current git directory)
    // 4 - Settings
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
      Match.when(4, () => <SettingsScreen />),
      Match.orElse(() => <InvolvedScreen onSelect={handleSelectPR} />),
    )
  }

  const terminalHeight = stdout?.rows ?? 24

  const repoPath =
    repoOwner && repoName ? `${repoOwner}/${repoName}` : undefined

  // Set screen context for list-level screens
  // PRDetailScreen sets its own context based on active tab
  React.useEffect(() => {
    if (currentScreen.type !== 'detail') {
      setScreenContext(sidebarIndex === 4 ? 'settings' : 'pr-list')
    }
  }, [currentScreen.type, sidebarIndex])

  const screenContext = useScreenContext()

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <TopBar
        username={user?.login ?? 'anonymous'}
        provider="github"
        repoPath={repoPath}
      />
      <Box flexDirection="row" flexGrow={1}>
        <Sidebar
          selectedIndex={sidebarIndex}
          visible={sidebarVisible}
          isActive={activePanel === 'sidebar'}
        />
        <MainPanel isActive={activePanel === 'list'}>
          {renderScreen()}
        </MainPanel>
      </Box>
      <StatusBar activePanel={activePanel} screenContext={screenContext} />
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showTokenInput && (
        <TokenInputModal
          onSubmit={handleTokenSubmit}
          onClose={() => setShowTokenInput(false)}
          error={tokenError ?? error}
        />
      )}
    </Box>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
})

interface AppProps {
  readonly repoOwner: string | null
  readonly repoName: string | null
}

function AppWithTheme({
  repoOwner,
  repoName,
}: AppProps): React.ReactElement {
  const { config } = useConfig()
  const themeName = (config?.theme ?? 'tokyo-night') as ThemeName
  const theme = getThemeByName(themeName)

  return (
    <ThemeProvider theme={theme}>
      <ErrorBoundary>
        <AppContent repoOwner={repoOwner} repoName={repoName} />
      </ErrorBoundary>
    </ThemeProvider>
  )
}

export function App({ repoOwner, repoName }: AppProps): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <InputFocusProvider>
        <AppWithTheme repoOwner={repoOwner} repoName={repoName} />
      </InputFocusProvider>
    </QueryClientProvider>
  )
}
