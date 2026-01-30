package gitlab

import (
	"context"
	"fmt"
	"strconv"

	"lazyreview/internal/models"
	"lazyreview/pkg/providers"

	gl "gitlab.com/gitlab-org/api/client-go"
)

// ListReviews returns all reviews/approvals for a merge request
func (p *Provider) ListReviews(ctx context.Context, owner, repo string, number int) ([]models.Review, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	// GitLab doesn't have a direct reviews API like GitHub
	// We use the approvals API instead
	approvals, _, err := p.client.MergeRequestApprovals.GetConfiguration(projectPath, int64(number), gl.WithContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to get approvals: %w", err)
	}

	reviews := make([]models.Review, 0)

	// Map approved_by users to reviews
	for _, approval := range approvals.ApprovedBy {
		review := models.Review{
			ID:    strconv.FormatInt(approval.User.ID, 10),
			State: models.ReviewStateApproved,
			Author: models.User{
				ID:        strconv.FormatInt(approval.User.ID, 10),
				Login:     approval.User.Username,
				Name:      approval.User.Name,
				AvatarURL: approval.User.AvatarURL,
			},
		}
		reviews = append(reviews, review)
	}

	return reviews, nil
}

// CreateReview creates a review (approval or request changes)
func (p *Provider) CreateReview(ctx context.Context, owner, repo string, number int, review models.ReviewInput) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	switch review.Event {
	case models.ReviewEventApprove:
		return p.ApproveReview(ctx, owner, repo, number, review.Body)
	case models.ReviewEventRequestChanges:
		return p.RequestChanges(ctx, owner, repo, number, review.Body)
	case models.ReviewEventComment:
		// Just add a comment
		return p.CreateComment(ctx, owner, repo, number, models.CommentInput{
			Body: review.Body,
		})
	}

	// If there are inline comments, add them
	for _, comment := range review.Comments {
		err := p.createDiffNote(ctx, projectPath, number, comment)
		if err != nil {
			return fmt.Errorf("failed to create diff note: %w", err)
		}
	}

	return nil
}

// ApproveReview approves a merge request
func (p *Provider) ApproveReview(ctx context.Context, owner, repo string, number int, body string) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	_, _, err := p.client.MergeRequestApprovals.ApproveMergeRequest(projectPath, int64(number), nil, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to approve merge request: %w", err)
	}

	// Add comment if body is provided
	if body != "" {
		err = p.CreateComment(ctx, owner, repo, number, models.CommentInput{
			Body: body,
		})
		if err != nil {
			return fmt.Errorf("failed to add approval comment: %w", err)
		}
	}

	return nil
}

// RequestChanges requests changes on a merge request
func (p *Provider) RequestChanges(ctx context.Context, owner, repo string, number int, body string) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	// GitLab doesn't have a direct "request changes" action
	// We can unapprove (if previously approved) and add a comment
	projectPath := owner + "/" + repo

	// Unapprove if previously approved
	_, err := p.client.MergeRequestApprovals.UnapproveMergeRequest(projectPath, int64(number), gl.WithContext(ctx))
	if err != nil {
		// Ignore errors - user may not have approved before
	}

	// Add comment explaining changes requested
	if body == "" {
		body = "Changes requested"
	}

	return p.CreateComment(ctx, owner, repo, number, models.CommentInput{
		Body: body,
	})
}

// ListComments returns all comments/notes for a merge request
func (p *Provider) ListComments(ctx context.Context, owner, repo string, number int) ([]models.Comment, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	notes, _, err := p.client.Notes.ListMergeRequestNotes(projectPath, int64(number), nil, gl.WithContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to list notes: %w", err)
	}

	comments := make([]models.Comment, 0, len(notes))
	for _, note := range notes {
		if note.System {
			continue // Skip system notes
		}
		comments = append(comments, *mapNote(note))
	}

	return comments, nil
}

// CreateComment creates a new comment on a merge request
func (p *Provider) CreateComment(ctx context.Context, owner, repo string, number int, comment models.CommentInput) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	// If it's a line comment, use diff notes
	if comment.Path != "" && comment.Line > 0 {
		return p.createDiffNote(ctx, projectPath, number, comment)
	}

	// Regular note
	_, _, err := p.client.Notes.CreateMergeRequestNote(projectPath, int64(number), &gl.CreateMergeRequestNoteOptions{
		Body: &comment.Body,
	}, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to create note: %w", err)
	}

	return nil
}

// createDiffNote creates a comment on a specific line of the diff
func (p *Provider) createDiffNote(ctx context.Context, projectPath string, number int, comment models.CommentInput) error {
	// Get the MR to find the diff refs
	mr, _, err := p.client.MergeRequests.GetMergeRequest(projectPath, int64(number), nil, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to get merge request: %w", err)
	}

	positionType := "text"
	position := &gl.PositionOptions{
		BaseSHA:      &mr.DiffRefs.BaseSha,
		StartSHA:     &mr.DiffRefs.StartSha,
		HeadSHA:      &mr.DiffRefs.HeadSha,
		PositionType: &positionType,
		NewPath:      &comment.Path,
		NewLine:      gl.Ptr(int64(comment.Line)),
	}

	_, _, err = p.client.Discussions.CreateMergeRequestDiscussion(projectPath, int64(number), &gl.CreateMergeRequestDiscussionOptions{
		Body:     &comment.Body,
		Position: position,
	}, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to create diff discussion: %w", err)
	}

	return nil
}

// ReplyToComment replies to an existing comment thread
func (p *Provider) ReplyToComment(ctx context.Context, owner, repo string, number int, commentID string, body string) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	// commentID is the discussion ID in GitLab
	_, _, err := p.client.Discussions.AddMergeRequestDiscussionNote(projectPath, int64(number), commentID, &gl.AddMergeRequestDiscussionNoteOptions{
		Body: &body,
	}, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to reply to discussion: %w", err)
	}

	return nil
}

// ResolveComment marks a comment thread as resolved
func (p *Provider) ResolveComment(ctx context.Context, owner, repo string, number int, commentID string) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	resolved := true
	_, _, err := p.client.Discussions.ResolveMergeRequestDiscussion(projectPath, int64(number), commentID, &gl.ResolveMergeRequestDiscussionOptions{
		Resolved: &resolved,
	}, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to resolve discussion: %w", err)
	}

	return nil
}
