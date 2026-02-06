# LazyReview TypeScript/React Ink Rewrite PRD

**Version:** 1.2
**Date:** 2026-02-06
**Author:** Product Team
**Status:** Draft

---

## Executive Summary

LazyReview is a terminal user interface (TUI) application for streamlined code review across multiple Git providers. This PRD defines a complete rewrite from Go/Bubbletea to TypeScript/React Ink with **100% feature parity** and a **clean, minimal design** inspired by modern terminal applications like mitmproxy, lazygit, and HTTP proxy inspectors.

**Key Outcomes:**
- Complete feature parity with Go v0.58.0
- Clean, minimal UI design with clear visual hierarchy
- TypeScript-idiomatic architecture with React patterns
- Performance parity (sub-100ms startup, 60fps scrolling)
- Dual distribution: npm global install + single binary

---

## Design Philosophy

### Visual Design Principles

Based on the reference UI (HTTP proxy inspector style), the new design will follow:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LazyReview                                      │
├──────────────┬──────────────────────────────────────────────────────────────┤
│  Repos       │  Pull Requests                                               │
│──────────────│──────────────────────────────────────────────────────────────│
│ ▸ All (47)   │  Author      Title                          Status  Updated │
│   org/repo   │  ─────────────────────────────────────────────────────────── │
│ ▸ github (3) │  @alice      Fix auth token refresh          ● Open  2h ago │
│   repo-1     │  @bob        Add rate limiting to API        ● Open  5h ago │
│   repo-2     │▸ @charlie    Refactor user service          ● Draft  1d ago │
│   repo-3     │  @dave       Update dependencies             ● Open  2d ago │
│ ▸ gitlab (2) │  @eve        Fix memory leak in cache        ● Open  3d ago │
│   project-a  │                                                              │
│   project-b  │                                                              │
├──────────────┴──────────────────────────────────────────────────────────────┤
│ Detail ──────────────────────────────────────────────────────────────────── │
│  Files    │  Comments    │  Timeline    │  Raw                              │
│ ─────────────────────────────────────────────────────────────────────────── │
│  src/services/user.ts                                                       │
│  ─────────────────────────────────────────────────────────────────────────  │
│  @@ -45,7 +45,12 @@                                                         │
│  45  │   async getUser(id: string): Promise<User> {                         │
│  46  │-    return this.cache.get(id)                                        │
│  47  │+    const cached = this.cache.get(id)                                │
│  48  │+    if (cached) return cached                                        │
│  49  │+    const user = await this.db.findById(id)                          │
│  50  │+    this.cache.set(id, user)                                         │
│  51  │+    return user                                                      │
│  52  │   }                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ j/k:scroll  l:detail  Esc:sidebar  s:sort  a:approve  r:request  q:quit    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Design Guidelines

1. **Minimal Chrome** - Thin borders, no heavy decorations
2. **Clear Hierarchy** - Left sidebar for navigation, main content area, detail panel below
3. **Muted Colors** - Soft palette, accent colors only for status/actions
4. **Dense Information** - Show more data, less padding
5. **Keyboard-First** - Status bar shows available actions
6. **Clean Typography** - Consistent spacing, aligned columns
7. **Subtle Separators** - Thin lines, not heavy borders

### Color Palette (Default Theme)

```typescript
const theme = {
  // Background layers
  bg: {
    primary: '#1a1b26',    // Main background
    secondary: '#16161e',  // Sidebar/panels
    tertiary: '#1f2335',   // Hover/selected
  },

  // Text hierarchy
  text: {
    primary: '#c0caf5',    // Main text
    secondary: '#565f89',  // Muted/labels
    accent: '#7aa2f7',     // Links/highlights
  },

  // Status colors (muted)
  status: {
    open: '#9ece6a',       // Green (muted)
    draft: '#e0af68',      // Yellow (muted)
    merged: '#bb9af7',     // Purple (muted)
    closed: '#f7768e',     // Red (muted)
  },

  // Diff colors
  diff: {
    added: '#9ece6a',
    removed: '#f7768e',
    context: '#565f89',
  },

  // Borders
  border: {
    default: '#292e42',
    focused: '#3d59a1',
  }
}
```

---

## Problem Statement

### Current Situation

LazyReview v0.58.0 is a mature Go/Bubbletea application with 99 Go source files, 4 provider integrations, and 30+ TUI components. While functional, the Go codebase presents challenges:

- Development team is more proficient in TypeScript
- Smaller pool of Go developers for TUI applications
- Limited npm-style package ecosystem
- Terminal testing requires significant boilerplate

### Opportunity

