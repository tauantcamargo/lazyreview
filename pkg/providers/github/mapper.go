package github

import (
	"strconv"
	"time"

	"lazyreview/internal/models"
	"lazyreview/pkg/providers"

	"github.com/google/go-github/v60/github"
)

// mapPullRequest converts a GitHub PR to our internal model
func mapPullRequest(pr *github.PullRequest) *models.PullRequest {
	if pr == nil {
		return nil
	}

	result := &models.PullRequest{
		ID:           toString(pr.NodeID),
		Number:       toInt(pr.Number),
		Title:        toString(pr.Title),
		Body:         toString(pr.Body),
		State:        mapPRState(pr),
		IsDraft:      toBool(pr.Draft),
		SourceBranch: pr.Head.GetRef(),
		HeadSHA:      pr.Head.GetSHA(),
		TargetBranch: pr.Base.GetRef(),
		Additions:    toInt(pr.Additions),
		Deletions:    toInt(pr.Deletions),
		ChangedFiles: toInt(pr.ChangedFiles),
		URL:          toString(pr.HTMLURL),
		CreatedAt:    toTime(pr.CreatedAt),
		UpdatedAt:    toTime(pr.UpdatedAt),
	}

	// Author
	if pr.User != nil {
		result.Author = *mapUser(pr.User)
	}

	// Repository
	if pr.Base != nil && pr.Base.Repo != nil {
		result.Repository = mapRepository(pr.Base.Repo)
	}

	// Labels
	for _, label := range pr.Labels {
		result.Labels = append(result.Labels, mapLabel(label))
	}

	// Assignees
	for _, assignee := range pr.Assignees {
		if user := mapUser(assignee); user != nil {
			result.Assignees = append(result.Assignees, *user)
		}
	}

	// Reviewers
	for _, reviewer := range pr.RequestedReviewers {
		if user := mapUser(reviewer); user != nil {
			result.Reviewers = append(result.Reviewers, *user)
		}
	}

	// Merged/Closed times
	if pr.MergedAt != nil {
		t := pr.MergedAt.Time
		result.MergedAt = &t
	}
	if pr.ClosedAt != nil {
		t := pr.ClosedAt.Time
		result.ClosedAt = &t
	}

	// Mergeable state
	if pr.Mergeable != nil {
		if *pr.Mergeable {
			result.MergeableState = models.MergeableStateMergeable
		} else {
			result.MergeableState = models.MergeableStateConflicting
		}
	} else {
		result.MergeableState = models.MergeableStateUnknown
	}

	return result
}

// mapPRState converts GitHub PR state to our model
func mapPRState(pr *github.PullRequest) models.PullRequestState {
	if pr.MergedAt != nil {
		return models.PRStateMerged
	}
	if pr.State != nil {
		switch *pr.State {
		case "open":
			return models.PRStateOpen
		case "closed":
			return models.PRStateClosed
		}
	}
	return models.PRStateOpen
}

// mapRepository converts a GitHub repo to our model
func mapRepository(repo *github.Repository) models.Repository {
	return models.Repository{
		ID:            toString(repo.NodeID),
		Owner:         toString(repo.Owner.Login),
		Name:          toString(repo.Name),
		FullName:      toString(repo.FullName),
		Description:   toString(repo.Description),
		URL:           toString(repo.HTMLURL),
		CloneURL:      toString(repo.CloneURL),
		DefaultBranch: toString(repo.DefaultBranch),
		IsPrivate:     toBool(repo.Private),
		IsFork:        toBool(repo.Fork),
		OpenIssues:    toInt(repo.OpenIssuesCount),
		Stars:         toInt(repo.StargazersCount),
		CreatedAt:     toTime(repo.CreatedAt),
		UpdatedAt:     toTime(repo.UpdatedAt),
		PushedAt:      toTime(repo.PushedAt),
	}
}

// mapOrganization converts a GitHub organization to our model
func mapOrganization(org *github.Organization) providers.Organization {
	repoCount := 0
	if org.TotalPrivateRepos != nil {
		repoCount += int(*org.TotalPrivateRepos)
	}
	if org.PublicRepos != nil {
		repoCount += *org.PublicRepos
	}

	return providers.Organization{
		ID:          toString(org.NodeID),
		Login:       toString(org.Login),
		Name:        toString(org.Name),
		Description: toString(org.Description),
		AvatarURL:   toString(org.AvatarURL),
		URL:         toString(org.HTMLURL),
		RepoCount:   repoCount,
	}
}

