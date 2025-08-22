# LazyReview

[![Go Version](https://img.shields.io/badge/Go-1.22+-blue.svg)](https://golang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Go Report Card](https://goreportcard.com/badge/github.com/tauantcamargo/lazyreview)](https://goreportcard.com/report/github.com/tauantcamargo/lazyreview)
[![Go Reference](https://pkg.go.dev/badge/github.com/tauantcamargo/lazyreview.svg)](https://pkg.go.dev/github.com/tauantcamargo/lazyreview)

> A fast, keyboard-driven terminal UI for code review across multiple Git providers

LazyReview is a powerful CLI/TUI application that streamlines the code review process across GitHub, GitLab, Bitbucket, and Azure DevOps. Built in the spirit of [lazygit](https://github.com/jesseduffield/lazygit), it provides an intuitive terminal interface for browsing, reviewing, and managing pull requests and merge requests.

## ✨ Features

- **Multi-Provider Support** - GitHub, GitLab, Bitbucket, Azure DevOps (cloud & self-hosted)
- **Efficient Navigation** - Browse PRs/MRs with filters, search, and sorting
- **Inline Review** - Diff viewing with file-by-file navigation and inline comments
- **Review Actions** - Approve, request changes, merge, label, assign, and re-run checks
- **Local Development** - Checkout PR branches locally for testing
- **Multi-Account** - Manage multiple accounts and workspaces with per-repo overrides
- **Offline Support** - Queue comments and approvals for later synchronization
- **Customizable** - Open in browser or editor with configurable keybindings

## 🚀 Quick Start

### Installation

#### Prebuilt Binaries

Download the latest release from [GitHub Releases](https://github.com/your-org/lazyreview/releases).

<!-- ```bash -->
<!-- # Requirements: Go ≥ 1.22 -->
<!-- go install github.com/your-org/lazyreview/cmd/lazyreview@latest -->
<!-- ``` -->

### First Run (thinking to have this feature)

1. **Authenticate** with your Git provider:

   ```bash
   lazyreview auth login
   ```

2. **Launch the TUI**:

   ```bash
   lazyreview
   ```

3. **Navigate** using:
   - `j/k` - Move up/down
   - `Enter` - Open/select
   - `q` - Go back
   - `?` - Show help

4. **Create a comment**:
   - `c` - Comment on line/hunk
   - Write your comment and save

## 📖 Usage

```bash
# start cli
go run main.go

# start lazyreview ui
go run main.go start
```

### Core Commands (future commands)

```bash
# Launch the TUI
lazyreview

# Authentication
lazyreview auth login [--provider github|gitlab|bitbucket|azure] [--host <url>]
lazyreview auth status
lazyreview auth logout [--all]

# Pull Request Management
lazyreview pr list [--author me] [--state open|closed|merged] [--search "..."]
lazyreview pr view <id|url>
lazyreview pr checkout <id>

# Review Operations
lazyreview review start <id>
lazyreview review comment <id> --file <path> --line <n> --message "..."
lazyreview review approve <id>
lazyreview review request-changes <id> --message "..."

# Labels and Assignments
lazyreview label add <id> <label...>
lazyreview label remove <id> <label...>
lazyreview assign add <id> <user...>
lazyreview assign remove <id> <user...>

# Utilities
lazyreview open <id>          # Open in browser
lazyreview config edit        # Edit configuration
lazyreview cache sync         # Sync offline queue
```

### TUI Keybindings

| Action         | Key     | Description             |
| -------------- | ------- | ----------------------- |
| **Navigation** | `j/k`   | Move up/down            |
|                | `h/l`   | Move left/right         |
|                | `Enter` | Open/select             |
|                | `q`     | Go back                 |
| **Actions**    | `a`     | Approve                 |
|                | `r`     | Request changes         |
|                | `c`     | Comment                 |
|                | `e`     | Edit                    |
|                | `d`     | Toggle diff view        |
| **Misc**       | `/`     | Search                  |
|                | `s`     | Switch provider/account |
|                | `o`     | Open in browser         |
|                | `?`     | Show help               |

## ⚙️ Configuration

<!-- ### Configuration File Location -->
<!---->
<!-- | Platform | Path                                                   | -->
<!-- | -------- | ------------------------------------------------------ | -->
<!-- | Linux    | `~/.config/lazyreview/config.yaml`                     | -->
<!-- | macOS    | `~/Library/Application Support/lazyreview/config.yaml` | -->
<!-- | Windows  | `%APPDATA%\lazyreview\config.yaml`                     | -->
<!---->
<!-- ### Example Configuration -->
<!---->
<!-- ```yaml -->
<!-- version: 0.1 -->
<!-- default_provider: github -->
<!---->
<!-- ui: -->
<!--   theme: auto # light|dark|auto -->
<!--   paging: true -->
<!--   show_checks: true -->
<!---->
<!-- keybindings: -->
<!--   up: k -->
<!--   down: j -->
<!--   left: h -->
<!--   right: l -->
<!--   approve: a -->
<!--   request_changes: r -->
<!--   comment: c -->
<!--   submit: s -->
<!--   search: / -->
<!---->
<!-- providers: -->
<!--   - name: github-work -->
<!--     type: github -->
<!--     host: github.com -->
<!--     token_env: GITHUB_TOKEN -->
<!--     default_query: -->
<!--       state: open -->
<!--       review_requested: me -->
<!---->
<!--   - name: gitlab-self -->
<!--     type: gitlab -->
<!--     host: gitlab.company.internal -->
<!--     base_url: https://gitlab.company.internal/api/v4 -->
<!--     token_env: GITLAB_TOKEN -->
<!---->
<!-- repo_overrides: -->
<!--   - path: ~/src/company/* -->
<!--     default_provider: gitlab-self -->
<!-- ``` -->

## 🔐 Authentication

### Provider Requirements

| Provider         | Token Type                                      | Required Scopes                                |
| ---------------- | ----------------------------------------------- | ---------------------------------------------- |
| **GitHub**       | Personal Access Token (Classic) or Fine-grained | `repo`, `read:org`                             |
| **GitLab**       | Personal Access Token                           | `api`                                          |
| **Bitbucket**    | App Password                                    | `pullrequest:read/write`, `repository:read`    |
| **Azure DevOps** | Personal Access Token                           | `Code (Read & Write)`, `Work Items` (optional) |

### Security Notes

- Tokens are stored in the OS keychain when available
- Environment variables are used as fallback (never stored in plaintext)
- Follow the principle of least privilege for token scopes

## 🛠️ Development

### Prerequisites

- Go ≥ 1.22
- Git ≥ 2.30
- Make

### Building

```bash
# Clone the repository
git clone https://github.com/tauantcamargo/lazyreview.git
cd lazyreview

# Build the binary
go build

```

### Project Structure

```
lazyreview/
├── cmd/                    # Command-line entry points
├── internal/              # Private application code
├── pkg/                   # Public packages
│   ├── providers/         # Git provider adapters
│   ├── tui/              # Terminal UI components
│   └── config/           # Configuration management
├── docs/                  # Documentation
└── examples/              # Example configurations
```

## 🗺️ Roadmap

| Version | Features | Timeline |
| ------- | -------- | -------- |

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Report Issues** - Open an issue for bugs or feature requests
2. **Submit PRs** - Fork the repo and submit pull requests
3. **Add Tests** - Include tests for new features
4. **Follow Style** - Match the existing code style and patterns
5. **Provider Support** - Add new provider adapters under `pkg/providers/`

### Development Guidelines

- Add tests for new functionality
- Follow existing coding conventions
- Update documentation for new features
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [lazygit](https://github.com/jesseduffield/lazygit)
- Built with [Gocui](https://github.com/awesome-gocui/gocui)
- Built with [cli](https://github.com/urfave/cli)
- Maibe - Built with [Bubble Tea](https://github.com/charmbracelet/bubbletea) for CLI
- Uses [Charm](https://charm.sh/) libraries for terminal utilities

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/tauantcamargo/lazyreview/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tauantcamargo/lazyreview/discussions)

---

**Note**: This project is in early development. The CLI interface and configuration format may change. We welcome feedback and contributions!
