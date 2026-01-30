package bitbucket

import (
	"strconv"

	"lazyreview/internal/models"
)

// mapUser converts a Bitbucket user to our User model
func mapUser(user *bbUser) *models.User {
	if user == nil {
		return nil
	}
	return &models.User{
		ID:        user.UUID,
		Login:     user.Username,
		Name:      user.DisplayName,
		AvatarURL: user.Links.Avatar.Href,
	}
}

// mapPullRequest converts a Bitbucket PR to our PullRequest model
func mapPullRequest(pr *bbPullRequest, owner, repo string) *models.PullRequest {
	if pr == nil {
		return nil
	}

	result := &models.PullRequest{
		ID:           strconv.Itoa(pr.ID),
		Number:       pr.ID,
		Title:        pr.Title,
		Body:         pr.Description,
		State:        mapPRState(pr.State),
		SourceBranch: pr.Source.Branch.Name,
		TargetBranch: pr.Destination.Branch.Name,
		Author:       *mapUser(&pr.Author),
		URL:          pr.Links.HTML.Href,
		CreatedAt:    pr.CreatedOn,
		UpdatedAt:    pr.UpdatedOn,
		Repository: models.Repository{
			Owner:    owner,
			Name:     repo,
			FullName: owner + "/" + repo,
		},
	}

	// Map reviewers and determine review status
	approvedCount := 0
	for _, reviewer := range pr.Reviewers {
		result.Reviewers = append(result.Reviewers, *mapUser(&reviewer.User))
		if reviewer.Approved {
			approvedCount++
		}
	}

	// Determine review decision
	if len(pr.Reviewers) > 0 {
		if approvedCount == len(pr.Reviewers) {
			result.ReviewDecision = models.ReviewDecisionApproved
		} else if approvedCount > 0 {
			result.ReviewDecision = models.ReviewDecisionPending
		} else {
			result.ReviewDecision = models.ReviewDecisionReviewRequired
		}
	}

	return result
}

// mapPRState converts Bitbucket state to our PullRequestState
func mapPRState(state string) models.PullRequestState {
	switch state {
	case "OPEN":
		return models.PRStateOpen
	case "MERGED":
		return models.PRStateMerged
	case "DECLINED", "SUPERSEDED":
		return models.PRStateClosed
	default:
		return models.PRStateOpen
	}
}

// mapDiffStat converts a Bitbucket diff stat to our FileChange model
func mapDiffStat(stat *bbDiffStat) models.FileChange {
	fc := models.FileChange{
		Additions: stat.LinesAdded,
		Deletions: stat.LinesRemoved,
	}

	if stat.New != nil {
		fc.Filename = stat.New.Path
	}
	if stat.Old != nil {
		fc.PreviousFilename = stat.Old.Path
	}

	switch stat.Status {
	case "added":
		fc.Status = models.FileStatusAdded
	case "removed":
		fc.Status = models.FileStatusDeleted
	case "modified":
		fc.Status = models.FileStatusModified
	case "renamed":
		fc.Status = models.FileStatusRenamed
	default:
		fc.Status = models.FileStatusModified
	}

	return fc
}

// mapComment converts a Bitbucket comment to our Comment model
func mapComment(comment *bbComment) *models.Comment {
	if comment == nil {
		return nil
	}

	c := &models.Comment{
		ID:        strconv.Itoa(comment.ID),
		Body:      comment.Content.Raw,
		Author:    *mapUser(&comment.User),
		CreatedAt: comment.CreatedOn,
		UpdatedAt: comment.UpdatedOn,
	}

	if comment.Inline != nil {
		c.Path = comment.Inline.Path
		if comment.Inline.To != nil {
			c.Line = *comment.Inline.To
		}
	}

	return c
}