A TypeScript rewrite with a modern, clean design enables:
- Faster feature development with familiar tooling
- Shared packages with web/API projects
- Modern testing with React component testing
- A refreshed, cleaner UI that's easier to maintain

---

## Goals & Success Metrics

| Goal | Target | Measurement |
|------|--------|-------------|
| Feature parity | 100% | Feature checklist |
| Startup time | <100ms | Benchmark |
| Scroll FPS | 60fps | Performance profiling |
| Memory usage | <50MB idle | Memory profiling |
| Test coverage | 80%+ | Vitest coverage |
| Bundle size | <20MB | Build output |

---

## Technical Specifications

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Node.js 20+ | Stable, mature ecosystem |
| Language | TypeScript 5.x (strict) | Type safety, DX |
| TUI Framework | React Ink 5.x | Component-based terminal UI |
| CLI Parser | Commander.js | CLI argument parsing |
| **HTTP Client** | **Axios** | HTTP requests with interceptors |
| **API Types** | **openapi-typescript** | Generate types from OpenAPI specs |
| **Data Fetching** | **TanStack Query** | Caching, background refresh, mutations |
| **State** | **Zustand** | Lightweight global state |
| Database | better-sqlite3 | Local persistence |
| Validation | Zod | Runtime validation + types |
| Testing | Vitest + Playwright | Unit + E2E testing |
| Bundler | tsup/esbuild | Fast builds |
| Binary | pkg | Single executable |

---

### Data Fetching Architecture

We use a modern, type-safe data fetching stack:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         React Ink Components                             │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  usePullRequests()  useReviews()  useComments()  useDiff()          ││
│  └─────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         TanStack Query                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  • Automatic caching & deduplication                                ││
│  │  • Background refetching (staleTime, gcTime)                        ││
│  │  • Optimistic updates for mutations                                 ││
│  │  • Infinite queries for pagination                                  ││
│  │  • Offline support with persistQueryClient                          ││
│  └─────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Provider SDK Layer                               │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  GitHubSDK    GitLabSDK    BitbucketSDK    AzureDevOpsSDK           ││
│  │  (generated from OpenAPI specs via openapi-typescript)              ││
│  └─────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Axios Instance                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  • Request/response interceptors                                    ││
│  │  • Auth token injection                                             ││
│  │  • Rate limiting                                                    ││
│  │  • Retry logic                                                      ││
│  │  • Error transformation                                             ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

### OpenAPI Type Generation

We use `openapi-typescript` to generate fully-typed SDK clients from provider OpenAPI specs:

```typescript
// packages/providers/scripts/generate-types.ts
import openapiTS from 'openapi-typescript'

// Generate types from GitHub's OpenAPI spec
// https://github.com/github/rest-api-description
await openapiTS(
  'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.yaml',
  { output: './src/github/types.generated.ts' }
)
```

**Generated SDK structure:**

```
packages/providers/
├── src/
│   ├── github/
│   │   ├── types.generated.ts    # Auto-generated from OpenAPI
│   │   ├── client.ts             # Typed Axios client
│   │   ├── sdk.ts                # High-level SDK methods
│   │   └── mappers.ts            # Map API types → domain models
│   ├── gitlab/
│   │   ├── types.generated.ts
│   │   ├── client.ts
│   │   ├── sdk.ts
│   │   └── mappers.ts
│   ├── bitbucket/
│   │   └── ...
│   └── azure-devops/
│       └── ...
├── scripts/
│   └── generate-types.ts         # Type generation script
└── package.json
```

**Usage example:**

```typescript
// packages/providers/src/github/client.ts
import axios from 'axios'
import type { paths, components } from './types.generated'

type PullRequest = components['schemas']['pull-request']
type ListPullsResponse = paths['/repos/{owner}/{repo}/pulls']['get']['responses']['200']['content']['application/json']

export function createGitHubClient(token: string) {
  const client = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  return {
    pulls: {
      list: async (owner: string, repo: string): Promise<ListPullsResponse> => {
        const { data } = await client.get(`/repos/${owner}/${repo}/pulls`)
        return data
      },
      get: async (owner: string, repo: string, number: number): Promise<PullRequest> => {
        const { data } = await client.get(`/repos/${owner}/${repo}/pulls/${number}`)
        return data
      },
    },
    // ... more endpoints
  }
}
```

---

### Axios Configuration

