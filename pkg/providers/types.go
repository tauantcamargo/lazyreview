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

// Organization represents a GitHub/GitLab organization or Bitbucket workspace
type Organization struct {
	// ID is the provider-specific identifier
	ID string

	// Login is the organization username (e.g., "my-company")
	Login string

	// Name is the display name (e.g., "My Company Inc.")
	Name string

	// Description is the organization description
	Description string

	// AvatarURL is the URL to the organization avatar/logo
	AvatarURL string

	// URL is the web URL to the organization
	URL string

	// RepoCount is the number of repositories in the organization
	RepoCount int
}

// ListReposOptions contains options for listing repositories
type ListReposOptions struct {
	// Type filters repositories by type
	// Valid values: "all", "public", "private", "forks", "sources", "member"
	Type string

	// Affiliation filters by user affiliation
	// Valid values: "owner", "collaborator", "organization_member"
	Affiliation string

	// Sort specifies the sort field
	// Valid values: "created", "updated", "pushed", "full_name"
	Sort string

	// Direction specifies sort direction
	Direction SortDirection

	// PerPage is the number of results per page
	PerPage int

	// Page is the page number (1-indexed)
	Page int
}

// UserPROptions contains options for listing user pull requests across repositories
type UserPROptions struct {
	// Involvement filters by user involvement type
	// Valid values: "authored", "assigned", "review_requested", "mentioned", "all"
	Involvement string

	// State filters by PR state
	State models.PullRequestState

	// PerPage is the number of results per page
	PerPage int

	// Page is the page number (1-indexed)
	Page int
}

// DefaultListReposOptions returns sensible defaults for listing repositories
func DefaultListReposOptions() ListReposOptions {
	return ListReposOptions{
		Type:        "all",
		Affiliation: "owner,collaborator,organization_member",
		Sort:        "updated",
		Direction:   SortDesc,
		PerPage:     30,
		Page:        1,
	}
}

// DefaultUserPROptions returns sensible defaults for listing user PRs
func DefaultUserPROptions() UserPROptions {
	return UserPROptions{
		Involvement: "all",
		State:       models.PRStateOpen,
		PerPage:     30,
		Page:        1,
	}
}
