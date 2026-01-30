package config

// ProviderType represents the type of Git provider
type ProviderType string

const (
	ProviderTypeGitHub      ProviderType = "github"
	ProviderTypeGitLab      ProviderType = "gitlab"
	ProviderTypeBitbucket   ProviderType = "bitbucket"
	ProviderTypeAzureDevOps ProviderType = "azuredevops"
)

// ProviderConfig holds configuration for a single provider
type ProviderConfig struct {
	// Name is the unique identifier for this provider configuration
	Name string `mapstructure:"name"`

	// Type is the provider type (github, gitlab, bitbucket, azuredevops)
	Type ProviderType `mapstructure:"type"`

	// Host is the hostname (e.g., "github.com", "gitlab.company.internal")
	Host string `mapstructure:"host"`

	// BaseURL is the API base URL (optional, derived from host if not set)
	BaseURL string `mapstructure:"base_url"`

	// TokenEnv is the environment variable name containing the auth token
	TokenEnv string `mapstructure:"token_env"`

	// DefaultQuery contains default filters for PR listing
	DefaultQuery DefaultQueryConfig `mapstructure:"default_query"`
}

// DefaultQueryConfig holds default query parameters for PR listing
type DefaultQueryConfig struct {
	State           string `mapstructure:"state"`            // open, closed, merged, all
	ReviewRequested string `mapstructure:"review_requested"` // "me" or username
	Author          string `mapstructure:"author"`           // "me" or username
	Assignee        string `mapstructure:"assignee"`         // "me" or username
	Labels          string `mapstructure:"labels"`           // comma-separated labels
}

// GetAPIBaseURL returns the API base URL for the provider
func (p *ProviderConfig) GetAPIBaseURL() string {
	if p.BaseURL != "" {
		return p.BaseURL
	}

	switch p.Type {
	case ProviderTypeGitHub:
		if p.Host == "github.com" || p.Host == "" {
			return "https://api.github.com"
		}
		return "https://" + p.Host + "/api/v3"
	case ProviderTypeGitLab:
		if p.Host == "gitlab.com" || p.Host == "" {
			return "https://gitlab.com/api/v4"
		}
		return "https://" + p.Host + "/api/v4"
	case ProviderTypeBitbucket:
		if p.Host == "bitbucket.org" || p.Host == "" {
			return "https://api.bitbucket.org/2.0"
		}
		return "https://" + p.Host + "/rest/api/1.0"
	case ProviderTypeAzureDevOps:
		return "https://dev.azure.com"
	default:
		return ""
	}
}

// GetHost returns the host, using defaults if not set
func (p *ProviderConfig) GetHost() string {
	if p.Host != "" {
		return p.Host
	}

	switch p.Type {
	case ProviderTypeGitHub:
		return "github.com"
	case ProviderTypeGitLab:
		return "gitlab.com"
	case ProviderTypeBitbucket:
		return "bitbucket.org"
	case ProviderTypeAzureDevOps:
		return "dev.azure.com"
	default:
		return ""
	}
}

// Validate checks if the provider configuration is valid
func (p *ProviderConfig) Validate() error {
	if p.Name == "" {
		return ErrProviderNameRequired
	}
	if p.Type == "" {
		return ErrProviderTypeRequired
	}
	switch p.Type {
	case ProviderTypeGitHub, ProviderTypeGitLab, ProviderTypeBitbucket, ProviderTypeAzureDevOps:
		// Valid type
	default:
		return ErrInvalidProviderType
	}
	return nil
}

// ProviderConfigError represents a provider configuration error
type ProviderConfigError string

func (e ProviderConfigError) Error() string {
	return string(e)
}

const (
	ErrProviderNameRequired ProviderConfigError = "provider name is required"
	ErrProviderTypeRequired ProviderConfigError = "provider type is required"
	ErrInvalidProviderType  ProviderConfigError = "invalid provider type"
)
