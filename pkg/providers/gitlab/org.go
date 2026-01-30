package gitlab

import (
	"context"

	"lazyreview/internal/models"
	"lazyreview/pkg/providers"
)

// ListOrganizations returns organizations the authenticated user belongs to
// GitLab uses groups instead of organizations
func (p *Provider) ListOrganizations(ctx context.Context) ([]providers.Organization, error) {
	// Stub implementation - returns empty list
	// TODO: Implement using p.client.Groups.ListGroups()
	return []providers.Organization{}, nil
}

// ListOrganizationRepos returns repositories in an organization
// GitLab uses groups instead of organizations
func (p *Provider) ListOrganizationRepos(ctx context.Context, org string, opts providers.ListReposOptions) ([]models.Repository, error) {
	// Stub implementation - returns empty list
	// TODO: Implement using p.client.Groups.ListGroupProjects()
	return []models.Repository{}, nil
}

// ListUserRepos returns the authenticated user's repositories
func (p *Provider) ListUserRepos(ctx context.Context, opts providers.ListReposOptions) ([]models.Repository, error) {
	// Stub implementation - returns empty list
	// TODO: Implement using p.client.Projects.ListUserProjects()
	return []models.Repository{}, nil
}

// ListUserPullRequests returns PRs across repositories for the authenticated user
// GitLab calls them Merge Requests (MRs)
func (p *Provider) ListUserPullRequests(ctx context.Context, opts providers.UserPROptions) ([]models.PullRequest, error) {
	// Stub implementation - returns empty list
	// TODO: Implement using p.client.MergeRequests.ListMergeRequests()
	return []models.PullRequest{}, nil
}
