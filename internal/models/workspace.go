package models

import "time"

// WorkspaceKind defines the type of workspace.
type WorkspaceKind string

const (
	WorkspaceKindAll       WorkspaceKind = "all"
	WorkspaceKindRecent    WorkspaceKind = "recent"
	WorkspaceKindFavorites WorkspaceKind = "favorites"
	WorkspaceKindMyPRs     WorkspaceKind = "my_prs"
	WorkspaceKindToReview  WorkspaceKind = "to_review"
	WorkspaceKindCustom    WorkspaceKind = "custom"
)

// Workspace groups repositories together.
type Workspace struct {
	ID          string
	Name        string
	Description string
	Repos       []RepoRef
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// WorkspaceTab represents a tab entry for workspace navigation.
type WorkspaceTab struct {
	ID          string
	Name        string
	Kind        WorkspaceKind
	WorkspaceID string
}
