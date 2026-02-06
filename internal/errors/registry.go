package errors

// RegistryEntry provides detailed information about an error code
type RegistryEntry struct {
	Code           ErrorCode
	Title          string
	Description    string
	HelpURL        string
	ContextActions map[string]func(string) string // Dynamic suggestions based on context
}

// errorRegistry maps error codes to their detailed information
var errorRegistry = map[ErrorCode]*RegistryEntry{
	// Authentication errors (LR-1xx)
	ErrCodeAuthRequired: {
		Code:        ErrCodeAuthRequired,
		Title:       "Authentication Required",
		Description: "You need to authenticate with the provider before accessing this resource.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview#authentication",
		ContextActions: map[string]func(string) string{
			"provider": func(provider string) string {
				if provider != "" {
					return "Run: lazyreview auth login --provider " + provider
				}
				return "Run: lazyreview auth login"
			},
		},
	},
	ErrCodeAuthTokenExpired: {
		Code:        ErrCodeAuthTokenExpired,
		Title:       "Authentication Token Expired",
		Description: "Your authentication token has expired and needs to be renewed.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview#token-management",
		ContextActions: map[string]func(string) string{
			"provider": func(provider string) string {
				if provider != "" {
					return "Generate a new token for " + provider
				}
				return "Generate a new personal access token"
			},
		},
	},
	ErrCodeAuthInsufficientPerms: {
		Code:        ErrCodeAuthInsufficientPerms,
		Title:       "Insufficient Permissions",
		Description: "Your token does not have the required permissions/scopes for this operation.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview#required-scopes",
		ContextActions: map[string]func(string) string{
			"required_scopes": func(scopes string) string {
				if scopes != "" {
					return "Required scopes: " + scopes
				}
				return "Check the required scopes in the documentation"
			},
		},
	},
	ErrCodeAuthSAMLRequired: {
		Code:        ErrCodeAuthSAMLRequired,
		Title:       "SAML SSO Authorization Required",
		Description: "This organization requires SAML SSO authorization for your token.",
		HelpURL:     "https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on",
		ContextActions: map[string]func(string) string{
			"org": func(org string) string {
				if org != "" {
					return "Authorize the '" + org + "' organization at github.com/settings/tokens"
				}
				return "Go to github.com/settings/tokens and configure SSO"
			},
		},
	},

	// API errors (LR-2xx)
	ErrCodeAPIRateLimit: {
		Code:        ErrCodeAPIRateLimit,
		Title:       "API Rate Limit Exceeded",
		Description: "You have exceeded the API rate limit for this provider.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview#rate-limiting",
		ContextActions: map[string]func(string) string{
			"reset_time": func(resetTime string) string {
				if resetTime != "" {
					return "Rate limit resets at: " + resetTime
				}
				return "Wait for the rate limit to reset"
			},
		},
	},
	ErrCodeAPINetwork: {
		Code:        ErrCodeAPINetwork,
		Title:       "Network Connection Error",
		Description: "Failed to connect to the provider's API due to network issues.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview#network-troubleshooting",
		ContextActions: map[string]func(string) string{
			"host": func(host string) string {
				if host != "" {
					return "Check connectivity to " + host
				}
				return "Check your internet connection"
			},
		},
	},
	ErrCodeAPIInvalidResponse: {
		Code:        ErrCodeAPIInvalidResponse,
		Title:       "Invalid API Response",
		Description: "The provider returned an unexpected or invalid response.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview#api-errors",
		ContextActions: map[string]func(string) string{
			"status_code": func(code string) string {
				if code != "" {
					return "HTTP Status: " + code
				}
				return "Check if the API endpoint is available"
			},
		},
	},
	ErrCodeAPINotFound: {
		Code:        ErrCodeAPINotFound,
		Title:       "Resource Not Found",
		Description: "The requested resource was not found or you don't have access to it.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview#troubleshooting",
		ContextActions: map[string]func(string) string{
			"resource": func(resource string) string {
				if resource != "" {
					return "Resource not found: " + resource
				}
				return "Verify the resource exists and you have access"
			},
		},
	},

	// Configuration errors (LR-3xx)
	ErrCodeConfigInvalid: {
		Code:        ErrCodeConfigInvalid,
		Title:       "Invalid Configuration",
		Description: "The configuration file contains invalid or malformed data.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview#configuration",
		ContextActions: map[string]func(string) string{
			"field": func(field string) string {
				if field != "" {
					return "Check configuration field: " + field
				}
				return "Verify YAML syntax is correct"
			},
		},
	},
	ErrCodeConfigMissing: {
		Code:        ErrCodeConfigMissing,
		Title:       "Configuration File Missing",
		Description: "The configuration file could not be found.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview#initial-setup",
		ContextActions: map[string]func(string) string{
			"path": func(path string) string {
				if path != "" {
					return "Expected config at: " + path
				}
				return "Run: lazyreview config path"
			},
		},
	},
	ErrCodeConfigProviderNotFound: {
		Code:        ErrCodeConfigProviderNotFound,
		Title:       "Provider Not Configured",
		Description: "The requested provider is not configured in your config file.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview#adding-providers",
		ContextActions: map[string]func(string) string{
			"provider": func(provider string) string {
				if provider != "" {
					return "Add provider '" + provider + "' to your config file"
				}
				return "Run: lazyreview config edit"
			},
		},
	},

	// AI provider errors (LR-4xx)
	ErrCodeAIProviderError: {
		Code:        ErrCodeAIProviderError,
		Title:       "AI Provider Error",
		Description: "The AI provider encountered an error processing your request.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview#ai-features",
		ContextActions: map[string]func(string) string{
			"provider": func(provider string) string {
				if provider != "" {
					return "Check " + provider + " service status"
				}
				return "Check AI provider service status"
			},
		},
	},
	ErrCodeAITokenMissing: {
		Code:        ErrCodeAITokenMissing,
		Title:       "AI Token Missing",
		Description: "AI features require an API token to be configured.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview#ai-setup",
		ContextActions: map[string]func(string) string{
			"env_var": func(envVar string) string {
				if envVar != "" {
					return "Set environment variable: " + envVar
				}
				return "Configure your AI provider token"
			},
		},
	},
	ErrCodeAIRateLimit: {
		Code:        ErrCodeAIRateLimit,
		Title:       "AI Rate Limit Exceeded",
		Description: "You have exceeded the rate limit for the AI provider.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview#ai-limits",
		ContextActions: map[string]func(string) string{
			"retry_after": func(retryAfter string) string {
				if retryAfter != "" {
					return "Retry after: " + retryAfter
				}
				return "Wait before making additional AI requests"
			},
		},
	},

	// Internal errors (LR-5xx)
	ErrCodeInternalUnexpected: {
		Code:        ErrCodeInternalUnexpected,
		Title:       "Unexpected Internal Error",
		Description: "An unexpected error occurred. This is likely a bug.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview/issues",
		ContextActions: map[string]func(string) string{
			"operation": func(operation string) string {
				if operation != "" {
					return "Failed during: " + operation
				}
				return "Please report this issue on GitHub"
			},
		},
	},
	ErrCodeInternalStorage: {
		Code:        ErrCodeInternalStorage,
		Title:       "Storage Error",
		Description: "Failed to read or write to local storage.",
		HelpURL:     "https://github.com/tauantcamargo/lazyreview#troubleshooting",
		ContextActions: map[string]func(string) string{
			"path": func(path string) string {
				if path != "" {
					return "Check file permissions for: " + path
				}
				return "Check file system permissions"
			},
		},
	},
}

// GetRegistryEntry retrieves detailed information for an error code
func GetRegistryEntry(code ErrorCode) *RegistryEntry {
	entry, ok := errorRegistry[code]
	if !ok {
		return nil
	}
	return entry
}