```typescript
// packages/providers/src/shared/axios-instance.ts
import axios, { AxiosInstance, AxiosError } from 'axios'
import { RateLimiter } from './rate-limiter'

export interface AxiosConfig {
  baseURL: string
  token: string
  rateLimitPerSecond?: number
  timeout?: number
  retries?: number
}

export function createAxiosInstance(config: AxiosConfig): AxiosInstance {
  const { baseURL, token, rateLimitPerSecond = 10, timeout = 30000, retries = 3 } = config

  const instance = axios.create({
    baseURL,
    timeout,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const rateLimiter = new RateLimiter(rateLimitPerSecond)

  // Request interceptor - rate limiting & auth
  instance.interceptors.request.use(async (config) => {
    await rateLimiter.acquire()
    return config
  })

  // Response interceptor - error handling & retry
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as any

      // Retry logic for transient errors
      if (config && config.__retryCount < retries) {
        if (error.response?.status === 429 || error.response?.status >= 500) {
          config.__retryCount = (config.__retryCount || 0) + 1
          const delay = getRetryDelay(error, config.__retryCount)
          await sleep(delay)
          return instance.request(config)
        }
      }

      // Transform to domain error
      throw transformError(error)
    }
  )

  return instance
}
```

---

### TanStack Query Integration

TanStack Query provides powerful caching and data synchronization:

```typescript
// packages/providers/src/queries/use-pull-requests.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useProviderSDK } from '../hooks/use-provider-sdk'
import type { PullRequest, PRFilter } from '@lazyreview/core'

// Query keys factory for type safety
export const pullRequestKeys = {
  all: ['pull-requests'] as const,
  lists: () => [...pullRequestKeys.all, 'list'] as const,
  list: (owner: string, repo: string, filters?: PRFilter) =>
    [...pullRequestKeys.lists(), owner, repo, filters] as const,
  details: () => [...pullRequestKeys.all, 'detail'] as const,
  detail: (owner: string, repo: string, number: number) =>
    [...pullRequestKeys.details(), owner, repo, number] as const,
}

// Hook: List pull requests
export function usePullRequests(owner: string, repo: string, filters?: PRFilter) {
  const sdk = useProviderSDK()

  return useQuery({
    queryKey: pullRequestKeys.list(owner, repo, filters),
    queryFn: () => sdk.pulls.list(owner, repo, filters),
    staleTime: 2 * 60 * 1000,       // 2 minutes
    gcTime: 10 * 60 * 1000,         // 10 minutes
    refetchOnWindowFocus: false,    // Terminal doesn't have window focus
  })
}

// Hook: Get single PR with details
export function usePullRequest(owner: string, repo: string, number: number) {
  const sdk = useProviderSDK()

  return useQuery({
    queryKey: pullRequestKeys.detail(owner, repo, number),
    queryFn: () => sdk.pulls.get(owner, repo, number),
    staleTime: 30 * 1000,           // 30 seconds for detail view
  })
}

// Hook: Approve PR (mutation with optimistic update)
export function useApprovePR() {
  const sdk = useProviderSDK()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ owner, repo, number, body }: ApprovePRInput) =>
      sdk.reviews.approve(owner, repo, number, body),

    // Optimistic update
    onMutate: async ({ owner, repo, number }) => {
      await queryClient.cancelQueries({
        queryKey: pullRequestKeys.detail(owner, repo, number)
      })

      const previous = queryClient.getQueryData<PullRequest>(
        pullRequestKeys.detail(owner, repo, number)
      )

      // Optimistically update the PR
      queryClient.setQueryData(
        pullRequestKeys.detail(owner, repo, number),
        (old: PullRequest | undefined) => old ? {
          ...old,
          reviewDecision: 'APPROVED',
        } : old
      )

      return { previous }
    },

    // Rollback on error
    onError: (err, { owner, repo, number }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          pullRequestKeys.detail(owner, repo, number),
          context.previous
        )
      }
    },

    // Refetch after success
    onSettled: (_, __, { owner, repo, number }) => {
      queryClient.invalidateQueries({
        queryKey: pullRequestKeys.detail(owner, repo, number)
      })
    },
  })
}
```

**Query Provider Setup:**

```typescript
// apps/cli/src/app/providers/QueryProvider.tsx
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { storage } from '@lazyreview/storage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,     // 2 minutes default
      gcTime: 30 * 60 * 1000,       // 30 minutes
      retry: 2,
      refetchOnWindowFocus: false,  // No window focus in terminal
    },
  },
})

// Persist queries to SQLite for offline support
const persister = createSyncStoragePersister({
  storage: {
    getItem: (key) => storage.cache.get(key),
    setItem: (key, value) => storage.cache.set(key, value),
    removeItem: (key) => storage.cache.delete(key),
  },
})

persistQueryClient({
  queryClient,
  persister,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
})

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

---

### Zustand State Management

Zustand handles UI state that doesn't belong in TanStack Query:

```typescript
// apps/cli/src/app/stores/app-store.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { PullRequest, User, Workspace, PRFilter } from '@lazyreview/core'

