package azuredevops

import (
	"context"
	"fmt"
	"strconv"

	"lazyreview/internal/models"
	"lazyreview/pkg/providers"
)

// ListPullRequests returns pull requests matching the given options
func (p *Provider) ListPullRequests(ctx context.Context, owner, repo string, opts providers.ListOptions) ([]models.PullRequest, error) {
	if p.token == "" {
		return nil, providers.ErrNotAuthenticated
	}

	params := map[string]string{}
	if opts.State != "" {
		params["searchCriteria.status"] = mapStateFilter(string(opts.State))
	}
	if opts.PerPage > 0 {
		params["$top"] = strconv.Itoa(opts.PerPage)
	}
	if opts.Page > 1 {
		params["$skip"] = strconv.Itoa((opts.Page - 1) * opts.PerPage)
	}

	path := p.buildURL(owner, repo, "git/repositories/"+repo+"/pullrequests", params)

	var result adoPaginatedResponse[adoPullRequest]
	err := p.get(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to list pull requests: %w", err)
	}

	prs := make([]models.PullRequest, 0, len(result.Value))
	for _, pr := range result.Value {
		prs = append(prs, *mapPullRequest(&pr))
	}

	return prs, nil
}

// GetPullRequest returns a single pull request by ID
func (p *Provider) GetPullRequest(ctx context.Context, owner, repo string, number int) (*models.PullRequest, error) {
	if p.token == "" {
		return nil, providers.ErrNotAuthenticated
	}

	path := p.buildURL(owner, repo, fmt.Sprintf("git/repositories/%s/pullrequests/%d", repo, number), nil)

	var pr adoPullRequest
	err := p.get(ctx, path, &pr)
	if err != nil {
		return nil, fmt.Errorf("failed to get pull request: %w", err)
	}

	return mapPullRequest(&pr), nil
}

// GetPullRequestDiff returns the diff for a pull request
func (p *Provider) GetPullRequestDiff(ctx context.Context, owner, repo string, number int) (*models.Diff, error) {
	if p.token == "" {
		return nil, providers.ErrNotAuthenticated
	}

	// Get iterations to find changes
	path := p.buildURL(owner, repo, fmt.Sprintf("git/repositories/%s/pullrequests/%d/iterations", repo, number), nil)

	var iterations adoPaginatedResponse[struct {
		ID int `json:"id"`
	}]
	err := p.get(ctx, path, &iterations)
	if err != nil {
		return nil, fmt.Errorf("failed to get iterations: %w", err)
	}

	if len(iterations.Value) == 0 {
		return &models.Diff{}, nil
	}

	// Get changes from the latest iteration
	latestIteration := iterations.Value[len(iterations.Value)-1].ID
	changesPath := p.buildURL(owner, repo, fmt.Sprintf("git/repositories/%s/pullrequests/%d/iterations/%d/changes", repo, number, latestIteration), nil)

	var changes struct {
		ChangeEntries []adoIterationChange `json:"changeEntries"`
	}
	err = p.get(ctx, changesPath, &changes)
	if err != nil {
		return nil, fmt.Errorf("failed to get changes: %w", err)
	}

	diff := &models.Diff{
		Files: make([]models.FileDiff, 0, len(changes.ChangeEntries)),
	}

	for _, change := range changes.ChangeEntries {
		fileDiff := models.FileDiff{
			Path: change.Item.Path,
		}

		if change.OriginalPath != "" {
			fileDiff.OldPath = change.OriginalPath
		}

		switch change.ChangeType {
		case "add":
			fileDiff.Status = models.FileStatusAdded
		case "delete":
			fileDiff.Status = models.FileStatusDeleted
		case "rename":
			fileDiff.Status = models.FileStatusRenamed
		default:
			fileDiff.Status = models.FileStatusModified
		}

		diff.Files = append(diff.Files, fileDiff)
	}

	return diff, nil
}

// GetPullRequestFiles returns the list of changed files
func (p *Provider) GetPullRequestFiles(ctx context.Context, owner, repo string, number int) ([]models.FileChange, error) {
	diff, err := p.GetPullRequestDiff(ctx, owner, repo, number)
	if err != nil {
		return nil, err
	}

	files := make([]models.FileChange, 0, len(diff.Files))
	for _, f := range diff.Files {
		files = append(files, models.FileChange{
			Filename:         f.Path,
			PreviousFilename: f.OldPath,
			Status:           f.Status,
		})
	}

	return files, nil
}

