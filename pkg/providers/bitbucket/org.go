package bitbucket

import (
	"context"

	"lazyreview/internal/models"
	"lazyreview/pkg/providers"
)

// ListOrganizations returns organizations the authenticated user belongs to
// Bitbucket uses workspaces instead of organizations
func (p *Provider) ListOrganizations(ctx context.Context) ([]providers.Organization, error) {
	// Stub implementation - returns empty list
	// TODO: Implement using /workspaces endpoint
	return []providers.Organization{}, nil
}

// ListOrganizationRepos returns repositories in an organization
// Bitbucket uses workspaces instead of organizations
func (p *Provider) ListOrganizationRepos(ctx context.Context, org string, opts providers.ListReposOptions) ([]models.Repository, error) {
	// Stub implementation - returns empty list
	// TODO: Implement using /repositories/{workspace} endpoint
	return []models.Repository{}, nil
}

// ListUserRepos returns the authenticated user's repositories
func (p *Provider) ListUserRepos(ctx context.Context, opts providers.ListReposOptions) ([]models.Repository, error) {
	// Stub implementation - returns empty list
	// TODO: Implement using /user/permissions/repositories endpoint
	return []models.Repository{}, nil
}

// ListUserPullRequests returns PRs across repositories for the authenticated user
func (p *Provider) ListUserPullRequests(ctx context.Context, opts providers.UserPROptions) ([]models.PullRequest, error) {
	// Stub implementation - returns empty list
	// TODO: Implement using /pullrequests/{selected_user} endpoint
	return []models.PullRequest{}, nil
}
