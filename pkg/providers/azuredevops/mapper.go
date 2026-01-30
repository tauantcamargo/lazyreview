package azuredevops

import (
	"strconv"
	"strings"

	"lazyreview/internal/models"
)

// mapIdentity converts an Azure DevOps identity to our User model
func mapIdentity(identity *adoIdentity) *models.User {
	if identity == nil {
		return nil
	}
	return &models.User{
		ID:        identity.ID,
		Login:     identity.UniqueName,
		Name:      identity.DisplayName,
		AvatarURL: identity.ImageURL,
	}
}

// mapPullRequest converts an Azure DevOps PR to our PullRequest model
func mapPullRequest(pr *adoPullRequest) *models.PullRequest {
	if pr == nil {
		return nil
	}

	result := &models.PullRequest{
		ID:           strconv.Itoa(pr.PullRequestID),
		Number:       pr.PullRequestID,
		Title:        pr.Title,
		Body:         pr.Description,
		State:        mapPRState(pr.Status),
		SourceBranch: trimRefPrefix(pr.SourceRefName),
		TargetBranch: trimRefPrefix(pr.TargetRefName),
		Author:       *mapIdentity(&pr.CreatedBy),
		IsDraft:      pr.IsDraft,
		URL:          pr.URL,
		CreatedAt:    pr.CreationDate,
		Repository: models.Repository{
			ID:       pr.Repository.ID,
			Name:     pr.Repository.Name,
			Owner:    pr.Repository.Project.Name,
			FullName: pr.Repository.Project.Name + "/" + pr.Repository.Name,
		},
	}

	if pr.ClosedDate != nil {
		result.ClosedAt = pr.ClosedDate
		result.MergedAt = pr.ClosedDate // ADO doesn't distinguish merged vs closed
	}

	// Map reviewers and determine review status
	approvedCount := 0
	rejectedCount := 0
	for _, reviewer := range pr.Reviewers {
		result.Reviewers = append(result.Reviewers, *mapIdentity(&adoIdentity{
			ID:          reviewer.ID,
			DisplayName: reviewer.DisplayName,
			UniqueName:  reviewer.UniqueName,
			ImageURL:    reviewer.ImageURL,
		}))
		if reviewer.Vote >= 10 {
			approvedCount++
		} else if reviewer.Vote <= -10 {
			rejectedCount++
		}
	}

	// Determine review decision based on votes
	if rejectedCount > 0 {
		result.ReviewDecision = models.ReviewDecisionChangesRequsted
	} else if approvedCount == len(pr.Reviewers) && len(pr.Reviewers) > 0 {
		result.ReviewDecision = models.ReviewDecisionApproved
	} else if len(pr.Reviewers) > 0 {
		result.ReviewDecision = models.ReviewDecisionPending
	}

	// Map labels
	for _, label := range pr.Labels {
		if label.Active {
			result.Labels = append(result.Labels, models.Label{
				ID:   label.ID,
				Name: label.Name,
			})
		}
	}

	// Map mergeable state
	result.MergeableState = mapMergeStatus(pr.MergeStatus)

	return result
}

// mapPRState converts Azure DevOps status to our PullRequestState
func mapPRState(status string) models.PullRequestState {
	switch status {
	case "active":
		return models.PRStateOpen
	case "completed":
		return models.PRStateMerged
	case "abandoned":
		return models.PRStateClosed
	default:
		return models.PRStateOpen
	}
}

// mapMergeStatus converts Azure DevOps merge status to our MergeableState
func mapMergeStatus(status string) models.MergeableState {
	switch status {
	case "succeeded":
		return models.MergeableStateMergeable
	case "conflicts":
		return models.MergeableStateConflicting
	case "queued":
		return models.MergeableStateUnknown
	default:
		return models.MergeableStateUnknown
	}
}

// mapVoteToReviewState converts Azure DevOps vote to our ReviewState
func mapVoteToReviewState(vote int) models.ReviewState {
	switch {
	case vote >= 10:
		return models.ReviewStateApproved
	case vote >= 5:
		return models.ReviewStateApproved // Approved with suggestions
	case vote <= -10:
		return models.ReviewStateChangesRequested
	case vote <= -5:
		return models.ReviewStatePending // Waiting for author
	default:
		return models.ReviewStatePending
	}
}

// mapThread converts an Azure DevOps thread to our Comment model
func mapThread(thread *adoThread) *models.Comment {
	if thread == nil || len(thread.Comments) == 0 {
		return nil
	}

	firstComment := thread.Comments[0]

	c := &models.Comment{
		ID:        strconv.Itoa(thread.ID),
		Body:      firstComment.Content,
		Author:    *mapIdentity(&firstComment.Author),
		CreatedAt: firstComment.PublishedDate,
		UpdatedAt: firstComment.LastUpdatedDate,
	}

	if thread.ThreadContext != nil {
		c.Path = thread.ThreadContext.FilePath
		if thread.ThreadContext.RightFileStart != nil {
			c.Line = thread.ThreadContext.RightFileStart.Line
		}
	}

	return c
}

// trimRefPrefix removes refs/heads/ prefix from branch names
func trimRefPrefix(ref string) string {
	return strings.TrimPrefix(ref, "refs/heads/")
}
