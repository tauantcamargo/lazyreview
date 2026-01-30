package bitbucket

import (
	"context"
	"fmt"
	"strconv"

	"lazyreview/internal/models"
	"lazyreview/pkg/providers"
)

// ListPullRequests returns pull requests matching the given options
func (p *Provider) ListPullRequests(ctx context.Context, owner, repo string, opts providers.ListOptions) ([]models.PullRequest, error) {
	if p.username == "" {
		return nil, providers.ErrNotAuthenticated
	}

	path := fmt.Sprintf("/repositories/%s/%s/pullrequests", owner, repo)

	params := map[string]string{}
	if opts.State != "" {
		params["state"] = mapStateFilter(string(opts.State))
	}
	if opts.PerPage > 0 {
		params["pagelen"] = strconv.Itoa(opts.PerPage)
	}
	if opts.Page > 0 {
		params["page"] = strconv.Itoa(opts.Page)
	}

	var result bbPaginated[bbPullRequest]
	err := p.get(ctx, p.buildURL(path, params), &result)
	if err != nil {
		return nil, fmt.Errorf("failed to list pull requests: %w", err)
	}

	prs := make([]models.PullRequest, 0, len(result.Values))
	for _, pr := range result.Values {
		prs = append(prs, *mapPullRequest(&pr, owner, repo))
	}

	return prs, nil
}

// GetPullRequest returns a single pull request by ID
func (p *Provider) GetPullRequest(ctx context.Context, owner, repo string, number int) (*models.PullRequest, error) {
	if p.username == "" {
		return nil, providers.ErrNotAuthenticated
	}

	path := fmt.Sprintf("/repositories/%s/%s/pullrequests/%d", owner, repo, number)

	var pr bbPullRequest
	err := p.get(ctx, path, &pr)
	if err != nil {
		return nil, fmt.Errorf("failed to get pull request: %w", err)
	}

	return mapPullRequest(&pr, owner, repo), nil
}

// GetPullRequestDiff returns the diff for a pull request
func (p *Provider) GetPullRequestDiff(ctx context.Context, owner, repo string, number int) (*models.Diff, error) {
	if p.username == "" {
		return nil, providers.ErrNotAuthenticated
	}

	// Get diff stats
	path := fmt.Sprintf("/repositories/%s/%s/pullrequests/%d/diffstat", owner, repo, number)

	var result bbPaginated[bbDiffStat]
	err := p.get(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get diff stats: %w", err)
	}

	diff := &models.Diff{
		Files: make([]models.FileDiff, 0, len(result.Values)),
	}

	for _, stat := range result.Values {
		fileDiff := models.FileDiff{
			Additions: stat.LinesAdded,
			Deletions: stat.LinesRemoved,
		}

		if stat.New != nil {
			fileDiff.Path = stat.New.Path
		}
		if stat.Old != nil {
			fileDiff.OldPath = stat.Old.Path
		}

		switch stat.Status {
		case "added":
			fileDiff.Status = models.FileStatusAdded
		case "removed":
			fileDiff.Status = models.FileStatusDeleted
		case "modified":
			fileDiff.Status = models.FileStatusModified
		case "renamed":
			fileDiff.Status = models.FileStatusRenamed
		default:
			fileDiff.Status = models.FileStatusModified
		}

		diff.Files = append(diff.Files, fileDiff)
		diff.Additions += stat.LinesAdded
		diff.Deletions += stat.LinesRemoved
	}

	return diff, nil
}

// GetPullRequestFiles returns the list of changed files
func (p *Provider) GetPullRequestFiles(ctx context.Context, owner, repo string, number int) ([]models.FileChange, error) {
	if p.username == "" {
		return nil, providers.ErrNotAuthenticated
	}

	path := fmt.Sprintf("/repositories/%s/%s/pullrequests/%d/diffstat", owner, repo, number)

	var result bbPaginated[bbDiffStat]
	err := p.get(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get diff stats: %w", err)
	}

	files := make([]models.FileChange, 0, len(result.Values))
	for _, stat := range result.Values {
		files = append(files, mapDiffStat(&stat))
	}

	return files, nil
}

