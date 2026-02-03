package git

import (
	"fmt"
	"os/exec"
)

// CheckoutBranch fetches a remote branch and checks it out locally.
func CheckoutBranch(rootDir, remoteName, branch, localBranch string) error {
	if branch == "" {
		return fmt.Errorf("branch is empty")
	}
	if localBranch == "" {
		localBranch = branch
	}
	if remoteName == "" {
		remoteName = "origin"
	}

	dirty, err := isWorkingTreeDirty(rootDir)
	if err != nil {
		return err
	}
	if dirty {
		return fmt.Errorf("working tree has uncommitted changes")
	}

	if err := runGit(rootDir, "fetch", remoteName, branch); err != nil {
		return fmt.Errorf("failed to fetch %s/%s: %w", remoteName, branch, err)
	}

	if err := runGit(rootDir, "checkout", "-B", localBranch, "FETCH_HEAD"); err != nil {
		return fmt.Errorf("failed to checkout %s: %w", localBranch, err)
	}

	return nil
}

func runGit(rootDir string, args ...string) error {
	cmd := exec.Command("git", args...)
	if rootDir != "" {
		cmd.Dir = rootDir
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s", string(output))
	}
	return nil
}
