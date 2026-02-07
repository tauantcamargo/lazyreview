# TypeScript + Ink Rewrite (Preview)

This folder tracks the in-progress TypeScript + React Ink rewrite of LazyReview.

## Quick Start

```bash
npm install
npm run dev
```

Start with a repo:

```bash
node apps/cli/dist/index.js start --provider github --repo owner/name
```

If no repo is provided, the TUI runs in demo mode with sample data.

Diffs are fetched from providers when available. Azure DevOps currently returns a header-only diff placeholder.

Large diffs are routed through a worker thread to keep the UI responsive.

## List PRs (Multi-provider)

```bash
export LAZYREVIEW_TOKEN=your_github_token
npm run build
node apps/cli/dist/index.js pr list --repo owner/name
```

Use filters:

```bash
node apps/cli/dist/index.js pr list --repo owner/name --state all --limit 50
```

Review actions:

```bash
node apps/cli/dist/index.js pr approve --repo owner/name --number 123 --body "LGTM"
node apps/cli/dist/index.js pr request-changes --repo owner/name --number 123 --body "Please update tests"
node apps/cli/dist/index.js pr comment --repo owner/name --number 123 --body "Note"
node apps/cli/dist/index.js pr comment --repo owner/name --number 123 --body "Inline note" --path src/app.ts --line 10 --side RIGHT
```

Azure DevOps format:

```bash
node apps/cli/dist/index.js pr list --provider azuredevops --repo org/project/repo
```

## Provider Auth

```bash
node apps/cli/dist/index.js auth login --provider github --token YOUR_TOKEN
node apps/cli/dist/index.js auth status --provider github
node apps/cli/dist/index.js auth logout --provider github
```

Bitbucket tokens should be in `username:app_password` format.

Tokens are stored in the OS keychain when available, with an encrypted file fallback.

## Config

```bash
node apps/cli/dist/index.js config path
node apps/cli/dist/index.js config show
node apps/cli/dist/index.js config edit
```

Sample provider config:

```yaml
default_provider: github
providers:
  - name: GitHub
    type: github
    host: github.com
    token_env: GITHUB_TOKEN
```

Notes:
`token_env`, `base_url`, and other snake_case keys are supported for compatibility.

## AI Provider

```bash
node apps/cli/dist/index.js ai login --provider openai --key YOUR_KEY
node apps/cli/dist/index.js ai status --provider openai
node apps/cli/dist/index.js ai logout --provider openai
```

## AI Summary / Review (TUI)

Open a diff view, then:

- Press `s` to generate an AI summary.
- Press `a` to generate an AI review preview.
- In the AI preview, press `e` to edit and `p` to post (review only).

If `ai.enabled` is set to `false` in config, the AI actions will be blocked.

## Theme

In the TUI, press `t` to open the theme picker. Supported themes: `lazygit`, `darcula`, `tokyonight`, `gruvbox`, `catppuccin`, `auto`.

## Offline Queue (SQLite)

```bash
node apps/cli/dist/index.js queue enqueue --type comment --provider github --host github.com --owner owner --repo name --pr 1 --payload '{"body":"hello"}'
node apps/cli/dist/index.js queue list
node apps/cli/dist/index.js queue sync
```

Supported queue types: `comment`, `approve`, `request_changes`, `review_comment`.

Comment payload supports `body`, `path`, `line`, `side`, `startLine`, `commitId`.

## Benchmarks

```bash
npm run bench
```

## Packaging

```bash
npm run build
npm run pkg
```

## Notes

- Provider support beyond GitHub is not implemented yet.
- Packaging with `pkg` is not yet verified.
