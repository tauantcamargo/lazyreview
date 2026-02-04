# LazyReview

[![Go Version](https://img.shields.io/badge/Go-1.22+-blue.svg)](https://golang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Go Report Card](https://goreportcard.com/badge/github.com/tauantcamargo/lazyreview)](https://goreportcard.com/report/github.com/tauantcamargo/lazyreview)
[![Release](https://img.shields.io/github/v/release/tauantcamargo/lazyreview)](https://github.com/tauantcamargo/lazyreview/releases)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-orange?logo=buy-me-a-coffee)](https://buymeacoffee.com/tauantcamargo)

> A fast, keyboard-driven terminal UI for code review across multiple Git providers

LazyReview brings the efficiency of [lazygit](https://github.com/jesseduffield/lazygit) to code reviews. Navigate, review, and manage pull requests across GitHub, GitLab, Bitbucket, and Azure DevOps - all from your terminal with vim-style keybindings.

## Features

- **Multi-Provider Support** - GitHub, GitLab, Bitbucket, Azure DevOps (cloud & self-hosted)
- **Vim-Style Navigation** - `j/k`, `h/l`, `gg`, `G`, `Ctrl+d/u` and more
- **Inline Diff Viewing** - Syntax-highlighted diffs with file-by-file navigation
- **Review Actions** - Approve, request changes, line comments, general comments, and review comments
- **Workspaces & Dashboard** - Group repos and get a multi-repo overview
- **Offline Queue** - Automatically retries review actions and comments when you're back online
- **Local Git Integration** - Auto-detect repo, show branch status, checkout PR branch
- **Comments Panel** - Browse PR comments, including replies, and manage threads inline
- **Theme Presets** - Switch between `auto`, `darcula`, `tokyonight`, `gruvbox`, and `catppuccin` in Settings
- **AI-Assisted Review** - Run AI review on the current file and submit approve/request changes/comment
- **Range Selection** - Select multiple lines in the diff and comment on the whole block
- **Secure Authentication** - Tokens stored in OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **Cross-Platform** - Linux, macOS, and Windows binaries available

## Installation

### Homebrew (macOS/Linux)

```bash
brew install tauantcamargo/tap/lazyreview
```

### Download Binary

Download the latest release for your platform from [GitHub Releases](https://github.com/tauantcamargo/lazyreview/releases).

**Linux/macOS:**
```bash
# Download and extract (replace VERSION and PLATFORM)
curl -sL https://github.com/tauantcamargo/lazyreview/releases/download/vVERSION/lazyreview_VERSION_PLATFORM.tar.gz | tar xz
sudo mv lazyreview /usr/local/bin/
```

### Install Script

```bash
curl -sSL https://raw.githubusercontent.com/tauantcamargo/lazyreview/main/scripts/install.sh | sh
```

### Build from Source

```bash
# Requires Go 1.22+
git clone https://github.com/tauantcamargo/lazyreview.git
cd lazyreview
go build -o lazyreview .
sudo mv lazyreview /usr/local/bin/
```

### Go Install

```bash
go install github.com/tauantcamargo/lazyreview@latest
```

## Quick Start

### 1. Authenticate with your provider

```bash
# GitHub
lazyreview auth login --provider github

# GitLab
lazyreview auth login --provider gitlab

# Bitbucket (use username:app_password format)
lazyreview auth login --provider bitbucket

# Azure DevOps
lazyreview auth login --provider azuredevops
```

### 2. Launch the TUI

```bash
lazyreview start
```

### 3. Navigate and review

| Key | Action |
|-----|--------|
| `j` / `k` | Move down / up |
| `h` / `l` | Move left / right (panels) |
| `Enter` | Select / Open PR details |
| `gg` | Go to top |
| `G` | Go to bottom |
| `Ctrl+d` / `Ctrl+u` | Half page down / up |
| `n` / `N` | Next / previous file |
| `{` / `}` | Previous / next hunk |
| `a` | Approve PR |
| `r` | Request changes |
| `c` | Line comment |
| `C` | General PR comment |
| `v` | Review comment |
| `s` | Generate PR summary draft |
| `t` | Toggle comments panel |
| `y` | Reply to selected comment |
| `e` | Edit selected inline comment |
| `x` | Delete selected inline comment |
| `z` | Resolve selected thread (provider support varies) |
| `A` | AI review (current file) |
| `O` | Open selected file in `$EDITOR` |
| `V` | Select range (multi-line comment) |
| `Shift+c` | Checkout PR branch |
| `?` | Show help |
| `q` | Quit / Go back |

To change themes: open **Settings** from the sidebar, select a theme entry, and press `Enter`.

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

### Security

- Tokens are stored securely in your OS keychain
- macOS: Keychain Access
- Windows: Credential Manager
- Linux: Secret Service (GNOME Keyring, KWallet)

## Configuration

Configuration file location:
- **Linux**: `~/.config/lazyreview/config.yaml`
- **macOS**: `~/Library/Application Support/lazyreview/config.yaml`
- **Windows**: `%APPDATA%\lazyreview\config.yaml`

Example configuration:

```yaml
version: "0.1"
default_provider: github

ui:
  theme: auto
  show_checks: true

keybindings:
  up: k
  down: j
  left: h
  right: l
  approve: a
  request_changes: r
  comment: c

providers:
  - name: github-personal
    type: github
    host: github.com

  - name: gitlab-work
    type: gitlab
    host: gitlab.company.com
```

## Project Structure

```
lazyreview/
├── cmd/                      # CLI commands
│   ├── cmd.go               # Command definitions
│   └── cmui.go              # Progress UI component
├── internal/
│   ├── auth/                # Authentication system
│   ├── config/              # Configuration management
│   ├── gui/                 # Main TUI application
│   ├── queue/               # Offline action queue
│   ├── services/            # Aggregation + caching helpers
│   ├── storage/             # SQLite storage layer
│   └── models/              # Data models
├── pkg/
│   ├── components/          # Reusable UI components
│   │   ├── diff.go         # Diff viewer
│   │   ├── filetree.go     # File tree
│   │   ├── help.go         # Help overlay
│   │   └── list.go         # List component
│   ├── git/                 # Local git helpers
│   └── providers/           # Git provider adapters
│       ├── github/         # GitHub implementation
│       ├── gitlab/         # GitLab implementation
│       ├── bitbucket/      # Bitbucket implementation
│       └── azuredevops/    # Azure DevOps implementation
├── scripts/
│   └── install.sh          # Installation script
└── .goreleaser.yaml        # Release configuration
```

## Development

### Prerequisites

- Go 1.22+
- Git

### Building

```bash
git clone https://github.com/tauantcamargo/lazyreview.git
cd lazyreview
go build
./lazyreview start
```

### Running Tests

```bash
go test ./...
```

## AI Review Setup

Set environment variables before launching:

```bash
export LAZYREVIEW_AI_PROVIDER=openai
export LAZYREVIEW_AI_API_KEY=your_key
# Optional:
export LAZYREVIEW_AI_MODEL=gpt-4o-mini
export LAZYREVIEW_AI_BASE_URL=https://api.openai.com/v1
```

## Roadmap

- [x] Core TUI with Bubble Tea
- [x] GitHub provider
- [x] GitLab provider
- [x] Bitbucket provider
- [x] Azure DevOps provider
- [x] Vim-style navigation
- [x] Diff viewer with file navigation
- [x] Hunk navigation ({/})
- [x] Secure credential storage
- [x] Real API data fetching
- [x] Cross-platform releases
- [x] Review actions (approve, request changes)
- [x] Local git detection (auto-detect repo from .git)
- [x] SQLite storage layer (workspaces, favorites)
- [x] Syntax highlighting with Chroma
- [x] Advanced filtering (by author, state, labels, etc.)
- [x] Provider org/repo listing extensions
- [x] Inline commenting (c key) and general comments (C key)
- [x] Review comments (v key)
- [x] Local git integration (branch status + checkout)
- [x] Dashboard view (multi-repo)
- [x] Workspace management UI
- [x] Offline queue for comments/approvals
- [x] Comments panel with replies
- [x] AI-assisted review (OpenAI-compatible)
- [x] Multi-line diff selection for comments
- [x] Split/unified diff view toggle (d key)
- [ ] Custom themes

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
- Built with [Bubble Tea](https://github.com/charmbracelet/bubbletea) TUI framework
- Uses [Bubbles](https://github.com/charmbracelet/bubbles) components
- Styled with [Lipgloss](https://github.com/charmbracelet/lipgloss)
- CLI powered by [urfave/cli](https://github.com/urfave/cli)

## Support

- **Issues**: [GitHub Issues](https://github.com/tauantcamargo/lazyreview/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tauantcamargo/lazyreview/discussions)

---

If you find LazyReview useful, consider [buying me a coffee](https://buymeacoffee.com/tauantcamargo)!