// View types
type ViewType = 'list' | 'detail' | 'dashboard' | 'settings' | 'workspaces'
type PanelType = 'sidebar' | 'content' | 'detail'
type SidebarMode = 'repos' | 'filters' | 'workspaces'

interface AppState {
  // Navigation
  currentView: ViewType
  currentPanel: PanelType
  sidebarMode: SidebarMode

  // Selection
  selectedRepo: { owner: string; repo: string } | null
  selectedPRNumber: number | null
  selectedFileIndex: number

  // UI State
  searchQuery: string
  filters: PRFilter
  isCommandPaletteOpen: boolean
  isHelpOpen: boolean

  // User
  currentUser: User | null

  // Actions
  setView: (view: ViewType) => void
  setPanel: (panel: PanelType) => void
  setSidebarMode: (mode: SidebarMode) => void
  selectRepo: (owner: string, repo: string) => void
  selectPR: (number: number) => void
  setSearchQuery: (query: string) => void
  setFilters: (filters: Partial<PRFilter>) => void
  toggleCommandPalette: () => void
  toggleHelp: () => void
  setCurrentUser: (user: User | null) => void
  reset: () => void
}

const initialState = {
  currentView: 'list' as ViewType,
  currentPanel: 'content' as PanelType,
  sidebarMode: 'repos' as SidebarMode,
  selectedRepo: null,
  selectedPRNumber: null,
  selectedFileIndex: 0,
  searchQuery: '',
  filters: {},
  isCommandPaletteOpen: false,
  isHelpOpen: false,
  currentUser: null,
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setView: (view) => set({ currentView: view }),

    setPanel: (panel) => set({ currentPanel: panel }),

    setSidebarMode: (mode) => set({ sidebarMode: mode }),

    selectRepo: (owner, repo) => set({
      selectedRepo: { owner, repo },
      selectedPRNumber: null, // Reset PR selection when changing repo
    }),

    selectPR: (number) => set({
      selectedPRNumber: number,
      currentView: 'detail',
    }),

    setSearchQuery: (query) => set({ searchQuery: query }),

    setFilters: (filters) => set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

    toggleCommandPalette: () => set((state) => ({
      isCommandPaletteOpen: !state.isCommandPaletteOpen,
    })),

    toggleHelp: () => set((state) => ({
      isHelpOpen: !state.isHelpOpen,
    })),

    setCurrentUser: (user) => set({ currentUser: user }),

    reset: () => set(initialState),
  }))
)

// Selector hooks for better performance
export const useCurrentView = () => useAppStore((s) => s.currentView)
export const useSelectedRepo = () => useAppStore((s) => s.selectedRepo)
export const useSelectedPR = () => useAppStore((s) => s.selectedPRNumber)
export const useFilters = () => useAppStore((s) => s.filters)
```

---

### Combined Usage in Components

```typescript
// apps/cli/src/app/screens/PRList.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { usePullRequests } from '@lazyreview/providers'
import { useAppStore, useSelectedRepo, useFilters } from '../stores/app-store'
import { VirtualList } from '../components/VirtualList'
import { PRRow } from '../components/PRRow'
import { StatusBar } from '../components/StatusBar'

