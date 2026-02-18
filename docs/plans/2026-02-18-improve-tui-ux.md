# Improve TUI UX Implementation Plan

Created: 2026-02-18
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: Yes

> **Status Lifecycle:** PENDING → COMPLETE → VERIFIED
> **Iterations:** Tracks implement→verify cycles (incremented by verify phase)
>
> - PENDING: Initial state, awaiting implementation
> - COMPLETE: All tasks implemented
> - VERIFIED: All checks passed
>
> **Approval Gate:** Implementation CANNOT proceed until `Approved: Yes`
> **Worktree:** Set at plan creation (from dispatcher). `Yes` uses git worktree isolation; `No` works directly on current branch (default)

## Summary

**Goal:** Comprehensive UX refresh across all LazyReview TUI screens, panels, navigation, and flows — improving visual hierarchy, information density, empty/loading/error states, keyboard discoverability, and overall polish.

**Architecture:** All changes are within the presentation layer (components, screens, theme). No service layer, provider, or data model changes needed. Each task targets a specific area of the UI, modifying existing components in place.

**Tech Stack:** Ink 6 + React 19, @inkjs/ui, existing theme system (ThemeColors)

## Scope

### In Scope

- TopBar: richer breadcrumbs, better visual separation
- Sidebar: improved visual hierarchy, active state indicators, spacing
- PR list items: better layout, scan-ability, stat badges
- PR detail header: more compact, badge-based status display
- PR tabs: visual improvements, active tab emphasis
- Empty states: contextual icons, actionable hints, better centering
- Loading states: contextual messages, skeleton-like progress feel
- Error states: improved visual hierarchy, action buttons
- StatusBar: better hint formatting, visual separators
- Help modal: improved layout, two-column rendering, scrollable
- Settings screen: section grouping with visual headers
- Team Dashboard: richer stats display, visual cards
- Browse Repo: improved search UX, repo cards
- Onboarding: visual refresh with better step indicators
- Pagination: clearer current-page indicator
- Panel focus: stronger visual affordance for active panel
- Command palette: improved styling and match highlighting
- Divider component: support for section titles, decorative variants

### Out of Scope

- New features (no new functionality, only UX improvements to existing features)
- Service layer / API changes
- Provider implementations
- Data model changes
- Theme color palette changes (we use existing colors more effectively)
- Keybinding remapping (just better display of existing bindings)
- Config schema changes
- Individual PR detail tab content layout (DiffView gutter, FileTree icons, CommitsTab, ChecksTab row layout) — these are complex per-tab systems that warrant their own dedicated plan
- Review/Comment/Merge modal internal layouts (ReviewModal, CommentModal, MergeModal, ReReviewModal, NotesModal) — covered only by shared primitive improvements (Task 4 Divider/BorderedBox); modal-specific layouts deferred
- TokenInputModal redesign — covered partially by OnboardingScreen improvements (Task 12)
- PRPreviewPanel layout changes — inherits improvements from shared components

## Prerequisites

- Working build (`pnpm build` passes)
- Existing tests pass (`pnpm test`)

## Context for Implementer

> This section is critical for cross-session continuity.

- **Patterns to follow:** All components use `useTheme()` from `src/theme/index` for colors. Layout uses `Box`/`Text` from Ink. Navigation via `useListNavigation` hook. Screen context set via `setScreenContext()`.
- **Conventions:** Functional components, readonly props, no mutation. `useInput` for keyboard handling. Theme colors accessed as `theme.colors.accent`, etc.
- **Key files:**
  - `src/app.tsx` — Root layout with TopBar, Sidebar, MainPanel, StatusBar
  - `src/screens/PRListScreen.tsx` — PR list with filtering, sorting, pagination
  - `src/screens/PRDetailScreen.tsx` — Detail view with 6 tabs
  - `src/components/layout/` — TopBar, Sidebar, MainPanel, StatusBar, HelpModal, OnboardingScreen
  - `src/components/common/` — Shared primitives (EmptyState, LoadingIndicator, etc.)
  - `src/components/pr/` — PR-specific components
  - `src/theme/types.ts` — ThemeColors interface
- **Gotchas:**
  - Ink renders to terminal — no CSS, no DOM. Everything is `Box` with `flexDirection`, `gap`, `padding`.
  - `inverse` prop on `Text` creates highlight effect for selected items.
  - Modal component uses `position="absolute"` to overlay.
  - Sidebar has 3 modes: `full`, `icon-only`, `hidden`.
  - Terminal height is limited — vertical space is precious. Avoid adding lines that push content off-screen.
