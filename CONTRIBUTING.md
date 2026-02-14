# Contributing to LazyReview

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
git clone https://github.com/tauantcamargo/lazyreview.git
cd lazyreview
pnpm install
pnpm dev        # Watch mode build
pnpm start      # Run the TUI
```

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm build` | Build with tsup |
| `pnpm dev` | Watch mode build |
| `pnpm start` | Run the TUI |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Watch mode tests |
| `pnpm test:coverage` | Tests with coverage (80% threshold) |
| `pnpm typecheck` | TypeScript type checking |

## Code Style

- **Immutable patterns only** -- never mutate objects, always spread/create new
- **Effect services** with tagged errors for API interactions
- **Zod schemas** for all external data validation
- **Files under 400 lines** -- extract when files grow too large
- **Small functions** (<50 lines)
- **No console.log** -- use status messages or Effect logging
- **Vim-style navigation** (j/k/h/l) via Ink's useInput

## Commit Messages

We use [conventional commits](https://www.conventionalcommits.org/):

```
feat: add label picker modal
fix: handle empty diff in side-by-side view
refactor: extract diff navigation helpers
docs: update provider comparison table
test: add Azure DevOps contract tests
chore: update dependencies
perf: add optimistic updates for comments
```

## Pull Request Process

1. Branch from main
2. Write tests for new functionality
3. Ensure pnpm test and pnpm typecheck pass
4. Keep commits focused and well-described
5. Open a PR with a clear summary of changes

## Architecture Overview

**Key concepts:**
- **Provider interface** (src/services/providers/types.ts) -- all 5 providers implement this
- **Effect services** (src/services/) -- typed errors, dependency injection, layers
- **React Query hooks** (src/hooks/) -- data fetching, caching, mutations
- **Ink components** (src/components/) -- terminal UI rendering

## How to Add a New Provider

1. Create src/services/providers/<name>.ts implementing the Provider interface
2. Create helper and mutation modules (<name>-helpers.ts, <name>-mutations.ts)
3. Add Zod schemas in src/models/<name>/ with mapper functions
4. Add a tagged error class in src/models/errors.ts
5. Register in the factory at src/services/providers/index.ts
6. Add contract tests in src/services/providers/__tests__/
7. Add auth support in src/services/Auth.ts
8. Update detectProvider in src/utils/git.ts

## How to Add a New Theme

1. Add a color palette to src/theme/themes.ts following the ThemeColors type
2. Add the theme name to ThemeName in src/theme/types.ts
3. Add it to THEME_ORDER in src/screens/SettingsScreen.tsx

## Good First Issues

Look for issues labeled good first issue on GitHub. Great starting points:
- Adding a new theme
- Improving date formatting edge cases in src/utils/date.ts
- Increasing test coverage for specific files
- Adding new syntax highlighting language mappings in src/utils/languages.ts
