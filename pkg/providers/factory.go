package providers

import (
	"fmt"

	"lazyreview/internal/config"
)

// Registry holds registered provider factories
type Registry struct {
	factories map[ProviderType]Factory
}

// Factory is a function that creates a provider from config
type Factory func(cfg config.ProviderConfig) (Provider, error)

// NewRegistry creates a new provider registry
func NewRegistry() *Registry {
	return &Registry{
		factories: make(map[ProviderType]Factory),
	}
}

// Register adds a provider factory to the registry
func (r *Registry) Register(providerType ProviderType, factory Factory) {
	r.factories[providerType] = factory
}

// Create creates a provider from config
func (r *Registry) Create(cfg config.ProviderConfig) (Provider, error) {
	providerType := ProviderType(cfg.Type)
	factory, ok := r.factories[providerType]
	if !ok {
		return nil, fmt.Errorf("unknown provider type: %s", cfg.Type)
	}
	return factory(cfg)
}

// DefaultRegistry is the global provider registry
var DefaultRegistry = NewRegistry()

// Register registers a provider factory with the default registry
func Register(providerType ProviderType, factory Factory) {
	DefaultRegistry.Register(providerType, factory)
}

// Create creates a provider from config using the default registry
func Create(cfg config.ProviderConfig) (Provider, error) {
	return DefaultRegistry.Create(cfg)
}

// CreateFromConfig creates all providers from an app config
func CreateFromConfig(cfg *config.Config) (map[string]Provider, error) {
	providers := make(map[string]Provider)

	for _, providerCfg := range cfg.Providers {
		provider, err := Create(providerCfg)
		if err != nil {
			return nil, fmt.Errorf("failed to create provider %s: %w", providerCfg.Name, err)
		}
		providers[providerCfg.Name] = provider
	}

	return providers, nil
}
