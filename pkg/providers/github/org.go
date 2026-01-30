package github

import (
	"context"
	"fmt"

	"lazyreview/internal/models"
	"lazyreview/pkg/providers"

	"github.com/google/go-github/v60/github"
)

// ListOrganizations returns organizations the authenticated user belongs to
func (p *Provider) ListOrganizations(ctx context.Context) ([]providers.Organization, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	opts := &github.ListOptions{
		PerPage: 100,
	}

	var allOrgs []providers.Organization
	for {
		orgs, resp, err := p.client.Organizations.List(ctx, "", opts)
		if err != nil {
			return nil, fmt.Errorf("failed to list organizations: %w", err)
		}

		for _, org := range orgs {
			allOrgs = append(allOrgs, mapOrganization(org))
		}

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	return allOrgs, nil
}

// ListOrganizationRepos returns repositories in an organization
func (p *Provider) ListOrganizationRepos(ctx context.Context, org string, opts providers.ListReposOptions) ([]models.Repository, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	ghOpts := &github.RepositoryListByOrgOptions{
		Type:      opts.Type,
		Sort:      opts.Sort,
		Direction: string(opts.Direction),
		ListOptions: github.ListOptions{
			PerPage: opts.PerPage,
			Page:    opts.Page,
		},
	}

	repos, _, err := p.client.Repositories.ListByOrg(ctx, org, ghOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to list organization repos: %w", err)
	}

	result := make([]models.Repository, 0, len(repos))
	for _, repo := range repos {
		result = append(result, mapRepository(repo))
	}

	return result, nil
}

// ListUserRepos returns the authenticated user's repositories
func (p *Provider) ListUserRepos(ctx context.Context, opts providers.ListReposOptions) ([]models.Repository, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	ghOpts := &github.RepositoryListOptions{
		Affiliation: opts.Affiliation,
		Type:        opts.Type,
		Sort:        opts.Sort,
		Direction:   string(opts.Direction),
		ListOptions: github.ListOptions{
			PerPage: opts.PerPage,
			Page:    opts.Page,
		},
	}

	repos, _, err := p.client.Repositories.List(ctx, "", ghOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to list user repos: %w", err)
	}

	result := make([]models.Repository, 0, len(repos))
	for _, repo := range repos {
		result = append(result, mapRepository(repo))
	}

	return result, nil
}

// ListUserPullRequests returns PRs across repositories for the authenticated user
func (p *Provider) ListUserPullRequests(ctx context.Context, opts providers.UserPROptions) ([]models.PullRequest, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	// Get current user
	user, _, err := p.client.Users.Get(ctx, "")
	if err != nil {
		return nil, fmt.Errorf("failed to get current user: %w", err)
	}

	// Build search query based on involvement
	query := buildUserPRQuery(user.GetLogin(), opts)

	searchOpts := &github.SearchOptions{
		Sort:  "updated",
		Order: "desc",
		ListOptions: github.ListOptions{
			PerPage: opts.PerPage,
			Page:    opts.Page,
		},
	}

	result, _, err := p.client.Search.Issues(ctx, query, searchOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to search user PRs: %w", err)
	}

	prs := make([]models.PullRequest, 0, len(result.Issues))
	for _, issue := range result.Issues {
		// GitHub Search API returns issues, but we filter by is:pr
		if issue.PullRequestLinks != nil {
			pr, err := p.fetchPRFromIssue(ctx, issue)
			if err != nil {
				// Log error but continue with other PRs
				continue
			}
			prs = append(prs, *pr)
		}
	}

	return prs, nil
}

// buildUserPRQuery constructs a GitHub search query for user PRs
func buildUserPRQuery(username string, opts providers.UserPROptions) string {
	query := "is:pr"

	// Add state filter
	switch opts.State {
	case models.PRStateOpen:
		query += " is:open"
	case models.PRStateClosed:
		query += " is:closed is:unmerged"
	case models.PRStateMerged:
		query += " is:merged"
	}

	// Add involvement filter
	switch opts.Involvement {
	case "authored":
		query += fmt.Sprintf(" author:%s", username)
	case "assigned":
		query += fmt.Sprintf(" assignee:%s", username)
	case "review_requested":
		query += fmt.Sprintf(" review-requested:%s", username)
	case "mentioned":
		query += fmt.Sprintf(" mentions:%s", username)
	case "all":
		// All PRs involving the user
		query += fmt.Sprintf(" involves:%s", username)
	default:
		// Default to all involvement
		query += fmt.Sprintf(" involves:%s", username)
	}

	return query
}

// fetchPRFromIssue fetches the full PR details from a search issue result
func (p *Provider) fetchPRFromIssue(ctx context.Context, issue *github.Issue) (*models.PullRequest, error) {
	// Extract owner and repo from repository URL
	repo := issue.GetRepository()
	if repo == nil {
		return nil, fmt.Errorf("issue missing repository information")
	}

	owner := repo.GetOwner().GetLogin()
	repoName := repo.GetName()

	// Fetch full PR details
	pr, _, err := p.client.PullRequests.Get(ctx, owner, repoName, issue.GetNumber())
	if err != nil {
		return nil, fmt.Errorf("failed to fetch PR details: %w", err)
	}

	return mapPullRequest(pr), nil
}
