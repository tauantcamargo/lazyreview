package github

import (
	"context"
	"fmt"
	"net/http"

	"lazyreview/internal/config"

	ghlib "github.com/google/go-github/v60/github"
)

// TokenValidator validates GitHub tokens
type TokenValidator struct {
	host string
}

// NewTokenValidator creates a new GitHub token validator
func NewTokenValidator(host string) *TokenValidator {
	if host == "" {
		host = "github.com"
	}
	return &TokenValidator{host: host}
}

// ValidateToken validates a GitHub token and returns the username
func (v *TokenValidator) ValidateToken(ctx context.Context, token string) (string, error) {
	client := ghlib.NewClient(nil).WithAuthToken(token)

	// Configure for GitHub Enterprise if needed
	if v.host != "" && v.host != "github.com" {
		cfg := config.ProviderConfig{
			Type: config.ProviderTypeGitHub,
			Host: v.host,
		}
		baseURL := cfg.GetAPIBaseURL()
		var err error
		client, err = client.WithEnterpriseURLs(baseURL, baseURL)
		if err != nil {
			return "", fmt.Errorf("failed to configure enterprise URL: %w", err)
		}
	}

	user, resp, err := client.Users.Get(ctx, "")
	if err != nil {
		if resp != nil && resp.StatusCode == http.StatusUnauthorized {
			return "", fmt.Errorf("invalid token")
		}
		return "", fmt.Errorf("failed to validate token: %w", err)
	}

	if user.Login == nil {
		return "", fmt.Errorf("unable to get username")
	}

	return *user.Login, nil
}
