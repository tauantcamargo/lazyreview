# LazyReview Implementation Plan

## Executive Summary

LazyReview is a lazygit-style TUI for code reviews across multiple Git providers (GitHub, GitLab, Bitbucket, Azure DevOps). This plan outlines a phased approach to build a keyboard-driven, vim-style interface for efficient PR/MR management.

---

## Current State

```
lazyreview/
├── main.go                    # Entry point → cmd.CommandStart()
├── cmd/
│   ├── cmd.go                 # CLI setup with urfave/cli (start/login/logout stubs)
│   └── cmui.go                # Bubble Tea progress bar component
├── pkg/tui/
│   └── layout.go              # Gocui layout (header/sidebar/content/footer)
└── go.mod                     # Dependencies: gocui, bubbletea, urfave/cli
```

**What exists:**
- Basic CLI with urfave/cli
- Gocui-based TUI shell (non-functional panels)
- Bubble Tea progress indicator
- Only Ctrl+C keybinding

**What's missing:**
- Provider integrations
- Authentication
- Vim-style navigation
- Diff viewing
- Review actions
- Distribution/packaging

---

## Architecture Decision: TUI Framework

**Decision: Migrate to Bubble Tea**

Rationale:
1. Elm-style MVU pattern suits complex, dynamic UIs
2. Rich ecosystem (Bubbles components, Lipgloss styling)
3. Better testability (pure functions)
4. Active community (9,000+ projects)

Migration path: Gradual replacement of Gocui views with Bubble Tea components.

---

## Target Package Structure

```
lazyreview/
├── main.go
├── cmd/
│   ├── root.go                # Root CLI command
│   ├── start.go               # TUI launcher
│   └── auth.go                # Auth subcommands
├── internal/
│   ├── app/
│   │   ├── app.go             # Main application coordinator
│   │   └── state.go           # Application state
│   ├── config/
│   │   ├── config.go          # YAML config loading
│   │   ├── keybindings.go     # Keybinding definitions
│   │   └── providers.go       # Provider configuration
│   ├── gui/
│   │   ├── gui.go             # Main GUI struct
│   │   ├── layout.go          # Layout management
│   │   ├── keybindings.go     # Keybinding registration
│   │   └── theme.go           # Theme/styling
│   ├── context/
│   │   ├── context.go         # Base context interface
│   │   ├── list_context.go    # List view context
│   │   ├── diff_context.go    # Diff view context
│   │   └── manager.go         # Context stack manager
│   ├── controllers/
│   │   ├── pr_controller.go   # PR list operations
│   │   ├── diff_controller.go # Diff viewing
│   │   ├── review_controller.go
│   │   └── auth_controller.go
│   ├── helpers/
│   │   ├── pr_helper.go
│   │   ├── diff_helper.go
│   │   ├── comment_helper.go
│   │   └── git_helper.go
│   ├── models/
│   │   ├── pr.go              # PullRequest model
│   │   ├── review.go
│   │   ├── comment.go
│   │   ├── diff.go
│   │   └── user.go
│   └── queue/
│       ├── queue.go           # Offline action queue
│       └── sync.go
├── pkg/
│   ├── providers/
│   │   ├── provider.go        # Provider interface
│   │   ├── github/
│   │   ├── gitlab/
│   │   ├── bitbucket/
│   │   └── azuredevops/
│   ├── keyring/
│   │   └── keyring.go         # Credential storage
│   ├── git/
│   │   └── git.go             # Local git operations
│   └── components/
│       ├── list.go
│       ├── diff.go
│       ├── input.go
│       └── help.go
└── .goreleaser.yaml           # Release automation
```

---

## Core Interfaces

### Provider Interface (Adapter Pattern)

