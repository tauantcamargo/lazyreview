# LazyReview

TUI code review tool for GitHub PRs built with Ink + Effect + TypeScript.

## Project Structure

```
src/
├── cli.tsx              # Entry point
├── app.tsx              # Root component with Box layout
├── components/
│   ├── layout/          # TopBar, Sidebar, MainPanel, StatusBar
│   ├── pr/              # PRListItem, PRHeader, PRTabs, FilesTab, CommentsTab
│   └── common/          # EmptyState, LoadingIndicator
├── screens/             # PRListScreen, PRDetailScreen, MyPRsScreen, ReviewRequestsScreen, SettingsScreen
├── hooks/               # useGitHub, useAuth, useConfig, useLoading, useTheme, useListNavigation, useActivePanel
├── services/            # Effect services: GitHubApi, Auth, Config, Loading, layers
├── models/              # Zod schemas + TS types
├── theme/               # Theme types, color palettes, ThemeProvider
└── utils/               # date formatting, terminal helpers
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
