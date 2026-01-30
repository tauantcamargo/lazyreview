package providers

import "lazyreview/internal/models"

// ProviderType represents the type of Git provider
type ProviderType string

const (
	ProviderTypeGitHub      ProviderType = "github"
	ProviderTypeGitLab      ProviderType = "gitlab"
	ProviderTypeBitbucket   ProviderType = "bitbucket"
	ProviderTypeAzureDevOps ProviderType = "azuredevops"
)

// ListOptions contains options for listing pull requests
type ListOptions struct {
	// State filters by PR state (open, closed, all)
	State models.PullRequestState

	// Author filters by PR author
	Author string

	// Assignee filters by assignee
	Assignee string

	// ReviewRequested filters to PRs where review is requested
	ReviewRequested string

	// Labels filters by labels (comma-separated)
	Labels []string

	// Search is a search query string
	Search string

	// Sort specifies the sort field
	Sort SortField

	// Direction specifies sort direction
	Direction SortDirection

	// PerPage is the number of results per page
	PerPage int

	// Page is the page number (1-indexed)
	Page int
}

// SortField represents fields that can be sorted on
type SortField string

const (
	SortByCreated   SortField = "created"
	SortByUpdated   SortField = "updated"
	SortByPopularity SortField = "popularity"
	SortByLongRunning SortField = "long-running"
)

// SortDirection represents sort direction
type SortDirection string

const (
	SortAsc  SortDirection = "asc"
	SortDesc SortDirection = "desc"
)

// MergeOptions contains options for merging a pull request
type MergeOptions struct {
	// Method is the merge method to use
	Method MergeMethod

	// CommitTitle is the title for the merge commit
	CommitTitle string

	// CommitMessage is the message for the merge commit
	CommitMessage string

	// SHA is the expected head SHA (for optimistic concurrency)
	SHA string

	// DeleteBranch indicates whether to delete the source branch after merge
	DeleteBranch bool
}

// MergeMethod represents the method used to merge a PR
type MergeMethod string

const (
	MergeMethodMerge  MergeMethod = "merge"
	MergeMethodSquash MergeMethod = "squash"
	MergeMethodRebase MergeMethod = "rebase"
)

// DefaultListOptions returns sensible defaults for listing PRs
func DefaultListOptions() ListOptions {
	return ListOptions{
		State:     models.PRStateOpen,
		Sort:      SortByUpdated,
		Direction: SortDesc,
		PerPage:   30,
		Page:      1,
	}
}

// DefaultMergeOptions returns sensible defaults for merging
func DefaultMergeOptions() MergeOptions {
	return MergeOptions{
		Method:       MergeMethodMerge,
		DeleteBranch: false,
	}
}

// ListResult wraps a list response with pagination info
type ListResult[T any] struct {
	Items      []T
	TotalCount int
	HasMore    bool
	NextPage   int
}