```go
type Provider interface {
    // Authentication
    Authenticate(ctx context.Context, token string) error
    ValidateToken(ctx context.Context) (bool, error)

    // Pull Request Operations
    ListPullRequests(ctx context.Context, opts ListPROptions) ([]models.PullRequest, error)
    GetPullRequest(ctx context.Context, id string) (*models.PullRequest, error)
    GetPullRequestDiff(ctx context.Context, id string) (*models.Diff, error)
    GetPullRequestFiles(ctx context.Context, id string) ([]models.FileChange, error)

    // Review Operations
    ListReviews(ctx context.Context, prID string) ([]models.Review, error)
    CreateReview(ctx context.Context, prID string, review models.ReviewInput) error
    ApproveReview(ctx context.Context, prID string, comment string) error
    RequestChanges(ctx context.Context, prID string, comment string) error

    // Comment Operations
    ListComments(ctx context.Context, prID string) ([]models.Comment, error)
    CreateComment(ctx context.Context, prID string, comment models.CommentInput) error

    // Metadata
    Name() string
    Type() ProviderType
}
```

---

## Phased Implementation

### Phase 1: Foundation (Weeks 1-3)

**Goals:** Core architecture, configuration, basic TUI shell

#### 1.1 Configuration System
- `internal/config/config.go` - YAML config with viper
- `internal/config/keybindings.go` - Keybinding definitions
- `internal/config/providers.go` - Provider configs

**Config format:**
```yaml
version: 0.1
default_provider: github

ui:
  theme: auto
  show_checks: true

keybindings:
  up: k
  down: j
  left: h
  right: l
  top: g
  bottom: G
  approve: a
  request_changes: r
  comment: c
  quit: q
  help: "?"

providers:
  - name: github-personal
    type: github
    host: github.com
    token_env: GITHUB_TOKEN
```

#### 1.2 Core Models
- `internal/models/pr.go`
- `internal/models/review.go`
- `internal/models/comment.go`
- `internal/models/diff.go`

#### 1.3 Provider Interface
- `pkg/providers/provider.go`
- `pkg/providers/types.go`
- `pkg/providers/errors.go`

#### 1.4 Bubble Tea TUI Shell
- Migrate `pkg/tui/layout.go` to Bubble Tea
- `internal/gui/gui.go` - Main coordinator
- `pkg/components/list.go` - List component

---

### Phase 2: Authentication & Credentials (Weeks 4-5)

**Goals:** Secure token storage for all providers

#### 2.1 Keyring Integration
- `pkg/keyring/keyring.go` - Wrapper around 99designs/keyring
- Supports: macOS Keychain, Windows Credential Manager, Linux Secret Service

#### 2.2 Auth Commands
- `cmd/auth.go` - login, logout, status subcommands
- `internal/controllers/auth_controller.go`

**Auth flow:**
1. `lazyreview auth login --provider github`
2. Prompt for token (masked)
3. Validate against API
4. Store in OS keyring

#### Provider Token Requirements

| Provider | Token Type | Scopes |
|----------|-----------|--------|
| GitHub | PAT (Classic/Fine-grained) | `repo`, `read:org` |
| GitLab | PAT | `api` |
| Bitbucket | App Password | `pullrequest:read/write`, `repository:read` |
| Azure DevOps | PAT | `Code (Read & Write)` |

---

### Phase 3: GitHub Provider (Weeks 6-8)

**Goals:** Complete GitHub integration as reference

- `pkg/providers/github/client.go`
- `pkg/providers/github/pr.go`
- `pkg/providers/github/review.go`
- `pkg/providers/github/mapper.go`

**Library:** `github.com/google/go-github/v60`

**API endpoints:**
```
GET  /repos/{owner}/{repo}/pulls
GET  /repos/{owner}/{repo}/pulls/{id}
GET  /repos/{owner}/{repo}/pulls/{id}/files
GET  /repos/{owner}/{repo}/pulls/{id}/reviews
POST /repos/{owner}/{repo}/pulls/{id}/reviews
GET  /repos/{owner}/{repo}/pulls/{id}/comments
POST /repos/{owner}/{repo}/pulls/{id}/comments
```

