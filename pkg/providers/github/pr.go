package github

import (
	"context"
	"fmt"
	"strings"

	"lazyreview/internal/models"
	"lazyreview/pkg/providers"

	"github.com/google/go-github/v60/github"
)

// wrapGitHubError converts GitHub API errors into provider-specific errors
func wrapGitHubError(err error, owner string) error {
	if err == nil {
		return nil
	}
	errStr := err.Error()

	// Check for SAML enforcement errors
	if strings.Contains(errStr, "SAML enforcement") ||
		strings.Contains(errStr, "organization SAML") ||
		strings.Contains(errStr, "grant your Personal Access token access") {
		return providers.NewSAMLError(owner, errStr)
	}

	return err
}

// ListPullRequests returns pull requests matching the given options
func (p *Provider) ListPullRequests(ctx context.Context, owner, repo string, opts providers.ListOptions) ([]models.PullRequest, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	ghOpts := &github.PullRequestListOptions{
		State:     mapStateToGH(opts.State),
		Sort:      mapSortToGH(opts.Sort),
		Direction: string(opts.Direction),
		ListOptions: github.ListOptions{
			Page:    opts.Page,
			PerPage: opts.PerPage,
		},
	}

	prs, _, err := p.client.PullRequests.List(ctx, owner, repo, ghOpts)
	if err != nil {
		if wrappedErr := wrapGitHubError(err, owner); wrappedErr != err {
			return nil, wrappedErr
		}
		return nil, fmt.Errorf("failed to list pull requests: %w", err)
	}

	result := make([]models.PullRequest, 0, len(prs))
	for _, pr := range prs {
		mapped := mapPullRequest(pr)
		if mapped != nil {
			result = append(result, *mapped)
		}
	}

	return result, nil
}

// GetPullRequest returns a single pull request by number
func (p *Provider) GetPullRequest(ctx context.Context, owner, repo string, number int) (*models.PullRequest, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	pr, _, err := p.client.PullRequests.Get(ctx, owner, repo, number)
	if err != nil {
		return nil, fmt.Errorf("failed to get pull request: %w", err)
	}

	result := mapPullRequest(pr)

	// Fetch check status for the head commit
	if result != nil && result.HeadSHA != "" {
		result.ChecksStatus = p.getChecksStatus(ctx, owner, repo, result.HeadSHA)
	}

	return result, nil
}

// getChecksStatus fetches the combined status for a commit
func (p *Provider) getChecksStatus(ctx context.Context, owner, repo, ref string) models.ChecksStatus {
	// Get combined status
	status, _, err := p.client.Repositories.GetCombinedStatus(ctx, owner, repo, ref, nil)
	if err != nil {
		return models.ChecksStatusNone
	}

	// Map GitHub state to our model
	switch status.GetState() {
	case "success":
		return models.ChecksStatusPassing
	case "failure", "error":
		return models.ChecksStatusFailing
	case "pending":
		return models.ChecksStatusPending
	default:
		// Also check for check runs if no statuses exist
		if status.GetTotalCount() == 0 {
			return p.getCheckRunsStatus(ctx, owner, repo, ref)
		}
		return models.ChecksStatusNone
	}
}

// getCheckRunsStatus fetches the check runs status (GitHub Actions)
func (p *Provider) getCheckRunsStatus(ctx context.Context, owner, repo, ref string) models.ChecksStatus {
	checks, _, err := p.client.Checks.ListCheckRunsForRef(ctx, owner, repo, ref, nil)
	if err != nil || checks.GetTotal() == 0 {
		return models.ChecksStatusNone
	}

	// Count conclusions
	hasFailure := false
	hasPending := false
	hasSuccess := false

	for _, run := range checks.CheckRuns {
		switch run.GetConclusion() {
		case "success":
			hasSuccess = true
		case "failure", "cancelled", "timed_out", "action_required":
			hasFailure = true
		case "":
			// Empty conclusion means in progress
			hasPending = true
		}
	}

	if hasFailure {
		return models.ChecksStatusFailing
	}
	if hasPending {
		return models.ChecksStatusPending
	}
	if hasSuccess {
		return models.ChecksStatusPassing
	}
	return models.ChecksStatusNone
}

// GetPullRequestDiff returns the diff for a pull request
func (p *Provider) GetPullRequestDiff(ctx context.Context, owner, repo string, number int) (*models.Diff, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	// Get the files which contain the patch info
	files, err := p.GetPullRequestFiles(ctx, owner, repo, number)
	if err != nil {
		return nil, err
	}

	diff := &models.Diff{
		Files: make([]models.FileDiff, 0, len(files)),
	}

	for _, file := range files {
		fileDiff := models.FileDiff{
			Path:      file.Filename,
			OldPath:   file.PreviousFilename,
			Status:    file.Status,
			Additions: file.Additions,
			Deletions: file.Deletions,
			Patch:     file.Patch,
		}
		diff.Files = append(diff.Files, fileDiff)
		diff.Additions += file.Additions
		diff.Deletions += file.Deletions
	}

	return diff, nil
}

