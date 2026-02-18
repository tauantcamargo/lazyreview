import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'ink-testing-library'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, defaultTheme } from './theme/index'
import { InputFocusProvider } from './hooks/useInputFocus'
import { RepoContextProvider } from './hooks/useRepoContext'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { TopBar } from './components/layout/TopBar'
import { Sidebar } from './components/layout/Sidebar'
import { MainPanel } from './components/layout/MainPanel'
import { StatusBar } from './components/layout/StatusBar'
import { TokenInputModal } from './components/layout/TokenInputModal'

// Mock useAuth to control authenticated vs unauthenticated states
vi.mock('./hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
    error: null,
    loading: false,
    saveToken: vi.fn(),
    isSavingToken: false,
    tokenInfo: null,
    availableSources: [],
    setPreferredSource: vi.fn(),
    clearManualToken: vi.fn(),
    refetch: vi.fn(),
  })),
}))

// Mock useConfig to return default config without filesystem access
vi.mock('./hooks/useConfig', () => ({
  useConfig: vi.fn(() => ({
    config: {
      theme: 'tokyo-night',
      pageSize: 30,
      refreshInterval: 60,
      provider: 'github',
      hasOnboarded: true,
    },
    error: null,
    loading: false,
    updateConfig: vi.fn(),
  })),
}))

// Mock useReadState to avoid filesystem access
vi.mock('./hooks/useReadState', () => ({
  useReadState: vi.fn(() => ({
    isUnread: () => false,
    markAsRead: vi.fn(),
  })),
}))

// Import the mocked modules so we can change return values per test
import { useAuth } from './hooks/useAuth'
import { useConfig } from './hooks/useConfig'

const mockedUseAuth = vi.mocked(useAuth)
const mockedUseConfig = vi.mocked(useConfig)

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })
}

/**
 * Minimal App shell that replicates the provider hierarchy from app.tsx
 * but renders only the layout skeleton (TopBar, Sidebar, MainPanel, StatusBar).
 * This avoids pulling in screens that make real API calls while still
 * validating the full boot sequence of providers and layout.
 */
function TestAppShell({
  authenticated,
  children,
}: {
  readonly authenticated: boolean
  readonly children?: React.ReactNode
}): React.ReactElement {
  const queryClient = createTestQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <InputFocusProvider>
        <ThemeProvider theme={defaultTheme}>
          <RepoContextProvider localRepo={null}>
            <ErrorBoundary>
              <TopBar
                username={authenticated ? 'testuser' : 'anonymous'}
                provider="github"
              />
              <Sidebar selectedIndex={0} visible={true} isActive={true} />
              <MainPanel isActive={false}>
                {children}
              </MainPanel>
              <StatusBar />
              {!authenticated && (
                <TokenInputModal
                  onSubmit={() => {}}
                  onClose={() => {}}
                  error={null}
                />
              )}
            </ErrorBoundary>
          </RepoContextProvider>
        </ThemeProvider>
      </InputFocusProvider>
    </QueryClientProvider>
  )
}

describe('App integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders TopBar with app name', () => {
    const { lastFrame } = render(<TestAppShell authenticated={true} />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('LazyReview')
  })

  it('renders TopBar with username when authenticated', () => {
    const { lastFrame } = render(<TestAppShell authenticated={true} />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('testuser')
  })

  it('renders Sidebar with navigation items', () => {
    const { lastFrame } = render(<TestAppShell authenticated={true} />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Involved')
    expect(frame).toContain('My PRs')
    expect(frame).toContain('For Review')
    expect(frame).toContain('Browse')
    expect(frame).toContain('Settings')
  })

  it('renders StatusBar with keyboard hints', () => {
    const { lastFrame } = render(<TestAppShell authenticated={true} />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('j/k:nav')
  })

  it('renders MainPanel content area', () => {
    const { lastFrame } = render(
      <TestAppShell authenticated={true}>
        <>Main content here</>
      </TestAppShell>,
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Main content here')
  })

  it('shows token input modal when unauthenticated', () => {
    const { lastFrame } = render(<TestAppShell authenticated={false} />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('GitHub')
    expect(frame).toContain('Token')
  })

  it('does not show token modal when authenticated', () => {
    const { lastFrame } = render(<TestAppShell authenticated={true} />)
    const frame = lastFrame() ?? ''
    // Token modal prompts for personal access token
    expect(frame).not.toContain('Personal Access Token')
  })

  it('renders anonymous username when unauthenticated', () => {
    const { lastFrame } = render(<TestAppShell authenticated={false} />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('anonymous')
  })

  it('ErrorBoundary catches render errors gracefully', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ThrowingChild = (): React.ReactElement => {
      throw new Error('Boom')
    }

    const queryClient = createTestQueryClient()
    const { lastFrame } = render(
      <QueryClientProvider client={queryClient}>
        <InputFocusProvider>
          <ThemeProvider theme={defaultTheme}>
            <RepoContextProvider localRepo={null}>
              <ErrorBoundary>
                <ThrowingChild />
              </ErrorBoundary>
            </RepoContextProvider>
          </ThemeProvider>
        </InputFocusProvider>
      </QueryClientProvider>,
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Something went wrong')
    expect(frame).toContain('Boom')
    spy.mockRestore()
  })

  it('renders connected status by default', () => {
    const { lastFrame } = render(<TestAppShell authenticated={true} />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('●')
  })

  it('provider chain does not throw with null localRepo', () => {
    expect(() => {
      render(<TestAppShell authenticated={true} />)
    }).not.toThrow()
  })
})