---

### Phase 4: Vim-Style Navigation (Weeks 9-10)

**Goals:** Full keyboard navigation like lazygit

#### Keybindings

| Key | Action |
|-----|--------|
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `h` / `←` | Collapse / previous panel |
| `l` / `→` | Expand / next panel |
| `gg` | Go to top |
| `G` | Go to bottom |
| `Ctrl+d` | Half page down |
| `Ctrl+u` | Half page up |
| `/` | Search/filter |
| `n` | Next search match |
| `N` | Previous search match |
| `Enter` | Select/open |
| `q` | Go back/quit |
| `Esc` | Cancel/close popup |
| `Tab` | Next panel |
| `Shift+Tab` | Previous panel |
| `?` | Show help |

#### Context Stack
- Push/pop contexts for navigation
- Maintain focus history
- Handle panel transitions

---

### Phase 5: Diff Viewing & Review UI (Weeks 11-13)

**Goals:** Inline diff viewing with comments

#### 5.1 Diff Parser
- `internal/helpers/diff_helper.go` - Unified diff parsing
- `pkg/components/diff.go` - Diff renderer

**Features:**
- Unified diff format
- Syntax highlighting (chroma)
- Line/hunk navigation

#### 5.2 Review Actions

| Key | Action |
|-----|--------|
| `a` | Approve |
| `r` | Request changes |
| `c` | Comment at line |
| `C` | General comment |
| `d` | Toggle split/unified diff |

---

### Phase 6: Additional Providers (Weeks 14-17)

#### 6.1 GitLab
- `pkg/providers/gitlab/`
- Library: `github.com/xanzy/go-gitlab`
- Note: MRs instead of PRs

#### 6.2 Bitbucket
- `pkg/providers/bitbucket/`
- Library: Custom REST client
- Note: Workspace/project hierarchy

#### 6.3 Azure DevOps
- `pkg/providers/azuredevops/`
- Library: Custom REST client
- Note: Vote-based approval (-10 to 10)

---

### Phase 7: Local Git Integration (Week 18)

- `pkg/git/git.go` - Git command wrapper
- `internal/helpers/git_helper.go`

**Operations:**
- Checkout PR branch
- Detect current repo/provider
- Show local branch status

---

### Phase 8: Offline Queue (Weeks 19-20)

- `internal/queue/queue.go` - SQLite-based queue
- `internal/queue/sync.go` - Sync on reconnect

**Queued actions:** Comments, approvals, change requests

---

### Phase 9: Distribution & Packaging (Week 21)

**Goals:** Multiple installation methods

#### 9.1 GoReleaser Setup
- `.goreleaser.yaml` - Automated releases

**Binaries for:**
- Linux (amd64, arm64)
- macOS (amd64, arm64)
- Windows (amd64)

#### 9.2 Homebrew
- Create `homebrew-tap` repository
- Formula at `HomebrewFormula/lazyreview.rb`

```ruby
class Lazyreview < Formula
  desc "Terminal UI for code review across Git providers"
  homepage "https://github.com/tauantcamargo/lazyreview"
  url "https://github.com/tauantcamargo/lazyreview/releases/download/v#{version}/lazyreview_#{version}_darwin_amd64.tar.gz"

  def install
    bin.install "lazyreview"
  end
end
```

**Install:** `brew install tauantcamargo/tap/lazyreview`

#### 9.3 Direct Binary Download
- GitHub Releases page
- Install script: `curl -sSL https://raw.githubusercontent.com/tauantcamargo/lazyreview/main/install.sh | sh`

#### 9.4 Build from Source
```bash
git clone https://github.com/tauantcamargo/lazyreview.git
cd lazyreview
go build -o lazyreview .
./lazyreview
```

#### 9.5 APT Repository (Future)
- Set up Debian package repository
- Create `.deb` packages via GoReleaser
- Host on packagecloud.io or GitHub Pages