- **Domain context:** This is a code review TUI. Users spend most time on PR lists and the files tab diff view. Quick scanning of PR state (open/merged/draft, checks, reviews) is critical.

## Progress Tracking

**MANDATORY: Update this checklist as tasks complete. Change `[ ]` to `[x]`.**

- [x] Task 1: Enhance EmptyState component
- [x] Task 2: Improve LoadingIndicator component
- [x] Task 3: Improve ErrorWithRetry component
- [x] Task 4: Enhance Divider and BorderedBox components
- [x] Task 5: Refresh TopBar with improved breadcrumbs and layout
- [x] Task 6: Enhance Sidebar visual hierarchy
- [x] Task 7: Improve PRListItem scan-ability and information layout
- [x] Task 8: Refresh PRHeader with badge-based compact layout
- [x] Task 9: Enhance StatusBar hints and visual formatting
- [x] Task 10: Improve PaginationBar visual design
- [x] Task 11: Refresh HelpModal with two-column layout
- [x] Task 12: Improve OnboardingScreen visual flow
- [x] Task 13: Enhance PRTabs and MainPanel focus indicators
- [x] Task 14: Improve SettingsScreen with section grouping
- [x] Task 15: Refresh TeamDashboardScreen and BrowseRepoScreen
- [x] Task 16: Polish CommandPalette, FilterModal, and SortModal

**Total Tasks:** 16 | **Completed:** 16 | **Remaining:** 0

> **Parallelization note:** Tasks 1-2, 4-10, 12-16 are fully independent. Tasks 3 and 11 follow Task 4 (enhanced Divider).

## Implementation Tasks

### Task 1: Enhance EmptyState component

**Objective:** Make empty states more helpful and visually engaging with contextual icons, actionable hints, and better typography.

**Dependencies:** None

**Files:**

- Modify: `src/components/common/EmptyState.tsx`

**Key Decisions / Notes:**

- Add larger ASCII art icons or unicode symbols for different empty state types (e.g., inbox empty, no results, no config)
- Add a `title` prop separate from `message` for two-level text hierarchy
- Add `actions` prop to suggest what the user can do (e.g., "Press / to search" or "Press R to refresh")
- Follow the pattern at `src/components/common/ErrorWithRetry.tsx:146-161` for action hints
- Keep centered layout but add vertical padding for visual breathing room
- Use `theme.colors.accent` for action keys, `theme.colors.muted` for surrounding text
- Update all call sites in screens to pass contextual icons and hints

**Definition of Done:**

- [ ] EmptyState supports `title`, `message`, `icon`, and `actions` props
- [ ] All empty state call sites pass contextual hints (PRListScreen, InvolvedScreen, etc.)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 2: Improve LoadingIndicator component

**Objective:** Make loading states more contextual and visually consistent, with support for inline loading and loading within a bounded area.

**Dependencies:** None

**Files:**

- Modify: `src/components/common/LoadingIndicator.tsx`

**Key Decisions / Notes:**

- Add an `inline` mode (single line, no centering) for use within tabs/sections
- Add a `subtitle` prop for secondary context ("Fetching 342 files...")
- Remove the `height: height - 4` hardcoding that breaks layout in nested containers — use `flexGrow={1}` with `justifyContent="center"` instead
- Keep the Spinner from `@inkjs/ui` but add a dotted progress animation for longer waits
- Use `theme.colors.muted` for subtitle text
- Update call sites in PRDetailScreen, PRListScreen, ChecksTab to use inline mode where appropriate

**Definition of Done:**

- [ ] LoadingIndicator supports `inline` and `subtitle` props
- [ ] Full-screen mode uses flexGrow instead of hardcoded height
- [ ] PRDetailScreen tab loading uses inline mode
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 3: Improve ErrorWithRetry component

**Objective:** Improve error display with clearer visual hierarchy, a bordered container, and better action discovery.

