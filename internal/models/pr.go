package models

import "time"

// PullRequestState represents the state of a pull request
type PullRequestState string

const (
	PRStateOpen   PullRequestState = "open"
	PRStateClosed PullRequestState = "closed"
	PRStateMerged PullRequestState = "merged"
)

// PullRequest represents a pull request/merge request across all providers
type PullRequest struct {
	// ID is the provider-specific identifier
	ID string

	// Number is the PR number (e.g., #123)
	Number int

	// Title is the PR title
	Title string

	// Body is the PR description/body
	Body string

	// State is the current state (open, closed, merged)
	State PullRequestState

	// Author is the user who created the PR
	Author User

	// SourceBranch is the branch being merged from
	SourceBranch string

	// TargetBranch is the branch being merged into
	TargetBranch string

	// Repository is the repository this PR belongs to
	Repository Repository

	// IsDraft indicates if this is a draft PR
	IsDraft bool

	// Labels are the labels attached to this PR
	Labels []Label

	// Assignees are the users assigned to this PR
	Assignees []User

	// Reviewers are the users requested to review
	Reviewers []User

	// ReviewDecision is the overall review decision
	ReviewDecision ReviewDecision

	// MergeableState indicates if the PR can be merged
	MergeableState MergeableState

	// Additions is the number of lines added
	Additions int

	// Deletions is the number of lines deleted
	Deletions int

	// ChangedFiles is the number of files changed
	ChangedFiles int

	// CommitCount is the number of commits
	CommitCount int

	// ChecksStatus represents CI/CD check status
	ChecksStatus ChecksStatus

	// URL is the web URL for this PR
	URL string

	// CreatedAt is when the PR was created
	CreatedAt time.Time

	// UpdatedAt is when the PR was last updated
	UpdatedAt time.Time

	// MergedAt is when the PR was merged (if merged)
	MergedAt *time.Time

	// ClosedAt is when the PR was closed (if closed)
	ClosedAt *time.Time
}

// Repository represents a Git repository
type Repository struct {
	// ID is the provider-specific identifier
	ID string

	// Owner is the repository owner (user or org)
	Owner string

	// Name is the repository name
	Name string

	// FullName is owner/name
	FullName string

	// Description is the repository description
	Description string

	// URL is the web URL
	URL string

	// CloneURL is the HTTPS clone URL
	CloneURL string

	// DefaultBranch is the default branch name
	DefaultBranch string

	// IsPrivate indicates if the repo is private
	IsPrivate bool

	// IsFork indicates if this is a forked repository
	IsFork bool

	// OpenIssues is the count of open issues
	OpenIssues int

	// Stars is the number of stars/favorites
	Stars int

	// CreatedAt is when the repository was created
	CreatedAt time.Time

	// UpdatedAt is when the repository was last updated
	UpdatedAt time.Time

	// PushedAt is when the repository was last pushed to
	PushedAt time.Time
}

// Label represents a label on a PR
type Label struct {
	// ID is the provider-specific identifier
	ID string

	// Name is the label name
	Name string

	// Color is the hex color code (without #)
	Color string

	// Description is the label description
	Description string
}

// ReviewDecision represents the overall review decision
type ReviewDecision string

const (
	ReviewDecisionPending         ReviewDecision = "pending"
	ReviewDecisionApproved        ReviewDecision = "approved"
	ReviewDecisionChangesRequsted ReviewDecision = "changes_requested"
	ReviewDecisionReviewRequired  ReviewDecision = "review_required"
)

// MergeableState represents whether a PR can be merged
type MergeableState string

const (
	MergeableStateMergeable   MergeableState = "mergeable"
	MergeableStateConflicting MergeableState = "conflicting"
	MergeableStateUnknown     MergeableState = "unknown"
	MergeableStateBlocked     MergeableState = "blocked"
)

// ChecksStatus represents the status of CI/CD checks
type ChecksStatus string

const (
	ChecksStatusPending ChecksStatus = "pending"
	ChecksStatusPassing ChecksStatus = "passing"
	ChecksStatusFailing ChecksStatus = "failing"
	ChecksStatusNone    ChecksStatus = "none"
)

// PullRequestSummary is a lightweight representation for lists
type PullRequestSummary struct {
	ID             string
	Number         int
	Title          string
	Author         string
	State          PullRequestState
	ReviewDecision ReviewDecision
	ChecksStatus   ChecksStatus
	UpdatedAt      time.Time
	IsDraft        bool
}

// ToSummary converts a PullRequest to a PullRequestSummary
func (pr *PullRequest) ToSummary() PullRequestSummary {
	return PullRequestSummary{
		ID:             pr.ID,
		Number:         pr.Number,
		Title:          pr.Title,
		Author:         pr.Author.Login,
		State:          pr.State,
		ReviewDecision: pr.ReviewDecision,
		ChecksStatus:   pr.ChecksStatus,
		UpdatedAt:      pr.UpdatedAt,
		IsDraft:        pr.IsDraft,
	}
}