```bash
# Future usage
curl -sSL https://lazyreview.dev/gpg | sudo apt-key add -
echo "deb https://lazyreview.dev/apt stable main" | sudo tee /etc/apt/sources.list.d/lazyreview.list
sudo apt update && sudo apt install lazyreview
```

#### 9.6 GoReleaser Config

```yaml
# .goreleaser.yaml
version: 2
project_name: lazyreview

builds:
  - main: .
    binary: lazyreview
    goos:
      - linux
      - darwin
      - windows
    goarch:
      - amd64
      - arm64
    ldflags:
      - -s -w -X main.version={{.Version}}

archives:
  - formats: [tar.gz]
    name_template: "{{ .ProjectName }}_{{ .Version }}_{{ .Os }}_{{ .Arch }}"
    format_overrides:
      - goos: windows
        formats: [zip]

brews:
  - repository:
      owner: tauantcamargo
      name: homebrew-tap
    homepage: https://github.com/tauantcamargo/lazyreview
    description: Terminal UI for code review across Git providers
    license: MIT

nfpms:
  - package_name: lazyreview
    homepage: https://github.com/tauantcamargo/lazyreview
    maintainer: Tauan Camargo
    description: Terminal UI for code review across Git providers
    license: MIT
    formats:
      - deb
      - rpm

checksum:
  name_template: "checksums.txt"

changelog:
  sort: asc
  filters:
    exclude:
      - "^docs:"
      - "^test:"
```

---

### Phase 10: Polish & Performance (Week 22)

- Lazy loading for PR lists
- Background refresh
- API response caching
- Virtual scrolling
- Comprehensive error handling
- Unit/integration tests

---

## Dependency Graph

```
Phase 1 (Foundation)
    │
    ├── Phase 2 (Auth)
    │       │
    │       └── Phase 3 (GitHub)
    │               │
    │               ├── Phase 4 (Navigation)
    │               │       │
    │               │       └── Phase 5 (Diff/Review)
    │               │               │
    │               │               ├── Phase 6 (Other Providers)
    │               │               │
    │               │               └── Phase 8 (Offline Queue)
    │               │
    │               └── Phase 7 (Local Git)
    │
    └── Phase 9 (Distribution) ─── Can start after Phase 3
            │
            └── Phase 10 (Polish) ─── All phases complete
```

---

## Recommended Libraries

| Purpose | Library |
|---------|---------|
| TUI Framework | `charmbracelet/bubbletea` |
| TUI Components | `charmbracelet/bubbles` |
| TUI Styling | `charmbracelet/lipgloss` |
| CLI Framework | `urfave/cli/v2` |
| GitHub API | `google/go-github/v60` |
| GitLab API | `xanzy/go-gitlab` |
| Keyring | `99designs/keyring` |
| Config | `spf13/viper` |
| Database | `mattn/go-sqlite3` |
| Diff Parsing | `sergi/go-diff` |
| Syntax Highlight | `alecthomas/chroma` |
| Releases | `goreleaser/goreleaser` |

---

## Risk Summary

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| TUI migration complexity | Medium | High | Incremental migration |
| Provider API inconsistencies | High | Medium | Strong adapter pattern |
| Keyring availability | Medium | Medium | Encrypted file fallback |
| Large diff performance | Medium | Medium | Virtual scrolling |
| Cross-platform terminal issues | Medium | Low | Bubble Tea abstractions |

---

## Success Criteria

1. **Usability**: Users familiar with lazygit navigate intuitively
2. **Multi-provider**: All four providers with same UX
3. **Performance**: <100ms navigation, <2s PR list load
4. **Reliability**: Offline queue never loses actions
5. **Security**: Tokens in OS keyring, never plaintext
6. **Distribution**: Available via Homebrew, binaries, and source

---

**WAITING FOR CONFIRMATION**: Proceed with this plan? (yes/no/modify)
