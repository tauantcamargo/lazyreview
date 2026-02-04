package github

import (
	"context"
	"fmt"

	"lazyreview/internal/models"
	"lazyreview/pkg/providers"

	"github.com/google/go-github/v60/github"
)

// ListReviews returns all reviews for a pull request
func (p *Provider) ListReviews(ctx context.Context, owner, repo string, number int) ([]models.Review, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	opts := &github.ListOptions{PerPage: 100}
	var allReviews []*github.PullRequestReview

	for {
		reviews, resp, err := p.client.PullRequests.ListReviews(ctx, owner, repo, number, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to list reviews: %w", err)
		}
		allReviews = append(allReviews, reviews...)

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	result := make([]models.Review, 0, len(allReviews))
	for _, review := range allReviews {
		mapped := mapReview(review)
		if mapped != nil {
			result = append(result, *mapped)
		}
	}

	return result, nil
}

// CreateReview submits a new review
func (p *Provider) CreateReview(ctx context.Context, owner, repo string, number int, review models.ReviewInput) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	ghReview := &github.PullRequestReviewRequest{
		Body:  &review.Body,
		Event: github.String(mapReviewEvent(review.Event)),
	}

	// Add comments if any
	if len(review.Comments) > 0 {
		comments := make([]*github.DraftReviewComment, 0, len(review.Comments))
		for _, c := range review.Comments {
			comment := &github.DraftReviewComment{
				Path: &c.Path,
				Body: &c.Body,
			}
			if c.Line > 0 {
				comment.Line = &c.Line
			}
			if c.Side != "" {
				side := string(c.Side)
				comment.Side = &side
			}
			comments = append(comments, comment)
		}
		ghReview.Comments = comments
	}

	_, _, err := p.client.PullRequests.CreateReview(ctx, owner, repo, number, ghReview)
	if err != nil {
		return fmt.Errorf("failed to create review: %w", err)
	}

	return nil
}

// ApproveReview approves a pull request
func (p *Provider) ApproveReview(ctx context.Context, owner, repo string, number int, body string) error {
	return p.CreateReview(ctx, owner, repo, number, models.ReviewInput{
		Event: models.ReviewEventApprove,
		Body:  body,
	})
}

// RequestChanges requests changes on a pull request
func (p *Provider) RequestChanges(ctx context.Context, owner, repo string, number int, body string) error {
	return p.CreateReview(ctx, owner, repo, number, models.ReviewInput{
		Event: models.ReviewEventRequestChanges,
		Body:  body,
	})
}

// ListComments returns all comments for a pull request
func (p *Provider) ListComments(ctx context.Context, owner, repo string, number int) ([]models.Comment, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	var result []models.Comment

	// Get review comments (inline)
	reviewOpts := &github.PullRequestListCommentsOptions{
		ListOptions: github.ListOptions{PerPage: 100},
	}
	for {
		comments, resp, err := p.client.PullRequests.ListComments(ctx, owner, repo, number, reviewOpts)
		if err != nil {
			return nil, fmt.Errorf("failed to list review comments: %w", err)
		}
		for _, c := range comments {
			mapped := mapComment(c)
			if mapped != nil {
				result = append(result, *mapped)
			}
		}
		if resp.NextPage == 0 {
			break
		}
		reviewOpts.Page = resp.NextPage
	}

	// Get issue comments (general)
	issueOpts := &github.IssueListCommentsOptions{
		ListOptions: github.ListOptions{PerPage: 100},
	}
	for {
		comments, resp, err := p.client.Issues.ListComments(ctx, owner, repo, number, issueOpts)
		if err != nil {
			return nil, fmt.Errorf("failed to list issue comments: %w", err)
		}
		for _, c := range comments {
			mapped := mapIssueComment(c)
			if mapped != nil {
				result = append(result, *mapped)
			}
		}
		if resp.NextPage == 0 {
			break
		}
		issueOpts.Page = resp.NextPage
	}

	return result, nil
}

// CreateComment creates a new comment
func (p *Provider) CreateComment(ctx context.Context, owner, repo string, number int, comment models.CommentInput) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	if comment.Path != "" && comment.Line > 0 {
		// Inline comment on a specific file/line
		ghComment := &github.PullRequestComment{
			Body: &comment.Body,
			Path: &comment.Path,
			Line: &comment.Line,
		}
		if comment.Side != "" {
			side := string(comment.Side)
			ghComment.Side = &side
		}
		if comment.CommitID != "" {
			ghComment.CommitID = &comment.CommitID
		}

		_, _, err := p.client.PullRequests.CreateComment(ctx, owner, repo, number, ghComment)
		if err != nil {
			return fmt.Errorf("failed to create inline comment: %w", err)
		}
	} else {
		// General comment on the PR
		ghComment := &github.IssueComment{
			Body: &comment.Body,
		}

		_, _, err := p.client.Issues.CreateComment(ctx, owner, repo, number, ghComment)
		if err != nil {
			return fmt.Errorf("failed to create comment: %w", err)
		}
	}

	return nil
}

// ReplyToComment replies to an existing comment
func (p *Provider) ReplyToComment(ctx context.Context, owner, repo string, number int, commentID string, body string) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	ghComment := &github.PullRequestComment{
		Body: &body,
	}

	_, _, err := p.client.PullRequests.CreateCommentInReplyTo(ctx, owner, repo, number, body, 0)
	_ = ghComment // Suppress unused warning

	if err != nil {
		return fmt.Errorf("failed to reply to comment: %w", err)
	}

	return nil
}

// ResolveComment marks a comment thread as resolved
// Note: GitHub doesn't have native comment resolution via REST API,
// this would require GraphQL API
func (p *Provider) ResolveComment(ctx context.Context, owner, repo string, number int, commentID string) error {
	// GitHub REST API doesn't support resolving comments
	// This would need to use the GraphQL API
	return providers.ErrUnsupported
}

// mapReviewEvent converts our review event to GitHub's
func mapReviewEvent(event models.ReviewEvent) string {
	switch event {
	case models.ReviewEventApprove:
		return "APPROVE"
	case models.ReviewEventRequestChanges:
		return "REQUEST_CHANGES"
	case models.ReviewEventComment:
		return "COMMENT"
	default:
		return "COMMENT"
	}
}
