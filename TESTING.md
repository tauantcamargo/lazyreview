# Testing LazyReview

## Prerequisites

1. **GitHub Authentication** - You need one of:
   - `GITHUB_TOKEN` environment variable set
   - GitHub CLI (`gh`) installed and authenticated (`gh auth login`)

2. **Node.js 20+** and **pnpm** installed

## Setup

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build
```

## Running the TUI

### Option 1: Specify a repo

```bash
# Run with owner/repo argument
pnpm start facebook/react
pnpm start vercel/next.js
pnpm start your-username/your-repo
```

### Option 2: Use environment variables

```bash
# Set default owner/repo
export LAZY_OWNER=facebook
export LAZY_REPO=react

# Run without arguments
pnpm start
```

### Option 3: Development mode

```bash
# Watch mode - rebuilds on file changes
pnpm dev

# In another terminal, run the app
pnpm start owner/repo
```

## Navigation

| Key | Action |
|-----|--------|
| `j` / `Down` | Move down |
| `k` / `Up` | Move up |
| `Enter` | Select / Open PR |
| `Tab` | Switch focus between sidebar and main panel |
| `b` | Toggle sidebar visibility |
| `1` / `2` / `3` | Switch PR detail tabs (Files, Comments, Timeline) |
| `q` | Back / Quit |
| `?` | Toggle help modal |
| `Ctrl+c` | Force quit |

## Screens to Test

### 1. Pull Requests List (default)
- Shows open PRs for the specified repo
- Navigate with `j`/`k`, select with `Enter`

### 2. My PRs
- Use sidebar (`Tab` to focus, `j`/`k` to navigate) to select "My PRs"
- Shows PRs you've created

### 3. Review Requests
- Shows PRs where your review is requested

### 4. Settings
- Displays current configuration
- Config file: `~/.config/lazyreview/config.yaml`

### 5. PR Detail View
- Select a PR to see details
- **Files tab** (`1`): Changed files with diff viewer
- **Comments tab** (`2`): PR comments
- **Timeline tab** (`3`): Review history

## Configuration

Create `~/.config/lazyreview/config.yaml`:

```yaml
provider: github
theme: tokyo-night  # or: dracula, catppuccin-mocha
defaultOwner: your-username
defaultRepo: your-repo
pageSize: 30
keybindings:
  toggleSidebar: b
  help: "?"
  quit: q
```

## Troubleshooting

### "No GitHub token found"
```bash
# Option 1: Set token directly
export GITHUB_TOKEN=ghp_your_token_here

# Option 2: Use GitHub CLI
gh auth login
```

### "Cannot find module" errors
```bash
# Rebuild the project
pnpm build
```

### Terminal rendering issues
- Ensure your terminal supports true color
- Try resizing your terminal window
- Minimum recommended size: 80x24

## Type Checking

```bash
pnpm typecheck
```

## Running Tests (when available)

```bash
pnpm test
pnpm test:watch
pnpm test:coverage
```
