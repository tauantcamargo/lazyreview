package azuredevops

import (
	"context"
	"fmt"
	"strconv"

	"lazyreview/internal/models"
	"lazyreview/pkg/providers"
)

// ListReviews returns all reviews for a pull request
func (p *Provider) ListReviews(ctx context.Context, owner, repo string, number int) ([]models.Review, error) {
	if p.token == "" {
		return nil, providers.ErrNotAuthenticated
	}

	// Get the PR to access reviewer info
	path := p.buildURL(owner, repo, fmt.Sprintf("git/repositories/%s/pullrequests/%d", repo, number), nil)

	var pr adoPullRequest
	err := p.get(ctx, path, &pr)
	if err != nil {
		return nil, fmt.Errorf("failed to get pull request: %w", err)
	}

	reviews := make([]models.Review, 0, len(pr.Reviewers))
	for _, reviewer := range pr.Reviewers {
		reviews = append(reviews, models.Review{
			ID:    reviewer.ID,
			State: mapVoteToReviewState(reviewer.Vote),
			Author: models.User{
				ID:        reviewer.ID,
				Login:     reviewer.UniqueName,
				Name:      reviewer.DisplayName,
				AvatarURL: reviewer.ImageURL,
			},
		})
	}

	return reviews, nil
}

// CreateReview creates a review (vote)
func (p *Provider) CreateReview(ctx context.Context, owner, repo string, number int, review models.ReviewInput) error {
	if p.token == "" {
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

// ApproveReview approves a pull request (vote +10)
func (p *Provider) ApproveReview(ctx context.Context, owner, repo string, number int, body string) error {
	if p.token == "" {
		return providers.ErrNotAuthenticated
	}

	// Get current user ID
	user, err := p.GetCurrentUser(ctx)
	if err != nil {
		return err
	}

	path := p.buildURL("", "", fmt.Sprintf("git/repositories/%s/pullrequests/%d/reviewers/%s", "", number, user.ID), nil)

	voteBody := map[string]int{
		"vote": 10, // Approved
	}

	if err := p.patch(ctx, path, voteBody, nil); err != nil {
		return fmt.Errorf("failed to approve: %w", err)
	}

	// Add comment if body provided
	if body != "" {
		return p.CreateComment(ctx, "", "", number, models.CommentInput{
			Body: body,
		})
	}

	return nil
}

// RequestChanges requests changes on a pull request (vote -10)
func (p *Provider) RequestChanges(ctx context.Context, owner, repo string, number int, body string) error {
	if p.token == "" {
		return providers.ErrNotAuthenticated
	}

	// Get current user ID
	user, err := p.GetCurrentUser(ctx)
	if err != nil {
		return err
	}

	path := p.buildURL(owner, repo, fmt.Sprintf("git/repositories/%s/pullrequests/%d/reviewers/%s", repo, number, user.ID), nil)

	voteBody := map[string]int{
		"vote": -10, // Rejected
	}

	if err := p.patch(ctx, path, voteBody, nil); err != nil {
		return fmt.Errorf("failed to reject: %w", err)
	}

	// Add comment explaining changes requested
	if body == "" {
		body = "Changes requested"
	}

	return p.CreateComment(ctx, owner, repo, number, models.CommentInput{
		Body: body,
	})
}

// ListComments returns all comment threads for a pull request
func (p *Provider) ListComments(ctx context.Context, owner, repo string, number int) ([]models.Comment, error) {
	if p.token == "" {
		return nil, providers.ErrNotAuthenticated
	}

	path := p.buildURL(owner, repo, fmt.Sprintf("git/repositories/%s/pullrequests/%d/threads", repo, number), nil)

	var result adoPaginatedResponse[adoThread]
	err := p.get(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to list threads: %w", err)
	}

	comments := make([]models.Comment, 0)
	for _, thread := range result.Value {
		if thread.IsDeleted {
			continue
		}
		if c := mapThread(&thread); c != nil {
			comments = append(comments, *c)
		}
	}

	return comments, nil
}

// CreateComment creates a new comment thread on a pull request
func (p *Provider) CreateComment(ctx context.Context, owner, repo string, number int, comment models.CommentInput) error {
	if p.token == "" {
		return providers.ErrNotAuthenticated
	}

	path := p.buildURL(owner, repo, fmt.Sprintf("git/repositories/%s/pullrequests/%d/threads", repo, number), nil)

	body := map[string]any{
		"comments": []map[string]any{
			{
				"parentCommentId": 0,
				"content":         comment.Body,
				"commentType":     1, // text
			},
		},
		"status": 1, // active
	}

	// Add thread context for inline comments
	if comment.Path != "" && comment.Line > 0 {
		body["threadContext"] = map[string]any{
			"filePath": comment.Path,
			"rightFileStart": map[string]int{
				"line":   comment.Line,
				"offset": 1,
			},
			"rightFileEnd": map[string]int{
				"line":   comment.Line,
				"offset": 1,
			},
		}
	}

	return p.post(ctx, path, body, nil)
}

// ReplyToComment replies to an existing thread
func (p *Provider) ReplyToComment(ctx context.Context, owner, repo string, number int, commentID string, body string) error {
	if p.token == "" {
		return providers.ErrNotAuthenticated
	}

	threadID, err := strconv.Atoi(commentID)
	if err != nil {
		return fmt.Errorf("invalid thread ID: %w", err)
	}

	path := p.buildURL(owner, repo, fmt.Sprintf("git/repositories/%s/pullrequests/%d/threads/%d/comments", repo, number, threadID), nil)

	reqBody := map[string]any{
		"parentCommentId": 1, // Reply to first comment
		"content":         body,
		"commentType":     1, // text
	}

	return p.post(ctx, path, reqBody, nil)
}

// ResolveComment marks a thread as resolved
func (p *Provider) ResolveComment(ctx context.Context, owner, repo string, number int, commentID string) error {
	if p.token == "" {
		return providers.ErrNotAuthenticated
	}

	threadID, err := strconv.Atoi(commentID)
	if err != nil {
		return fmt.Errorf("invalid thread ID: %w", err)
	}

	path := p.buildURL(owner, repo, fmt.Sprintf("git/repositories/%s/pullrequests/%d/threads/%d", repo, number, threadID), nil)

	body := map[string]int{
		"status": 2, // fixed
	}

	return p.patch(ctx, path, body, nil)
}