export function PRListScreen() {
  const selectedRepo = useSelectedRepo()
  const filters = useFilters()
  const selectPR = useAppStore((s) => s.selectPR)

  const {
    data: pullRequests,
    isLoading,
    isError,
    error,
    refetch,
  } = usePullRequests(
    selectedRepo?.owner ?? '',
    selectedRepo?.repo ?? '',
    filters
  )

  if (!selectedRepo) {
    return <Text color="gray">Select a repository from the sidebar</Text>
  }

  if (isLoading) {
    return <Text color="gray">Loading pull requests...</Text>
  }

  if (isError) {
    return <Text color="red">Error: {error.message}</Text>
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexGrow={1}>
        <VirtualList
          items={pullRequests ?? []}
          itemHeight={1}
          renderItem={(pr) => (
            <PRRow
              pr={pr}
              onSelect={() => selectPR(pr.number)}
            />
          )}
        />
      </Box>
      <StatusBar
        left="j/k:nav  Enter:open  /:search  f:filter  R:refresh"
        right={`${pullRequests?.length ?? 0} PRs`}
      />
    </Box>
  )
}
```

---

### Package Structure (Updated)

```
lazyreview/
├── apps/
│   └── cli/                        # Main CLI application
│       ├── src/
│       │   ├── index.ts            # Entry point
│       │   ├── commands/           # CLI commands
│       │   └── app/                # React Ink application
│       │       ├── App.tsx
│       │       ├── providers/      # React context providers
│       │       │   ├── QueryProvider.tsx
│       │       │   └── ThemeProvider.tsx
│       │       ├── stores/         # Zustand stores
│       │       │   └── app-store.ts
│       │       ├── screens/        # Screen components
│       │       ├── components/     # UI components
│       │       └── hooks/          # Custom hooks
│
├── packages/
│   ├── core/                       # Domain models & types
│   │   └── src/
│   │       ├── models/             # PullRequest, Review, Comment, etc.
│   │       ├── types/              # Shared TypeScript types
│   │       └── utils/              # Shared utilities
│   │
│   ├── providers/                  # Git provider SDKs
│   │   ├── scripts/
│   │   │   └── generate-types.ts   # OpenAPI type generation
│   │   └── src/
│   │       ├── shared/
│   │       │   ├── axios-instance.ts
│   │       │   ├── rate-limiter.ts
│   │       │   └── errors.ts
│   │       ├── queries/            # TanStack Query hooks
│   │       │   ├── keys.ts
│   │       │   ├── use-pull-requests.ts
│   │       │   ├── use-reviews.ts
│   │       │   └── use-comments.ts
│   │       ├── github/
│   │       │   ├── types.generated.ts  # From openapi-typescript
│   │       │   ├── client.ts
│   │       │   ├── sdk.ts
│   │       │   └── mappers.ts
│   │       ├── gitlab/
│   │       ├── bitbucket/
│   │       └── azure-devops/
│   │
│   ├── ai/                         # AI review providers
│   │   └── src/
│   │       ├── openai/
│   │       ├── anthropic/
│   │       └── ollama/
│   │
│   ├── storage/                    # Persistence layer
│   │   └── src/
│   │       ├── sqlite.ts           # SQLite operations
│   │       ├── cache.ts            # Query cache adapter
│   │       ├── keyring.ts          # Credential storage
│   │       └── queue.ts            # Offline action queue
│   │
│   ├── config/                     # Configuration
│   │   └── src/
│   │       ├── config.ts           # Config loader
│   │       ├── schema.ts           # Zod schemas
│   │       └── keybindings.ts      # Keybinding config
│   │
│   ├── git/                        # Git operations
│   │   └── src/
│   │       ├── context.ts          # Git context detection
│   │       └── operations.ts       # Git commands
│   │
│   └── ui/                         # Shared UI components
│       └── src/
│           ├── components/
│           │   ├── VirtualList.tsx
│           │   ├── DiffViewer.tsx
│           │   ├── FileTree.tsx
│           │   ├── Tabs.tsx
│           │   ├── StatusBar.tsx
│           │   └── ...
│           ├── hooks/
│           │   ├── useKeyboard.ts
│           │   ├── useChord.ts
│           │   └── useFocus.ts
│           └── themes/
│
├── specs/                          # OpenAPI specifications
│   ├── github.yaml                 # GitHub API spec (downloaded)
│   ├── gitlab.yaml                 # GitLab API spec
│   └── ...
│
├── benchmarks/                     # Performance benchmarks
└── scripts/                        # Build scripts
    ├── generate-types.ts           # Generate all provider types
    └── build.ts
