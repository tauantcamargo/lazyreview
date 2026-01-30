package github

import (
	"context"
	"fmt"
	"net/http"

	"lazyreview/internal/config"
	"lazyreview/internal/models"
	"lazyreview/pkg/providers"

	"github.com/google/go-github/v60/github"
)

// Provider implements the providers.Provider interface for GitHub
type Provider struct {
	client *github.Client
	config config.ProviderConfig
	token  string
}

// New creates a new GitHub provider
func New(cfg config.ProviderConfig) (*Provider, error) {
	return &Provider{
		config: cfg,
	}, nil
}

// Authenticate sets up the GitHub client with the given token
func (p *Provider) Authenticate(ctx context.Context, token string) error {
	p.token = token
	p.client = github.NewClient(nil).WithAuthToken(token)

	// For GitHub Enterprise, set custom base URL
	if p.config.Host != "" && p.config.Host != "github.com" {
		baseURL := p.config.GetAPIBaseURL()
		var err error
		p.client, err = p.client.WithEnterpriseURLs(baseURL, baseURL)
		if err != nil {
			return fmt.Errorf("failed to configure enterprise URL: %w", err)
		}
	}

	return nil
}

// ValidateToken checks if the token is valid by fetching the authenticated user
func (p *Provider) ValidateToken(ctx context.Context) (bool, error) {
	if p.client == nil {
		return false, providers.ErrNotAuthenticated
	}

	_, resp, err := p.client.Users.Get(ctx, "")
	if err != nil {
		if resp != nil && resp.StatusCode == http.StatusUnauthorized {
			return false, providers.ErrInvalidToken
		}
		return false, fmt.Errorf("failed to validate token: %w", err)
	}

	return true, nil
}

// GetCurrentUser returns the authenticated user
func (p *Provider) GetCurrentUser(ctx context.Context) (*models.User, error) {
	if p.client == nil {
		return nil, providers.ErrNotAuthenticated
	}

	user, _, err := p.client.Users.Get(ctx, "")
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return mapUser(user), nil
}

// Name returns the provider name
func (p *Provider) Name() string {
	return p.config.Name
}

// Type returns the provider type
func (p *Provider) Type() providers.ProviderType {
	return providers.ProviderTypeGitHub
}

// BaseURL returns the API base URL
func (p *Provider) BaseURL() string {
	return p.config.GetAPIBaseURL()
}

// Host returns the provider host
func (p *Provider) Host() string {
	return p.config.GetHost()
}

// Client returns the underlying GitHub client
func (p *Provider) Client() *github.Client {
	return p.client
}

// SetClient sets the GitHub client (for testing)
func (p *Provider) SetClient(client *github.Client) {
	p.client = client
}

// init registers the GitHub provider factory
func init() {
	providers.Register(providers.ProviderTypeGitHub, func(cfg config.ProviderConfig) (providers.Provider, error) {
		return New(cfg)
	})
}
