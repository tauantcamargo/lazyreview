# LazyReview v2.0.0 Roadmap

**Author:** Product Owner
**Date:** 2026-02-14
**Status:** Draft
**Current Version:** v1.0.74 (3712 tests, 149 files)

---

## Executive Summary

LazyReview 1.x delivered a complete, multi-provider TUI for code review with polished
UX, comprehensive keyboard navigation, and support for five git hosting platforms.
Version 2.0.0 represents a fundamental leap: the move from a **single-user review
viewer** to a **team-oriented review workstation** with a plugin architecture,
streaming data, persistent local state, and optional AI assistance.

The major version bump is justified by:
1. Breaking changes to the config schema (plugin system, workspace profiles)
2. Breaking changes to the Provider interface (streaming, webhooks, batch operations)
3. New runtime dependency model (SQLite for local state, optional LLM integration)
4. Fundamental architecture shift to virtual scrolling and streaming data

---

## Table of Contents

1. [Breaking Changes](#1-breaking-changes)
2. [Flagship Features](#2-flagship-features)
3. [Plugin System & Extensibility](#3-plugin-system--extensibility)
4. [Performance & Architecture](#4-performance--architecture)
5. [Collaboration & Team Features](#5-collaboration--team-features)
6. [AI & Intelligence](#6-ai--intelligence)
7. [Quality of Life](#7-quality-of-life)
8. [Implementation Phases](#8-implementation-phases)
9. [Migration Guide](#9-migration-guide)
10. [Success Metrics](#10-success-metrics)

---

## 1. Breaking Changes

These changes justify the semver major bump and require a migration path.

### 1.1 Config Schema v2

**Title:** Restructured YAML configuration with workspace profiles
**Description:** The current flat `~/.config/lazyreview/config.yaml` is reaching its
limits. v2 introduces workspace profiles, plugin configuration blocks, and a versioned
schema. Users can define per-directory overrides (similar to `.editorconfig` or
`.prettierrc`) with a `.lazyreview.yaml` at the repo root. The global config gains a
`version: 2` field and restructured sections. A migration utility auto-upgrades v1 configs.
**Complexity:** M
**Priority:** P0
**Dependencies:** None

**Breaking details:**
- Top-level `provider` key moves to `defaults.provider`
- `keybindings` becomes `keybindingOverrides` (already partially done)
- `gitlab.host` removed (replaced by `providers.gitlab.hosts`)
- New required `version: 2` field
- Plugin configs under `plugins:` namespace

### 1.2 Provider Interface v2

**Title:** Expanded Provider interface with streaming, batch operations, and webhook support
**Description:** The Provider interface in `src/services/providers/types.ts` gains new
methods for streaming diffs (returning `AsyncIterable` instead of full arrays for large
files), batch PR fetching (fetch metadata for multiple PRs in a single call), and
webhook registration for real-time push updates instead of polling.
**Complexity:** L
**Priority:** P0
**Dependencies:** None

**Breaking details:**
- `getPRFiles` return type changes from `readonly FileChange[]` to `AsyncIterable<FileChange> | readonly FileChange[]`
- New required `readonly batchGetPRs` method
- `ProviderCapabilities` gains `supportsStreaming`, `supportsWebhooks`, `supportsBatchFetch`
- `ApiError` union type extended with `StreamError` and `WebhookError`

### 1.3 Persistent Local State (SQLite)

**Title:** Replace in-memory state with SQLite-backed persistence
**Description:** Currently, read/unread state, viewed files, and bookmarks are stored
in the YAML config or in-memory React Query cache. v2 moves all mutable local state
to a SQLite database at `~/.local/share/lazyreview/state.db`. This enables: review
progress survival across sessions, historical analytics, and cross-device sync (future).
**Complexity:** L
**Priority:** P0
**Dependencies:** Config Schema v2

**Breaking details:**
- `useReadState` and `useViewedFiles` hooks change their storage backend
- `recentRepos` and `bookmarkedRepos` move from YAML config to SQLite
- New `better-sqlite3` (or `sql.js`) runtime dependency
- First launch runs a migration to import v1 state

---

## 2. Flagship Features

These are the headline features that make people want to upgrade to v2.

### 2.1 Review Workspace (Multi-PR Dashboard)

**Title:** Open and manage multiple PRs simultaneously in a tabbed workspace
**Description:** The current model is linear: list -> detail -> back to list. v2
introduces a workspace metaphor where users can "pin" multiple PRs and switch between
them with `Alt+1..9` or a tab bar. Each PR retains its scroll position, active tab,
and review state. The workspace layout is two-pane: pinned PR tabs on the left,
active PR content on the right.
**Complexity:** XL
**Priority:** P0
**Dependencies:** Persistent Local State

**User stories:**
- As a reviewer with 5 PRs queued, I want to flip between them without losing my place
- As a lead, I want to keep my own PR open while reviewing a teammate's PR
- As a reviewer, I want to see which pinned PRs have unresolved threads at a glance

**Acceptance criteria:**
- [ ] Pin/unpin PRs with a keybinding (default: `p`)
- [ ] Switch between pinned PRs with `Alt+1..9` or `gt`/`gT` (vim tab style)
- [ ] Each PR tab preserves: active tab, scroll offset, viewed files, pending review
- [ ] Tab bar shows PR number, author avatar initial, unresolved thread count
- [ ] Maximum 9 pinned PRs (configurable)
- [ ] Workspace state persists across sessions via SQLite

### 2.2 Inline Code Suggestions (Edit Proposals)

**Title:** Propose code changes directly from the diff view as suggestion blocks
**Description:** GitHub, GitLab, and Gitea support "suggestion" syntax in review
comments (triple-backtick with `suggestion` language tag). v2 lets reviewers select
lines in the diff, press a key to enter suggestion mode, edit the proposed replacement
code in-place, and submit it as a properly formatted suggestion comment. The PR author
can then accept suggestions directly from the TUI.
**Complexity:** L
**Priority:** P0
**Dependencies:** Visual select (already exists), Provider Interface v2

**Acceptance criteria:**
- [ ] Select lines with `v`, press `S` to enter suggestion mode
- [ ] Inline editor shows the selected code with editable replacement below
- [ ] Submitting wraps the replacement in provider-appropriate suggestion syntax
- [ ] PR author can accept a suggestion with `a` (triggers a commit via API)
- [ ] Batch-accept multiple suggestions in one commit
- [ ] Works on GitHub, GitLab, and Gitea (Bitbucket/Azure degrade gracefully to plain comment)

### 2.3 PR Timeline View

**Title:** Unified chronological timeline of all PR activity
**Description:** Currently, conversations, reviews, commits, and check status live
in separate tabs. v2 adds a "Timeline" tab that interleaves all events chronologically:
commits, review submissions, comments, label changes, status checks, force pushes.
This gives a complete narrative of the PR's lifecycle in one scrollable view.
**Complexity:** L
**Priority:** P1
**Dependencies:** Provider Interface v2 (for timeline events API)

**Acceptance criteria:**
- [ ] New "Timeline" tab in PR detail (between Description and Conversations)
- [ ] Interleaves: commits, reviews, comments, label changes, assignee changes, status checks
- [ ] Each event type has a distinct icon/color prefix
- [ ] Expandable/collapsible event groups (e.g., collapse a batch of CI checks)
- [ ] Jump-to-conversation from timeline events

### 2.4 Split Diff View (Three-Way Merge Conflict View)

**Title:** Three-way diff for merge conflict resolution
**Description:** When a PR has merge conflicts, show a three-way diff (base, ours,
theirs) in a split view. Users can navigate conflicts with keybindings and see exactly
what each side changed relative to the common ancestor. This does not resolve conflicts
(that requires local checkout), but it provides visibility that no other TUI offers.
**Complexity:** L
**Priority:** P1
**Dependencies:** None

**Acceptance criteria:**
- [ ] Detect merge conflict state from PR metadata (`mergeable: false`, `mergeable_state: 'dirty'`)
- [ ] Show conflict indicator in PR header and Files tab
- [ ] Three-pane split view: base | head | base branch
- [ ] Navigate between conflict regions with `]c` / `[c` (vim-style)
- [ ] Keybinding to open conflicted file in $EDITOR for local resolution

---

## 3. Plugin System & Extensibility

### 3.1 Plugin Architecture

**Title:** Loadable plugin system for extending LazyReview
**Description:** v2 introduces a plugin API that allows third-party TypeScript modules
to extend LazyReview. Plugins can: add sidebar sections, add PR detail tabs, add
command palette entries, provide custom diff renderers, hook into review lifecycle
events (pre-submit, post-merge), and register keybindings. Plugins are loaded from
`~/.config/lazyreview/plugins/` or installed via npm.
**Complexity:** XL
**Priority:** P1
**Dependencies:** Config Schema v2

**Plugin API surface:**
```typescript
interface LazyReviewPlugin {
  readonly name: string
  readonly version: string
  readonly activate: (ctx: PluginContext) => void | Promise<void>
  readonly deactivate?: () => void
}

interface PluginContext {
  readonly registerTab: (tab: CustomTab) => void
  readonly registerCommand: (cmd: CommandEntry) => void
  readonly registerKeybinding: (ctx: string, action: string, key: string) => void
  readonly registerSidebarSection: (section: SidebarSection) => void
  readonly onEvent: (event: PluginEvent, handler: EventHandler) => void
  readonly config: PluginConfigReader
  readonly storage: PluginStorage  // Scoped SQLite access
}
```

**Acceptance criteria:**
- [ ] Plugin discovery from `~/.config/lazyreview/plugins/` directory
- [ ] Plugin lifecycle: activate on startup, deactivate on exit
- [ ] Plugin isolation: errors in one plugin do not crash the app
- [ ] Plugin config in main config file under `plugins.<name>.` namespace
- [ ] At least 3 first-party plugins as proof-of-concept

### 3.2 Custom Theme Authoring

**Title:** User-defined themes via YAML/JSON files
**Description:** Currently themes are hardcoded in `src/theme/themes.ts`. v2 allows
users to define custom themes in `~/.config/lazyreview/themes/` as YAML files that
conform to the `ThemeColors` interface. The settings screen shows both built-in and
custom themes. Themes can also extend built-in themes with partial overrides.
**Complexity:** S
**Priority:** P1
**Dependencies:** Config Schema v2

**Acceptance criteria:**
- [ ] Load `.yaml` files from `~/.config/lazyreview/themes/`
- [ ] Validate against `ThemeColors` schema with helpful error messages
- [ ] Support `extends: "tokyo-night"` to partially override a built-in theme
- [ ] Custom themes appear in Settings alongside built-in themes
- [ ] Hot-reload theme changes without restarting the app

### 3.3 Custom Provider Registration

**Title:** Register third-party git hosting providers via plugins
**Description:** The current 5-provider set is hardcoded. v2 allows plugins to register
new providers by implementing the `Provider` interface. This enables support for
self-hosted tools like Gerrit, Phabricator, or internal code review systems without
modifying LazyReview core.
**Complexity:** L
**Priority:** P2
**Dependencies:** Plugin Architecture

**Acceptance criteria:**
- [ ] Plugins can call `ctx.registerProvider(type, factory)` to add a provider
- [ ] Custom providers appear in Settings > Provider selection
- [ ] Custom providers participate in auto-detection if they register URL patterns
- [ ] Contract test framework can be used by plugin authors to validate their provider

---

## 4. Performance & Architecture

### 4.1 Virtual Scrolling for Diff Views

**Title:** Render only visible diff lines using virtual scrolling
**Description:** Currently, `DiffView` and `SideBySideDiffView` render ALL diff lines
into the Ink component tree, even for files with 10,000+ lines. This causes slow
initial render and high memory usage. v2 implements virtual scrolling that only renders
the visible viewport window (terminal height) plus a small overscan buffer. Lines
outside the viewport are represented as empty placeholders.
**Complexity:** L
**Priority:** P0
**Dependencies:** None

**Current problem:**
- `buildDiffRows()` in `DiffView.tsx` creates a React element for every line
- A 5000-line diff creates 5000+ `<Box>` elements in the tree
- Ink must measure and lay out all of them even though only ~40 are visible

**Acceptance criteria:**
- [ ] Diff views only render `viewport_height + 2 * overscan` rows at a time
- [ ] Scroll position maintained correctly with j/k/G/gg navigation
- [ ] Search (/) and go-to-line (:) work correctly with virtualized rows
- [ ] Hunk headers remain sticky at the top of visible viewport
- [ ] Performance benchmark: <100ms render for 10,000-line diff (currently >2s)

### 4.2 Streaming Diff Loading

**Title:** Stream diffs as they load instead of waiting for the full response
**Description:** Large PRs with many files can take 5-10 seconds to load all diffs.
v2 streams file diffs progressively: show files as their diffs arrive, show a progress
indicator for remaining files. Uses `ReadableStream` or `AsyncIterable` from the
provider layer.
**Complexity:** M
**Priority:** P1
**Dependencies:** Provider Interface v2

**Acceptance criteria:**
- [ ] Files tab shows files immediately as their diffs arrive
- [ ] Progress bar shows "Loading: 12/45 files..."
- [ ] User can browse already-loaded files while others are still loading
- [ ] Cancellation: navigating away cancels pending streams

### 4.3 Background Data Prefetching

**Title:** Prefetch PR detail data before the user opens it
**Description:** When the user is on a PR list and hovers (highlights) a PR, prefetch
that PR's files, comments, and reviews in the background. When they press Enter, the
detail view opens instantly. This is similar to the preview panel but goes further by
preloading all tabs.
**Complexity:** M
**Priority:** P1
**Dependencies:** None

**Acceptance criteria:**
- [ ] Prefetch starts 500ms after cursor rests on a PR in the list
- [ ] Prefetch includes: PR detail, files (first page), comments, reviews
- [ ] Prefetch is cancelled if user moves cursor before 500ms
- [ ] Prefetched data populates React Query cache so detail view shows instantly
- [ ] Rate limit awareness: skip prefetch if remaining API calls < 200

### 4.4 Request Coalescing and Deduplication

**Title:** Coalesce rapid identical API requests into a single call
**Description:** When multiple hooks request the same data in the same render cycle
(e.g., multiple components requesting the same PR's comments), only one API call should
be made. React Query handles this for cache hits, but v2 adds an explicit request
coalescer at the Effect service layer for in-flight deduplication.
**Complexity:** S
**Priority:** P1
**Dependencies:** None

**Acceptance criteria:**
- [ ] Concurrent identical Effect calls are coalesced into a single HTTP request
- [ ] All callers receive the same result
- [ ] Request deduplication window is configurable (default: 100ms)
- [ ] Coalescing is transparent to consumers -- no API changes

---

## 5. Collaboration & Team Features

### 5.1 Team Review Dashboard

**Title:** Aggregate view of team review workload across repos
**Description:** A new sidebar section "Team" shows an aggregate view of all open PRs
across configured repos for your team. See who has pending reviews, which PRs are
blocked, which have stale reviews. This requires the concept of a "team" (list of
usernames) in the config.
**Complexity:** L
**Priority:** P1
**Dependencies:** Config Schema v2, Persistent Local State

**Acceptance criteria:**
- [ ] New config section `team.members: ["user1", "user2", ...]`
- [ ] New sidebar item "Team" showing aggregate PR counts
- [ ] Team dashboard shows: awaiting review (from me), awaiting review (from others), ready to merge
- [ ] Each team member row shows their review workload count
- [ ] Click into a team member to see their PRs
- [ ] Works across multiple repos and providers

### 5.2 Review Checklists

**Title:** Configurable review checklists that track completion per-PR
**Description:** Define review checklists in `.lazyreview.yaml` at the repo root
(e.g., "tests added", "docs updated", "no console.log", "error handling verified").
The checklist appears in the PR detail view and tracks completion state per-reviewer.
State is persisted in SQLite.
**Complexity:** M
**Priority:** P2
**Dependencies:** Persistent Local State, Config Schema v2

**Acceptance criteria:**
- [ ] `.lazyreview.yaml` supports `reviewChecklist: [...]` field
- [ ] Checklist appears as a collapsible section in Description tab
- [ ] Check/uncheck items with `Space`
- [ ] Checklist state persists across sessions
- [ ] Checklist completion shown in PR list (e.g., "3/5 checks")

### 5.3 PR Notes (Private Annotations)

**Title:** Private, local-only notes on any PR
**Description:** Users can add private notes to any PR that are stored locally (not
posted to the provider). Useful for tracking personal review progress, noting things
to follow up on, or drafting feedback before submitting. Notes are searchable and
persist across sessions.
**Complexity:** S
**Priority:** P2
**Dependencies:** Persistent Local State

**Acceptance criteria:**
- [ ] Press `n` in PR detail to open notes editor
- [ ] Notes saved to SQLite, associated with provider+owner+repo+prNumber
- [ ] Notes indicator icon in PR list for PRs with notes
- [ ] Notes searchable from command palette
- [ ] Notes exportable as markdown

---

## 6. AI & Intelligence

### 6.1 AI PR Summary

**Title:** LLM-generated PR summary from diff and commit messages
**Description:** On demand, generate a concise summary of what a PR does by analyzing
the diff content and commit messages. Uses a configurable LLM backend (OpenAI, Anthropic,
Ollama for local). Displayed as a collapsible section at the top of the Description tab.
The summary is cached locally so it is not regenerated on every visit.
**Complexity:** L
**Priority:** P1
**Dependencies:** Config Schema v2 (for API key config), Persistent Local State (for caching)

**Acceptance criteria:**
- [ ] Config: `ai.provider: "openai" | "anthropic" | "ollama"`, `ai.model`, `ai.apiKey`
- [ ] Trigger with keybinding (default: `Ctrl+A`) -- never automatic
- [ ] Summary includes: what changed, why (from commit messages), risk areas
- [ ] Summary cached in SQLite per PR+commit SHA (invalidated on new commits)
- [ ] Loading state with streaming token output
- [ ] Works without AI configured (feature simply hidden)
- [ ] Ollama support for fully offline/private usage

### 6.2 Smart Review Suggestions

**Title:** AI-powered inline suggestions for common issues
**Description:** When reviewing files, optionally highlight potential issues: missing
error handling, potential null dereferences, style inconsistencies, security concerns.
Uses the same LLM backend as PR Summary. Suggestions appear as non-intrusive
annotations in the diff margin, togglable on/off.
**Complexity:** XL
**Priority:** P2
**Dependencies:** AI PR Summary, Virtual Scrolling (for annotation rendering)

**Acceptance criteria:**
- [ ] Toggle AI annotations with `Ctrl+I` in Files tab
- [ ] Annotations appear in the diff gutter as colored markers
- [ ] Select an annotation to see the full suggestion text
- [ ] One-click to convert an AI suggestion into a review comment
- [ ] Rate limiting: analyze at most N files per PR to control costs
- [ ] Local Ollama support for code-sensitive environments

### 6.3 Review Comment Templates

**Title:** Reusable comment templates with variable substitution
**Description:** Define comment templates (snippets) for common review feedback:
"nit: ", "blocking: ", "question: ", standard feedback for missing tests, etc.
Templates are stored in config and accessible from a picker when writing comments.
**Complexity:** S
**Priority:** P1
**Dependencies:** Config Schema v2

**Acceptance criteria:**
- [ ] Config: `commentTemplates: [{name, prefix, body}, ...]`
- [ ] Press `Ctrl+T` in comment editor to open template picker
- [ ] Templates support `{{file}}`, `{{line}}`, `{{author}}` variables
- [ ] Templates can define a prefix/badge (e.g., "nit:", "blocking:")
- [ ] Ship with 5-10 sensible default templates

---

## 7. Quality of Life

### 7.1 Keyboard Macros

**Title:** Record and replay sequences of keybindings
**Description:** Power users can record a sequence of keystrokes (e.g., "go to next
file, mark as viewed, go to next file, mark as viewed") and replay it. Macros are
stored in config and can be bound to keys.
**Complexity:** M
**Priority:** P2
**Dependencies:** None

**User story:** As a reviewer, I want to bulk-mark generated files as viewed without
pressing the same keys 50 times.

**Acceptance criteria:**
- [ ] Start recording with `q` + register key (vim-style: `qa` starts recording to register `a`)
- [ ] Stop recording with `q` again
- [ ] Replay with `@a` (vim-style)
- [ ] Macros persist across sessions in config
- [ ] Maximum macro length: 100 keystrokes

### 7.2 Fuzzy File Picker

**Title:** Quick-open file from PR by fuzzy name matching
**Description:** Press `Ctrl+F` in Files tab to open a fuzzy file picker (similar to
VS Code's Ctrl+P). Type part of a filename, use j/k to navigate results, press Enter
to jump directly to that file's diff. Uses the existing fuzzy-search utility.
**Complexity:** S
**Priority:** P0
**Dependencies:** None (fuzzy-search.ts already exists)

**Acceptance criteria:**
- [ ] Opens full-screen modal with search input and file list
- [ ] Fuzzy matching against full file paths
- [ ] Results show file status icon (added/modified/deleted) and diff stats
- [ ] Enter opens the file diff; Escape closes the picker
- [ ] Recently viewed files appear first when no query is entered

### 7.3 Diff Bookmarks

**Title:** Bookmark specific lines in diffs for quick navigation
**Description:** While reviewing a large diff, mark specific lines as bookmarks.
Navigate between bookmarks with `'` + register (vim marks style). Bookmarks persist
for the duration of the review session and optionally across sessions.
**Complexity:** M
**Priority:** P2
**Dependencies:** Persistent Local State

**Acceptance criteria:**
- [ ] Set bookmark with `m` + register key (a-z)
- [ ] Jump to bookmark with `'` + register key
- [ ] Bookmarks show as indicators in the gutter
- [ ] List all bookmarks with `'` + `'` (or command palette)
- [ ] Bookmarks scoped to PR + file

### 7.4 File-Level Review Actions

**Title:** Approve or flag individual files during review
**Description:** Mark individual files as "approved", "needs changes", or "skipped"
during review. This local tracking helps reviewers manage large PRs systematically.
Show file review status in the file tree.
**Complexity:** S
**Priority:** P1
**Dependencies:** Persistent Local State

**Acceptance criteria:**
- [ ] Press `a` on a file to mark "approved" (green check in tree)
- [ ] Press `x` on a file to mark "needs changes" (red x in tree)
- [ ] Press `s` on a file to mark "skipped" (grey dash in tree)
- [ ] File tree shows review status icons
- [ ] Summary: "12/20 files reviewed" in Files tab header
- [ ] Navigate to next unreviewed file with `]f`

### 7.5 Commit Range Selection

**Title:** View diff for a specific range of commits instead of full PR diff
**Description:** In the Commits tab, select a range of commits (start and end) and
view only the diff between those two commits. Useful for reviewing incremental updates
to a PR rather than the entire change.
**Complexity:** M
**Priority:** P1
**Dependencies:** None

**Acceptance criteria:**
- [ ] In Commits tab, press `v` to enter range select mode
- [ ] Select start commit, move down, select end commit
- [ ] View shows diff between those two commits only
- [ ] Clear range with Escape to return to full PR diff
- [ ] Range selection shown in Files tab header ("Showing commits abc..def")

### 7.6 PR Dependency Graph

**Title:** Visualize PR dependency chains (stacked PRs)
**Description:** When PRs reference other PRs in their description or have base branches
that are other PRs' head branches, show a dependency graph. Navigate the graph to see
the full stack and understand merge order.
**Complexity:** M
**Priority:** P2
**Dependencies:** None

**Acceptance criteria:**
- [ ] Auto-detect stacked PRs from base branch relationships
- [ ] Parse "Depends on #123" from PR descriptions
- [ ] Show dependency chain in a collapsible section in Description tab
- [ ] Navigate to dependent PRs directly from the graph
- [ ] Indicate merge readiness in the chain (bottom-up)

### 7.7 Offline Mode

**Title:** Browse previously loaded PRs without network connectivity
**Description:** All PR data fetched during online sessions is cached in SQLite.
When offline, LazyReview degrades gracefully: shows cached data with a clear
"offline" indicator, disables mutations, and queues actions for later sync.
**Complexity:** L
**Priority:** P2
**Dependencies:** Persistent Local State

**Acceptance criteria:**
- [ ] Cache PR metadata, diffs, comments, and reviews in SQLite
- [ ] Detect offline state from failed API calls
- [ ] Show "Offline" badge in TopBar
- [ ] Read-only browsing of cached PRs
- [ ] Mutations queued with "will submit when online" indicator
- [ ] Auto-sync queued mutations when connectivity returns

---

## 8. Implementation Phases

### Phase 2A: Foundation (Weeks 1-3)

**Goal:** Lay the architectural groundwork for all v2 features.

| # | Ticket | Complexity | Depends On |
|---|--------|-----------|------------|
| 1 | Config Schema v2 with migration utility | M | - |
| 2 | SQLite state backend (better-sqlite3 integration) | L | #1 |
| 3 | Virtual scrolling engine for diff views | L | - |
| 4 | Provider Interface v2 (new capabilities, batch, streaming types) | L | - |
| 5 | Config migration: auto-upgrade v1 configs on first launch | S | #1 |
| 6 | State migration: import v1 read/viewed/bookmarks into SQLite | S | #2 |

**Milestone:** App launches with v2 config, SQLite state, virtual diff scrolling.
All v1 features continue working. All existing tests pass.

### Phase 2B: Core UX Leap (Weeks 4-7)

**Goal:** Ship the flagship features that define v2.

| # | Ticket | Complexity | Depends On |
|---|--------|-----------|------------|
| 7 | Review workspace: multi-PR pinning and tab management | XL | #2 |
| 8 | Inline code suggestions: selection -> suggestion editor -> submit | L | #4 |
| 9 | Fuzzy file picker (Ctrl+F in Files tab) | S | - |
| 10 | Comment templates system | S | #1 |
| 11 | File-level review tracking (approve/flag/skip per file) | S | #2 |
| 12 | Background data prefetching on PR list hover | M | - |
| 13 | Commit range selection in Commits tab | M | - |
| 14 | Request coalescing at Effect service layer | S | - |

**Milestone:** Multi-PR workspace functional. Suggestion comments work on GitHub.
File review tracking visible in tree. Prefetch makes detail views feel instant.

### Phase 2C: Extensibility (Weeks 8-10)

**Goal:** Open LazyReview to plugin authors and custom themes.

| # | Ticket | Complexity | Depends On |
|---|--------|-----------|------------|
| 15 | Plugin architecture: discovery, lifecycle, isolation | XL | #1 |
| 16 | Plugin API: registerTab, registerCommand, registerKeybinding | L | #15 |
| 17 | Plugin API: onEvent hooks (pre-submit, post-merge, etc.) | M | #15 |
| 18 | Custom theme authoring (YAML files in themes directory) | S | #1 |
| 19 | First-party plugin: "review-checklist" | M | #15, #2 |
| 20 | First-party plugin: "pr-notes" | S | #15, #2 |
| 21 | First-party plugin: "team-dashboard" | L | #15, #2 |

**Milestone:** Plugin system stable. Three first-party plugins demonstrate the API.
Custom themes load from disk.

### Phase 2D: Intelligence (Weeks 11-13)

**Goal:** Optional AI capabilities for users who configure an LLM.

| # | Ticket | Complexity | Depends On |
|---|--------|-----------|------------|
| 22 | LLM integration layer (OpenAI, Anthropic, Ollama adapters) | L | #1 |
| 23 | AI PR summary generation and caching | M | #22, #2 |
| 24 | PR timeline view (unified chronological activity feed) | L | #4 |
| 25 | Smart review suggestions (AI-annotated diffs) | XL | #22, #3 |
| 26 | Streaming diff loading from providers | M | #4 |

**Milestone:** AI summary works with all three backends. Timeline view complete.
Smart suggestions available as opt-in feature.

### Phase 2E: Power Features & Polish (Weeks 14-16)

**Goal:** Advanced features for power users, stability, and docs.

| # | Ticket | Complexity | Depends On |
|---|--------|-----------|------------|
| 27 | Split diff view for merge conflicts (three-way) | L | - |
| 28 | Keyboard macros (record/replay) | M | - |
| 29 | Diff bookmarks (vim marks style) | M | #2 |
| 30 | PR dependency graph visualization | M | - |
| 31 | Custom provider registration via plugins | L | #15 |
| 32 | Offline mode with SQLite cache | L | #2 |
| 33 | v2 migration guide and release documentation | M | - |
| 34 | Comprehensive test coverage for all v2 features (80%+ target) | L | All |

**Milestone:** Feature-complete v2.0.0-rc1. All features documented. Test coverage
meets 80% threshold across new code.

### Phase 2F: Release Candidate (Week 17)

**Goal:** Stabilize, test, release.

| # | Ticket | Complexity | Depends On |
|---|--------|-----------|------------|
| 35 | Full regression test suite (verify all v1 features still work) | M | All |
| 36 | Performance benchmarks: virtual scroll, prefetch, streaming | S | #3, #12, #26 |
| 37 | Beta testing with 5+ external users, collect feedback | M | All |
| 38 | v2.0.0 release: changelog, npm publish, GitHub release | S | All |

---

## 9. Migration Guide

### For Users

1. **Automatic config migration:** On first launch of v2, your `config.yaml` is
   automatically upgraded. A backup is saved as `config.yaml.v1.backup`.

2. **State migration:** Read/unread state, viewed files, bookmarks, and recent repos
   are imported into the new SQLite database automatically.

3. **Breaking keybinding changes:** None. All v1 keybindings are preserved.

4. **New dependency:** v2 requires Node.js 20+ (unchanged) but adds a native SQLite
   dependency. The npm install step handles this automatically.

### For Plugin Authors

1. **Plugin guide:** Full API documentation at `docs/plugin-guide.md`

2. **Contract tests:** A test harness is provided for validating custom providers
   against the Provider interface.

3. **TypeScript types:** All plugin API types exported from `lazyreview/plugin-api`.

---

## 10. Success Metrics

### Quantitative

| Metric | v1 Baseline | v2 Target |
|--------|------------|-----------|
| Time to first meaningful paint (PR detail) | ~2s for large PRs | <500ms |
| Memory usage (10,000-line diff) | ~150MB | <50MB |
| Test count | 3712 | 5000+ |
| Test file count | 149 | 200+ |
| Supported providers | 5 | 5 + extensible |
| Max concurrent PRs in workspace | 1 | 9 |
| Config file format version | implicit v1 | explicit v2 |
| Startup time (cold) | ~1.5s | <2s (despite SQLite) |

### Qualitative

- Users can complete a full review session across multiple PRs without leaving the terminal
- Plugin authors can extend LazyReview without forking the codebase
- AI features feel like natural extensions, not bolted-on gimmicks
- Offline mode means LazyReview works on airplanes and in restricted networks
- The upgrade from v1 to v2 is seamless -- no manual migration required

---

## Feature Priority Matrix

| Feature | User Impact | Strategic Alignment | Effort | Priority |
|---------|------------|-------------------|--------|----------|
| Config Schema v2 | 3 | 5 | M | P0 |
| Provider Interface v2 | 3 | 5 | L | P0 |
| Persistent Local State (SQLite) | 4 | 5 | L | P0 |
| Virtual Scrolling | 5 | 4 | L | P0 |
| Review Workspace (Multi-PR) | 5 | 5 | XL | P0 |
| Inline Code Suggestions | 5 | 5 | L | P0 |
| Fuzzy File Picker | 4 | 4 | S | P0 |
| Background Prefetching | 4 | 4 | M | P1 |
| Comment Templates | 4 | 3 | S | P1 |
| File-Level Review Actions | 4 | 4 | S | P1 |
| Commit Range Selection | 4 | 4 | M | P1 |
| Plugin Architecture | 3 | 5 | XL | P1 |
| Custom Theme Authoring | 3 | 4 | S | P1 |
| Team Dashboard | 4 | 4 | L | P1 |
| AI PR Summary | 4 | 4 | L | P1 |
| PR Timeline View | 4 | 3 | L | P1 |
| Streaming Diff Loading | 3 | 4 | M | P1 |
| Request Coalescing | 3 | 3 | S | P1 |
| Smart Review Suggestions | 3 | 3 | XL | P2 |
| Review Checklists | 3 | 3 | M | P2 |
| PR Notes | 3 | 3 | S | P2 |
| Keyboard Macros | 2 | 3 | M | P2 |
| Diff Bookmarks | 3 | 3 | M | P2 |
| PR Dependency Graph | 3 | 3 | M | P2 |
| Custom Providers via Plugins | 2 | 4 | L | P2 |
| Offline Mode | 3 | 3 | L | P2 |
| Split Diff (Merge Conflicts) | 3 | 4 | L | P1 |

---

## Architecture Notes for Engineers

### SQLite Integration

Use `better-sqlite3` (synchronous, no native compilation issues on most platforms)
or `sql.js` (WASM, zero native deps but slightly slower). Recommended: `better-sqlite3`
with a fallback to `sql.js` for environments where native compilation fails.

Database location: `~/.local/share/lazyreview/state.db` (XDG Base Directory compliant).

Schema versioning via a `migrations` table. Each migration is a numbered SQL file.
Effect service: `StateStore` with tagged `StateError`.

### Virtual Scrolling

Do NOT use a third-party virtual scroll library (none exist for Ink). Implement a
lightweight windowing layer:

```typescript
interface VirtualWindow<T> {
  readonly items: readonly T[]          // Full list
  readonly viewportSize: number         // Terminal rows available
  readonly scrollOffset: number         // First visible index
  readonly overscan: number             // Extra items above/below
  readonly visibleItems: readonly T[]   // Computed slice
  readonly totalHeight: number          // items.length
}
```

Integrate with `useListNavigation` to update `scrollOffset` on j/k navigation.

### Plugin Isolation

Each plugin runs in its own error boundary. Use `Effect.catchAll` to wrap plugin
activation. Plugin components are wrapped in React `ErrorBoundary`. Plugin failures
log a warning but never crash the app.

### Provider Interface v2 Compatibility

The v2 Provider interface must remain backward-compatible with v1 providers. New
methods should use `Effect.succeed([])` as defaults in a `ProviderV1Adapter` that
wraps v1 implementations. This allows existing provider code to work without changes
during the migration.

### Effect Service Layer for AI

```
src/services/
  ai/
    types.ts       # AiService interface, AiError
    openai.ts      # OpenAI adapter
    anthropic.ts   # Anthropic adapter
    ollama.ts      # Ollama adapter (local)
    index.ts       # Factory: createAiService(config)
```

All AI calls go through the `AiService` Effect service. The service handles:
streaming token responses, rate limiting, cost tracking, response caching in SQLite.
