# LazyReview

TUI code review tool for GitHub PRs built with Ink + Effect + TypeScript.

## Project Structure

```
src/
├── cli.tsx              # Entry point
├── app.tsx              # Root component with Box layout
├── components/
│   ├── layout/          # TopBar, Sidebar, MainPanel, StatusBar, HelpModal, TokenInputModal
│   ├── pr/              # PRListItem, PRHeader, PRTabs, DescriptionTab, ConversationsTab, CommitsTab,
│   │                    #   FilesTab, ChecksTab, DiffView, SideBySideDiffView, FileTree, DiffComment,
│   │                    #   ReviewModal, CommentModal, MergeModal, ReReviewModal, ReviewSummary,
│   │                    #   CheckStatusSummary, CheckStatusIcon, ReviewStatusIcon, TimelineItemView
│   └── common/          # EmptyState, LoadingIndicator, ErrorBoundary, ErrorWithRetry, MarkdownText,
│                        #   BorderedBox, Divider, FilterModal, SortModal, Modal, MultiLineInput,
│                        #   PaginationBar, Spinner
├── screens/             # PRListScreen, PRDetailScreen, BrowseRepoScreen, SettingsScreen
├── hooks/               # useGitHub, useGitHubMutations, useAuth, useConfig, useRecentRepos,
│                        #   useBookmarkedRepos, useSidebarCounts, useSidebarSections, useListNavigation,
│                        #   useActivePanel, useFilter, useViewedFiles, useReadState, useScreenContext,
│                        #   usePendingReview, usePRDetailModals, useReviewActions, useCommentActions,
│                        #   usePRStateActions, usePagination, useStatusMessage, useLastUpdated,
│                        #   useRateLimit, useRefreshInterval, useManualRefresh
├── services/            # Effect services: CodeReviewApi, GitHubApiLive, Auth, Config, layers
├── models/              # Zod schemas + TS types
├── theme/               # Theme types, color palettes, ThemeProvider
└── utils/               # date formatting, terminal helpers, git helpers, sanitize (stripAnsi)
```

## Commands

- `pnpm build` - Build with tsup
- `pnpm start` - Run the TUI
- `pnpm dev` - Watch mode build
- `pnpm typecheck` - TypeScript type checking
- `pnpm test` - Run tests
- `pnpm test:watch` - Watch mode tests
- `pnpm test:coverage` - Tests with coverage (80% threshold)

## Stack

- **UI**: Ink 6 + @inkjs/ui + React 19
- **Services**: Effect (typed errors, dependency injection, layers)
- **Validation**: Zod schemas for API responses
- **Config**: YAML (~/.config/lazyreview/config.yaml)
- **Build**: tsup (ESM, node20 target)
- **Test**: Vitest + ink-testing-library

## Conventions

- Immutable patterns only (no mutation)
- Effect services with tagged errors
- Zod schemas for all external data
- Custom hooks for navigation: useListNavigation, useActivePanel
- Vim-style navigation (j/k/h/l) via useInput from ink
- Small files (<400 lines), high cohesion
- All user input validated with Zod