// MergePullRequest completes a pull request
func (p *Provider) MergePullRequest(ctx context.Context, owner, repo string, number int, opts providers.MergeOptions) error {
	if p.token == "" {
		return providers.ErrNotAuthenticated
	}

	// First, get the PR to find the last merge source commit
	pr, err := p.GetPullRequest(ctx, owner, repo, number)
	if err != nil {
		return err
	}

	path := p.buildURL(owner, repo, fmt.Sprintf("git/repositories/%s/pullrequests/%d", repo, number), nil)

	body := map[string]any{
		"status": "completed",
		"lastMergeSourceCommit": map[string]string{
			"commitId": pr.ID, // This should be the actual commit ID
		},
		"completionOptions": map[string]any{
			"deleteSourceBranch": opts.DeleteBranch,
			"mergeCommitMessage": opts.CommitMessage,
			"squashMerge":        opts.Method == providers.MergeMethodSquash,
		},
	}

	return p.patch(ctx, path, body, nil)
}

// ClosePullRequest abandons a pull request
func (p *Provider) ClosePullRequest(ctx context.Context, owner, repo string, number int) error {
	if p.token == "" {
		return providers.ErrNotAuthenticated
	}

	path := p.buildURL(owner, repo, fmt.Sprintf("git/repositories/%s/pullrequests/%d", repo, number), nil)

	body := map[string]string{
		"status": "abandoned",
	}

	return p.patch(ctx, path, body, nil)
}

// ReopenPullRequest reactivates an abandoned pull request
func (p *Provider) ReopenPullRequest(ctx context.Context, owner, repo string, number int) error {
	if p.token == "" {
		return providers.ErrNotAuthenticated
	}

	path := p.buildURL(owner, repo, fmt.Sprintf("git/repositories/%s/pullrequests/%d", repo, number), nil)

	body := map[string]string{
		"status": "active",
	}

	return p.patch(ctx, path, body, nil)
}

// AddLabels adds labels to a pull request
func (p *Provider) AddLabels(ctx context.Context, owner, repo string, number int, labels []string) error {
	if p.token == "" {
		return providers.ErrNotAuthenticated
	}

	for _, label := range labels {
		path := p.buildURL(owner, repo, fmt.Sprintf("git/repositories/%s/pullrequests/%d/labels", repo, number), nil)

		body := map[string]string{
			"name": label,
		}

		if err := p.post(ctx, path, body, nil); err != nil {
			return fmt.Errorf("failed to add label %s: %w", label, err)
		}
	}

	return nil
}

// RemoveLabel removes a label from a pull request
func (p *Provider) RemoveLabel(ctx context.Context, owner, repo string, number int, label string) error {
	// Azure DevOps requires the label ID to remove
	// This would need to list labels first to find the ID
	return fmt.Errorf("removing labels requires label ID lookup - not yet implemented")
}

// AddAssignees adds assignees to a pull request
// Note: Azure DevOps doesn't have assignees, only reviewers
func (p *Provider) AddAssignees(ctx context.Context, owner, repo string, number int, assignees []string) error {
	return fmt.Errorf("azure DevOps does not support PR assignees, use AddReviewers instead")
}

// RemoveAssignees removes assignees from a pull request
func (p *Provider) RemoveAssignees(ctx context.Context, owner, repo string, number int, assignees []string) error {
	return fmt.Errorf("azure DevOps does not support PR assignees")
}

// AddReviewers adds reviewers to a pull request
func (p *Provider) AddReviewers(ctx context.Context, owner, repo string, number int, reviewers []string) error {
	if p.token == "" {
		return providers.ErrNotAuthenticated
	}

	for _, reviewerID := range reviewers {
		path := p.buildURL(owner, repo, fmt.Sprintf("git/repositories/%s/pullrequests/%d/reviewers/%s", repo, number, reviewerID), nil)

		body := map[string]any{
			"vote":       0,
			"isRequired": true,
		}

		if err := p.patch(ctx, path, body, nil); err != nil {
			return fmt.Errorf("failed to add reviewer %s: %w", reviewerID, err)
		}
	}

	return nil
}

// mapStateFilter converts our state filter to Azure DevOps format
func mapStateFilter(state string) string {
	switch state {
	case "open":
		return "active"
	case "closed":
		return "abandoned"
	case "merged":
		return "completed"
	case "all":
		return "all"
	default:
		return "active"
	}
}
