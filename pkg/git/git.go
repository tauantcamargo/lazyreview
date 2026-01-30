package git

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// GitContext contains information about the current Git repository
type GitContext struct {
	IsGitRepo     bool
	RootPath      string
	CurrentBranch string
	Remotes       []Remote
}

// Remote represents a Git remote with parsed metadata
type Remote struct {
	Name     string // "origin"
	URL      string // "git@github.com:owner/repo.git"
	Provider string // "github", "gitlab", "bitbucket", "azuredevops"
	Owner    string // "owner"
	Repo     string // "repo"
	Host     string // "github.com"
}

// DetectGitContext checks if the current working directory is a Git repository
// and extracts repository information
func DetectGitContext() (*GitContext, error) {
	ctx := &GitContext{
		IsGitRepo: false,
	}

	// Check if this is a git repository
	rootPath, err := getGitRoot()
	if err != nil {
		// Not a git repo or git not installed
		return ctx, nil
	}

	ctx.IsGitRepo = true
	ctx.RootPath = rootPath

	// Get current branch
	branch, err := GetCurrentBranch()
	if err == nil {
		ctx.CurrentBranch = branch
	}

	// Get remotes
	remotes, err := GetRemotes()
	if err == nil {
		ctx.Remotes = remotes
	}

	return ctx, nil
}

// GetRemotes returns all Git remotes for the current repository
func GetRemotes() ([]Remote, error) {
	cmd := exec.Command("git", "remote", "-v")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get git remotes: %w", err)
	}

	return parseRemotes(string(output))
}

// GetCurrentBranch returns the current branch name
func GetCurrentBranch() (string, error) {
	cmd := exec.Command("git", "branch", "--show-current")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get current branch: %w", err)
	}

	branch := strings.TrimSpace(string(output))
	if branch == "" {
		return "", fmt.Errorf("not on a branch (detached HEAD?)")
	}

	return branch, nil
}

// getGitRoot returns the root path of the Git repository
func getGitRoot() (string, error) {
	cmd := exec.Command("git", "rev-parse", "--show-toplevel")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("not a git repository: %w", err)
	}

	rootPath := strings.TrimSpace(string(output))
	if rootPath == "" {
		return "", fmt.Errorf("empty git root path")
	}

	// Resolve to absolute path
	absPath, err := filepath.Abs(rootPath)
	if err != nil {
		return rootPath, nil
	}

	return absPath, nil
}

// parseRemotes parses the output of `git remote -v`
func parseRemotes(output string) ([]Remote, error) {
	lines := strings.Split(output, "\n")
	remoteMap := make(map[string]string) // name -> URL

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Format: "origin  git@github.com:owner/repo.git (fetch)"
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}

		remoteName := parts[0]
		remoteURL := parts[1]

		// Only process fetch URLs (skip push)
		if len(parts) >= 3 && parts[2] == "(fetch)" {
			remoteMap[remoteName] = remoteURL
		} else if len(parts) == 2 {
			// If no (fetch)/(push), still use it
			remoteMap[remoteName] = remoteURL
		}
	}

	// Parse each remote URL
	remotes := make([]Remote, 0, len(remoteMap))
	for name, url := range remoteMap {
		remote, err := ParseRemoteURL(url)
		if err != nil {
			// Skip remotes we can't parse
			continue
		}
		remote.Name = name
		remotes = append(remotes, *remote)
	}

	return remotes, nil
}

// GetPrimaryRemote returns the most likely primary remote
// Priority: origin > upstream > first available
func (ctx *GitContext) GetPrimaryRemote() *Remote {
	if len(ctx.Remotes) == 0 {
		return nil
	}

	// Look for "origin" first
	for i := range ctx.Remotes {
		if ctx.Remotes[i].Name == "origin" {
			return &ctx.Remotes[i]
		}
	}

	// Look for "upstream"
	for i := range ctx.Remotes {
		if ctx.Remotes[i].Name == "upstream" {
			return &ctx.Remotes[i]
		}
	}

	// Return first remote
	return &ctx.Remotes[0]
}

// GetRemoteByProvider returns the first remote matching the provider type
func (ctx *GitContext) GetRemoteByProvider(provider string) *Remote {
	for i := range ctx.Remotes {
		if ctx.Remotes[i].Provider == provider {
			return &ctx.Remotes[i]
		}
	}
	return nil
}

// IsInGitRepo checks if the current directory is inside a Git repository
func IsInGitRepo() bool {
	cmd := exec.Command("git", "rev-parse", "--is-inside-work-tree")
	output, err := cmd.Output()
	if err != nil {
		return false
	}

	result := strings.TrimSpace(string(output))
	return result == "true"
}

// GetWorkingDirectory returns the current working directory
func GetWorkingDirectory() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get working directory: %w", err)
	}
	return cwd, nil
}
