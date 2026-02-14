# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.74] - 2026-02-14

### Added
- **Direct PR navigation**: `--pr 42` CLI flag to jump directly to a specific PR, supports full URLs for all providers
- **PR creation from TUI**: Press `N` in This Repo screen to create PRs with title, body, branch selection, and draft toggle
- **Label management**: Press `L` in PR detail to add/remove labels via picker modal (GitHub)
- **Assignee management**: Press `A` in PR detail to add/remove assignees via picker modal (GitHub)
- **Comment reactions**: Press `+` on a comment to add emoji reactions with 8 reaction types (GitHub)
- **Bot summary display**: Press `B` in Description tab to see AI/bot-generated PR summaries
- **GitHub Enterprise support**: Config `providers.github.hosts` for custom GHE domains with correct API URL derivation
- **Self-hosted GitLab support**: Config `providers.gitlab.hosts` with nested group paths and MR URL parsing
- **Multi-instance provider support**: Per-host token storage for multiple instances of the same provider
- **Syntax highlighting**: Expanded from 12 to 73 language mappings, extracted to `src/utils/languages.ts`
- **Diff statistics summary**: Compact stats bar in Files tab showing file count, +/-, extension breakdown, top files
- **Enhanced markdown**: Task lists with completion counts, pipe-delimited tables, image placeholders, strikethrough, nested lists
- **Scroll position indicator**: Shows current line/total lines in diff panel header
- **Hunk navigation**: `{`/`}` keys to jump between diff hunks, skip context lines
- **Go-to-line**: `:` key in diff view to jump to a specific line number
- **Jump to unread**: `U` key in PR list to jump to next unread PR
- **Compact list mode**: `Ctrl+L` to toggle single-line PR list items, configurable via `compactList` in config
- **PR preview panel**: `P` key shows PR description preview on wide terminals (140+ columns)
- **Responsive sidebar**: Width adapts to terminal size (28/34/40 columns), `Ctrl+B` cycles full/icon-only/hidden
- **Panel resizing**: `<`/`>` keys to resize file tree panel width in Files tab
- **File tree collapse**: `Enter`/`Space` on directories to collapse/expand subtrees
- **github-light theme**: Light background theme for users with light terminal backgrounds
- **Color-coded status messages**: Success (green), error (red), info (default) status bar messages
- **Color-blind accessible high-contrast theme**: Changed diff colors from red/green to blue/orange

### Changed
- **Unified interfaces**: Aligned CodeReviewApiService method names 1:1 with Provider interface (17 renames)
- **Optimistic updates**: Comments, reviews, and thread resolution now update the UI cache instantly with rollback on failure
- **Request deduplication**: Shared PR cache reduces API calls ~40-66% during sidebar navigation
- **Lazy file loading**: Diffs load on-demand per file; pagination support for 300+ file PRs
- Fixed onboarding screen to show correct panel switching keys (Tab/Escape instead of h/l)
- Removed TopBar margin to reclaim terminal space

## [1.0.68] - 2026-02-13

### Added
- **Multi-provider support**: GitLab, Bitbucket, Azure DevOps, Gitea/Forgejo alongside GitHub
- Provider abstraction layer with capabilities system and contract tests
- Provider-agnostic authentication (CLI tools, env vars, manual tokens per provider)
- Provider-agnostic git remote URL parsing (auto-detects provider from remote)
- Provider switching in Settings (cycle between all 5 providers)
- GitLab: Full MR support (list, diff, approve, comment, merge, pipelines, discussions)
- Bitbucket: Full PR support (list, diff, approve, comment, merge, pipelines)
- Azure DevOps: Full PR support (list, diff, vote, comment, complete, builds, threads)
- Gitea/Forgejo: Full PR support (list, diff, review, comment, merge)
- Desktop notifications for PR activity (new PRs, updates, review requests)
- Cross-file diff search (F key to search across all files, n/N to navigate)
- Configurable keybindings via config.yaml with per-context overrides
- Context-sensitive shortcut hints in status bar
- Provider indicator badge in top bar ([GH], [GL], [BB], [AZ], [GT])
- Provider-specific error messages with actionable fix suggestions
- CHANGELOG and release scripts (pnpm release:patch/minor/major)
- Provider integration test framework with contract tests for all providers
- Per-provider token storage (~/.config/lazyreview/tokens/{provider}.token)

### Changed
- Authentication system refactored for multi-provider support
- HelpModal now dynamically built from keybinding config
- Status bar shows actual keybindings (respects user overrides)
- TopBar shows color-coded provider badge
- ErrorWithRetry shows provider-specific help for auth failures
- README expanded with provider comparison table and per-provider setup
- CLAUDE.md updated with provider architecture documentation

## [1.0.49] - 2026-02-13

### Added
- Provider abstraction layer for multi-provider support (Phase 2)
- High contrast accessibility theme with WCAG AA colors
- Visible focus indicators on all interactive elements
- Integration test for full app startup flow
- Exponential backoff retry with 429/Retry-After support
- Token expiration detection with auto re-auth
- Immutable auth state management
- Onboarding screen for first-time users
- Consolidated URL parsing utilities

### Changed
- Auth service refactored to fully immutable pattern
- API helpers enhanced with retry logic

## [1.0.41] - 2026-02-12

### Added
- Memoized diff computations with stable fingerprints
- Draft PR toggle (convert to draft / mark ready for review)
- Commit diff viewer for individual commits
- PR title inline editing

### Changed
- FilesTab refactored from 852 to 478 lines
- Extracted useDiffSearch, useVisualSelect, useFilesTabKeyboard hooks

## [1.0.31] - 2026-02-11

### Added
- CI/CD workflow for tests on push/PR
- Confirmation dialogs for destructive actions
- Keyboard shortcut hints in status bar
- Diff search with n/N navigation
- Check run URL opening and copying

### Changed
- Ctrl+S replaces Ctrl+Enter for submit (terminal compatibility)

## [1.0.26] - 2026-02-11

### Added
- Diff search highlighting (/ in diff view)
- Check run open in browser and copy URL
- Label contrast colors (WCAG luminance)
- Reply to issue comments and go-to-file from inline comments

## [1.0.18] - 2026-02-10

### Added
- Side-by-side diff view (d key)
- File-viewed tracking
- Edit PR description
- Side-by-side diff comments
- API pagination for large result sets
- Lazy-load review and check status

### Fixed
- g key collision in conversations tab
- Diff view truncation (measureElement + expandTabs)

## [1.0.0] - 2026-02-08

### Added
- Initial release
- GitHub PR list with search, sort, pagination
- PR detail with Description, Conversations, Commits, Files, Checks tabs
- Review submission (approve, request changes, comment)
- Inline diff comments with visual line selection
- Merge PR (merge, squash, rebase)
- Close/reopen PR
- Side-by-side diff view
- Faceted filtering and sorting
- Read/unread state tracking
- File-viewed tracking
- PR branch checkout
- Markdown rendering
- Four themes (tokyo-night, dracula, catppuccin-mocha, gruvbox)
- Configurable settings
- Browse any repo feature
- Auto-refresh with rate limit awareness