```

---

## Feature Requirements

### CLI Commands (P0)

| Command | Description |
|---------|-------------|
| `lazyreview` | Start TUI (default) |
| `auth login/logout/status` | Authentication |
| `ai login/logout/status` | AI provider config |
| `config edit/path/show` | Configuration |
| `queue sync` | Offline queue |
| `version` | Show version |
| `update` | Self-update |
| `keys` | Keyboard shortcuts |
| `doctor` | Health check |

### TUI Layout

The TUI follows a **3-panel layout** with a status bar:

```
┌─────────────────────────────────────────────────────────────┐
│ Header (optional - can be minimal or hidden)                │
├───────────┬─────────────────────────────────────────────────┤
│           │                                                 │
│  SIDEBAR  │              MAIN CONTENT                       │
│           │                                                 │
│  - Repos  │  - PR List                                      │
│  - Filters│  - PR Detail                                    │
│  - Nav    │  - Dashboard                                    │
│           │                                                 │
├───────────┴─────────────────────────────────────────────────┤
│                     DETAIL PANEL                            │
│  - Diff viewer                                              │
│  - Comments                                                 │
│  - Timeline                                                 │
├─────────────────────────────────────────────────────────────┤
│ STATUS BAR: keybindings, mode, timestamps                   │
└─────────────────────────────────────────────────────────────┘
```

### Screen Components

#### 1. PR List View (Main Screen)

```
┌─ Repos ──────┬─ Pull Requests ─────────────────────────────────────────┐
│ All (47)     │ Author       Title                      Status  Updated │
│ ▸ github     │ ──────────────────────────────────────────────────────  │
│   org/repo   │ @alice       Fix auth token refresh      ● Open   2h    │
│   other/repo │ @bob         Add rate limiting           ● Open   5h    │
│ ▸ gitlab     │▸@charlie     Refactor user service       ○ Draft  1d    │
│   project    │ @dave        Update dependencies         ● Open   2d    │
└──────────────┴─────────────────────────────────────────────────────────┘
│ j/k:nav  Enter:open  /:search  f:filter  R:refresh  q:quit            │
└───────────────────────────────────────────────────────────────────────┘
```

Features:
- Collapsible repo tree in sidebar
- Sortable columns (author, title, status, updated)
- Inline status indicators (●/○)
- Relative timestamps
- Virtual scrolling for 10,000+ PRs

#### 2. PR Detail View

```
┌─ Files ──────┬─ src/services/user.ts ──────────────────────────────────┐
│ ▸ src/       │ Files │ Comments (3) │ Timeline │ Description           │
│   services/  │ ───────────────────────────────────────────────────────  │
│   ▸ user.ts  │ @@ -45,7 +45,12 @@                                      │
│   ▸ auth.ts  │  45 │   async getUser(id: string): Promise<User> {      │
│ ▸ tests/     │  46 │-    return this.cache.get(id)                     │
│   user.test  │  47 │+    const cached = this.cache.get(id)             │
│              │  48 │+    if (cached) return cached                     │
│              │  49 │+    const user = await this.db.findById(id)       │
│              │  50 │+    this.cache.set(id, user)                      │
│              │  51 │+    return user                                   │
└──────────────┴─────────────────────────────────────────────────────────┘
│ a:approve  r:request changes  c:comment  m:merge  Esc:back            │
└───────────────────────────────────────────────────────────────────────┘
```

Features:
- File tree with expand/collapse
- Tab navigation (Files, Comments, Timeline, Description)
- Syntax-highlighted diff
- Inline comment placement
- Side-by-side diff option

#### 3. Dashboard View

```
┌─ Dashboard ────────────────────────────────────────────────────────────┐
│                                                                        │
│ ─── Needs Your Review (5) ─────────────────────────────────────────── │
│  org/repo    Fix auth token refresh              @alice   ● Open  2h  │
│  org/repo    Add rate limiting to API            @bob     ● Open  5h  │
│  org/repo    Update error handling               @carol   ● Open  1d  │
│                                                                        │
│ ─── Your Pull Requests (3) ────────────────────────────────────────── │
│  org/repo    Refactor user service               You      ○ Draft 1d  │
│  org/repo    Add caching layer                   You      ● Open  3d  │
│                                                                        │
│ ─── Recent Activity ───────────────────────────────────────────────── │
│  org/repo    Database migration script           @dave    ✓ Merged 2h │
│  org/repo    Fix memory leak                     @eve     ✓ Merged 5h │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
│ j/k:nav  Enter:open  d:dashboard  l:list  w:workspaces  q:quit        │
└────────────────────────────────────────────────────────────────────────┘
```

### Keyboard Bindings

#### Navigation (Vim Mode)

| Key | Action |
|-----|--------|
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `h` / `←` | Left panel / collapse |
| `l` / `→` | Right panel / expand |
| `gg` | Go to top |
| `G` | Go to bottom |
| `Ctrl+u` | Page up |
| `Ctrl+d` | Page down |

#### Actions

| Key | Action |
|-----|--------|
| `Enter` | Select / confirm |
| `Esc` | Back / cancel |
| `Tab` | Next panel |
| `/` | Search |
| `a` | Approve |
| `r` | Request changes |
| `c` | Comment |
| `m` | Merge |
| `o` | Open in browser |
| `C` | Checkout |
| `R` | Refresh |
| `A` | AI review |
| `?` | Help |
| `q` | Quit |

#### Chords (500ms timeout)

| Chord | Action |
|-------|--------|
| `gg` | Go to top |
| `gc` | General comment |
| `gr` | Refresh |

### Provider Support

| Provider | Auth | Scopes |
|----------|------|--------|
| GitHub | PAT | `repo`, `read:org` |
| GitLab | PAT | `api` |
| Bitbucket | App Password | `pullrequest`, `repository` |
| Azure DevOps | PAT | `Code (Read & Write)` |

Full `Provider` interface with 30+ methods for PR operations, reviews, comments, labels, assignees, and organization management.

### AI Review System

| Provider | Models | Features |
|----------|--------|----------|
| OpenAI | GPT-4, GPT-3.5 | Full review, cost tracking |
| Anthropic | Claude 3 | Full review, cost tracking |
| Ollama | Local models | Self-hosted, no cost |

Strictness levels: `relaxed`, `standard`, `strict`

### Themes

| Theme | Description |
|-------|-------------|
| `default` | Clean, minimal (Tokyo Night inspired) |
| `lazygit` | Lazygit-style colors |
| `gruvbox` | Gruvbox palette |
| `catppuccin` | Catppuccin colors |
| `high-contrast` | Accessibility theme |

---

## UI Components Library

### Core Components

```typescript
// VirtualList - Efficient rendering of large lists
<VirtualList
  items={pullRequests}
  itemHeight={1}
  renderItem={(pr) => <PRRow pr={pr} />}
/>

// DiffViewer - Syntax-highlighted diff display
<DiffViewer
  diff={diff}
  showLineNumbers
  highlightSyntax
/>

// FileTree - Collapsible file tree
<FileTree
  files={files}
  onSelect={(file) => selectFile(file)}
/>

// Tabs - Tab navigation
<Tabs
  tabs={['Files', 'Comments', 'Timeline']}
  activeTab={activeTab}
  onSelect={setActiveTab}
/>

// StatusBar - Bottom status with keybindings
<StatusBar
  left="j/k:nav  Enter:open  /:search"
  right="PR #123  org/repo"
/>
```

### Design Tokens

```typescript
// Spacing (in terminal characters)
const spacing = {
  xs: 1,
  sm: 2,
  md: 4,
  lg: 8,
}

// Border styles
const borders = {
  none: '',
  thin: '─│┌┐└┘',
  rounded: '─│╭╮╰╯',
}
```

---

## Configuration Compatibility

The TypeScript version MUST read/write the same config format:

```yaml
# ~/.config/lazyreview/config.yaml
version: 0.1
default_provider: github
ui:
  theme: default
  vim_mode: true
  paging: true
  show_checks: true
performance:
  cache_ttl: 120
  comment_cache_ttl: 20
  max_concurrency: 6
  rate_limit_per_second: 10
keybindings:
  # ... full keybinding config
providers:
  - name: github-work
    type: github
    host: github.com
    token_env: GITHUB_TOKEN
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-4)
- Monorepo setup with pnpm
- Core domain models
- Config loader with Zod
- SQLite storage
- Basic CLI structure

