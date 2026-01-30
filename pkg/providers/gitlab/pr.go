package gitlab

import (
	"context"
	"fmt"

	"lazyreview/internal/models"
	"lazyreview/pkg/providers"

	gl "gitlab.com/gitlab-org/api/client-go"
)

// ListPullRequests returns merge requests matching the given options
func (p *Provider) ListPullRequests(ctx context.Context, owner, repo string, opts providers.ListOptions) ([]models.PullRequest, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	// Build list options
	listOpts := &gl.ListProjectMergeRequestsOptions{
		ListOptions: gl.ListOptions{
			PerPage: int64(opts.PerPage),
			Page:    int64(opts.Page),
		},
	}

	// Map state filter
	if opts.State != "" {
		state := mapStateFilter(string(opts.State))
		listOpts.State = &state
	}

	mrs, _, err := p.client.MergeRequests.ListProjectMergeRequests(projectPath, listOpts, gl.WithContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to list merge requests: %w", err)
	}

	prs := make([]models.PullRequest, 0, len(mrs))
	for _, mr := range mrs {
		prs = append(prs, *mapBasicMergeRequest(mr, owner, repo))
	}

	return prs, nil
}

// GetPullRequest returns a single merge request by IID
func (p *Provider) GetPullRequest(ctx context.Context, owner, repo string, number int) (*models.PullRequest, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	mr, _, err := p.client.MergeRequests.GetMergeRequest(projectPath, int64(number), nil, gl.WithContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to get merge request: %w", err)
	}

	return mapMergeRequest(mr, owner, repo), nil
}

// GetPullRequestDiff returns the diff for a merge request
func (p *Provider) GetPullRequestDiff(ctx context.Context, owner, repo string, number int) (*models.Diff, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	// Get diffs for the merge request
	diffs, _, err := p.client.MergeRequests.ListMergeRequestDiffs(projectPath, int64(number), nil, gl.WithContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to get merge request diffs: %w", err)
	}

	diff := &models.Diff{
		Files: make([]models.FileDiff, 0),
	}

	for _, d := range diffs {
		fileDiff := models.FileDiff{
			Path:    d.NewPath,
			OldPath: d.OldPath,
			Patch:   d.Diff,
		}

		// Determine status
		if d.NewFile {
			fileDiff.Status = models.FileStatusAdded
		} else if d.DeletedFile {
			fileDiff.Status = models.FileStatusDeleted
		} else if d.RenamedFile {
			fileDiff.Status = models.FileStatusRenamed
		} else {
			fileDiff.Status = models.FileStatusModified
		}

		diff.Files = append(diff.Files, fileDiff)
	}

	return diff, nil
}

// GetPullRequestFiles returns the list of changed files
func (p *Provider) GetPullRequestFiles(ctx context.Context, owner, repo string, number int) ([]models.FileChange, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	diffs, _, err := p.client.MergeRequests.ListMergeRequestDiffs(projectPath, int64(number), nil, gl.WithContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to get merge request diffs: %w", err)
	}

	files := make([]models.FileChange, 0, len(diffs))
	for _, d := range diffs {
		fc := models.FileChange{
			Filename:         d.NewPath,
			PreviousFilename: d.OldPath,
			Patch:            d.Diff,
		}

		// Determine status
		if d.NewFile {
			fc.Status = models.FileStatusAdded
		} else if d.DeletedFile {
			fc.Status = models.FileStatusDeleted
		} else if d.RenamedFile {
			fc.Status = models.FileStatusRenamed
		} else {
			fc.Status = models.FileStatusModified
		}

		files = append(files, fc)
	}

	return files, nil
}

// MergePullRequest merges a merge request
func (p *Provider) MergePullRequest(ctx context.Context, owner, repo string, number int, opts providers.MergeOptions) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	mergeOpts := &gl.AcceptMergeRequestOptions{
		MergeCommitMessage: &opts.CommitMessage,
	}

	if opts.Method == providers.MergeMethodSquash {
		squash := true
		mergeOpts.Squash = &squash
	}

	if opts.DeleteBranch {
		remove := true
		mergeOpts.ShouldRemoveSourceBranch = &remove
	}

	_, _, err := p.client.MergeRequests.AcceptMergeRequest(projectPath, int64(number), mergeOpts, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to merge merge request: %w", err)
	}

	return nil
}

// ClosePullRequest closes a merge request without merging
func (p *Provider) ClosePullRequest(ctx context.Context, owner, repo string, number int) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo
	stateEvent := "close"

	_, _, err := p.client.MergeRequests.UpdateMergeRequest(projectPath, int64(number), &gl.UpdateMergeRequestOptions{
		StateEvent: &stateEvent,
	}, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to close merge request: %w", err)
	}

	return nil
}

