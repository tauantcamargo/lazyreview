package azuredevops

import (
	"context"

	"lazyreview/internal/models"
	"lazyreview/pkg/providers"
)

// ListOrganizations returns organizations the authenticated user belongs to
func (p *Provider) ListOrganizations(ctx context.Context) ([]providers.Organization, error) {
	// Stub implementation - returns empty list
	// TODO: Implement using Azure DevOps accounts API
	return []providers.Organization{}, nil
}

// ListOrganizationRepos returns repositories in an organization
func (p *Provider) ListOrganizationRepos(ctx context.Context, org string, opts providers.ListReposOptions) ([]models.Repository, error) {
	// Stub implementation - returns empty list
	// TODO: Implement using Azure DevOps Git Repositories API
	return []models.Repository{}, nil
}

// ListUserRepos returns the authenticated user's repositories
func (p *Provider) ListUserRepos(ctx context.Context, opts providers.ListReposOptions) ([]models.Repository, error) {
	// Stub implementation - returns empty list
	// TODO: Implement using Azure DevOps Git Repositories API with user filter
	return []models.Repository{}, nil
}

// ListUserPullRequests returns PRs across repositories for the authenticated user
func (p *Provider) ListUserPullRequests(ctx context.Context, opts providers.UserPROptions) ([]models.PullRequest, error) {
	// Stub implementation - returns empty list
	// TODO: Implement using Azure DevOps Pull Requests API with creator filter
	return []models.PullRequest{}, nil
}