### Phase 2: Providers (Weeks 5-8)
- Provider interface
- GitHub, GitLab, Bitbucket, Azure DevOps
- Auth commands
- Rate limiting & caching

### Phase 3: TUI Core (Weeks 9-12)
- React Ink setup
- Theme system
- VirtualList component
- PR list screen
- Keyboard handling

### Phase 4: PR Detail (Weeks 13-16)
- DiffViewer component
- FileTree component
- PR detail screen
- Review actions
- Comments

### Phase 5: Advanced (Weeks 17-20)
- Dashboard view
- Workspace manager
- AI review integration
- Offline queue

### Phase 6: Polish (Weeks 21-24)
- Performance optimization
- Binary packaging
- npm publishing
- Documentation

---

## Distribution & Release

### Installation Methods

Users can install LazyReview via multiple methods:

| Method | Command | Platform |
|--------|---------|----------|
| **npm** | `npm install -g lazyreview` | All |
| **Homebrew** | `brew install lazyreview` | macOS, Linux |
| **Binary** | Download from GitHub Releases | All |
| **npx** | `npx lazyreview` | All |

### npm Publishing

```json
// package.json (apps/cli)
{
  "name": "lazyreview",
  "version": "1.0.0",
  "bin": {
    "lazyreview": "./dist/index.js"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "engines": {
    "node": ">=20.0.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

### Homebrew Formula

```ruby
# Formula/lazyreview.rb
class Lazyreview < Formula
  desc "Terminal UI for streamlined code review across Git providers"
  homepage "https://github.com/tauantcamargo/lazyreview"
  url "https://github.com/tauantcamargo/lazyreview/releases/download/v1.0.0/lazyreview-darwin-arm64.tar.gz"
  sha256 "..." # Auto-generated
  license "MIT"

  depends_on "node@20" => :optional

  def install
    bin.install "lazyreview"
  end

  test do
    system "#{bin}/lazyreview", "--version"
  end
