package models

import "time"

// CommentType represents the type of comment
type CommentType string

const (
	// CommentTypeGeneral is a general PR comment (not on specific code)
	CommentTypeGeneral CommentType = "general"

	// CommentTypeInline is a comment on a specific line of code
	CommentTypeInline CommentType = "inline"

	// CommentTypeReview is a comment that's part of a review
	CommentTypeReview CommentType = "review"
)

// Comment represents a comment on a pull request
type Comment struct {
	// ID is the provider-specific identifier
	ID string

	// Type is the comment type
	Type CommentType

	// Author is the user who wrote the comment
	Author User

	// Body is the comment text
	Body string

	// Path is the file path (for inline comments)
	Path string

	// Line is the line number (for inline comments)
	Line int

	// Side indicates if the comment is on the old or new side of the diff
	Side DiffSide

	// StartLine is the start line for multi-line comments
	StartLine int

	// InReplyTo is the ID of the comment this is replying to
	InReplyTo string

	// IsResolved indicates if this comment thread is resolved
	IsResolved bool

	// IsOutdated indicates if the comment is on outdated code
	IsOutdated bool

	// CreatedAt is when the comment was created
	CreatedAt time.Time

	// UpdatedAt is when the comment was last updated
	UpdatedAt time.Time

	// URL is the web URL to the comment
	URL string

	// Replies are replies to this comment
	Replies []Comment
}

// DiffSide indicates which side of the diff a comment is on
type DiffSide string

const (
	DiffSideLeft  DiffSide = "LEFT"  // Old/removed code
	DiffSideRight DiffSide = "RIGHT" // New/added code
)

// CommentInput represents input for creating a comment
type CommentInput struct {
	// Body is the comment text
	Body string

	// Path is the file path (required for inline comments)
	Path string

	// Line is the line number (required for inline comments)
	Line int

	// Side is the diff side (required for inline comments)
	Side DiffSide

	// StartLine is the start line for multi-line comments
	StartLine int

	// CommitID is the SHA for the commit being commented on (provider-specific)
	CommitID string

	// InReplyTo is the ID of the comment to reply to
	InReplyTo string
}

// IsInline returns true if this is an inline comment
func (c *Comment) IsInline() bool {
	return c.Path != "" && c.Line > 0
}

// HasReplies returns true if this comment has replies
func (c *Comment) HasReplies() bool {
	return len(c.Replies) > 0
}

// ThreadLength returns the total number of comments in this thread
func (c *Comment) ThreadLength() int {
	return 1 + len(c.Replies)
}
