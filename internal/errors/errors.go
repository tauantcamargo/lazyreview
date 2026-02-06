// Package errors provides enhanced error types with actionable suggestions.
package errors

import (
	"fmt"
	"strings"
)

// ActionableError is an error that includes suggestions for how to fix it.
type ActionableError struct {
	Code        ErrorCode
	Err         error
	Message     string
	Suggestions []string
	HelpURL     string
	Context     map[string]string // Context for dynamic suggestions
}

func (e *ActionableError) Error() string {
	var sb strings.Builder

	// Include error code if present
	if e.Code != "" {
		sb.WriteString("[")
		sb.WriteString(string(e.Code))
		sb.WriteString("] ")
	}

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

// WithHelp adds a help URL to the error (returns new instance for immutability).
func (e *ActionableError) WithHelp(url string) *ActionableError {
	return &ActionableError{
		Code:        e.Code,
		Err:         e.Err,
		Message:     e.Message,
		Suggestions: e.Suggestions,
		HelpURL:     url,
		Context:     e.Context,
	}
}

// WithContext adds context data for dynamic suggestions (returns new instance for immutability).
func (e *ActionableError) WithContext(context map[string]string) *ActionableError {
	// Create a copy of the context map
	contextCopy := make(map[string]string, len(context))
	for k, v := range context {
		contextCopy[k] = v
	}

	return &ActionableError{
		Code:        e.Code,
		Err:         e.Err,
		Message:     e.Message,
		Suggestions: e.Suggestions,
		HelpURL:     e.HelpURL,
		Context:     contextCopy,
	}
}

// GetContextualSuggestions returns suggestions enhanced with context data.
func (e *ActionableError) GetContextualSuggestions() []string {
	suggestions := make([]string, len(e.Suggestions))
	copy(suggestions, e.Suggestions)

	// Add context-aware suggestions from registry
	if e.Code != "" {
		entry := GetRegistryEntry(e.Code)
		if entry != nil && len(entry.ContextActions) > 0 {
			for key, actionFunc := range entry.ContextActions {
				if value, ok := e.Context[key]; ok {
					contextSuggestion := actionFunc(value)
					if contextSuggestion != "" {
						// Add to the beginning if it's context-specific
						suggestions = append([]string{contextSuggestion}, suggestions...)
					}
				}
			}
		}
	}

	return suggestions
}

// NewWithCode creates a new ActionableError with an error code.
func NewWithCode(code ErrorCode, message string, suggestions ...string) *ActionableError {
	err := &ActionableError{
		Code:        code,
		Message:     message,
		Suggestions: suggestions,
		Context:     make(map[string]string),
	}

	// Populate help URL from registry if available
	if entry := GetRegistryEntry(code); entry != nil {
		err.HelpURL = entry.HelpURL
	}

	return err
}

// WrapWithCode wraps an existing error with an error code and actionable suggestions.
func WrapWithCode(originalErr error, code ErrorCode, message string, suggestions ...string) *ActionableError {
	err := NewWithCode(code, message, suggestions...)
	err.Err = originalErr
	return err
}

// Common error constructors with built-in suggestions

// AuthenticationRequired returns an error for missing authentication.
func AuthenticationRequired(provider string) *ActionableError {
	err := NewWithCode(
		ErrCodeAuthRequired,
		fmt.Sprintf("Not authenticated with %s", provider),
		fmt.Sprintf("Run: lazyreview auth login --provider %s", provider),
		"Check if your token has expired",
		"Verify you have the required scopes/permissions",
	)
	return err.WithContext(map[string]string{"provider": provider})
}

// TokenExpired returns an error for expired tokens.
func TokenExpired(provider string) *ActionableError {
	err := NewWithCode(
		ErrCodeAuthTokenExpired,
		fmt.Sprintf("Token for %s has expired", provider),
		"Generate a new personal access token",
		fmt.Sprintf("Run: lazyreview auth login --provider %s", provider),
		"Consider using a token with no expiration for CI/CD",
	)
	return err.WithContext(map[string]string{"provider": provider})
}

// InsufficientPermissions returns an error for scope/permission issues.
func InsufficientPermissions(provider string, requiredScopes []string) *ActionableError {
	scopeList := strings.Join(requiredScopes, ", ")
	err := NewWithCode(
		ErrCodeAuthInsufficientPerms,
		fmt.Sprintf("Insufficient permissions for %s", provider),
		fmt.Sprintf("Required scopes: %s", scopeList),
		"Generate a new token with the correct scopes",
		fmt.Sprintf("Run: lazyreview auth login --provider %s", provider),
	)
	return err.WithContext(map[string]string{
		"provider":        provider,
		"required_scopes": scopeList,
	})
}

// SAMLRequired returns an error for GitHub SAML SSO requirements.
func SAMLRequired(org string) *ActionableError {
	err := NewWithCode(
		ErrCodeAuthSAMLRequired,
		fmt.Sprintf("SAML SSO authorization required for organization '%s'", org),
		"Go to: github.com/settings/tokens",
		"Find your token and click 'Configure SSO'",
		fmt.Sprintf("Authorize the '%s' organization", org),
		"Restart LazyReview after authorizing",
	)
	return err.WithContext(map[string]string{"org": org})
}

// RateLimitExceeded returns an error for API rate limiting.
func RateLimitExceeded(provider string, resetTime string) *ActionableError {
	err := NewWithCode(
		ErrCodeAPIRateLimit,
		fmt.Sprintf("API rate limit exceeded for %s", provider),
		"Wait for the rate limit to reset",
		"Use caching to reduce API calls (performance.cache_ttl in config)",
	)

	context := map[string]string{"provider": provider}
	if resetTime != "" {
		context["reset_time"] = resetTime
	}

	return err.WithContext(context)
}

// NetworkError returns an error for network connectivity issues.
func NetworkError(err error) *ActionableError {
	return WrapWithCode(
		err,
		ErrCodeAPINetwork,
		"Network connection error",
		"Check your internet connection",
		"Verify you can reach the provider's API",
		"Check if you need to configure a proxy",
		"Try again in a few moments",
	)
}

// ConfigurationError returns an error for config issues.
func ConfigurationError(message string) *ActionableError {
	return NewWithCode(
		ErrCodeConfigInvalid,
		message,
		"Run: lazyreview config path (to find config file)",
		"Run: lazyreview config edit (to edit config)",
		"Check YAML syntax is valid",
	)
}

// ProviderNotSupported returns an error for unsupported providers.
func ProviderNotSupported(provider string) *ActionableError {
	err := NewWithCode(
		ErrCodeConfigProviderNotFound,
		fmt.Sprintf("Provider '%s' is not supported", provider),
		"Supported providers: github, gitlab, bitbucket, azuredevops",
		"Check spelling and try again",
	)
	return err.WithContext(map[string]string{"provider": provider})
}
