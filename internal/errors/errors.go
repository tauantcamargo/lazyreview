// Package errors provides enhanced error types with actionable suggestions.
package errors

import (
	"fmt"
	"strings"
)

// ActionableError is an error that includes suggestions for how to fix it.
type ActionableError struct {
	Err         error
	Message     string
	Suggestions []string
	HelpURL     string
}

func (e *ActionableError) Error() string {
	var sb strings.Builder
	sb.WriteString(e.Message)

	if e.Err != nil {
		sb.WriteString(": ")
		sb.WriteString(e.Err.Error())
	}

	return sb.String()
}

func (e *ActionableError) Unwrap() error {
	return e.Err
}

// FormatWithSuggestions returns the error message with suggestions formatted for display.
func (e *ActionableError) FormatWithSuggestions() string {
	var sb strings.Builder
	sb.WriteString("Error: ")
	sb.WriteString(e.Message)

	if e.Err != nil {
		sb.WriteString("\n")
		sb.WriteString("Details: ")
		sb.WriteString(e.Err.Error())
	}

	if len(e.Suggestions) > 0 {
		sb.WriteString("\n\nHow to fix:")
		for i, suggestion := range e.Suggestions {
			sb.WriteString(fmt.Sprintf("\n  %d. %s", i+1, suggestion))
		}
	}

	if e.HelpURL != "" {
		sb.WriteString("\n\nFor more help: ")
		sb.WriteString(e.HelpURL)
	}

	return sb.String()
}

// New creates a new ActionableError.
func New(message string, suggestions ...string) *ActionableError {
	return &ActionableError{
		Message:     message,
		Suggestions: suggestions,
	}
}

// Wrap wraps an existing error with actionable suggestions.
func Wrap(err error, message string, suggestions ...string) *ActionableError {
	return &ActionableError{
		Err:         err,
		Message:     message,
		Suggestions: suggestions,
	}
}

// WithHelp adds a help URL to the error.
func (e *ActionableError) WithHelp(url string) *ActionableError {
	e.HelpURL = url
	return e
}

// Common error constructors with built-in suggestions

// AuthenticationRequired returns an error for missing authentication.
func AuthenticationRequired(provider string) *ActionableError {
	return &ActionableError{
		Message: fmt.Sprintf("Not authenticated with %s", provider),
		Suggestions: []string{
			fmt.Sprintf("Run: lazyreview auth login --provider %s", provider),
			"Check if your token has expired",
			"Verify you have the required scopes/permissions",
		},
		HelpURL: "https://github.com/tauantcamargo/lazyreview#authentication",
	}
}

// TokenExpired returns an error for expired tokens.
func TokenExpired(provider string) *ActionableError {
	return &ActionableError{
		Message: fmt.Sprintf("Token for %s has expired", provider),
		Suggestions: []string{
			"Generate a new personal access token",
			fmt.Sprintf("Run: lazyreview auth login --provider %s", provider),
			"Consider using a token with no expiration for CI/CD",
		},
	}
}

// InsufficientPermissions returns an error for scope/permission issues.
func InsufficientPermissions(provider string, requiredScopes []string) *ActionableError {
	scopeList := strings.Join(requiredScopes, ", ")
	return &ActionableError{
		Message: fmt.Sprintf("Insufficient permissions for %s", provider),
		Suggestions: []string{
			fmt.Sprintf("Required scopes: %s", scopeList),
			"Generate a new token with the correct scopes",
			fmt.Sprintf("Run: lazyreview auth login --provider %s", provider),
		},
	}
}

// SAMLRequired returns an error for GitHub SAML SSO requirements.
func SAMLRequired(org string) *ActionableError {
	return &ActionableError{
		Message: fmt.Sprintf("SAML SSO authorization required for organization '%s'", org),
		Suggestions: []string{
			"Go to: github.com/settings/tokens",
			"Find your token and click 'Configure SSO'",
			fmt.Sprintf("Authorize the '%s' organization", org),
			"Restart LazyReview after authorizing",
		},
		HelpURL: "https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on",
	}
}

// RateLimitExceeded returns an error for API rate limiting.
func RateLimitExceeded(provider string, resetTime string) *ActionableError {
	suggestions := []string{
		"Wait for the rate limit to reset",
		"Use caching to reduce API calls (performance.cache_ttl in config)",
	}
	if resetTime != "" {
		suggestions = append(suggestions, fmt.Sprintf("Rate limit resets at: %s", resetTime))
	}

	return &ActionableError{
		Message:     fmt.Sprintf("API rate limit exceeded for %s", provider),
		Suggestions: suggestions,
	}
}

// NetworkError returns an error for network connectivity issues.
func NetworkError(err error) *ActionableError {
	return &ActionableError{
		Err:     err,
		Message: "Network connection error",
		Suggestions: []string{
			"Check your internet connection",
			"Verify you can reach the provider's API",
			"Check if you need to configure a proxy",
			"Try again in a few moments",
		},
	}
}

// ConfigurationError returns an error for config issues.
func ConfigurationError(message string) *ActionableError {
	return &ActionableError{
		Message: message,
		Suggestions: []string{
			"Run: lazyreview config path (to find config file)",
			"Run: lazyreview config edit (to edit config)",
			"Check YAML syntax is valid",
		},
	}
}

// ProviderNotSupported returns an error for unsupported providers.
func ProviderNotSupported(provider string) *ActionableError {
	return &ActionableError{
		Message: fmt.Sprintf("Provider '%s' is not supported", provider),
		Suggestions: []string{
			"Supported providers: github, gitlab, bitbucket, azuredevops",
			"Check spelling and try again",
		},
	}
}
