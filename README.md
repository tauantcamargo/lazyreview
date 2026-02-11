# LazyReview

A terminal user interface (TUI) for reviewing GitHub pull requests. Keyboard-driven, vim-style navigation—inspired by lazygit.

![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js)
![License](https://img.shields.io/badge/license-MIT-blue)

## Install

From npm (global):

```bash
npm install -g lazyreview
```

Or run once with npx:

```bash
npx lazyreview
```

**Requirements:** Node.js 20 or later.

## Usage

**From a git repository** (detects `origin` and loads that repo’s PRs):

```bash
lazyreview
```

**With an explicit owner/repo:**

```bash
lazyreview owner/repo
```

Example:

```bash
lazyreview facebook/react
```

On first run you’ll be prompted for a **GitHub Personal Access Token**. Create one at [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) with at least the `repo` scope.

## Features

- **PR list** – Browse open PRs with filter, sort, and pagination
- **PR detail** – Title, author, labels, description, and tabs:
  - **Conversations** – Description, reviews, and comments in one timeline
  - **Commits** – Commit list with message, author, and date
  - **Files** – File tree and side-by-side diff with syntax highlighting
- **Sidebar** – Involved, My PRs, For Review, This Repo, Settings
- **Themes** – Tokyo Night, Dracula, Catppuccin Mocha (configurable)
- **Git detection** – Auto-detects `owner/repo` from current directory’s `origin` remote

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `j` / `k` | Move down / up |
| `Enter` | Select / open |
| `Tab` | Switch focus (e.g. list ↔ sidebar) |
| `h` / `l` | In PR detail: focus file tree / diff panel |
| `b` | Toggle sidebar |
| `/` | Search / filter PRs |
| `s` | Sort PRs |
| `n` / `p` | Next / previous page |
| `1` / `2` / `3` | PR detail: Conversations / Commits / Files |
| `q` | Back or quit |
| `?` | Show help |
| `Ctrl+c` | Force quit |

## Commands

| Command | Description |
|---------|-------------|
| `lazyreview` | Start TUI (repo from current dir or last context) |
| `lazyreview owner/repo` | Start TUI for the given GitHub repo |

## Configuration

Configuration is optional. If used, it lives at:

- **macOS / Linux:** `~/.config/lazyreview/config.yaml`
- **Windows:** `%APPDATA%\lazyreview\config.yaml`

Example (YAML):

```yaml
theme: tokyo-night   # tokyo-night | dracula | catppuccin-mocha
```

GitHub token can be set via:

- Prompt on first run (stored locally), or
- Environment variable: `LAZYREVIEW_GITHUB_TOKEN`

## Development

```bash
git clone https://github.com/tauantcamargo/lazyreview.git
cd lazyreview
pnpm install
pnpm build
pnpm start
```

Scripts:

- `pnpm build` – Build (tsup)
- `pnpm start` – Run TUI
- `pnpm dev` – Watch build
- `pnpm typecheck` – TypeScript check
- `pnpm test` – Run tests

## License

MIT
