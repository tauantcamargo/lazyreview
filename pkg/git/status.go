package git

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

// BranchStatus summarizes the local branch state.
type BranchStatus struct {
	Branch   string
	Upstream string
	Ahead    int
	Behind   int
	Dirty    bool
}

// GetBranchStatus returns the current branch status for the working directory.
func GetBranchStatus() (*BranchStatus, error) {
	branch, err := GetCurrentBranch()
	if err != nil {
		return nil, err
	}

	dirty, err := isWorkingTreeDirty("")
	if err != nil {
		return nil, err
	}

	upstream, _ := getUpstream("")
	ahead := 0
	behind := 0
	if upstream != "" {
		ahead, behind, _ = getAheadBehind("", upstream)
	}

	return &BranchStatus{
		Branch:   branch,
		Upstream: upstream,
		Ahead:    ahead,
		Behind:   behind,
		Dirty:    dirty,
	}, nil
}

func isWorkingTreeDirty(rootDir string) (bool, error) {
	cmd := exec.Command("git", "status", "--porcelain")
	if rootDir != "" {
		cmd.Dir = rootDir
	}
	output, err := cmd.Output()
	if err != nil {
		return false, fmt.Errorf("failed to get git status: %w", err)
	}
	return strings.TrimSpace(string(output)) != "", nil
}

func getUpstream(rootDir string) (string, error) {
	cmd := exec.Command("git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
	if rootDir != "" {
		cmd.Dir = rootDir
	}
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}

func getAheadBehind(rootDir, upstream string) (int, int, error) {
	cmd := exec.Command("git", "rev-list", "--left-right", "--count", "HEAD..."+upstream)
	if rootDir != "" {
		cmd.Dir = rootDir
	}
	output, err := cmd.Output()
	if err != nil {
		return 0, 0, err
	}
	parts := strings.Fields(strings.TrimSpace(string(output)))
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("unexpected ahead/behind output: %s", strings.TrimSpace(string(output)))
	}
	ahead, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, fmt.Errorf("failed to parse ahead count: %w", err)
	}
	behind, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, fmt.Errorf("failed to parse behind count: %w", err)
	}
	return ahead, behind, nil
}