**Dependencies:** None (uses inline `borderStyle`/`borderColor` directly — does not depend on Task 4's BorderedBox enhancements)

**Files:**

- Modify: `src/components/common/ErrorWithRetry.tsx`

**Key Decisions / Notes:**

- Wrap the error display in a bordered box with `borderStyle="single"` and `borderColor={theme.colors.error}`
- Add an error icon/badge prefix: `[ERROR]` or unicode `✗` in error color
- Make the retry hint more prominent: `Press r to retry | Press ? for help`
- Keep the existing provider-specific hints from `getProviderErrorHint` — they're good
- Improve spacing: hint.suggestion gets its own bordered section below the error message
- Use `theme.colors.warning` background for the suggestion section

**Definition of Done:**

- [ ] Error display wrapped in a visually distinct bordered container
- [ ] Error icon prefix added
- [ ] Action hints are more prominent with key highlighting
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 4: Enhance Divider and BorderedBox components

**Objective:** Make the shared layout primitives more versatile — Divider supports decorative variants and BorderedBox supports status colors.

**Dependencies:** None

**Files:**

- Modify: `src/components/common/Divider.tsx`
- Modify: `src/components/common/BorderedBox.tsx`

**Key Decisions / Notes:**

- Divider: Add `style` prop with options `'single'` (─), `'double'` (═), `'thick'` (━), `'dotted'` (·)
- Divider: Make `title` support left, center, right alignment via `titleAlign` prop
- Divider: Use full available width by default instead of hardcoded 36 chars
- BorderedBox: Add `statusColor` prop to override border color (for error/warning/success states)
- BorderedBox: Add `subtitle` prop for a muted secondary line below the title
- These primitives are used across HelpModal, DescriptionTab, SettingsScreen, FilterModal

**Definition of Done:**

- [ ] Divider supports `style` and `titleAlign` props
- [ ] Divider uses full width by default
- [ ] BorderedBox supports `statusColor` and `subtitle` props
- [ ] Existing call sites still work (backward compatible — defaults match current behavior)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 5: Refresh TopBar with improved breadcrumbs and layout

**Objective:** Improve the TopBar with richer breadcrumbs, better visual separation between segments, and a more polished status area.

**Dependencies:** None

**Files:**

- Modify: `src/components/layout/TopBar.tsx`

**Key Decisions / Notes:**

- Replace `>` breadcrumb separator with `›` (more refined) or use box-drawing chars `│`
- Add provider icon/badge inline with breadcrumbs (e.g., `[GH] LazyReview › Involved`)
- Move connection status to use a colored dot `●` (already exists) but add subtle label only when not connected
- When connected, show just the green dot — no label needed (saves space)
- Add repo path to breadcrumb when viewing a repo-specific screen
- Truncate PR title more aggressively (30 chars) and show full title in StatusBar on hover/focus
- Use `theme.colors.border` for separator chars

**Definition of Done:**

- [ ] Breadcrumb separator uses `›` instead of `>`
- [ ] Provider badge integrated into breadcrumb trail
- [ ] Connection status more compact when connected (dot only)
- [ ] PR title truncation improved
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 6: Enhance Sidebar visual hierarchy

**Objective:** Improve sidebar readability with better spacing, section headers, count badges, and active item indicators.

**Dependencies:** None

**Files:**

- Modify: `src/components/layout/Sidebar.tsx`

**Key Decisions / Notes:**

- Add 1-line spacing between sidebar sections (Reviews section vs Tools section)
- Use filled `▶` arrow for the selected item instead of `▸` for stronger visual affordance
- Display counts in a badge-style format: `For Review ·· 3` instead of `For Review (3)`
- Show unread count with a bold accent dot: `For Review ·· 3 ● 2 new`
- In icon-only mode, show count as superscript-style number next to icon
- Add a thin horizontal rule (`─`) between section groups in full mode
- Keep section collapsing behavior (▸/▾) but improve the visual distinction of collapsed vs expanded headers

**Definition of Done:**

- [ ] Section headers have visual separator lines between groups
- [ ] Count display uses badge-style formatting
- [ ] Selected item uses filled arrow indicator `▶`
- [ ] Unread indicators are more visually prominent
- [ ] Icon-only mode shows counts compactly
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 7: Improve PRListItem scan-ability and information layout

**Objective:** Redesign PR list items for faster visual scanning — status badges, aligned columns, better use of color, and clearer metadata layout.

**Dependencies:** None

**Files:**

- Modify: `src/components/pr/PRListItem.tsx`

**Key Decisions / Notes:**

- Full mode: Reorganize into a cleaner two-line layout:
  - Line 1: `[state-badge] #number  PR title  [label badges]  [check-icon] [review-icon]`
  - Line 2: `    repo · author · time ago · +adds/-dels · N comments`
- Replace single-letter state codes (`O`, `C`, `M`, `D`) with more readable short badges: `OPEN`, `CLSD`, `MRGD`, `DRFT` in colored backgrounds using `inverse`
- Use consistent column widths for the PR number (right-aligned, padded)
- Show additions/deletions on line 2 for quick size scanning: `+123 -45`
- Compact mode: keep single-line but add colored state dot instead of letter
- Use `theme.colors.diffAdd`/`diffDel` for the +/- stats
- Separate metadata with `·` (middle dot) instead of `|` for a cleaner look

**Definition of Done:**

- [ ] Full mode uses a cleaner two-line layout with state badges
- [ ] PR number is right-aligned with consistent width
- [ ] Additions/deletions shown with color coding
- [ ] Metadata separators use middle dot `·`
- [ ] Compact mode uses colored state dot
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 8: Refresh PRHeader with badge-based compact layout

**Objective:** Make the PR detail header more compact and scannable with inline badges for state, draft status, checks, labels, and conflict indicators.

**Dependencies:** None

**Files:**

- Modify: `src/components/pr/PRHeader.tsx`

**Key Decisions / Notes:**

- Reorganize into a 2-line header (currently 3-4 lines):
  - Line 1: `[STATE-BADGE] #number  Title  [DRAFT] [CONFLICTS] [Notes] (idx/total)`
  - Line 2: `user → head:ref → base:ref  ·  opened 3h ago  ·  +12 -5  ·  8 files  ·  3 comments`
- State badge: colored inverse text `[Open]` `[Merged]` `[Closed]` `[Draft]`
- Move labels to a third line only when they exist (saves a line when no labels)
- Use `→` instead of "wants to merge ... into" for branch flow (more compact)
- Use `·` (middle dot) separators instead of spaces between metadata
- Keep the conflict indicator prominent with `theme.colors.error`

**Definition of Done:**

- [ ] Header reduced to 2 lines + optional label line
- [ ] State badge uses colored inverse text
- [ ] Branch flow uses arrow notation (`→`)
- [ ] Metadata uses middle dot separators
- [ ] Conflict indicator remains prominent
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 9: Enhance StatusBar hints and visual formatting

**Objective:** Improve the status bar to be more readable with better visual separation between hint groups and more contextual information.

**Dependencies:** None

**Files:**

- Modify: `src/components/layout/StatusBar.tsx`

**Key Decisions / Notes:**

- Separate hint groups with `│` (box drawing vertical line) instead of double spaces
- Format each hint as `key:label` with the key in accent/warning color and label in muted — already partially done, but make keys more prominent
- Add a visual separator `│` between left status area and right hints area
- When macro recording is active, show a pulsing `REC` badge
- Show review timer in a distinct badge format: `⏱ 12:34`
- Limit total hint count to 6-7 to avoid overflow on narrow terminals
- Truncate hints gracefully when terminal width is below 100 columns

**Definition of Done:**

- [ ] Hints separated by `│` for clearer grouping
- [ ] Key portions of hints use accent color
- [ ] Hints truncate gracefully on narrow terminals
- [ ] Review timer displayed in badge format
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 10: Improve PaginationBar visual design

**Objective:** Make pagination clearer and more compact with a visual page indicator.

**Dependencies:** None

**Files:**

- Modify: `src/components/common/PaginationBar.tsx`

**Key Decisions / Notes:**

- Replace `← [p]rev | Page 2/5 | [n]ext →` with a more compact format: `‹ 1-18 of 42  pg 2/5 ›`
- Use active color for clickable arrows, muted for disabled
- Show a visual dot indicator for pages when total ≤ 5: `● ○ ○ ○ ○`
- When total > 5, use the numeric format
- Keep the total items count visible
- Use `theme.colors.accent` for the active page dot
- Make prev/next arrows more visually distinct: `‹` and `›` instead of `←` and `→`

**Definition of Done:**

- [ ] Pagination uses compact format with `‹`/`›` arrows
- [ ] Dot indicator shown for ≤5 pages
- [ ] Disabled arrows use muted color
- [ ] Items range and total remain visible
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 11: Refresh HelpModal with two-column layout

**Objective:** Improve the help modal to be more readable and space-efficient with a two-column section layout and better visual hierarchy.

**Dependencies:** Task 4 (for enhanced Divider)

**Files:**

- Modify: `src/components/layout/HelpModal.tsx`

**Key Decisions / Notes:**

- Render shortcut groups in two columns side by side (left: Global + PR List + PR Detail, right: Conversations + Files + Commits + Input)
- Use a fixed-width box for key display (already 16 chars, keep it)
- Add a section count in the header: `Keyboard Shortcuts (9 sections)`
- Use the enhanced Divider with title between major groups
- Add a `scrollOffset` and allow j/k navigation within the help modal for long content
- Add a search/filter input at the top to find specific shortcuts
- Footer hint: `?:close | j/k:scroll | /:search`
- Use `theme.colors.warning` for key display and `theme.colors.text` for descriptions (already done)

**Definition of Done:**

- [ ] Help modal renders in two columns when terminal width ≥ 100
- [ ] Sections have titled dividers between them
- [ ] j/k scrolling works within the modal
- [ ] Footer hints updated
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 12: Improve OnboardingScreen visual flow

**Objective:** Refresh the onboarding experience with better step indicators, richer formatting, and a more welcoming visual design.

**Dependencies:** None

**Files:**

- Modify: `src/components/layout/OnboardingScreen.tsx`

**Key Decisions / Notes:**

- Add a progress bar at the top: `Step 1 of 4 ━━━━━━━━━━━━━━━━○○○○` with filled/empty sections
- Use bordered sections within each step for different content types (e.g., key bindings in a bordered box)
- Format keyboard shortcuts in the Navigation step as a mini-table with aligned columns
- Add color to the authentication step: use provider colors for each provider name
- Add a "Quick Start" badge on the first step
- Use `theme.colors.accent` for the progress bar fill
- Make the step dots at the bottom larger: `◉ ○ ○ ○` with the active one being a filled circle
- Footer: use key badges `[←]` `[→]` `[Enter]` `[Esc]` instead of plain text

**Definition of Done:**

- [ ] Progress bar added at the top of each step
- [ ] Key bindings formatted as aligned table in Navigation step
- [ ] Step indicator dots use filled/empty circles
- [ ] Footer uses key badge formatting
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 13: Enhance PRTabs and MainPanel focus indicators

**Objective:** Improve tab bar visual emphasis and panel focus affordance so users always know which tab is active and which panel has focus.

**Dependencies:** None

**Files:**

- Modify: `src/components/pr/PRTabs.tsx`
- Modify: `src/components/layout/MainPanel.tsx`

**Key Decisions / Notes:**

- PRTabs: Add a bottom border/divider line below the tab bar to separate it from content
- PRTabs: Make the active tab indicator more prominent — use inverse text or underline character
- PRTabs: Add tab numbers visually: `1:Description  2:Conversations  3:Commits  4:Files  5:Checks  6:Timeline`
- PRTabs: Show comment/thread count badges on Conversations tab and file count on Files tab if data is available (pass counts as props)
- MainPanel: Change `borderStyle` from `"single"` to `"double"` when `isActive` for stronger visual distinction
- MainPanel: Optionally show a small focus label in the top border area
- Both components are small (PRTabs: 45 lines, MainPanel: 27 lines) — changes are minimal

**Definition of Done:**

- [ ] Active tab has stronger visual emphasis (inverse or underline style)
- [ ] Tab numbers displayed inline with names
- [ ] MainPanel uses double border when active
- [ ] Divider line below tab bar
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 14: Improve SettingsScreen with section grouping

**Objective:** Organize the flat settings list into visually grouped sections with headers, making it easier to find and understand settings.

**Dependencies:** Task 4 (for enhanced Divider)

**Files:**

- Modify: `src/screens/SettingsScreen.tsx`
- Modify: `src/components/settings/SettingRow.tsx`

**Key Decisions / Notes:**

- Group settings into visual sections with Divider headers:
  - **Connection**: provider, token_source, new_token
  - **Appearance**: theme, page_size
  - **Refresh**: refresh_interval
  - **Defaults**: default_owner, default_repo
  - **AI**: ai_provider, ai_model, ai_api_key, ai_endpoint
  - **Notifications**: notifications, notify_new_pr, notify_update, notify_review_request
  - **Bookmarks**: bookmarked_repos
- Add section headers using the enhanced Divider with title: `── Connection ──`
- SettingRow: Add a description/help text line below the value in muted color
- SettingRow: Improve the editing state visual — show a bordered input area when in edit mode
- Add a section count or settings count in the screen header
- Keep j/k navigation working across all sections (no section collapsing needed)

**Definition of Done:**

- [ ] Settings organized into labeled sections with Divider headers
- [ ] SettingRow shows description text below value
- [ ] Edit mode has a visually distinct input area
- [ ] Section navigation works with j/k
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 15: Refresh TeamDashboardScreen and BrowseRepoScreen

**Objective:** Improve the Team Dashboard with richer stat display and the Browse screen with better search UX and repo cards.

**Dependencies:** None

**Files:**

- Modify: `src/screens/TeamDashboardScreen.tsx`
- Modify: `src/screens/BrowseRepoScreen.tsx`

**Key Decisions / Notes:**

- **TeamDashboardScreen:**
  - Add a summary bar at the top: `4 members · 12 open PRs · 6 pending reviews`
  - Use colored badges for authored count and review count (green for 0 pending, warning for >0)
  - Add a visual indicator for member activity (e.g., `●` green for recently active)
  - Improve table layout: use box-drawing chars for column separators instead of spaces
  - Add footer hints matching other screens' formatting
- **BrowseRepoScreen:**
  - Improve the repo input area: add a bordered search box with placeholder text
  - Show recent repos as cards/rows with provider badge and last-accessed time
  - Show bookmarked repos in a separate section above recent repos
  - Add validation error display inline below the input (currently just blocks)
  - Improve the transition from picker mode to list mode with a breadcrumb update

**Definition of Done:**

- [ ] Team Dashboard has a summary bar and colored badges
- [ ] Team Dashboard table uses improved column layout
- [ ] Browse screen has a bordered search input
- [ ] Recent repos shown with provider badge and time
- [ ] Bookmarked repos shown in separate section
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

### Task 16: Polish CommandPalette, FilterModal, and SortModal

**Objective:** Improve the overlay components that users interact with for filtering, sorting, and command execution — ensuring visual consistency with the refreshed design language.

**Dependencies:** Task 4 (for enhanced Divider)

**Files:**

- Modify: `src/components/common/CommandPalette.tsx`
- Modify: `src/components/common/FilterModal.tsx`
- Modify: `src/components/common/SortModal.tsx`

**Key Decisions / Notes:**

- **CommandPalette:**
  - Add category group headers for actions (e.g., "Navigation", "PR Actions", "View")
  - Improve the search prompt: use a bordered input area with `> ` prefix (already has `> `, improve styling)
  - Make match highlighting use `theme.colors.accent` instead of `theme.colors.warning` for better contrast
  - Add a divider between search input and results
  - Show total actions count and current selection position
- **FilterModal:**
  - Use BorderedBox for each facet section (repo, author, label) instead of plain text headers
  - Improve active filter indication: show selected values with accent color and `✓` prefix
  - Add a "Clear all" button hint at the bottom: `c:clear all  Esc:close`
  - Improve facet count display: `react (12)` with count in muted color
- **SortModal:**
  - Add visual indicator for current sort: `▲`/`▼` arrows next to the active sort field
  - Use bordered rows for sort options instead of plain text
  - Show sort direction toggle more prominently

**Definition of Done:**

- [ ] CommandPalette has category headers and improved match highlighting
- [ ] FilterModal uses bordered facet sections with clear active indication
- [ ] SortModal has sort direction arrows and bordered options
- [ ] All three modals share consistent footer hint formatting
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Verify:**

- `pnpm typecheck`
- `pnpm test`

## Testing Strategy

- **Unit tests:** Each modified component should maintain its existing tests. For components with new props, add test cases exercising the new props.
- **Type checking:** `pnpm typecheck` after each task to catch regressions
- **Visual verification:** After each task, build and run the TUI to manually verify:
  - Correct rendering at 80-col terminal width (minimum supported)
  - Correct rendering at 120-col terminal width (typical)
  - No content overflow or truncation artifacts
  - Unicode characters render correctly (arrows, dots, box-drawing chars)
- **Integration:** No integration tests needed — all changes are presentational

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Ink rendering differences across terminal emulators | Medium | Low | Test in at least 2 terminals (iTerm2, default Terminal). Avoid fancy unicode that may not render. |
| Narrow terminal breakage | Medium | Medium | All layout changes must handle terminal widths of 80-200 columns. Test at 80-col minimum. Add conditional rendering that degrades gracefully. |
| Vertical space overflow in PR detail | Low | High | Keep header compact (2 lines). All added elements must be conditional or collapsible. Count total lines before/after each change. |
| Breaking existing keyboard shortcuts | Low | High | No keybinding changes in scope. Only display of hints changes. All `useInput` handlers remain untouched. |

## Open Questions

- None at this time. All decisions captured in task notes.

### Deferred Ideas

- Custom icon sets configurable via theme
- Animated transitions between screens (Ink doesn't support this well)
- Mouse click support for sidebar items
- Configurable information density setting (compact/normal/detailed)
