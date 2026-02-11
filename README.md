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

**PR List** — Browse open PRs with search, sort, and pagination across multiple views:

- **Involved** — PRs you authored, were requested to review, or commented on
- **My PRs** — PRs you opened
- **For Review** — PRs awaiting your review
- **This Repo** — All open PRs in the current repo

**PR Detail** — Deep-dive into any PR with three tabs:

- **Conversations** — Full timeline: description, reviews, and comments
- **Commits** — Commit history with message, author, and date
- **Files** — File tree with syntax-highlighted diffs

**Themes** — Ships with three color schemes:

- `tokyo-night` (default)
- `dracula`
- `catppuccin-mocha`

**Other** — Git remote auto-detection, collapsible sidebar, configurable page size, and a built-in help overlay.

## Keyboard Shortcuts

### Navigation

| Key | Action |
|-----|--------|
| `j` / `k` | Move down / up |
| `gg` / `G` | Jump to top / bottom |
| `Enter` | Select / open |
| `q` | Back / quit |
| `Ctrl+c` | Force quit |

### Panels

| Key | Action |
|-----|--------|
| `Tab` | Switch focus between panels |
| `b` | Toggle sidebar |
| `h` / `l` | Focus file tree / diff (in Files tab) |

### PR List

| Key | Action |
|-----|--------|
| `/` | Search / filter |
| `s` | Sort |
| `n` / `p` | Next / previous page |

### PR Detail

| Key | Action |
|-----|--------|
| `1` | Conversations tab |
| `2` | Commits tab |
| `3` | Files tab |
| `?` | Help overlay |

## Configuration

Configuration is optional. File location:

```
~/.config/lazyreview/config.yaml
```

Example:

```yaml
theme: tokyo-night        # tokyo-night | dracula | catppuccin-mocha
pageSize: 30              # PRs per page
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
