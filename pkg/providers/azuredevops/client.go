package azuredevops

import (
	"context"
	"encoding/base64"
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
	defaultBaseURL = "https://dev.azure.com"
	apiVersion     = "7.1"
)

// Provider implements the providers.Provider interface for Azure DevOps
type Provider struct {
	client       *http.Client
	baseURL      string
	config       config.ProviderConfig
	token        string
	organization string
}

// New creates a new Azure DevOps provider
func New(cfg config.ProviderConfig) (*Provider, error) {
	baseURL := defaultBaseURL
	if cfg.Host != "" && cfg.Host != "dev.azure.com" {
		baseURL = cfg.GetAPIBaseURL()
	}

	return &Provider{
		client:  &http.Client{},
		baseURL: baseURL,
		config:  cfg,
	}, nil
}

// Authenticate sets up the Azure DevOps client with the given PAT
func (p *Provider) Authenticate(ctx context.Context, token string) error {
	p.token = token
	return nil
}

// ValidateToken checks if the token is valid
func (p *Provider) ValidateToken(ctx context.Context) (bool, error) {
	if p.token == "" {
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
	// Azure DevOps user profile endpoint
	var profile adoProfile
	err := p.get(ctx, "https://app.vssps.visualstudio.com/_apis/profile/profiles/me", &profile)
	if err != nil {
		return nil, fmt.Errorf("failed to get user profile: %w", err)
	}

	return &models.User{
		ID:    profile.ID,
		Login: profile.EmailAddress,
		Name:  profile.DisplayName,
	}, nil
}

// Name returns the provider name
func (p *Provider) Name() string {
	return p.config.Name
}

// Type returns the provider type
func (p *Provider) Type() providers.ProviderType {
	return providers.ProviderTypeAzureDevOps
}

// BaseURL returns the API base URL
func (p *Provider) BaseURL() string {
	return p.baseURL
}

// Host returns the provider host
func (p *Provider) Host() string {
	return p.config.GetHost()
}

// SetOrganization sets the organization for API calls
func (p *Provider) SetOrganization(org string) {
	p.organization = org
}

// HTTP helpers

func (p *Provider) get(ctx context.Context, urlPath string, result any) error {
	return p.doRequest(ctx, http.MethodGet, urlPath, nil, result)
}

func (p *Provider) post(ctx context.Context, urlPath string, body any, result any) error {
	return p.doRequest(ctx, http.MethodPost, urlPath, body, result)
}

func (p *Provider) patch(ctx context.Context, urlPath string, body any, result any) error {
	return p.doRequest(ctx, http.MethodPatch, urlPath, body, result)
}

func (p *Provider) doRequest(ctx context.Context, method, urlPath string, body any, result any) error {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal body: %w", err)
		}
		bodyReader = strings.NewReader(string(jsonBody))
	}

	req, err := http.NewRequestWithContext(ctx, method, urlPath, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Azure DevOps uses Basic auth with empty username and PAT as password
	auth := base64.StdEncoding.EncodeToString([]byte(":" + p.token))
	req.Header.Set("Authorization", "Basic "+auth)
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

// buildURL builds an API URL with the given path and optional params
func (p *Provider) buildURL(org, project, path string, params map[string]string) string {
	baseURL := fmt.Sprintf("%s/%s/%s/_apis/%s", p.baseURL, org, project, path)

	values := url.Values{}
	values.Set("api-version", apiVersion)
	for k, v := range params {
		values.Set(k, v)
	}

	return baseURL + "?" + values.Encode()
}

// init registers the Azure DevOps provider factory
func init() {
	providers.Register(providers.ProviderTypeAzureDevOps, func(cfg config.ProviderConfig) (providers.Provider, error) {
		return New(cfg)
	})
}
