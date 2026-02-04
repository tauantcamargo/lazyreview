package ai

import (
	"context"
	"errors"
	"os"
	"strings"
)

// Decision represents the AI review outcome.
type Decision string

const (
	DecisionApprove        Decision = "approve"
	DecisionRequestChanges Decision = "request_changes"
	DecisionComment        Decision = "comment"
)

// ReviewRequest represents input to the AI reviewer.
type ReviewRequest struct {
	FilePath string
	Diff     string
}

// ReviewResponse represents the AI review output.
type ReviewResponse struct {
	Decision Decision
	Comment  string
}

// Provider defines an AI review provider.
type Provider interface {
	Review(ctx context.Context, req ReviewRequest) (ReviewResponse, error)
}

// NewProviderFromEnv creates a provider from environment variables.
func NewProviderFromEnv() (Provider, error) {
	provider := strings.ToLower(strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_PROVIDER")))
	if provider == "" {
		return nil, errors.New("LAZYREVIEW_AI_PROVIDER not set")
	}

	switch provider {
	case "openai":
		return NewOpenAIProviderFromEnv()
	default:
		return nil, errors.New("unsupported AI provider: " + provider)
	}
}

// NewProviderFromConfig creates a provider from explicit runtime config.
func NewProviderFromConfig(providerName, apiKey, model, baseURL string) (Provider, error) {
	provider := strings.ToLower(strings.TrimSpace(providerName))
	switch provider {
	case "", "none", "disabled":
		return nil, errors.New("AI provider not configured")
	case "openai":
		return NewOpenAIProvider(apiKey, model, baseURL)
	default:
		return nil, errors.New("unsupported AI provider: " + provider)
	}
}