end
```

### GitHub Actions CI/CD

#### Build & Test Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm run typecheck
      - run: pnpm run lint
      - run: pnpm run test
      - run: pnpm run build

  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm run bench
      - name: Check performance regression
        run: pnpm run bench:check
```

#### Release Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write
  packages: write

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            target: linux-x64
          - os: ubuntu-latest
            target: linux-arm64
          - os: macos-latest
            target: darwin-x64
          - os: macos-latest
            target: darwin-arm64
          - os: windows-latest
            target: win-x64

    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm run build

      - name: Package binary
        run: pnpm run package --target ${{ matrix.target }}

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: lazyreview-${{ matrix.target }}
          path: dist/bin/lazyreview-*

  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts

      - name: Create tarballs
        run: |
          cd artifacts
          for dir in */; do
            target="${dir%/}"
            tar -czvf "${target}.tar.gz" -C "$dir" .
          done

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: artifacts/*.tar.gz
          generate_release_notes: true

  publish-npm:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm run build

      - name: Publish to npm
        run: pnpm --filter lazyreview publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  publish-homebrew:
    needs: release
    runs-on: ubuntu-latest
    steps:
      - name: Update Homebrew formula
        uses: mislav/bump-homebrew-formula-action@v3
        with:
          formula-name: lazyreview
          homebrew-tap: tauantcamargo/homebrew-tap
          download-url: https://github.com/tauantcamargo/lazyreview/releases/download/${{ github.ref_name }}/lazyreview-darwin-arm64.tar.gz
        env:
          COMMITTER_TOKEN: ${{ secrets.HOMEBREW_TAP_TOKEN }}
```

### Homebrew Tap Repository

Create a separate repository `tauantcamargo/homebrew-tap`:

```
homebrew-tap/
├── Formula/
│   └── lazyreview.rb
└── README.md
```

Users install via:
```bash
brew tap tauantcamargo/tap
brew install lazyreview
```

### Binary Packaging Script

```typescript
// scripts/package-binary.ts
import { execSync } from 'child_process'
import { platform, arch } from 'os'

const targets = {
  'darwin-arm64': 'node20-macos-arm64',
  'darwin-x64': 'node20-macos-x64',
  'linux-x64': 'node20-linux-x64',
  'linux-arm64': 'node20-linux-arm64',
  'win-x64': 'node20-win-x64',
}

async function packageBinary(target: string) {
  const pkgTarget = targets[target]
  if (!pkgTarget) {
    throw new Error(`Unknown target: ${target}`)
  }

  execSync(
    `pnpm exec pkg . --target ${pkgTarget} --output dist/bin/lazyreview-${target}`,
    { stdio: 'inherit', cwd: 'apps/cli' }
  )
}

const target = process.argv[2] || `${platform()}-${arch()}`
packageBinary(target)
```

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| Cold startup | <100ms |
| Warm startup | <50ms |
| List scroll | 60fps |
| PR list (10k items) | No frame drops |
| Memory idle | <50MB |
| Memory active | <100MB |
| Binary size | <20MB |

---

## Testing Strategy

- **Unit tests**: Vitest, 80%+ coverage
- **Component tests**: ink-testing-library
- **E2E tests**: Playwright terminal testing
- **Performance**: Benchmark suite in CI

---

## Feature Parity Checklist

- [ ] CLI commands (10)
- [ ] TUI views (6)
- [ ] Keyboard bindings (50+)
- [ ] Chord sequences (3+)
- [ ] Providers (4)
- [ ] AI providers (3)
- [ ] Themes (5+)
- [ ] Config compatibility
- [ ] Offline queue
- [ ] Caching system

---

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Ink performance | Early benchmarking, VirtualList |
| Binary size | Tree-shaking, pkg optimization |
| Native deps | better-sqlite3 prebuilds |
| Memory leaks | Regular profiling |

---

## Appendix: Go to TypeScript Mapping

| Go | TypeScript |
|----|------------|
| `struct` | `interface` / `type` |
| Goroutine | `Promise` / async |
| `context.Context` | AbortController |
| `bubbletea.Model` | React component |
| `bubbletea.Cmd` | useEffect |
| `viper` | Custom config + Zod |

---

**Change Log:**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-06 | Initial comprehensive PRD with clean design |
| 1.1 | 2026-02-06 | Added Axios, TanStack Query, openapi-typescript, Zustand details |
| 1.2 | 2026-02-06 | Added npm/Homebrew distribution with GitHub Actions CI/CD |
