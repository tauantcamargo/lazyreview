package ai

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"
)

// ProviderConfig represents AI provider configuration.
type ProviderConfig struct {
	Provider string
	APIKey   string
	Model    string
	BaseURL  string // For OpenAI or Ollama host
}

// ProviderFactory manages AI provider instantiation and runtime switching.
type ProviderFactory struct {
	mu                sync.RWMutex
	currentProvider   Provider
	currentName       string
	config            ProviderConfig
	fallbackChain     []string
	availabilityCache map[string]bool
	cacheTTL          time.Duration
}

// FactoryOption configures the provider factory.
type FactoryOption func(*ProviderFactory)

// WithFallbackChain sets the fallback provider chain.
func WithFallbackChain(chain []string) FactoryOption {
	return func(f *ProviderFactory) {
		f.fallbackChain = chain
	}
}

// WithCacheTTL sets the cache TTL for availability checks.
func WithCacheTTL(ttl time.Duration) FactoryOption {
	return func(f *ProviderFactory) {
		f.cacheTTL = ttl
	}
}

// NewProviderFactory creates a new provider factory.
func NewProviderFactory(config ProviderConfig, opts ...FactoryOption) (*ProviderFactory, error) {
	factory := &ProviderFactory{
		config:            config,
		fallbackChain:     []string{"openai", "anthropic", "ollama"},
		availabilityCache: make(map[string]bool),
		cacheTTL:          5 * time.Minute,
	}

	for _, opt := range opts {
		opt(factory)
	}

	// Initialize the provider
	provider, name, err := factory.createProvider(config)
	if err != nil {
		// Try fallback chain if configured provider fails
		if config.Provider != "" {
			for _, fallbackName := range factory.fallbackChain {
				if fallbackName == strings.ToLower(config.Provider) {
					continue // Skip the already-failed provider
				}

				fallbackConfig := ProviderConfig{
					Provider: fallbackName,
					APIKey:   config.APIKey,
					Model:    config.Model,
					BaseURL:  config.BaseURL,
				}

				provider, name, err = factory.createProvider(fallbackConfig)
				if err == nil {
					factory.currentProvider = provider
					factory.currentName = name
					return factory, nil
				}
			}
		}
		return nil, fmt.Errorf("failed to initialize AI provider: %w", err)
	}

	factory.currentProvider = provider
	factory.currentName = name
	return factory, nil
}

// GetProvider returns the current active provider.
func (f *ProviderFactory) GetProvider() Provider {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.currentProvider
}

// GetProviderName returns the name of the current active provider.
func (f *ProviderFactory) GetProviderName() string {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.currentName
}

// SwitchProvider switches to a different AI provider at runtime.
func (f *ProviderFactory) SwitchProvider(name string, config ProviderConfig) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	provider, providerName, err := f.createProvider(config)
	if err != nil {
		return fmt.Errorf("failed to switch to %s: %w", name, err)
	}

	f.currentProvider = provider
	f.currentName = providerName
	f.config = config
	return nil
}

// IsProviderAvailable checks if a provider is available.
func (f *ProviderFactory) IsProviderAvailable(name string) bool {
	f.mu.RLock()
	cached, exists := f.availabilityCache[name]
	f.mu.RUnlock()

	if exists {
		return cached
	}

	// Check availability
	available := f.checkProviderAvailability(name)

	f.mu.Lock()
	f.availabilityCache[name] = available
	f.mu.Unlock()

	// Clear cache after TTL
	go func() {
		time.Sleep(f.cacheTTL)
		f.mu.Lock()
		delete(f.availabilityCache, name)
		f.mu.Unlock()
	}()

	return available
}

// GetAvailableProviders returns a list of available providers.
func (f *ProviderFactory) GetAvailableProviders() []string {
	providers := []string{"openai", "anthropic", "ollama"}
	available := make([]string, 0, len(providers))

	for _, name := range providers {
		if f.IsProviderAvailable(name) {
			available = append(available, name)
		}
	}

	return available
}

// Review performs an AI review using the current provider.
func (f *ProviderFactory) Review(ctx context.Context, req ReviewRequest) (ReviewResponse, error) {
	f.mu.RLock()
	provider := f.currentProvider
	f.mu.RUnlock()

	if provider == nil {
		return ReviewResponse{}, errors.New("no AI provider configured")
	}

	return provider.Review(ctx, req)
}

// createProvider creates a new provider instance based on configuration.
func (f *ProviderFactory) createProvider(config ProviderConfig) (Provider, string, error) {
	providerName := strings.ToLower(strings.TrimSpace(config.Provider))

	switch providerName {
	case "", "none", "disabled":
		return nil, "", errors.New("AI provider not configured")

	case "openai":
		provider, err := NewOpenAIProvider(config.APIKey, config.Model, config.BaseURL)
		return provider, "openai", err

	case "anthropic":
		provider, err := NewAnthropicProvider(config.APIKey, config.Model)
		return provider, "anthropic", err

	case "ollama":
		// For Ollama, baseURL is the host, apiKey is unused
		host := config.BaseURL
		if host == "" {
			host = defaultOllamaHost
		}
		provider, err := NewOllamaProvider(host, config.Model)
		return provider, "ollama", err

	default:
		return nil, "", fmt.Errorf("unsupported AI provider: %s", providerName)
	}
}

// checkProviderAvailability checks if a provider is available.
func (f *ProviderFactory) checkProviderAvailability(name string) bool {
	switch strings.ToLower(name) {
	case "openai":
		// OpenAI is available if API key is configured
		// We don't validate the key here to avoid unnecessary API calls
		return f.config.APIKey != ""

	case "anthropic":
		// Anthropic is available if API key is configured
		return f.config.APIKey != ""

	case "ollama":
		// Ollama is available if service is running
		return IsOllamaAvailable()

	default:
		return false
	}
}

// ValidateConfig validates the provider configuration.
func ValidateConfig(config ProviderConfig) error {
	providerName := strings.ToLower(strings.TrimSpace(config.Provider))

	switch providerName {
	case "", "none", "disabled":
		return errors.New("AI provider not configured")

	case "openai":
		if strings.TrimSpace(config.APIKey) == "" {
			return errors.New("OpenAI API key is required")
		}
		return nil

	case "anthropic":
		if strings.TrimSpace(config.APIKey) == "" {
			return errors.New("Anthropic API key is required")
		}
		return nil

	case "ollama":
		// Ollama doesn't require an API key, just a running service
		return nil

	default:
		return fmt.Errorf("unsupported AI provider: %s", providerName)
	}
}
