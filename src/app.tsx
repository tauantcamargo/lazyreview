import React, { useState, useCallback } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Box,
  Viewport,
  useList,
  useNodeMap,
  Node,
  useModal,
  useKeymap,
  useApp,
} from 'tuir'
import type { KeyMap } from 'tuir'
import { ThemeProvider, getThemeByName } from './theme/index'
import type { ThemeName } from './theme/index'
import { TopBar } from './components/layout/TopBar'
import { Sidebar, SIDEBAR_ITEMS } from './components/layout/Sidebar'
import { MainPanel } from './components/layout/MainPanel'
import { StatusBar } from './components/layout/StatusBar'
import { HelpModal } from './components/layout/HelpModal'
import { PRListScreen } from './screens/PRListScreen'
import { PRDetailScreen } from './screens/PRDetailScreen'
import { MyPRsScreen } from './screens/MyPRsScreen'
import { ReviewRequestsScreen } from './screens/ReviewRequestsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { Match } from 'effect'
import { useAuth } from './hooks/useAuth'
import { useConfig } from './hooks/useConfig'
import type { PullRequest } from './models/pull-request'

type AppScreen =
  | { readonly type: 'list' }
  | { readonly type: 'detail'; readonly pr: PullRequest }

const appKeymap = {
  toggleSidebar: { input: 'b' },
  quit: { input: 'q' },
} satisfies KeyMap

function AppContent({
  owner,
  repo,
}: {
  readonly owner: string
  readonly repo: string
}): React.ReactElement {
  const { exit } = useApp()
  const { user } = useAuth()
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [currentScreen, setCurrentScreen] = useState<AppScreen>({
    type: 'list',
  })

  const sidebarItems = [...SIDEBAR_ITEMS]
  const { listView: sidebarListView, control: sidebarControl } = useList(
    sidebarItems,
    {
      navigation: 'vi-vertical',
    },
  )

  const nodeMap = sidebarVisible ? [['sidebar', 'main']] : [['main']]
  const { register } = useNodeMap(nodeMap, {
    initialFocus: 'main',
    navigation: 'arrow',
  })

  const { modal } = useModal({
    show: { input: '?' },
    hide: { input: '?' },
  })

  const { useEvent: useAppEvent } = useKeymap(appKeymap)

  useAppEvent('toggleSidebar', () => {
    setSidebarVisible((prev) => !prev)
  })

  useAppEvent('quit', () => {
    if (currentScreen.type === 'detail') {
      setCurrentScreen({ type: 'list' })
    } else {
      exit()
    }
  })

  const handleSelectPR = useCallback((pr: PullRequest) => {
    setCurrentScreen({ type: 'detail', pr })
  }, [])

  const handleBackToList = useCallback(() => {
    setCurrentScreen({ type: 'list' })
  }, [])

  const sidebarIndex = sidebarControl.currentIndex

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
        <PRListScreen
          owner={owner}
          repo={repo}
          onSelect={handleSelectPR}
        />
      )),
      Match.when(1, () => <MyPRsScreen onSelect={handleSelectPR} />),
      Match.when(2, () => <ReviewRequestsScreen onSelect={handleSelectPR} />),
      Match.when(3, () => <SettingsScreen />),
      Match.orElse(() => (
        <PRListScreen
          owner={owner}
          repo={repo}
          onSelect={handleSelectPR}
        />
      ))
    )
  }

  return (
    <Viewport flexDirection="column">
      <TopBar
        username={user?.login ?? 'anonymous'}
        provider="github"
        repoPath={`${owner}/${repo}`}
      />
      <Box flexDirection="row" flexGrow={1}>
        <Node.Box {...register('sidebar')}>
          <Sidebar listView={sidebarListView} visible={sidebarVisible} />
        </Node.Box>
        <Node.Box {...register('main')} flexGrow={1}>
          <MainPanel>{renderScreen()}</MainPanel>
        </Node.Box>
      </Box>
      <StatusBar />
      <HelpModal modal={modal} />
    </Viewport>
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

export function App({ owner, repo }: AppProps): React.ReactElement {
  const { config } = useConfig()
  const themeName = (config?.theme ?? 'tokyo-night') as ThemeName
  const theme = getThemeByName(themeName)

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <AppContent owner={owner} repo={repo} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
