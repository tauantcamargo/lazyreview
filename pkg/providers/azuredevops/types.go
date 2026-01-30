package azuredevops

import "time"

// Azure DevOps API types

// adoProfile represents a user profile
type adoProfile struct {
	ID           string `json:"id"`
	DisplayName  string `json:"displayName"`
	EmailAddress string `json:"emailAddress"`
}

// adoIdentity represents a user identity
type adoIdentity struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	UniqueName  string `json:"uniqueName"`
	ImageURL    string `json:"imageUrl"`
}

// adoPullRequest represents an Azure DevOps pull request
type adoPullRequest struct {
	PullRequestID     int                   `json:"pullRequestId"`
	Title             string                `json:"title"`
	Description       string                `json:"description"`
	Status            string                `json:"status"` // active, abandoned, completed
	SourceRefName     string                `json:"sourceRefName"`
	TargetRefName     string                `json:"targetRefName"`
	CreatedBy         adoIdentity           `json:"createdBy"`
	CreationDate      time.Time             `json:"creationDate"`
	ClosedDate        *time.Time            `json:"closedDate,omitempty"`
	MergeStatus       string                `json:"mergeStatus"` // succeeded, conflicts, queued, notSet
	IsDraft           bool                  `json:"isDraft"`
	URL               string                `json:"url"`
	Repository        adoRepository         `json:"repository"`
	Reviewers         []adoReviewer         `json:"reviewers"`
	Labels            []adoLabel            `json:"labels"`
	CompletionOptions *adoCompletionOptions `json:"completionOptions,omitempty"`
}

// adoRepository represents a repository
type adoRepository struct {
	ID      string     `json:"id"`
	Name    string     `json:"name"`
	URL     string     `json:"url"`
	Project adoProject `json:"project"`
}

// adoProject represents a project
type adoProject struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// adoReviewer represents a PR reviewer
type adoReviewer struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	UniqueName  string `json:"uniqueName"`
	ImageURL    string `json:"imageUrl"`
	Vote        int    `json:"vote"` // -10: rejected, -5: waiting, 0: no response, 5: approved with suggestions, 10: approved
	IsRequired  bool   `json:"isRequired"`
}

// adoLabel represents a label
type adoLabel struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Active bool   `json:"active"`
}

// adoCompletionOptions represents merge completion options
type adoCompletionOptions struct {
	MergeCommitMessage  string `json:"mergeCommitMessage,omitempty"`
	DeleteSourceBranch  bool   `json:"deleteSourceBranch"`
	SquashMerge         bool   `json:"squashMerge"`
	BypassPolicy        bool   `json:"bypassPolicy"`
	TransitionWorkItems bool   `json:"transitionWorkItems"`
}

// adoIterationChange represents a change in a PR iteration
type adoIterationChange struct {
	ChangeID     int           `json:"changeId"`
	ChangeType   string        `json:"changeType"` // add, edit, delete, rename
	Item         adoChangeItem `json:"item"`
	OriginalPath string        `json:"originalPath,omitempty"`
}

// adoChangeItem represents a changed item
type adoChangeItem struct {
	Path string `json:"path"`
}

// adoThread represents a comment thread
type adoThread struct {
	ID              int               `json:"id"`
	Status          string            `json:"status"` // active, fixed, wontFix, closed, byDesign, pending
	Comments        []adoComment      `json:"comments"`
	ThreadContext   *adoThreadContext `json:"threadContext,omitempty"`
	PublishedDate   time.Time         `json:"publishedDate"`
	LastUpdatedDate time.Time         `json:"lastUpdatedDate"`
	IsDeleted       bool              `json:"isDeleted"`
}

// adoThreadContext represents the context of a comment thread
type adoThreadContext struct {
	FilePath       string           `json:"filePath"`
	RightFileStart *adoFilePosition `json:"rightFileStart,omitempty"`
	RightFileEnd   *adoFilePosition `json:"rightFileEnd,omitempty"`
}

// adoFilePosition represents a position in a file
type adoFilePosition struct {
	Line   int `json:"line"`
	Offset int `json:"offset"`
}

// adoComment represents a comment
type adoComment struct {
	ID                     int         `json:"id"`
	ParentCommentID        int         `json:"parentCommentId"`
	Author                 adoIdentity `json:"author"`
	Content                string      `json:"content"`
	PublishedDate          time.Time   `json:"publishedDate"`
	LastUpdatedDate        time.Time   `json:"lastUpdatedDate"`
	LastContentUpdatedDate time.Time   `json:"lastContentUpdatedDate"`
	CommentType            string      `json:"commentType"` // text, codeChange, system
	IsDeleted              bool        `json:"isDeleted"`
}

// adoPaginatedResponse is the paginated response wrapper
type adoPaginatedResponse[T any] struct {
	Value []T `json:"value"`
	Count int `json:"count"`
}
