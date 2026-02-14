<p align="center">
  <h1 align="center">LazyReview</h1>
  <p align="center">
    A keyboard-driven TUI for reviewing pull requests from GitHub, GitLab, Bitbucket, Azure DevOps, and Gitea — right from your terminal.
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

Code review shouldn't require a browser. LazyReview brings the full PR experience into your terminal with vim-style navigation, syntax-highlighted diffs, and a clean panel layout — so you can review without leaving your workflow.

## How Is This Different?

| Tool | What it does | LazyReview's advantage |
|------|-------------|----------------------|
| `gh pr` / `glab` | CLI PR commands | LazyReview is a full TUI with visual diffs, not just CLI commands |
| lazygit / gitui | Git TUI | These manage git operations; LazyReview manages **code review** -- they're complementary |
| GitHub/GitLab web | Browser PR review | LazyReview keeps you in the terminal with vim-style navigation |
| tig | Git log/diff viewer | No PR review, no comments, no multi-provider support |

LazyReview is the only TUI that provides a full code review workflow across GitHub, GitLab, Bitbucket, Azure DevOps, and Gitea.

## Supported Providers

LazyReview works with five git hosting providers. The provider is auto-detected from your git remote, or you can set it in `config.yaml`.

| Feature | GitHub | GitLab | Bitbucket | Azure DevOps | Gitea/Forgejo |
|---------|:------:|:------:|:---------:|:------------:|:-------------:|
| List & filter PRs | Yes | Yes | Yes | Yes | Yes |
| PR detail (description, files, commits) | Yes | Yes | Yes | Yes | Yes |
| Syntax-highlighted diffs | Yes | Yes | Yes | Yes | Yes |
| Side-by-side diff view | Yes | Yes | Yes | Yes | Yes |
| Submit reviews (approve/request changes) | Yes | Yes | Yes | Yes | Yes |
| Inline diff comments | Yes | Yes | Yes | Yes | Yes |
| Resolve/unresolve threads | Yes | Yes | -- | Yes | -- |
| Draft PRs | Yes | Yes | -- | Yes | -- |
| CI/CD check runs | Yes | Yes | Yes | Yes | Yes |
| Merge (merge/squash/rebase) | Yes | Yes | Yes | Yes | Yes |
| GraphQL API | Yes | -- | -- | -- | -- |
| Reactions | Yes | -- | -- | -- | -- |

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

### Update

```bash
# npm
npm update -g lazyreview

# Homebrew
brew upgrade lazyreview
```

**Requires Node.js 20 or later.**

## Quick Start

```bash
# From inside a git repo — auto-detects provider and owner/repo from origin
lazyreview

# Or specify a repo directly
lazyreview facebook/react
```

### Authentication

On first run you'll be prompted for a token. Each provider uses a different token type:

#### GitHub

