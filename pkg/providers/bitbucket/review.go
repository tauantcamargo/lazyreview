package bitbucket

import (
	"context"
	"fmt"

	"lazyreview/internal/models"
	"lazyreview/pkg/providers"
)

// ListReviews returns all reviews/approvals for a pull request
func (p *Provider) ListReviews(ctx context.Context, owner, repo string, number int) ([]models.Review, error) {
	if p.username == "" {
		return nil, providers.ErrNotAuthenticated
	}

	// Get the PR to access participant info
	path := fmt.Sprintf("/repositories/%s/%s/pullrequests/%d", owner, repo, number)

	var pr bbPullRequest
	err := p.get(ctx, path, &pr)
	if err != nil {
		return nil, fmt.Errorf("failed to get pull request: %w", err)
	}

	reviews := make([]models.Review, 0)
	for _, participant := range pr.Participants {
		if participant.Role != "REVIEWER" {
			continue
		}

		state := models.ReviewStatePending
		if participant.Approved {
			state = models.ReviewStateApproved
		}

		reviews = append(reviews, models.Review{
			ID:     participant.User.UUID,
			State:  state,
			Author: *mapUser(&participant.User),
		})
	}

	return reviews, nil
}

// CreateReview creates a review (approval or request changes)
func (p *Provider) CreateReview(ctx context.Context, owner, repo string, number int, review models.ReviewInput) error {
	if p.username == "" {
		return providers.ErrNotAuthenticated
	}

	switch review.Event {
	case models.ReviewEventApprove:
		return p.ApproveReview(ctx, owner, repo, number, review.Body)
	case models.ReviewEventRequestChanges:
		return p.RequestChanges(ctx, owner, repo, number, review.Body)
	case models.ReviewEventComment:
		if review.Body != "" {
			return p.CreateComment(ctx, owner, repo, number, models.CommentInput{
				Body: review.Body,
			})
		}
	}

	// Create inline comments if any
	for _, comment := range review.Comments {
		err := p.CreateComment(ctx, owner, repo, number, comment)
		if err != nil {
			return fmt.Errorf("failed to create comment: %w", err)
		}
	}

	return nil
}

// ApproveReview approves a pull request
func (p *Provider) ApproveReview(ctx context.Context, owner, repo string, number int, body string) error {
	if p.username == "" {
		return providers.ErrNotAuthenticated
	}

	path := fmt.Sprintf("/repositories/%s/%s/pullrequests/%d/approve", owner, repo, number)
	err := p.post(ctx, path, nil, nil)
	if err != nil {
		return fmt.Errorf("failed to approve pull request: %w", err)
	}

	// Add comment if body provided
	if body != "" {
		return p.CreateComment(ctx, owner, repo, number, models.CommentInput{
			Body: body,
		})
	}

	return nil
}

// RequestChanges requests changes on a pull request
func (p *Provider) RequestChanges(ctx context.Context, owner, repo string, number int, body string) error {
	if p.username == "" {
		return providers.ErrNotAuthenticated
	}

	// Bitbucket doesn't have a direct "request changes" action
	// Unapprove if previously approved and add a comment
	path := fmt.Sprintf("/repositories/%s/%s/pullrequests/%d/approve", owner, repo, number)
	_ = p.delete(ctx, path) // Ignore error if not approved

	// Add comment explaining changes requested
	if body == "" {
		body = "Changes requested"
	}

	return p.CreateComment(ctx, owner, repo, number, models.CommentInput{
		Body: body,
	})
}

// ListComments returns all comments for a pull request
func (p *Provider) ListComments(ctx context.Context, owner, repo string, number int) ([]models.Comment, error) {
	if p.username == "" {
		return nil, providers.ErrNotAuthenticated
	}

	path := fmt.Sprintf("/repositories/%s/%s/pullrequests/%d/comments", owner, repo, number)

	var result bbPaginated[bbComment]
	err := p.get(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to list comments: %w", err)
	}

	comments := make([]models.Comment, 0, len(result.Values))
	for _, c := range result.Values {
		if c.Deleted {
			continue
		}
		comments = append(comments, *mapComment(&c))
	}

	return comments, nil
}

// CreateComment creates a new comment on a pull request
func (p *Provider) CreateComment(ctx context.Context, owner, repo string, number int, comment models.CommentInput) error {
	if p.username == "" {
		return providers.ErrNotAuthenticated
	}

	path := fmt.Sprintf("/repositories/%s/%s/pullrequests/%d/comments", owner, repo, number)

	body := map[string]interface{}{
		"content": map[string]string{
			"raw": comment.Body,
		},
	}

	// Add inline info if this is a line comment
	if comment.Path != "" && comment.Line > 0 {
		body["inline"] = map[string]interface{}{
			"path": comment.Path,
			"to":   comment.Line,
		}
	}

	return p.post(ctx, path, body, nil)
}

// ReplyToComment replies to an existing comment
func (p *Provider) ReplyToComment(ctx context.Context, owner, repo string, number int, commentID string, body string) error {
	if p.username == "" {
		return providers.ErrNotAuthenticated
	}

	path := fmt.Sprintf("/repositories/%s/%s/pullrequests/%d/comments", owner, repo, number)

	reqBody := map[string]interface{}{
		"content": map[string]string{
			"raw": body,
		},
		"parent": map[string]string{
			"id": commentID,
		},
	}

	return p.post(ctx, path, reqBody, nil)
}

// ResolveComment marks a comment as resolved
// Note: Bitbucket doesn't support resolving comments
func (p *Provider) ResolveComment(ctx context.Context, owner, repo string, number int, commentID string) error {
	return fmt.Errorf("bitbucket does not support resolving comments")
}
