package providers

import (
	"context"

	"lazyreview/internal/models"
)

// Provider defines the interface for interacting with Git providers
// All provider implementations (GitHub, GitLab, Bitbucket, Azure DevOps) must implement this interface
type Provider interface {
	// Authentication

	// Authenticate validates and stores the authentication token
	Authenticate(ctx context.Context, token string) error

	// ValidateToken checks if the current token is valid
	ValidateToken(ctx context.Context) (bool, error)

	// GetCurrentUser returns the authenticated user
	GetCurrentUser(ctx context.Context) (*models.User, error)

	// Pull Request Operations

	// ListPullRequests returns pull requests matching the given options
	ListPullRequests(ctx context.Context, owner, repo string, opts ListOptions) ([]models.PullRequest, error)

	// GetPullRequest returns a single pull request by number
	GetPullRequest(ctx context.Context, owner, repo string, number int) (*models.PullRequest, error)

	// GetPullRequestDiff returns the diff for a pull request
	GetPullRequestDiff(ctx context.Context, owner, repo string, number int) (*models.Diff, error)

	// GetPullRequestFiles returns the list of changed files
	GetPullRequestFiles(ctx context.Context, owner, repo string, number int) ([]models.FileChange, error)

	// Review Operations

	// ListReviews returns all reviews for a pull request
	ListReviews(ctx context.Context, owner, repo string, number int) ([]models.Review, error)

	// CreateReview submits a new review
	CreateReview(ctx context.Context, owner, repo string, number int, review models.ReviewInput) error

	// ApproveReview approves a pull request
	ApproveReview(ctx context.Context, owner, repo string, number int, body string) error

	// RequestChanges requests changes on a pull request
	RequestChanges(ctx context.Context, owner, repo string, number int, body string) error

	// Comment Operations

	// ListComments returns all comments for a pull request
	ListComments(ctx context.Context, owner, repo string, number int) ([]models.Comment, error)

	// CreateComment creates a new comment
	CreateComment(ctx context.Context, owner, repo string, number int, comment models.CommentInput) error

	// ReplyToComment replies to an existing comment
	ReplyToComment(ctx context.Context, owner, repo string, number int, commentID string, body string) error

	// ResolveComment marks a comment thread as resolved (if supported)
	ResolveComment(ctx context.Context, owner, repo string, number int, commentID string) error

	// PR Actions

	// MergePullRequest merges a pull request
	MergePullRequest(ctx context.Context, owner, repo string, number int, opts MergeOptions) error

	// ClosePullRequest closes a pull request without merging
	ClosePullRequest(ctx context.Context, owner, repo string, number int) error

	// ReopenPullRequest reopens a closed pull request
	ReopenPullRequest(ctx context.Context, owner, repo string, number int) error

	// Labels and Assignees

	// AddLabels adds labels to a pull request
	AddLabels(ctx context.Context, owner, repo string, number int, labels []string) error

	// RemoveLabel removes a label from a pull request
	RemoveLabel(ctx context.Context, owner, repo string, number int, label string) error

	// AddAssignees adds assignees to a pull request
	AddAssignees(ctx context.Context, owner, repo string, number int, assignees []string) error

	// RemoveAssignees removes assignees from a pull request
	RemoveAssignees(ctx context.Context, owner, repo string, number int, assignees []string) error

	// AddReviewers requests reviews from users
	AddReviewers(ctx context.Context, owner, repo string, number int, reviewers []string) error

	// Metadata

	// Name returns the configured name for this provider instance
	Name() string

	// Type returns the provider type
	Type() ProviderType

	// BaseURL returns the API base URL
	BaseURL() string

	// Host returns the provider host
	Host() string
}
