package git_test

import (
	"fmt"
	"lazyreview/pkg/git"
)

func ExampleDetectGitContext() {
	ctx, err := git.DetectGitContext()
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}

	if !ctx.IsGitRepo {
		fmt.Println("Not a Git repository")
		return
	}

	fmt.Printf("Git repository detected\n")
	fmt.Printf("Root: %s\n", ctx.RootPath)
	fmt.Printf("Branch: %s\n", ctx.CurrentBranch)
	fmt.Printf("Remotes: %d\n", len(ctx.Remotes))

	if remote := ctx.GetPrimaryRemote(); remote != nil {
		fmt.Printf("Primary remote: %s (%s/%s on %s)\n",
			remote.Name, remote.Owner, remote.Repo, remote.Provider)
	}
}

func ExampleParseRemoteURL() {
	urls := []string{
		"git@github.com:owner/repo.git",
		"https://github.com/owner/repo.git",
		"https://gitlab.com/group/subgroup/repo.git",
		"git@bitbucket.org:workspace/repo.git",
		"https://dev.azure.com/org/project/_git/repo",
	}

	for _, url := range urls {
		remote, err := git.ParseRemoteURL(url)
		if err != nil {
			fmt.Printf("Error parsing %s: %v\n", url, err)
			continue
		}
		fmt.Printf("%s -> %s/%s on %s\n", url, remote.Owner, remote.Repo, remote.Provider)
	}
	// Output:
	// git@github.com:owner/repo.git -> owner/repo on github
	// https://github.com/owner/repo.git -> owner/repo on github
	// https://gitlab.com/group/subgroup/repo.git -> group/subgroup/repo on gitlab
	// git@bitbucket.org:workspace/repo.git -> workspace/repo on bitbucket
	// https://dev.azure.com/org/project/_git/repo -> org/project/repo on azuredevops
}
