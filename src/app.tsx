import React, { useState, useCallback } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Box, useApp, useInput, useStdout } from 'ink'
import { ThemeProvider, getThemeByName } from './theme/index'
import type { ThemeName } from './theme/index'
import { TopBar } from './components/layout/TopBar'
import { Sidebar, SIDEBAR_ITEMS } from './components/layout/Sidebar'
import { MainPanel } from './components/layout/MainPanel'
import { StatusBar } from './components/layout/StatusBar'
import { HelpModal } from './components/layout/HelpModal'
import { TokenInputModal } from './components/layout/TokenInputModal'
import { PRListScreen } from './screens/PRListScreen'
import { PRDetailScreen } from './screens/PRDetailScreen'
import { MyPRsScreen } from './screens/MyPRsScreen'
import { ReviewRequestsScreen } from './screens/ReviewRequestsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { Match } from 'effect'
import { useAuth } from './hooks/useAuth'
import { useConfig } from './hooks/useConfig'
import { useListNavigation } from './hooks/useListNavigation'
import { useActivePanel } from './hooks/useActivePanel'
import type { PullRequest } from './models/pull-request'

type AppScreen =
  | { readonly type: 'list' }
  | { readonly type: 'detail'; readonly pr: PullRequest }

function AppContent({
  owner,
  repo,
}: {
  readonly owner: string
  readonly repo: string
}): React.ReactElement {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const { user, isAuthenticated, loading, saveToken, error } = useAuth()
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [currentScreen, setCurrentScreen] = useState<AppScreen>({
    type: 'list',
  })
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showTokenInput, setShowTokenInput] = useState(false)

  // Panel focus management
  const { activePanel, setActivePanel } = useActivePanel({
    hasSelection: currentScreen.type === 'detail',
  })

  // Sidebar navigation
  const { selectedIndex: sidebarIndex } = useListNavigation({
    itemCount: SIDEBAR_ITEMS.length,
    viewportHeight: SIDEBAR_ITEMS.length,
    isActive: activePanel === 'sidebar' && !showHelp && !showTokenInput,
  })

  // Show token modal when not authenticated
  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      setShowTokenInput(true)
    } else if (isAuthenticated) {
      setShowTokenInput(false)
    }
  }, [loading, isAuthenticated])

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
    { isActive: !showTokenInput },
  )

  const handleSelectPR = useCallback((pr: PullRequest) => {
    setCurrentScreen({ type: 'detail', pr })
  }, [])

  const handleBackToList = useCallback(() => {
    setCurrentScreen({ type: 'list' })
  }, [])

  function renderScreen(): React.ReactElement {
    if (currentScreen.type === 'detail') {
      return (
        <PRDetailScreen
          pr={currentScreen.pr}
          owner={owner}
          repo={repo}
          onBack={handleBackToList}
        />
      )
    }

    return Match.value(sidebarIndex).pipe(
      Match.when(0, () => (
        <PRListScreen owner={owner} repo={repo} onSelect={handleSelectPR} />
      )),
      Match.when(1, () => <MyPRsScreen onSelect={handleSelectPR} />),
      Match.when(2, () => <ReviewRequestsScreen onSelect={handleSelectPR} />),
      Match.when(3, () => <SettingsScreen />),
      Match.orElse(() => (
        <PRListScreen owner={owner} repo={repo} onSelect={handleSelectPR} />
      )),
    )
  }

  const terminalHeight = stdout?.rows ?? 24

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <TopBar
        username={user?.login ?? 'anonymous'}
        provider="github"
        repoPath={`${owner}/${repo}`}
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
      <StatusBar activePanel={activePanel} />
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
  readonly owner: string
  readonly repo: string
}

function AppWithTheme({ owner, repo }: AppProps): React.ReactElement {
  const { config } = useConfig()
  const themeName = (config?.theme ?? 'tokyo-night') as ThemeName
  const theme = getThemeByName(themeName)

  return (
    <ThemeProvider theme={theme}>
      <AppContent owner={owner} repo={repo} />
    </ThemeProvider>
  )
}

export function App({ owner, repo }: AppProps): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <AppWithTheme owner={owner} repo={repo} />
    </QueryClientProvider>
  )
}
