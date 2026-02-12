<p align="center">
  <h1 align="center">LazyReview</h1>
  <p align="center">
    A keyboard-driven TUI for reviewing GitHub pull requests, right from your terminal.
    <br />
    Inspired by <a href="https://github.com/jesseduffield/lazygit">lazygit</a>.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/lazyreview"><img src="https://img.shields.io/npm/v/lazyreview?color=339933&label=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/lazyreview"><img src="https://img.shields.io/npm/dm/lazyreview?color=blue" alt="npm downloads" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
</p>

---

## Why LazyReview?

Code review shouldn't require a browser. LazyReview brings the full GitHub PR experience into your terminal with vim-style navigation, syntax-highlighted diffs, and a clean panel layout — so you can review without leaving your workflow.

## Install

### Homebrew

```bash
brew install tauantcamargo/tap/lazyreview
```

### npm

```bash
npm install -g lazyreview
```

### npx (no install)

```bash
npx lazyreview
```

**Requires Node.js 20 or later.**

## Quick Start

```bash
# From inside a git repo — auto-detects owner/repo from origin
lazyreview

# Or specify a repo directly
lazyreview facebook/react
```

On first run you'll be prompted for a **GitHub token**. LazyReview supports three sources (in priority order):

| Source | Setup |
|--------|-------|
| **GitHub CLI** | Install [gh](https://cli.github.com/) and run `gh auth login` |
| **Environment variable** | Export `LAZYREVIEW_GITHUB_TOKEN` |
| **Manual token** | Paste when prompted (stored at `~/.config/lazyreview/.token`) |

You can switch between sources anytime in **Settings**.

## Features

### PR List

Browse open PRs with search, sort, and pagination across multiple views:

- **Involved** — PRs you authored, were requested to review, or commented on
- **My PRs** — PRs you opened
- **For Review** — PRs awaiting your review
- **This Repo** — All open PRs in the current repo
- **CI Status** — Check run results displayed inline on each PR

### PR Detail

Deep-dive into any PR with three tabs:

- **Conversations** — Full timeline with description, reviews, and comments rendered as markdown. Includes a review summary showing approval status per reviewer.
- **Commits** — Commit history with message, author, and date
- **Files** — File tree with syntax-highlighted diffs and vim-style visual line selection

### Review Actions

Complete your entire review workflow without leaving the terminal:

- **Submit Review** — Approve, request changes, or comment with multi-line markdown body (`r` / `R`)
- **Reply to Comments** — Reply directly to review comment threads (`r` on conversations tab)
- **Inline Comments** — Add comments on specific diff lines (`c` in diff view)
- **Multi-line Comments** — Select a range of lines with visual mode, then comment (`v` → select → `c`)
- **Resolve Threads** — Toggle resolve/unresolve on review threads (`x`)
- **Filter Resolved** — Show or hide resolved comment threads (`f`)
- **Merge PR** — Merge, squash, or rebase with confirmation and custom commit title (`m`)
- **Request Re-review** — Multi-select reviewers to re-request reviews from (`e`)
- **Open in Browser** — Quick escape hatch to GitHub (`o`)

### Auto-Refresh

PRs and review data refresh automatically in the background with rate limit awareness:

- Configurable refresh interval (default: 60s for lists, 30s for detail)
- Automatically slows down when approaching GitHub API rate limits
- Manual refresh anytime with `R`

### Themes

Ships with four color schemes, cycle through them in Settings:

- `tokyo-night` (default)
- `dracula`
- `catppuccin-mocha`
- `gruvbox`

### Settings

Fully configurable from the TUI — no need to edit files manually:

- Token source switching (gh CLI / env var / manual)
- Theme cycling
- Page size (1-100)
- Refresh interval (10-600s)
- Default owner/repo

### Other

- Git remote auto-detection
- Collapsible sidebar
- Markdown rendering in PR bodies and comments
- Multi-line text input with cursor navigation and tab indentation
- Built-in help overlay (`?`)

## Keyboard Shortcuts

> **Case matters.** Uppercase and lowercase keys trigger different actions (e.g. `R` = submit review, `r` = reply; `E` = re-review, `e` = edit comment; `S` = batch review, `s` = sort).

### Global

| Key | Action |
|-----|--------|
| `j` / `k` | Move down / up |
| `Enter` | Select / open |
| `b` | Toggle sidebar |
| `?` | Toggle help overlay |
| `q` / `Esc` | Back / quit |
| `Ctrl+c` | Force quit |

### PR List

| Key | Action |
|-----|--------|
| `/` | Filter PRs |
| `s` | Sort PRs |
| `n` / `p` | Next / previous page |
| `o` | Open PR in browser |
| `y` | Copy PR URL |
| `u` | Toggle unread only |
| `t` | Toggle state (Open / Closed / All) |
| `R` | Refresh |

### PR Detail

| Key | Action |
|-----|--------|
| `1` / `2` / `3` | Switch tabs (Conversations / Commits / Files) |
| `o` | Open PR in browser |
| `y` | Copy PR URL |
| `R` | Submit review |
| `S` | Start batch review |
| `E` | Request re-review |
| `m` | Merge PR |
| `X` | Close / reopen PR |
| `G` | Checkout PR branch locally |
| `]` / `[` | Next / previous PR |

### Conversations Tab

| Key | Action |
|-----|--------|
| `c` | New comment |
| `r` | Reply to comment |
| `e` | Edit own comment |
| `D` | Edit PR description (author only) |
| `x` | Resolve / unresolve thread |
| `f` | Toggle resolved comments |

### Files Tab

| Key | Action |
|-----|--------|
| `h` / `l` | Focus tree / diff |
| `Tab` | Switch tree / diff panel |
| `/` | Filter files (tree panel) |
| `d` | Toggle side-by-side diff |
| `v` | Visual line select (diff) |
| `c` | Inline comment (diff) |
| `r` | Reply to diff comment |
| `e` | Edit own diff comment |
| `x` | Resolve / unresolve (diff) |

### Commits Tab

| Key | Action |
|-----|--------|
| `y` | Copy commit SHA |

### Comment / Review Input

| Key | Action |
|-----|--------|
| `Enter` | New line |
| `Tab` | Insert indent (2 spaces) |
| `Ctrl+Enter` | Submit |
| `Esc` | Cancel |

## Configuration

Configuration is optional. File location:

```
~/.config/lazyreview/config.yaml
```

Example:

```yaml
theme: tokyo-night        # tokyo-night | dracula | catppuccin-mocha | gruvbox
pageSize: 30              # PRs per page (1-100)
refreshInterval: 60       # Auto-refresh interval in seconds (10-600)
provider: github          # git provider
defaultOwner: myorg       # skip auto-detection
defaultRepo: myrepo       # skip auto-detection
```

## Development

```bash
git clone https://github.com/tauantcamargo/lazyreview.git
cd lazyreview
pnpm install
pnpm dev        # watch mode
pnpm start      # run the TUI
```

| Command | Description |
|---------|-------------|
| `pnpm build` | Production build (tsup) |
| `pnpm dev` | Watch mode build |
| `pnpm start` | Run the TUI |
| `pnpm typecheck` | TypeScript type check |
| `pnpm test` | Run tests (Vitest) |
| `pnpm test:coverage` | Tests with coverage report |
| `pnpm lint` | Check formatting (Prettier) |
| `pnpm format` | Auto-format source files |

### Tech Stack

- **UI**: [Ink](https://github.com/vadimdemedes/ink) + React 19
- **Services**: [Effect](https://effect.website/) (typed errors, dependency injection)
- **Validation**: Effect Schema
- **Config**: YAML
- **Build**: tsup (bundled ESM, Node 20 target)
- **Test**: Vitest

## License

MIT