// MergePullRequest merges a pull request
func (p *Provider) MergePullRequest(ctx context.Context, owner, repo string, number int, opts providers.MergeOptions) error {
	if p.username == "" {
		return providers.ErrNotAuthenticated
	}

	path := fmt.Sprintf("/repositories/%s/%s/pullrequests/%d/merge", owner, repo, number)

	body := map[string]interface{}{}
	if opts.CommitMessage != "" {
		body["message"] = opts.CommitMessage
	}
	if opts.DeleteBranch {
		body["close_source_branch"] = true
	}

	switch opts.Method {
	case providers.MergeMethodSquash:
		body["merge_strategy"] = "squash"
	case providers.MergeMethodRebase:
		body["merge_strategy"] = "fast_forward"
	default:
		body["merge_strategy"] = "merge_commit"
	}

	return p.post(ctx, path, body, nil)
}

// ClosePullRequest declines a pull request
func (p *Provider) ClosePullRequest(ctx context.Context, owner, repo string, number int) error {
	if p.username == "" {
		return providers.ErrNotAuthenticated
	}

	path := fmt.Sprintf("/repositories/%s/%s/pullrequests/%d/decline", owner, repo, number)
	return p.post(ctx, path, nil, nil)
}

// ReopenPullRequest reopens a declined pull request
func (p *Provider) ReopenPullRequest(ctx context.Context, owner, repo string, number int) error {
	// Bitbucket doesn't support reopening declined PRs directly
	// You need to create a new PR
	return fmt.Errorf("bitbucket does not support reopening declined pull requests")
}

// AddLabels adds labels to a pull request
// Note: Bitbucket doesn't have labels on PRs
func (p *Provider) AddLabels(ctx context.Context, owner, repo string, number int, labels []string) error {
	return fmt.Errorf("bitbucket does not support PR labels")
}

// RemoveLabel removes a label from a pull request
// Note: Bitbucket doesn't have labels on PRs
func (p *Provider) RemoveLabel(ctx context.Context, owner, repo string, number int, label string) error {
	return fmt.Errorf("bitbucket does not support PR labels")
}

// AddAssignees adds assignees to a pull request
// Note: Bitbucket doesn't have assignees, only reviewers
func (p *Provider) AddAssignees(ctx context.Context, owner, repo string, number int, assignees []string) error {
	return fmt.Errorf("bitbucket does not support PR assignees, use AddReviewers instead")
}

// RemoveAssignees removes assignees from a pull request
// Note: Bitbucket doesn't have assignees
func (p *Provider) RemoveAssignees(ctx context.Context, owner, repo string, number int, assignees []string) error {
	return fmt.Errorf("bitbucket does not support PR assignees")
}

// AddReviewers requests reviews from users
func (p *Provider) AddReviewers(ctx context.Context, owner, repo string, number int, reviewers []string) error {
	if p.username == "" {
		return providers.ErrNotAuthenticated
	}

	// Get current PR to preserve existing reviewers
	pr, err := p.GetPullRequest(ctx, owner, repo, number)
	if err != nil {
		return err
	}

	// Build reviewer list
	reviewerList := make([]map[string]string, 0)
	for _, r := range pr.Reviewers {
		reviewerList = append(reviewerList, map[string]string{"username": r.Login})
	}
	for _, username := range reviewers {
		reviewerList = append(reviewerList, map[string]string{"username": username})
	}

	path := fmt.Sprintf("/repositories/%s/%s/pullrequests/%d", owner, repo, number)
	body := map[string]interface{}{
		"reviewers": reviewerList,
	}

	return p.put(ctx, path, body, nil)
}

// mapStateFilter converts our state filter to Bitbucket format
func mapStateFilter(state string) string {
	switch state {
	case "open":
		return "OPEN"
	case "closed":
		return "DECLINED"
	case "merged":
		return "MERGED"
	default:
		return "OPEN"
	}
}
