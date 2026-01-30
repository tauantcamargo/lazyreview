package bitbucket

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"lazyreview/internal/config"
	"lazyreview/internal/models"
	"lazyreview/pkg/providers"
)

const (
	defaultBaseURL = "https://api.bitbucket.org/2.0"
)

// Provider implements the providers.Provider interface for Bitbucket
type Provider struct {
	client   *http.Client
	baseURL  string
	config   config.ProviderConfig
	username string
	password string // App password
}

// New creates a new Bitbucket provider
func New(cfg config.ProviderConfig) (*Provider, error) {
	baseURL := defaultBaseURL
	if cfg.Host != "" && cfg.Host != "bitbucket.org" {
		baseURL = cfg.GetAPIBaseURL()
	}

	return &Provider{
		client:  &http.Client{},
		baseURL: baseURL,
		config:  cfg,
	}, nil
}

// Authenticate sets up the Bitbucket client with the given credentials
// For Bitbucket, token should be in format "username:app_password"
func (p *Provider) Authenticate(ctx context.Context, token string) error {
	parts := strings.SplitN(token, ":", 2)
	if len(parts) != 2 {
		return fmt.Errorf("invalid token format: expected 'username:app_password'")
	}

	p.username = parts[0]
	p.password = parts[1]

	return nil
}

// ValidateToken checks if the token is valid
func (p *Provider) ValidateToken(ctx context.Context) (bool, error) {
	if p.username == "" || p.password == "" {
		return false, providers.ErrNotAuthenticated
	}

	_, err := p.GetCurrentUser(ctx)
	if err != nil {
		return false, err
	}

	return true, nil
}

// GetCurrentUser returns the authenticated user
func (p *Provider) GetCurrentUser(ctx context.Context) (*models.User, error) {
	var user bbUser
	err := p.get(ctx, "/user", &user)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return mapUser(&user), nil
}

// Name returns the provider name
func (p *Provider) Name() string {
	return p.config.Name
}

// Type returns the provider type
func (p *Provider) Type() providers.ProviderType {
	return providers.ProviderTypeBitbucket
}

// BaseURL returns the API base URL
func (p *Provider) BaseURL() string {
	return p.baseURL
}

// Host returns the provider host
func (p *Provider) Host() string {
	return p.config.GetHost()
}

// HTTP helpers

func (p *Provider) get(ctx context.Context, path string, result interface{}) error {
	return p.doRequest(ctx, http.MethodGet, path, nil, result)
}

func (p *Provider) post(ctx context.Context, path string, body interface{}, result interface{}) error {
	return p.doRequest(ctx, http.MethodPost, path, body, result)
}

func (p *Provider) put(ctx context.Context, path string, body interface{}, result interface{}) error {
	return p.doRequest(ctx, http.MethodPut, path, body, result)
}

func (p *Provider) delete(ctx context.Context, path string) error {
	return p.doRequest(ctx, http.MethodDelete, path, nil, nil)
}

func (p *Provider) doRequest(ctx context.Context, method, path string, body interface{}, result interface{}) error {
	fullURL := p.baseURL + path

	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal body: %w", err)
		}
		bodyReader = strings.NewReader(string(jsonBody))
	}

	req, err := http.NewRequestWithContext(ctx, method, fullURL, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.SetBasicAuth(p.username, p.password)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return providers.ErrInvalidToken
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	if result != nil && resp.ContentLength != 0 {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("failed to decode response: %w", err)
		}
	}

	return nil
}

func (p *Provider) buildURL(path string, params map[string]string) string {
	if len(params) == 0 {
		return path
	}

	values := url.Values{}
	for k, v := range params {
		values.Set(k, v)
	}

	return path + "?" + values.Encode()
}

// init registers the Bitbucket provider factory
func init() {
	providers.Register(providers.ProviderTypeBitbucket, func(cfg config.ProviderConfig) (providers.Provider, error) {
		return New(cfg)
	})
}