// ReopenPullRequest reopens a closed merge request
func (p *Provider) ReopenPullRequest(ctx context.Context, owner, repo string, number int) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo
	stateEvent := "reopen"

	_, _, err := p.client.MergeRequests.UpdateMergeRequest(projectPath, int64(number), &gl.UpdateMergeRequestOptions{
		StateEvent: &stateEvent,
	}, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to reopen merge request: %w", err)
	}

	return nil
}

// AddLabels adds labels to a merge request
func (p *Provider) AddLabels(ctx context.Context, owner, repo string, number int, labels []string) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	// Get current MR to get existing labels
	mr, _, err := p.client.MergeRequests.GetMergeRequest(projectPath, int64(number), nil, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to get merge request: %w", err)
	}

	// Combine existing and new labels
	allLabels := append(mr.Labels, labels...)
	labelsOpt := gl.LabelOptions(allLabels)

	_, _, err = p.client.MergeRequests.UpdateMergeRequest(projectPath, int64(number), &gl.UpdateMergeRequestOptions{
		Labels: &labelsOpt,
	}, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to add labels: %w", err)
	}

	return nil
}

// RemoveLabel removes a label from a merge request
func (p *Provider) RemoveLabel(ctx context.Context, owner, repo string, number int, label string) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	// Get current MR to get existing labels
	mr, _, err := p.client.MergeRequests.GetMergeRequest(projectPath, int64(number), nil, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to get merge request: %w", err)
	}

	// Filter out the label to remove
	newLabels := make([]string, 0)
	for _, l := range mr.Labels {
		if l != label {
			newLabels = append(newLabels, l)
		}
	}
	labelsOpt := gl.LabelOptions(newLabels)

	_, _, err = p.client.MergeRequests.UpdateMergeRequest(projectPath, int64(number), &gl.UpdateMergeRequestOptions{
		Labels: &labelsOpt,
	}, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to remove label: %w", err)
	}

	return nil
}

// AddAssignees adds assignees to a merge request
func (p *Provider) AddAssignees(ctx context.Context, owner, repo string, number int, assignees []string) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	// GitLab uses user IDs, not usernames, so we need to look up users
	assigneeIDs, err := p.getUserIDs(ctx, assignees)
	if err != nil {
		return err
	}

	_, _, err = p.client.MergeRequests.UpdateMergeRequest(projectPath, int64(number), &gl.UpdateMergeRequestOptions{
		AssigneeIDs: assigneeIDs,
	}, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to add assignees: %w", err)
	}

	return nil
}

// RemoveAssignees removes assignees from a merge request
func (p *Provider) RemoveAssignees(ctx context.Context, owner, repo string, number int, assignees []string) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	// Get current MR
	mr, _, err := p.client.MergeRequests.GetMergeRequest(projectPath, int64(number), nil, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to get merge request: %w", err)
	}

	// Build set of usernames to remove
	removeSet := make(map[string]bool)
	for _, a := range assignees {
		removeSet[a] = true
	}

	// Filter out assignees to remove
	newAssigneeIDs := make([]int64, 0)
	for _, a := range mr.Assignees {
		if !removeSet[a.Username] {
			newAssigneeIDs = append(newAssigneeIDs, a.ID)
		}
	}

	_, _, err = p.client.MergeRequests.UpdateMergeRequest(projectPath, int64(number), &gl.UpdateMergeRequestOptions{
		AssigneeIDs: &newAssigneeIDs,
	}, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to remove assignees: %w", err)
	}

	return nil
}

// AddReviewers requests reviews from users
func (p *Provider) AddReviewers(ctx context.Context, owner, repo string, number int, reviewers []string) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	projectPath := owner + "/" + repo

	// GitLab uses user IDs for reviewers
	reviewerIDs, err := p.getUserIDs(ctx, reviewers)
	if err != nil {
		return err
	}

	_, _, err = p.client.MergeRequests.UpdateMergeRequest(projectPath, int64(number), &gl.UpdateMergeRequestOptions{
		ReviewerIDs: reviewerIDs,
	}, gl.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("failed to add reviewers: %w", err)
	}

	return nil
}

// getUserIDs looks up user IDs from usernames
func (p *Provider) getUserIDs(ctx context.Context, usernames []string) (*[]int64, error) {
	ids := make([]int64, 0, len(usernames))
	for _, username := range usernames {
		users, _, err := p.client.Users.ListUsers(&gl.ListUsersOptions{
			Username: &username,
		}, gl.WithContext(ctx))
		if err != nil {
			return nil, fmt.Errorf("failed to look up user %s: %w", username, err)
		}
		if len(users) == 0 {
			return nil, fmt.Errorf("user not found: %s", username)
		}
		ids = append(ids, users[0].ID)
	}
	return &ids, nil
}

// mapStateFilter converts our state filter to GitLab format
func mapStateFilter(state string) string {
	switch state {
	case "open":
		return "opened"
	case "closed":
		return "closed"
	case "merged":
		return "merged"
	case "all":
		return "all"
	default:
		return "opened"
	}
}