| Source | Setup |
|--------|-------|
| **GitHub CLI** | Install [gh](https://cli.github.com/) and run `gh auth login` |
| **Environment variable** | Export `LAZYREVIEW_GITHUB_TOKEN` |
| **Manual token** | Paste when prompted (stored at `~/.config/lazyreview/.token`) |

Token needs `repo` scope. Create one at [github.com/settings/tokens](https://github.com/settings/tokens).

#### GitLab

| Source | Setup |
|--------|-------|
| **Environment variable** | Export `LAZYREVIEW_GITLAB_TOKEN` |
| **Manual token** | Paste when prompted |

Token needs `api` scope. Create one at [gitlab.com/-/user_settings/personal_access_tokens](https://gitlab.com/-/user_settings/personal_access_tokens).

For self-hosted GitLab, set `gitlab.host` in `config.yaml`.

#### Bitbucket

| Source | Setup |
|--------|-------|
| **Environment variable** | Export `LAZYREVIEW_BITBUCKET_TOKEN` |
| **Manual token** | Paste when prompted |

Use an App Password with **Repository** and **Pull Request** read/write permissions. Create one at [bitbucket.org/account/settings/app-passwords](https://bitbucket.org/account/settings/app-passwords).

#### Azure DevOps

| Source | Setup |
|--------|-------|
| **Environment variable** | Export `LAZYREVIEW_AZURE_TOKEN` |
| **Manual token** | Paste when prompted |

Use a Personal Access Token (PAT) with **Code (Read & Write)** scope. Create one at [dev.azure.com](https://dev.azure.com).

#### Gitea / Forgejo

| Source | Setup |
|--------|-------|
| **Environment variable** | Export `LAZYREVIEW_GITEA_TOKEN` |
| **Manual token** | Paste when prompted |

Create a token under **Settings > Applications** in your Gitea/Forgejo instance.

You can switch between token sources anytime in **Settings**.

## Features

### PR List

Browse open PRs with search, sort, and pagination across multiple views:

- **Involved** -- PRs you authored, were requested to review, or commented on
- **My PRs** -- PRs you opened
- **For Review** -- PRs awaiting your review
- **This Repo** -- All open PRs in the current repo
- **Browse** -- Browse any repo's PRs (e.g., `facebook/react`) with recent history and bookmarks
- **CI Status** -- Check run results displayed inline on each PR
- **Read/Unread** -- Track which PRs have new activity since last viewed

### PR Detail

Deep-dive into any PR with five tabs:

- **Description** -- PR body rendered as markdown with additions/deletions stats, labels, and edit support
- **Conversations** -- Full timeline with reviews and comments rendered as markdown. Includes a review summary showing approval status per reviewer.
- **Commits** -- Commit history with message, author, and date
- **Files** -- File tree with syntax-highlighted diffs, side-by-side view, and vim-style visual line selection
- **Checks** -- CI/CD check run results with pass/fail/pending summary

### Review Actions

Complete your entire review workflow without leaving the terminal:

- **Submit Review** -- Approve, request changes, or comment with multi-line markdown body (`r` / `R`)
- **Reply to Comments** -- Reply directly to review comment threads (`r` on conversations tab)
- **Inline Comments** -- Add comments on specific diff lines (`c` in diff view)
- **Multi-line Comments** -- Select a range of lines with visual mode, then comment (`v` then select then `c`)
- **Resolve Threads** -- Toggle resolve/unresolve on review threads (`x`)
- **Filter Resolved** -- Show or hide resolved comment threads (`f`)
- **Merge PR** -- Merge, squash, or rebase with confirmation and custom commit title (`m`)
- **Close / Reopen PR** -- Close or reopen PRs directly (`X`)
- **Edit PR Description** -- Edit the PR body as the author (`D`)
- **Edit Comments** -- Edit your own comments inline (`e`)
- **Request Re-review** -- Multi-select reviewers to re-request reviews from (`E`)
- **File Viewed Tracking** -- Mark files as viewed to track review progress (`v`)
- **Open in Browser** -- Quick escape hatch to your provider's web UI (`o`)

### Auto-Refresh

PRs and review data refresh automatically in the background with rate limit awareness:

- Configurable refresh interval (default: 60s for lists, 30s for detail)
- Automatically slows down when approaching API rate limits
- Manual refresh anytime with `R`

### Themes

Ships with four color schemes, cycle through them in Settings:

- `tokyo-night` (default)
- `dracula`
- `catppuccin-mocha`
- `gruvbox`

### Settings

Fully configurable from the TUI -- no need to edit files manually:

- Provider selection (GitHub / GitLab / Bitbucket / Azure / Gitea)
- Token source switching
- Theme cycling
- Page size (1-100)
- Refresh interval (10-600s)
- Default owner/repo

### Browse Any Repo

Browse PRs from any repo without leaving the app:

- Navigate to the **Browse** sidebar item
- Type `owner/repo` (e.g., `facebook/react`) and press Enter
- Recent repos are saved automatically (up to 10)
- Bookmark frequently used repos in **Settings** for quick access
- Full PR list with filtering, sorting, and detail view -- same as local repo

### Sidebar

- **PR counts** and **unread badges** update automatically
- **Collapsible sections** (Reviews / App) with Enter to toggle
- **Breadcrumb trail** in TopBar shows current screen and PR context
- **Provider badge** with color coding (`[GH]` / `[GL]` / `[BB]` / `[AZ]` / `[GT]`)
- **Connection status** indicator (green/yellow/red) in TopBar

### Other

- Git remote auto-detection (provider + owner/repo)
- Collapsible sidebar (`Ctrl+b`)
- Side-by-side diff view (`d` in Files tab)
- Markdown rendering in PR bodies and comments
- Multi-line text input with cursor navigation and tab indentation
- Built-in help overlay (`?`)
- PR branch checkout directly from terminal (`G`)
- Context-sensitive keyboard shortcut hints in status bar
- Provider-specific error messages with actionable fix suggestions

## Keyboard Shortcuts

> **Case matters.** Uppercase and lowercase keys trigger different actions (e.g. `R` = submit review, `r` = reply; `E` = re-review, `e` = edit comment; `S` = batch review, `s` = sort).

### Global

| Key | Action |
|-----|--------|
| `j` / `k` | Move down / up |
| `Enter` | Select / open |
| `Ctrl+b` | Toggle sidebar |
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
| `1`-`5` | Switch tabs (Description / Conversations / Commits / Files / Checks) |
| `o` | Open PR in browser |
| `y` | Copy PR URL |
| `R` | Submit review |
| `S` | Start batch review |
| `D` | Edit PR description |
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

### Checks Tab

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate check runs |

### Comment / Review Input

| Key | Action |
|-----|--------|
| `Enter` | New line |
| `Tab` | Insert indent (2 spaces) |
| `Ctrl+S` | Submit |
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
provider: github          # github | gitlab | bitbucket | azure | gitea
defaultOwner: myorg       # skip auto-detection
defaultRepo: myrepo       # skip auto-detection
recentRepos: []           # auto-populated from Browse (max 10)
bookmarkedRepos: []       # manually managed in Settings

# GitLab self-hosted (optional)
gitlab:
  host: https://gitlab.example.com
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
- **Providers**: GitHub, GitLab, Bitbucket, Azure DevOps, Gitea/Forgejo (pluggable provider architecture)
- **Validation**: Zod + Effect Schema
- **Config**: YAML
- **Build**: tsup (bundled ESM, Node 20 target)
- **Test**: Vitest

## License

MIT
