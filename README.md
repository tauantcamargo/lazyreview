**LazyReview** — a terminal UI for code review across GitHub, GitLab, Bitbucket, and Azure DevOps

A fast, keyboard-driven CLI/TUI (in the spirit of lazygit) to browse, review, and act on pull/merge requests across multiple providers and accounts.

— Features

- Multi-provider: GitHub, GitLab, Bitbucket, Azure DevOps (cloud/self-hosted)
- Browse PRs/MRs: filters, search, and sorting
- Diff and file-by-file navigation with inline comments
- Approve/request changes, merge, label, assign, and re-run checks (where supported)
- Checkout PR branches locally
- Multiple accounts and workspaces; per-repo overrides
- Offline queue for comments/approvals with later sync
- Open in browser or editor; customizable keybindings

— Status
Early design phase. The CLI shape and config format may change. Feedback welcome.

— Installation
Prebuilt binaries: TBD (releases at https://github.com/your-org/your-repo/releases)

From source (choose one, depending on implementation language):

- Go:
  - Requirements: Go ≥ 1.22
  - Install: go install github.com/your-org/your-repo/cmd/cr@latest
    — Quick start

1. Install the binary (see above)
2. Run auth flow:
   - cr auth login
   - Select provider (GitHub/GitLab/Bitbucket/Azure) and follow prompts
3. Open the TUI:
   - cr
4. Navigate:
   - Arrow keys or j/k to move, Enter to open, q to go back
5. Create a comment:
   - c to comment on line/hunk; save and submit

— Commands (CLI)

- cr # Launch TUI
- cr auth login [--provider github|gitlab|bitbucket|azure] [--host <url>]
- cr auth status
- cr auth logout [--all]
- cr pr list [--author me] [--state open|closed|merged] [--search "..."]
- cr pr view <id|url>
- cr pr checkout <id>
- cr review start <id>
- cr review comment <id> --file <path> --line <n> --message "..."
- cr review approve <id>
- cr review request-changes <id> --message "..."
- cr label add <id> <label...>
- cr label remove <id> <label...>
- cr assign add <id> <user...>
- cr assign remove <id> <user...>
- cr open <id> # open in browser
- cr config edit
- cr cache sync

— Configuration
Default path:

- Linux: ~/.config/ProjectName/config.yaml
- macOS: ~/Library/Application Support/ProjectName/config.yaml
- Windows: %APPDATA%\ProjectName\config.yaml

Example (YAML):

```yaml
version: 0.1
default_provider: github
ui:
  theme: auto # light|dark|auto
  paging: true
  show_checks: true
keybindings:
  up: k
  down: j
  left: h
  right: l
  approve: a
  request_changes: r
  comment: c
  submit: s
  search: /
providers:
  - name: github-work
    type: github
    host: github.com
    # token is read from env if not in keychain
    token_env: GITHUB_TOKEN
    default_query:
      state: open
      review_requested: me
  - name: gitlab-self
    type: gitlab
    host: gitlab.company.internal
    base_url: https://gitlab.company.internal/api/v4
    token_env: GITLAB_TOKEN
repo_overrides:
  - path: ~/src/company/*
    default_provider: gitlab-self
```

— Authentication

- GitHub: Personal access token (classic) or fine-grained; scopes: repo, read:org
- GitLab: Personal access token; scopes: api
- Bitbucket: App password; scopes: pullrequest:read/write, repository:read
- Azure DevOps: PAT; scopes: Code (Read & Write), Work Items (optional)
- Storage: tokens are stored in OS keychain if available; otherwise read from env vars set in config (never stored in plaintext config)

— TUI keybindings (default)

- Navigation: j/k (up/down), h/l (left/right), Enter (open), q (back)
- Actions: a (approve), r (request changes), c (comment), e (edit), d (toggle diff view)
- Misc: / (search), s (switch provider/account), o (open in browser), ? (help)
- Hints shown in the status bar; all keys configurable

— Integrations

- Editor: set $EDITOR or configure editor.cmd; used to write long comments
- Browser: respects $BROWSER
- Git: used for checkout/fetch; requires git ≥ 2.30

— Roadmap

- v0.1: Read-only PR/MR list and detail view for GitHub
- v0.2: Commenting and approvals; basic diff viewer
- v0.3: GitLab support; checkout PR branches
- v0.4: Bitbucket and Azure DevOps support
- v0.5: Offline queue and conflict resolution
- v0.6: Advanced filters, custom queries, saved views

— Development

- Requirements: make, git, Go or Rust toolchain (TBD)
- Build: make build
- Test: make test
- Lint/Format: make lint fmt
- Run locally: CR_LOG=debug ./cr

— Contributing

- Open issues for bugs/ideas; PRs welcome
- Add tests for new features; follow existing coding style
- For providers, add adapters under pkg/providers/<name> and wire into the provider registry

— License
TBD (MIT/Apache-2.0). Add a LICENSE file before first release.

— Name
Replace ProjectName and cr with your final project name/command when decided.