// GetPullRequestFiles returns the list of changed files
func (p *Provider) GetPullRequestFiles(ctx context.Context, owner, repo string, number int) ([]models.FileChange, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	opts := &github.ListOptions{PerPage: 100}
	var allFiles []*github.CommitFile

	for {
		files, resp, err := p.client.PullRequests.ListFiles(ctx, owner, repo, number, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to list files: %w", err)
		}
		allFiles = append(allFiles, files...)

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	result := make([]models.FileChange, 0, len(allFiles))
	for _, file := range allFiles {
		mapped := mapFileChange(file)
		if mapped != nil {
			result = append(result, *mapped)
		}
	}

	return result, nil
}

// MergePullRequest merges a pull request
func (p *Provider) MergePullRequest(ctx context.Context, owner, repo string, number int, opts providers.MergeOptions) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	mergeOpts := &github.PullRequestOptions{
		CommitTitle: opts.CommitTitle,
		MergeMethod: mapMergeMethod(opts.Method),
		SHA:         opts.SHA,
	}

	_, _, err := p.client.PullRequests.Merge(ctx, owner, repo, number, opts.CommitMessage, mergeOpts)
	if err != nil {
		return fmt.Errorf("failed to merge pull request: %w", err)
	}

	// Delete branch if requested
	if opts.DeleteBranch {
		pr, _, err := p.client.PullRequests.Get(ctx, owner, repo, number)
		if err == nil && pr.Head != nil && pr.Head.Ref != nil {
			_, _ = p.client.Git.DeleteRef(ctx, owner, repo, "heads/"+*pr.Head.Ref)
		}
	}

	return nil
}

// ClosePullRequest closes a pull request without merging
func (p *Provider) ClosePullRequest(ctx context.Context, owner, repo string, number int) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	state := "closed"
	_, _, err := p.client.PullRequests.Edit(ctx, owner, repo, number, &github.PullRequest{
		State: &state,
	})
	if err != nil {
		return fmt.Errorf("failed to close pull request: %w", err)
	}

	return nil
}

// ReopenPullRequest reopens a closed pull request
func (p *Provider) ReopenPullRequest(ctx context.Context, owner, repo string, number int) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	state := "open"
	_, _, err := p.client.PullRequests.Edit(ctx, owner, repo, number, &github.PullRequest{
		State: &state,
	})
	if err != nil {
		return fmt.Errorf("failed to reopen pull request: %w", err)
	}

	return nil
}

// AddLabels adds labels to a pull request
func (p *Provider) AddLabels(ctx context.Context, owner, repo string, number int, labels []string) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	_, _, err := p.client.Issues.AddLabelsToIssue(ctx, owner, repo, number, labels)
	if err != nil {
		return fmt.Errorf("failed to add labels: %w", err)
	}

	return nil
}

// RemoveLabel removes a label from a pull request
func (p *Provider) RemoveLabel(ctx context.Context, owner, repo string, number int, label string) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	_, err := p.client.Issues.RemoveLabelForIssue(ctx, owner, repo, number, label)
	if err != nil {
		return fmt.Errorf("failed to remove label: %w", err)
	}

	return nil
}

// AddAssignees adds assignees to a pull request
func (p *Provider) AddAssignees(ctx context.Context, owner, repo string, number int, assignees []string) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	_, _, err := p.client.Issues.AddAssignees(ctx, owner, repo, number, assignees)
	if err != nil {
		return fmt.Errorf("failed to add assignees: %w", err)
	}

	return nil
}

// RemoveAssignees removes assignees from a pull request
func (p *Provider) RemoveAssignees(ctx context.Context, owner, repo string, number int, assignees []string) error {
	if p.client == nil {
		return providers.ErrNotAuthenticated
	}

	_, _, err := p.client.Issues.RemoveAssignees(ctx, owner, repo, number, assignees)
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

	_, _, err := p.client.PullRequests.RequestReviewers(ctx, owner, repo, number, github.ReviewersRequest{
		Reviewers: reviewers,
	})
	if err != nil {
		return fmt.Errorf("failed to add reviewers: %w", err)
	}

	return nil
}

// Helper functions for mapping options

func mapStateToGH(state models.PullRequestState) string {
	switch state {
	case models.PRStateOpen:
		return "open"
	case models.PRStateClosed:
		return "closed"
	default:
		return "all"
	}
}

func mapSortToGH(sort providers.SortField) string {
	switch sort {
	case providers.SortByCreated:
		return "created"
	case providers.SortByUpdated:
		return "updated"
	case providers.SortByPopularity:
		return "popularity"
	case providers.SortByLongRunning:
		return "long-running"
	default:
		return "updated"
	}
}

func mapMergeMethod(method providers.MergeMethod) string {
	switch method {
	case providers.MergeMethodMerge:
		return "merge"
	case providers.MergeMethodSquash:
		return "squash"
	case providers.MergeMethodRebase:
		return "rebase"
	default:
		return "merge"
	}
}
