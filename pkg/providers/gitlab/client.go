package gitlab

import (
	"context"
	"fmt"
	"net/http"

	"lazyreview/internal/config"
	"lazyreview/internal/models"
	"lazyreview/pkg/providers"

	gl "gitlab.com/gitlab-org/api/client-go"
)

// Provider implements the providers.Provider interface for GitLab
type Provider struct {
	client *gl.Client
	config config.ProviderConfig
	token  string
}

// New creates a new GitLab provider
func New(cfg config.ProviderConfig) (*Provider, error) {
	return &Provider{
		config: cfg,
	}, nil
}

// Authenticate sets up the GitLab client with the given token
func (p *Provider) Authenticate(ctx context.Context, token string) error {
	p.token = token

	var opts []gl.ClientOptionFunc

	// For self-hosted GitLab, set custom base URL
	if p.config.Host != "" && p.config.Host != "gitlab.com" {
		baseURL := p.config.GetAPIBaseURL()
		opts = append(opts, gl.WithBaseURL(baseURL))
	}

	client, err := gl.NewClient(token, opts...)
	if err != nil {
		return fmt.Errorf("failed to create GitLab client: %w", err)
	}

	p.client = client
	return nil
}

// ValidateToken checks if the token is valid by fetching the authenticated user
func (p *Provider) ValidateToken(ctx context.Context) (bool, error) {
	if p.client == nil {
		return false, providers.ErrNotAuthenticated
	}

	_, resp, err := p.client.Users.CurrentUser(gl.WithContext(ctx))
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

	user, _, err := p.client.Users.CurrentUser(gl.WithContext(ctx))
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
	return providers.ProviderTypeGitLab
}

// BaseURL returns the API base URL
func (p *Provider) BaseURL() string {
	return p.config.GetAPIBaseURL()
}

// Host returns the provider host
func (p *Provider) Host() string {
	return p.config.GetHost()
}

// Client returns the underlying GitLab client
func (p *Provider) Client() *gl.Client {
	return p.client
}

// SetClient sets the GitLab client (for testing)
func (p *Provider) SetClient(client *gl.Client) {
	p.client = client
}

// init registers the GitLab provider factory
func init() {
	providers.Register(providers.ProviderTypeGitLab, func(cfg config.ProviderConfig) (providers.Provider, error) {
		return New(cfg)
	})
}
