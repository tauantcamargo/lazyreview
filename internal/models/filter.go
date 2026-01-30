package models

import "time"

// PRFilter represents comprehensive filtering criteria for pull requests
type PRFilter struct {
	// State filters
	States []PullRequestState // open, closed, merged

	// Author filters
	Authors  []string
	AuthorMe bool // shortcut for current user

	// Assignee filters
	Assignees  []string
	AssigneeMe bool

	// Review filters
	ReviewRequested   []string
	ReviewRequestedMe bool
	ReviewDecision    []ReviewDecision

	// Label filters
	Labels        []string // include these
	ExcludeLabels []string // exclude these

	// Date filters
	CreatedAfter  *time.Time
	CreatedBefore *time.Time
	UpdatedAfter  *time.Time
	UpdatedBefore *time.Time

	// Other filters
	IsDraft      *bool
	HasConflicts *bool

	// Text search
	TitleContains string

	// Repository scope
	Repos []RepoRef // empty = all repos
}

// RepoRef identifies a repository
type RepoRef struct {
	ProviderType string
	Host         string
	Owner        string
	Repo         string
}

// FullName returns the owner/repo format
func (r RepoRef) FullName() string {
	return r.Owner + "/" + r.Repo
}

// UniqueKey returns a unique identifier for this repository
func (r RepoRef) UniqueKey() string {
	return r.ProviderType + ":" + r.Host + ":" + r.Owner + "/" + r.Repo
}

// IsEmpty returns true if the RepoRef is uninitialized
func (r RepoRef) IsEmpty() bool {
	return r.Owner == "" && r.Repo == ""
}

// FilterMyPRs creates a filter for PRs authored by the current user
func FilterMyPRs(username string) PRFilter {
	return PRFilter{
		States:   []PullRequestState{PRStateOpen},
		Authors:  []string{username},
		AuthorMe: true,
	}
}

// FilterNeedsMyReview creates a filter for PRs requesting review from the current user
func FilterNeedsMyReview(username string) PRFilter {
	return PRFilter{
		States:            []PullRequestState{PRStateOpen},
		ReviewRequested:   []string{username},
		ReviewRequestedMe: true,
	}
}

// FilterOpen creates a filter for all open PRs
func FilterOpen() PRFilter {
	return PRFilter{
		States: []PullRequestState{PRStateOpen},
	}
}

// FilterMerged creates a filter for all merged PRs
func FilterMerged() PRFilter {
	return PRFilter{
		States: []PullRequestState{PRStateMerged},
	}
}

// FilterClosed creates a filter for all closed (but not merged) PRs
func FilterClosed() PRFilter {
	return PRFilter{
		States: []PullRequestState{PRStateClosed},
	}
}

// FilterDrafts creates a filter for draft PRs
func FilterDrafts() PRFilter {
	isDraft := true
	return PRFilter{
		States:  []PullRequestState{PRStateOpen},
		IsDraft: &isDraft,
	}
}

// FilterWithConflicts creates a filter for PRs with merge conflicts
func FilterWithConflicts() PRFilter {
	hasConflicts := true
	return PRFilter{
		States:       []PullRequestState{PRStateOpen},
		HasConflicts: &hasConflicts,
	}
}

// FilterApproved creates a filter for approved PRs
func FilterApproved() PRFilter {
	return PRFilter{
		States:         []PullRequestState{PRStateOpen},
		ReviewDecision: []ReviewDecision{ReviewDecisionApproved},
	}
}

// FilterNeedsChanges creates a filter for PRs requesting changes
func FilterNeedsChanges() PRFilter {
	return PRFilter{
		States:         []PullRequestState{PRStateOpen},
		ReviewDecision: []ReviewDecision{ReviewDecisionChangesRequsted},
	}
}