// mapUser converts a GitHub user to our model
func mapUser(user *github.User) *models.User {
	if user == nil {
		return nil
	}
	return &models.User{
		ID:        toString(user.NodeID),
		Login:     toString(user.Login),
		Name:      toString(user.Name),
		Email:     toString(user.Email),
		AvatarURL: toString(user.AvatarURL),
		URL:       toString(user.HTMLURL),
	}
}

// mapLabel converts a GitHub label to our model
func mapLabel(label *github.Label) models.Label {
	return models.Label{
		ID:          toString(label.NodeID),
		Name:        toString(label.Name),
		Color:       toString(label.Color),
		Description: toString(label.Description),
	}
}

// mapReview converts a GitHub review to our model
func mapReview(review *github.PullRequestReview) *models.Review {
	if review == nil {
		return nil
	}

	result := &models.Review{
		ID:          toString(review.NodeID),
		State:       mapReviewState(toString(review.State)),
		Body:        toString(review.Body),
		URL:         toString(review.HTMLURL),
		SubmittedAt: toTime(review.SubmittedAt),
	}

	if review.User != nil {
		result.Author = *mapUser(review.User)
	}

	return result
}

// mapReviewState converts GitHub review state to our model
func mapReviewState(state string) models.ReviewState {
	switch state {
	case "APPROVED":
		return models.ReviewStateApproved
	case "CHANGES_REQUESTED":
		return models.ReviewStateChangesRequested
	case "COMMENTED":
		return models.ReviewStateCommented
	case "DISMISSED":
		return models.ReviewStateDismissed
	case "PENDING":
		return models.ReviewStatePending
	default:
		return models.ReviewStatePending
	}
}

// mapComment converts a GitHub comment to our model
func mapComment(comment *github.PullRequestComment) *models.Comment {
	if comment == nil {
		return nil
	}

	result := &models.Comment{
		ID:        strconv.FormatInt(comment.GetID(), 10),
		Type:      models.CommentTypeInline,
		Body:      toString(comment.Body),
		Path:      toString(comment.Path),
		Line:      toInt(comment.Line),
		CreatedAt: toTime(comment.CreatedAt),
		UpdatedAt: toTime(comment.UpdatedAt),
		URL:       toString(comment.HTMLURL),
	}

	if comment.User != nil {
		result.Author = *mapUser(comment.User)
	}

	// Map side
	if comment.Side != nil {
		if *comment.Side == "RIGHT" {
			result.Side = models.DiffSideRight
		} else {
			result.Side = models.DiffSideLeft
		}
	}

	// Map reply
	if comment.InReplyTo != nil {
		result.InReplyTo = strconv.FormatInt(*comment.InReplyTo, 10)
	}

	return result
}

// mapIssueComment converts a GitHub issue comment to our model
func mapIssueComment(comment *github.IssueComment) *models.Comment {
	if comment == nil {
		return nil
	}

	result := &models.Comment{
		ID:        strconv.FormatInt(comment.GetID(), 10),
		Type:      models.CommentTypeGeneral,
		Body:      toString(comment.Body),
		CreatedAt: toTime(comment.CreatedAt),
		UpdatedAt: toTime(comment.UpdatedAt),
		URL:       toString(comment.HTMLURL),
	}

	if comment.User != nil {
		result.Author = *mapUser(comment.User)
	}

	return result
}

// mapFileChange converts a GitHub commit file to our model
func mapFileChange(file *github.CommitFile) *models.FileChange {
	if file == nil {
		return nil
	}

	return &models.FileChange{
		Filename:         toString(file.Filename),
		PreviousFilename: toString(file.PreviousFilename),
		Status:           mapFileStatus(toString(file.Status)),
		Additions:        toInt(file.Additions),
		Deletions:        toInt(file.Deletions),
		Changes:          toInt(file.Changes),
		Patch:            toString(file.Patch),
		SHA:              toString(file.SHA),
		ContentsURL:      toString(file.ContentsURL),
	}
}

// mapFileStatus converts GitHub file status to our model
func mapFileStatus(status string) models.FileStatus {
	switch status {
	case "added":
		return models.FileStatusAdded
	case "modified":
		return models.FileStatusModified
	case "removed":
		return models.FileStatusDeleted
	case "renamed":
		return models.FileStatusRenamed
	case "copied":
		return models.FileStatusCopied
	default:
		return models.FileStatusModified
	}
}

// Helper functions for safe pointer dereferencing

func toString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func toInt(i *int) int {
	if i == nil {
		return 0
	}
	return *i
}

func toBool(b *bool) bool {
	if b == nil {
		return false
	}
	return *b
}

func toTime(t *github.Timestamp) time.Time {
	if t == nil {
		return time.Time{}
	}
	return t.Time
}

// Provider User type alias for auth validation
type User = models.User
