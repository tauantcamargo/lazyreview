package models

import "time"

// ReviewState represents the state of a review
type ReviewState string

const (
	ReviewStatePending          ReviewState = "pending"
	ReviewStateApproved         ReviewState = "approved"
	ReviewStateChangesRequested ReviewState = "changes_requested"
	ReviewStateCommented        ReviewState = "commented"
	ReviewStateDismissed        ReviewState = "dismissed"
)

// Review represents a code review on a pull request
type Review struct {
	// ID is the provider-specific identifier
	ID string

	// Author is the user who submitted the review
	Author User

	// State is the review state
	State ReviewState

	// Body is the review summary comment
	Body string

	// SubmittedAt is when the review was submitted
	SubmittedAt time.Time

	// URL is the web URL to the review
	URL string

	// Comments are the inline comments in this review
	Comments []Comment
}

// ReviewInput represents input for creating a review
type ReviewInput struct {
	// Event is the review action (APPROVE, REQUEST_CHANGES, COMMENT)
	Event ReviewEvent

	// Body is the review summary comment
	Body string

	// Comments are inline comments to add
	Comments []CommentInput
}

// ReviewEvent represents the type of review being submitted
type ReviewEvent string

const (
	ReviewEventApprove        ReviewEvent = "APPROVE"
	ReviewEventRequestChanges ReviewEvent = "REQUEST_CHANGES"
	ReviewEventComment        ReviewEvent = "COMMENT"
)

// ReviewSummary is a lightweight representation for display
type ReviewSummary struct {
	ID          string
	Author      string
	State       ReviewState
	SubmittedAt time.Time
}

// ToSummary converts a Review to a ReviewSummary
func (r *Review) ToSummary() ReviewSummary {
	return ReviewSummary{
		ID:          r.ID,
		Author:      r.Author.Login,
		State:       r.State,
		SubmittedAt: r.SubmittedAt,
	}
}
