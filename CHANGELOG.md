# Changelog

All notable changes to LazyReview are documented here.

## 1.0.0

- Add MIT LICENSE file
- Update README with complete keyboard shortcuts matching HelpModal
- Remove unused Loading service (dead code cleanup)
- Comprehensive test coverage push: 472 tests, 60%+ line coverage on core logic
- Add CHANGELOG.md

## 0.1.18

- Edit PR description from conversations tab (`D`)
- Render inline comments in side-by-side diff view
- File-viewed tracking for review progress (`v`)
- Full API pagination to fetch complete result sets
- Lazy-load review and check status for focused PR only (perf)
- Remap PR checkout to `G` to resolve `g` key collision

## 0.1.17

- Persistent read/unread state for PRs
- Side-by-side diff view toggle (`d`)
- Review approval status displayed in PR list items
- Next/prev PR navigation with `]`/`[`
- PR branch checkout (`G`)
- `--help` CLI flag with usage information

## 0.1.16

- `--help` CLI flag
- Open/closed/merged PR state toggle (`t`)
- Faceted filtering by repo, author, and label in FilterModal
- Syntax highlighting on added/deleted diff lines
- Updated HelpModal with accurate shortcuts

## 0.1.15

- Copy PR URL and commit SHA to clipboard (`y`)
- Fetch and display issue comments in conversations timeline
- Decompose large hooks into focused action hooks
- Replace mutation boilerplate with `createGitHubMutation` factory
- Extract shared PRListScreen to eliminate duplication
- Fix diff line number mapping for inline comments

## 0.1.14

- PR labels and assignees in PR list items
- Context-sensitive keyboard shortcut hints in status bar
- Retry on error for failed API calls
- PR description at top of conversations tab

## 0.1.13

- ErrorBoundary component for graceful crash recovery
- 19 test suites, 251 tests total

## 0.1.12

- Split large files into focused modules
- Inline diff comments (`c` in diff view)
- File tree filter (`/` in files tab)
- Batch review mode (`S`)
- Close/reopen PR (`X`)
- Edit own comments (`e`)
- Shared `runEffect` utility, removed all `@ts-ignore`

## 0.1.11

- Reply to review comment threads (`r`)
- Visual line selection for multi-line comments (`v`)
- Resolve/unresolve threads via GraphQL (`x`)
- Review summary showing approval status per reviewer
- Request re-review from multiple reviewers (`E`)
- Gruvbox theme

## 0.1.10

- Auto-refresh with configurable interval and rate limit awareness
- Merge PR with squash/rebase/merge options (`m`)
- Markdown rendering in PR bodies and comments
- Multi-line text input with cursor navigation and tab indentation
- 75 tests

## 0.1.9

- CI check run status displayed inline on each PR
- Settings screen for token, theme, page size, and refresh interval
- Submit review: approve, request changes, or comment (`R`)
- Dead code cleanup

## 0.1.8

- Enhanced README with badges and installation instructions

## 0.1.7 and earlier

- Initial TUI with Ink + Effect + TypeScript
- PR list with search, sort, and pagination
- PR detail with Conversations, Commits, and Files tabs
- Vim-style navigation (`j`/`k`/`h`/`l`)
- Syntax-highlighted diffs
- GitHub token authentication (env var, gh CLI, manual)
- YAML configuration
- Four built-in themes: tokyo-night, dracula, catppuccin-mocha, gruvbox
- Collapsible sidebar with multiple views (Involved, My PRs, For Review, This Repo)
