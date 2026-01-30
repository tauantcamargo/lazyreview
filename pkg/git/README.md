# Git Detection Package

This package provides Git repository detection and remote parsing for LazyReview.

## Features

- Detects if the current directory is inside a Git repository
- Extracts repository root path and current branch
- Parses Git remote URLs (SSH, HTTPS, and Git protocols)
- Supports multiple Git providers:
  - GitHub (github.com and GitHub Enterprise)
  - GitLab (gitlab.com and self-hosted)
  - Bitbucket (bitbucket.org)
  - Azure DevOps (dev.azure.com)

## Usage

### Detect Git Context

```go
import "lazyreview/pkg/git"

ctx, err := git.DetectGitContext()
if err != nil {
    // Handle error
}

if ctx.IsGitRepo {
    fmt.Printf("Repository: %s/%s\n", ctx.RootPath, ctx.CurrentBranch)

    // Get primary remote (prefers "origin", then "upstream")
    remote := ctx.GetPrimaryRemote()
    if remote != nil {
        fmt.Printf("Remote: %s/%s on %s\n",
            remote.Owner, remote.Repo, remote.Provider)
    }
}
```

### Parse Remote URLs

```go
remote, err := git.ParseRemoteURL("git@github.com:owner/repo.git")
if err != nil {
    // Handle error
}

fmt.Printf("Owner: %s\n", remote.Owner)
fmt.Printf("Repo: %s\n", remote.Repo)
fmt.Printf("Provider: %s\n", remote.Provider)
fmt.Printf("Host: %s\n", remote.Host)
```

## Supported URL Formats

### GitHub
```
git@github.com:owner/repo.git
https://github.com/owner/repo.git
```

### GitLab (with subgroups)
```
git@gitlab.com:group/subgroup/repo.git
https://gitlab.com/group/subgroup/repo.git
```

### Bitbucket
```
git@bitbucket.org:workspace/repo.git
https://bitbucket.org/workspace/repo.git
```

### Azure DevOps
```
https://dev.azure.com/organization/project/_git/repo
git@ssh.dev.azure.com:v3/organization/project/repo
```

## Integration with LazyReview

When you start LazyReview in a directory containing a Git repository, it will automatically:

1. Detect the repository root
2. Parse the remote URL (prefers "origin" remote)
3. Extract owner/repo information
4. Use this information to load pull requests from the correct repository

This means you can simply:

```bash
cd ~/projects/myrepo
lazyreview
```

And LazyReview will automatically show pull requests for `myrepo` without needing to configure anything.

## Testing

Run the tests:

```bash
go test ./pkg/git/...
```

Run with coverage:

```bash
go test -cover ./pkg/git/...
```
