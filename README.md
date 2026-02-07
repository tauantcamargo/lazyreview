# LazyReview

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/tauantcamargo/lazyreview)](https://github.com/tauantcamargo/lazyreview/releases)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-orange?logo=buy-me-a-coffee)](https://buymeacoffee.com/tauantcamargo)

> A fast, keyboard-driven terminal UI for code review across multiple Git providers

LazyReview brings the efficiency of [lazygit](https://github.com/jesseduffield/lazygit) to code reviews. Navigate, review, and manage pull requests across GitHub, GitLab, Bitbucket, and Azure DevOps - all from your terminal with vim-style keybindings.

## Elevator Pitch

Rant time: Code review in a browser is a tax on your attention. Tabs everywhere, tiny diff tools, endless scrolling, and four different workflows for four different providers. Want to leave a comment on a hunk without losing your place? Or just approve a PR quickly? It shouldn't be this hard.

LazyReview is a fast, keyboard-driven terminal UI for reviewing pull requests across GitHub, GitLab, Bitbucket, and Azure DevOps. If you're tired of the web UI maze, LazyReview is the escape hatch.

## Features

- **Multi-Provider Support** - GitHub, GitLab, Bitbucket, Azure DevOps (cloud & self-hosted)
- **Navigation Modes** - Vim-style by default, with optional arrows-only mode
- **Modern UI** - Tokyo Night-inspired theme with rounded borders and subtle accent colors
- **File Navigation** - Split-pane view with file tree and syntax-highlighted diffs
- **Inline Diff Viewing** - Syntax-highlighted unified diffs with hunk navigation
- **Diff Search & Jump** - Search inside diff (`/`) and jump matches with `n`/`N`
- **Review Actions** - Approve, request changes, line comments, general comments, and review comments
- **Saved Filters** - Save PR list filters and quick-switch them
- **Local Git Integration** - Auto-detect repo, show branch status, checkout PR branch
- **Comments & Threads** - Reply, edit, delete, resolve, and navigate comment threads
- **Timeline Sidebar** - Compact PR activity timeline (reviews and comment activity)
- **Theme Support** - Multiple theme presets (Tokyo Night, Catppuccin, Dracula, GitHub, Nord, Gruvbox)
- **AI-Assisted Review** - Run AI review on files with OpenAI integration
- **Range Selection** - Select multiple lines in the diff and comment on the whole block
- **Cross-Platform** - Linux, macOS, and Windows support

## Installation

### From Source (Development)

```bash
# Requires Node.js 20+ and pnpm
git clone https://github.com/tauantcamargo/lazyreview.git
cd lazyreview
pnpm install
pnpm build
```

### Run Locally

```bash
# After building
node apps/cli/dist/index.js

# Or with pnpm
pnpm --filter lazyreview start
```

## Quick Start

### 1. Set up authentication

```bash
# GitHub
export GITHUB_TOKEN=ghp_xxxxx

# Or set in .env file
echo "GITHUB_TOKEN=ghp_xxxxx" > .env
```

### 2. Launch the TUI

```bash
node apps/cli/dist/index.js

# In demo mode (no token required)
node apps/cli/dist/index.js --demo
```

### 3. Navigate and review

| Key | Action |
|-----|--------|
| `j` / `k` | Move down / up |
| `h` / `l` | Move left / right (panels) |
| `Enter` | Select / Open PR details |
| `Tab` | Switch tabs (context-aware) |
| `Shift+Tab` | Switch filter tabs globally |
| `gg` | Go to top (chord) |
| `G` | Go to bottom |
| `Ctrl+d` / `Ctrl+u` | Half page down / up |
| `/` | Search inside diff |
| `n` / `N` | Next / previous search match |
| `[` / `]` | Previous / next hunk |
| `S` | Save current PR list filter |
| `F` | Open saved filters palette |
| `a` | Approve PR |
| `r` | Request changes |
| `c` | Line comment |
| `C` | General PR comment |
| `y` | Reply to selected comment |
| `e` | Edit selected comment |
| `x` | Delete selected comment |
| `z` | Resolve/unresolve thread |
| `t` | Toggle timeline sidebar |
| `A` | AI review (preview) |
| `V` | Visual mode (select range) |
| `o` | Checkout PR branch |
| `?` | Show help |
| `q` | Quit / Go back |

### Tab Navigation

LazyReview uses context-aware tab navigation:

- **In PR List view**: `Tab` cycles through filter tabs (All, Recent, Favorites, My PRs, To Review)
- **In other views** (PR Details, Settings, etc.): `Tab` switches between that screen's internal tabs
- **Global tab switching**: `Shift+Tab` switches filter tabs from any screen

## File Navigation

LazyReview features a split-pane view in the Files tab:

- **Left Panel (35%)**: File tree showing all changed files
  - `j/k`: Navigate files
  - `l` or `Enter`: Select file or expand folder
  - `h`: Collapse folder
  - File icons and status colors

- **Right Panel (65%)**: Diff viewer for selected file
  - Syntax highlighting with language detection
  - Search with `/`
  - Hunk navigation with `[` and `]`
  - Line numbers
  - Modern rounded borders with accent colors

- **Panel Switching**:
  - `Tab`: Switch between file tree and diff panels
  - `h`: Jump back to tree from diff
  - `l`: Jump to diff from tree
  - Active panel is highlighted with accent color

## Authentication

### Token Requirements

| Provider | Token Type | Required Scopes |
|----------|------------|-----------------|
| **GitHub** | Personal Access Token | `repo`, `read:org` |
| **GitLab** | Personal Access Token | `api` |
| **Bitbucket** | App Password | `pullrequest:read/write`, `repository:read` |
| **Azure DevOps** | Personal Access Token | `Code (Read & Write)` |

### Creating Tokens

<details>
<summary><strong>GitHub</strong></summary>

1. Go to [Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `read:org`
4. Generate and copy the token

</details>

<details>
<summary><strong>GitLab</strong></summary>

1. Go to [User Settings > Access Tokens](https://gitlab.com/-/profile/personal_access_tokens)
2. Create a token with `api` scope
3. Copy the token

</details>

<details>
<summary><strong>Bitbucket</strong></summary>

1. Go to [Personal settings > App passwords](https://bitbucket.org/account/settings/app-passwords/)
2. Create an app password with `Repositories: Read` and `Pull requests: Read and Write`
3. Use format: `username:app_password` when authenticating

</details>

<details>
<summary><strong>Azure DevOps</strong></summary>

1. Go to User Settings > Personal Access Tokens
2. Create a token with `Code (Read & Write)` scope
3. Copy the token

</details>

## Project Structure

```
lazyreview/
├── apps/
│   └── cli/                 # CLI application
│       ├── src/
│       │   ├── screens/     # TUI screens
│       │   ├── hooks/       # React hooks for data fetching
│       │   ├── stores/      # Zustand state management
│       │   └── utils/       # Utilities
│       └── dist/            # Built output
├── packages/
│   ├── ui/                  # UI components library
│   │   └── src/
│   │       ├── components/  # Reusable TUI components
│   │       ├── hooks/       # UI hooks
│   │       └── theme.ts     # Theme system
│   ├── core/                # Core business logic
│   │   └── src/
│   │       ├── providers/   # Git provider adapters
│   │       ├── models.ts    # Data models
│   │       └── ai.ts        # AI integration
│   ├── storage/             # SQLite storage layer
│   ├── platform/            # Platform-specific code
│   └── ...
├── examples/                # Example applications
└── pnpm-workspace.yaml      # Monorepo configuration
```

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+

### Setup

```bash
# Clone the repository
git clone https://github.com/tauantcamargo/lazyreview.git
cd lazyreview

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run CLI
node apps/cli/dist/index.js
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run specific package tests
pnpm --filter @lazyreview/ui test
```

### Development Scripts

```bash
# Build all packages
pnpm build

# Build only CLI
pnpm build:cli

# Watch mode (auto-rebuild)
pnpm dev

# Lint
pnpm lint

# Type check
pnpm typecheck
```

## Architecture

LazyReview is built with:

- **Ink** - React for CLIs, building terminal UI components
- **Zustand** - Lightweight state management
- **React Query** - Data fetching and caching
- **TypeScript** - Type safety across the codebase
- **pnpm** - Fast, disk space efficient package manager

### Key Packages

- `@lazyreview/ui` - Reusable TUI components (FileTree, DiffView, Table, etc.)
- `@lazyreview/core` - Provider adapters, models, and business logic
- `@lazyreview/storage` - SQLite storage for caching and persistence
- `lazyreview` (apps/cli) - Main CLI application

## AI Review Setup

```bash
# Set OpenAI API key
export OPENAI_API_KEY=sk-xxxxx

# Or in .env file
echo "OPENAI_API_KEY=sk-xxxxx" >> .env
```

Supported AI providers:
- OpenAI (gpt-4, gpt-4-turbo, gpt-3.5-turbo)
- Any OpenAI-compatible API (set `OPENAI_BASE_URL`)

## Configuration

Configuration is managed through:

1. **Environment variables** (`.env` file)
   - `GITHUB_TOKEN` - GitHub personal access token
   - `GITLAB_TOKEN` - GitLab personal access token
   - `OPENAI_API_KEY` - OpenAI API key

2. **Zustand store** (in-memory state)
   - UI preferences
   - Saved filters
   - Selected repository

## Roadmap

- [x] Core TUI with Ink
- [x] GitHub provider
- [x] GitLab provider
- [x] Bitbucket provider
- [x] Azure DevOps provider
- [x] Vim-style navigation
- [x] File tree with split-pane diff view
- [x] Syntax-highlighted diffs
- [x] Hunk navigation
- [x] Diff search with match highlighting
- [x] Review actions (approve, request changes)
- [x] Comment operations (create, reply, edit, delete, resolve)
- [x] Local git integration (status, checkout)
- [x] Saved filters
- [x] Timeline sidebar
- [x] AI-assisted review
- [x] Visual mode (range selection)
- [ ] Keyboard chord system improvements
- [ ] Configuration file support
- [ ] Theme customization UI
- [ ] Workspace management
- [ ] Offline queue for actions
- [ ] Binary releases

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [lazygit](https://github.com/jesseduffield/lazygit)
- Built with [Ink](https://github.com/vadimdemedes/ink) - React for CLIs
- UI components with [Ink UI](https://github.com/vadimdemedes/ink-ui)
- State management with [Zustand](https://github.com/pmndrs/zustand)
- Styled with Ink's styling system

## Support

- **Issues**: [GitHub Issues](https://github.com/tauantcamargo/lazyreview/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tauantcamargo/lazyreview/discussions)

---

If you find LazyReview useful, consider [buying me a coffee](https://buymeacoffee.com/tauantcamargo)!
