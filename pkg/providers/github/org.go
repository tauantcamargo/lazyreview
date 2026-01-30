package github

import (
	"context"
	"fmt"
	"strings"

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

	// Paginate through all results (up to 500 PRs max to avoid rate limiting)
	maxPRs := 500
	perPage := 100
	if opts.PerPage > 0 && opts.PerPage < perPage {
		perPage = opts.PerPage
	}

	var allPRs []models.PullRequest
	page := 1

	for len(allPRs) < maxPRs {
		searchOpts := &github.SearchOptions{
			Sort:  "updated",
			Order: "desc",
			ListOptions: github.ListOptions{
				PerPage: perPage,
				Page:    page,
			},
		}

		result, resp, err := p.client.Search.Issues(ctx, query, searchOpts)
		if err != nil {
			// If we already have some PRs, return what we have
			if len(allPRs) > 0 {
				break
			}
			return nil, fmt.Errorf("failed to search user PRs: %w", err)
		}

		for _, issue := range result.Issues {
			// GitHub Search API returns issues, but we filter by is:pr
			if issue.PullRequestLinks != nil {
				// Use basic info directly from search results - NO extra API calls
				// This is much faster than fetching full details for each PR
				pr := p.mapSearchIssueToPR(issue)
				if pr != nil {
					allPRs = append(allPRs, *pr)
				}
			}
		}

		// Check if there are more pages
		if resp.NextPage == 0 || len(result.Issues) < perPage {
			break
		}
		page = resp.NextPage
	}

	return allPRs, nil
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
// If full fetch fails (e.g., SAML), it falls back to basic info from search result
func (p *Provider) fetchPRFromIssue(ctx context.Context, issue *github.Issue) (*models.PullRequest, error) {
	// Extract owner and repo - try multiple sources
	var owner, repoName string

	// First try the Repository object
	if repo := issue.GetRepository(); repo != nil {
		owner = repo.GetOwner().GetLogin()
		repoName = repo.GetName()
	}

	// If that's empty, parse from RepositoryURL (format: https://api.github.com/repos/owner/repo)
	if owner == "" || repoName == "" {
		repoURL := issue.GetRepositoryURL()
		if repoURL != "" {
			// Parse: https://api.github.com/repos/owner/repo
			parts := strings.Split(repoURL, "/")
			if len(parts) >= 2 {
				owner = parts[len(parts)-2]
				repoName = parts[len(parts)-1]
			}
		}
	}

	// If still empty, try to parse from HTMLURL (format: https://github.com/owner/repo/pull/123)
	if owner == "" || repoName == "" {
		htmlURL := issue.GetHTMLURL()
		if htmlURL != "" {
			parts := strings.Split(htmlURL, "/")
			// Find "pull" and get owner/repo before it
			for i, part := range parts {
				if part == "pull" && i >= 2 {
					owner = parts[i-2]
					repoName = parts[i-1]
					break
				}
			}
		}
	}

	if owner == "" || repoName == "" {
		return nil, fmt.Errorf("could not extract repository info from issue")
	}

	// Try to fetch full PR details
	pr, _, err := p.client.PullRequests.Get(ctx, owner, repoName, issue.GetNumber())
	if err != nil {
		// Fall back to basic info from search result
		// This allows showing PRs from SAML-protected repos with limited info
		return mapIssueToBasicPR(issue, owner, repoName), nil
	}

	return mapPullRequest(pr), nil
}

// mapSearchIssueToPR creates a PR from search issue data without extra API calls
// Extracts owner/repo from the issue URL since Repository object may be nil
func (p *Provider) mapSearchIssueToPR(issue *github.Issue) *models.PullRequest {
	// Extract owner and repo from issue URLs
	var owner, repoName string

	// Try RepositoryURL first (format: https://api.github.com/repos/owner/repo)
	if repoURL := issue.GetRepositoryURL(); repoURL != "" {
		parts := strings.Split(repoURL, "/")
		if len(parts) >= 2 {
			owner = parts[len(parts)-2]
			repoName = parts[len(parts)-1]
		}
	}

	// Fallback to HTMLURL (format: https://github.com/owner/repo/pull/123)
	if owner == "" || repoName == "" {
		if htmlURL := issue.GetHTMLURL(); htmlURL != "" {
			parts := strings.Split(htmlURL, "/")
			for i, part := range parts {
				if part == "pull" && i >= 2 {
					owner = parts[i-2]
					repoName = parts[i-1]
					break
				}
			}
		}
	}

	if owner == "" || repoName == "" {
		return nil
	}

	return mapIssueToBasicPR(issue, owner, repoName)
}

// mapIssueToBasicPR creates a basic PR from search issue data
// Used as fallback when full PR fetch fails (e.g., SAML-protected repos)
func mapIssueToBasicPR(issue *github.Issue, owner, repo string) *models.PullRequest {
	pr := &models.PullRequest{
		Number:    issue.GetNumber(),
		Title:     issue.GetTitle(),
		Body:      issue.GetBody(),
		State:     models.PRStateOpen,
		URL:       issue.GetHTMLURL(),
		CreatedAt: issue.GetCreatedAt().Time,
		UpdatedAt: issue.GetUpdatedAt().Time,
		Repository: models.Repository{
			Name:     repo,
			FullName: fmt.Sprintf("%s/%s", owner, repo),
			Owner:    owner,
		},
	}

	// Set state based on issue state
	if issue.GetState() == "closed" {
		pr.State = models.PRStateClosed
	}

	// Map author
	if issue.GetUser() != nil {
		pr.Author = models.User{
			Login:     issue.GetUser().GetLogin(),
			AvatarURL: issue.GetUser().GetAvatarURL(),
		}
	}

	// Map labels
	for _, label := range issue.Labels {
		pr.Labels = append(pr.Labels, models.Label{
			Name:  label.GetName(),
			Color: label.GetColor(),
		})
	}

	// Map assignees
	for _, assignee := range issue.Assignees {
		pr.Assignees = append(pr.Assignees, models.User{
			Login:     assignee.GetLogin(),
			AvatarURL: assignee.GetAvatarURL(),
		})
	}

	return pr
}
