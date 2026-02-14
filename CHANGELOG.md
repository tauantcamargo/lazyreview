# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
