# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
