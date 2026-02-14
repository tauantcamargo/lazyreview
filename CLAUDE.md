# LazyReview

TUI code review tool for pull requests built with Ink + Effect + TypeScript.
Supports GitHub, GitLab, Bitbucket, Azure DevOps, and Gitea/Forgejo via a pluggable provider architecture.

## Project Structure

```
src/
├── cli.tsx              # Entry point
├── app.tsx              # Root component with Box layout
├── components/
│   ├── layout/          # TopBar, Sidebar, MainPanel, StatusBar, HelpModal, TokenInputModal,
│   │                    #   OnboardingScreen
│   ├── pr/              # PRListItem, PRHeader, PRTabs, DescriptionTab, ConversationsTab, CommitsTab,
│   │                    #   FilesTab, ChecksTab, DiffView, SideBySideDiffView, FileTree, DiffComment,
│   │                    #   ReviewModal, CommentModal, MergeModal, ReReviewModal, ReviewSummary,
│   │                    #   CheckStatusSummary, CheckStatusIcon, ReviewStatusIcon, TimelineItemView
│   └── common/          # EmptyState, LoadingIndicator, ErrorBoundary, ErrorWithRetry, MarkdownText,
│                        #   BorderedBox, Divider, FilterModal, SortModal, Modal, MultiLineInput,
│                        #   PaginationBar, Spinner
├── screens/             # PRListScreen, PRDetailScreen, BrowseRepoScreen, SettingsScreen,
│                        #   InvolvedScreen, MyPRsScreen, ReviewRequestsScreen, ThisRepoScreen
├── hooks/               # useGitHub, useGitHubMutations, useAuth, useConfig, useRecentRepos,
│                        #   useBookmarkedRepos, useSidebarCounts, useSidebarSections, useListNavigation,
│                        #   useActivePanel, useFilter, useViewedFiles, useReadState, useScreenContext,
│                        #   usePendingReview, usePRDetailModals, useReviewActions, useCommentActions,
│                        #   usePRStateActions, usePagination, useStatusMessage, useLastUpdated,
│                        #   useRateLimit, useRefreshInterval, useManualRefresh, useKeybindings,
│                        #   useNotifications, useTokenExpired, useCrossFileSearch, useDiffSearch,
│                        #   useFilesTabKeyboard, useVisualSelect, useInputFocus, useRepoContext
├── services/
│   ├── Auth.ts          # Token management (per-provider: gh CLI, env var, manual)
│   ├── Config.ts        # YAML config loading/saving with Effect Schema
│   ├── GitHubApi.ts     # Effect service tag for CodeReviewApi
│   ├── GitHubApiLive.ts # Live Effect layer wiring providers to CodeReviewApi
│   ├── GitHubApiHelpers.ts    # GitHub REST/GraphQL helpers
│   ├── GitLabApiHelpers.ts    # GitLab REST helpers
│   ├── BitbucketApiHelpers.ts # Bitbucket REST helpers
│   ├── AzureApiHelpers.ts     # Azure DevOps REST helpers
│   ├── GiteaApiHelpers.ts     # Gitea/Forgejo REST helpers
│   ├── CodeReviewApiTypes.ts  # Shared service interface types
│   └── providers/       # Provider abstraction layer
│       ├── types.ts     # ProviderType, ProviderConfig, ProviderCapabilities, Provider interface
│       ├── index.ts     # createProvider() factory
│       ├── github.ts    # GitHub provider implementation
│       ├── gitlab.ts    # GitLab provider (reads + mutations)
│       ├── gitlab-helpers.ts  # GitLab API utilities
│       ├── gitlab-mutations.ts # GitLab write operations
│       ├── bitbucket.ts # Bitbucket provider
│       ├── bitbucket-helpers.ts # Bitbucket API utilities
│       ├── bitbucket-mutations.ts # Bitbucket write operations
│       ├── azure.ts     # Azure DevOps provider
│       ├── azure-helpers.ts   # Azure API utilities
│       ├── azure-mutations.ts # Azure write operations
│       ├── gitea.ts     # Gitea/Forgejo provider
│       └── gitea-mutations.ts # Gitea write operations
├── models/
│   ├── *.ts             # Shared Zod schemas + TS types (pull-request, comment, review, etc.)
│   ├── errors.ts        # Tagged errors: GitHubError, GitLabError, BitbucketError, AzureError, GiteaError
│   ├── gitlab/          # GitLab-specific schemas (merge-request, note, diff, pipeline, commit, mappers)
│   ├── bitbucket/       # Bitbucket-specific schemas (pull-request, comment, diff, pipeline, commit, mappers)
│   ├── azure/           # Azure-specific schemas (pull-request, comment, diff, build, commit, mappers)
│   └── gitea/           # Gitea-specific schemas (pull-request, comment, review, diff, commit, mappers)
├── config/
│   └── keybindings.ts   # Default keybindings, merge with user overrides, key matching
├── theme/               # Theme types, color palettes, ThemeProvider
└── utils/               # date formatting, terminal helpers, git helpers, sanitize (stripAnsi),
                         #   debounced writer, retry config, provider detection
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
- **Providers**: 5 providers via pluggable Provider interface (GitHub, GitLab, Bitbucket, Azure DevOps, Gitea/Forgejo)
- **Data fetching**: @tanstack/react-query (caching, auto-refresh, pagination)
- **Validation**: Zod schemas + Effect Schema for config
- **Config**: YAML (~/.config/lazyreview/config.yaml)
- **Build**: tsup (ESM, node20 target)
- **Test**: Vitest + ink-testing-library

## Provider Architecture

Each provider implements the `Provider` interface from `src/services/providers/types.ts`:

- **ProviderType**: `'github' | 'gitlab' | 'bitbucket' | 'azure' | 'gitea'`
- **ProviderCapabilities**: Feature flags (draft PRs, review threads, GraphQL, reactions, check runs, merge strategies)
- **Provider**: Full interface with read operations, mutations, and thread operations
- **createProvider()**: Factory function in `src/services/providers/index.ts` that returns the correct implementation

Each provider has:
- A main file (e.g. `github.ts`) with the provider constructor
- Helper modules for API calls (e.g. `gitlab-helpers.ts`)
- Mutation modules for write operations (e.g. `bitbucket-mutations.ts`)
- Model schemas in `src/models/<provider>/` with Zod validation and mapper functions
- Contract tests in `src/services/providers/__tests__/` verifying interface compliance

## Conventions

- Immutable patterns only (no mutation)
- Effect services with tagged errors (one error class per provider)
- Zod schemas for all external data, per-provider model directories
- Custom hooks for navigation: useListNavigation, useActivePanel
- Configurable keybindings via `src/config/keybindings.ts` with user overrides
- Vim-style navigation (j/k/h/l) via useInput from ink
- Small files (<400 lines), high cohesion
- All user input validated with Zod or Effect Schema
- Provider auto-detection from git remote URL
