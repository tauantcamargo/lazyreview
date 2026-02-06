package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

// Config holds all application configuration
type Config struct {
	Version         string            `mapstructure:"version"`
	DefaultProvider string            `mapstructure:"default_provider"`
	UI              UIConfig          `mapstructure:"ui"`
	Performance     PerformanceConfig `mapstructure:"performance"`
	AI              AIConfig          `mapstructure:"ai"`
	Analytics       AnalyticsConfig   `mapstructure:"analytics"`
	Keybindings     KeybindingsConfig `mapstructure:"keybindings"`
	Providers       []ProviderConfig  `mapstructure:"providers"`
}

// UIConfig holds UI-related settings
type UIConfig struct {
	Theme       string `mapstructure:"theme"`
	Paging      bool   `mapstructure:"paging"`
	ShowChecks  bool   `mapstructure:"show_checks"`
	VimMode     bool   `mapstructure:"vim_mode"`
	Editor      string `mapstructure:"editor"`
	UnicodeMode string `mapstructure:"unicode_mode"` // auto|on|off (default: auto)
}

// PerformanceConfig holds performance-related settings
type PerformanceConfig struct {
	// CacheTTL is the time-to-live for cached PR data in seconds (default: 120)
	CacheTTL int `mapstructure:"cache_ttl"`
	// CommentCacheTTL is the TTL for comment/review cache in seconds (default: 20)
	CommentCacheTTL int `mapstructure:"comment_cache_ttl"`
	// MaxConcurrency is the max concurrent API requests (default: 6)
	MaxConcurrency int `mapstructure:"max_concurrency"`
	// RateLimitPerSecond is the max API requests per second (default: 10, 0 = no limit)
	RateLimitPerSecond int `mapstructure:"rate_limit_per_second"`
}

// AIConfig holds AI provider settings
type AIConfig struct {
	// Provider is the AI provider to use (openai, anthropic, ollama)
	Provider string `mapstructure:"provider"`
	// Model is the AI model to use (provider-specific)
	Model string `mapstructure:"model"`
	// APIKey is the API key for the provider (not used for Ollama)
	APIKey string `mapstructure:"api_key"`
	// BaseURL is the base URL for the provider (OpenAI or Ollama host)
	BaseURL string `mapstructure:"base_url"`
	// Enabled controls whether AI review is enabled
	Enabled bool `mapstructure:"enabled"`
	// FallbackChain is the list of providers to try in order if primary fails
	FallbackChain []string `mapstructure:"fallback_chain"`
	// CostWarningThreshold is the monthly cost warning threshold in USD (default: 10.0)
	CostWarningThreshold float64 `mapstructure:"cost_warning_threshold"`
	// CostMonthlyLimit is the monthly cost hard limit in USD (default: 50.0, 0 = no limit)
	CostMonthlyLimit float64 `mapstructure:"cost_monthly_limit"`
	// ShowCostEstimate controls whether to show cost estimate before AI review (default: true)
	ShowCostEstimate bool `mapstructure:"show_cost_estimate"`
	// Strictness is the default review strictness level (relaxed, standard, strict)
	Strictness string `mapstructure:"strictness"`
	// RepositoryStrictness holds per-repository strictness overrides
	RepositoryStrictness map[string]string `mapstructure:"repository_strictness"`
}

// AnalyticsConfig holds analytics-related settings
type AnalyticsConfig struct {
	// Enabled controls whether analytics tracking is enabled (default: true)
	Enabled bool `mapstructure:"enabled"`
	// RetentionDays is the number of days to retain event data (default: 90)
	RetentionDays int `mapstructure:"retention_days"`
	// AutoCleanup enables automatic cleanup of old events (default: true)
	AutoCleanup bool `mapstructure:"auto_cleanup"`
}

// Default returns a Config with sensible defaults
func Default() *Config {
	return &Config{
		Version:         "0.1",
		DefaultProvider: "",
		UI: UIConfig{
			Theme:       "lazygit",
			Paging:      true,
			ShowChecks:  true,
			VimMode:     true,
			Editor:      "",
			UnicodeMode: "auto",
		},
		Performance: PerformanceConfig{
			CacheTTL:           120,
			CommentCacheTTL:    20,
			MaxConcurrency:     6,
			RateLimitPerSecond: 10,
		},
		AI: AIConfig{
			Provider:             "",
			Model:                "",
			APIKey:               "",
			BaseURL:              "",
			Enabled:              false,
			FallbackChain:        []string{"openai", "anthropic", "ollama"},
			CostWarningThreshold: 10.0,
			CostMonthlyLimit:     50.0,
			ShowCostEstimate:     true,
			Strictness:           "standard",
			RepositoryStrictness: make(map[string]string),
		},
		Analytics: AnalyticsConfig{
			Enabled:       true,
			RetentionDays: 90,
			AutoCleanup:   true,
		},
		Keybindings: DefaultKeybindings(),
		Providers:   []ProviderConfig{},
	}
}

// Load reads configuration from file and environment
func Load() (*Config, error) {
	v := viper.New()

	// Set config file name and type
	v.SetConfigName("config")
	v.SetConfigType("yaml")

	// Add config paths in order of precedence
	// 1. Current directory
	v.AddConfigPath(".")

	// 2. XDG config directory
	if xdgConfig := os.Getenv("XDG_CONFIG_HOME"); xdgConfig != "" {
		v.AddConfigPath(filepath.Join(xdgConfig, "lazyreview"))
	}

	// 3. Home directory config
	if home, err := os.UserHomeDir(); err == nil {
		v.AddConfigPath(filepath.Join(home, ".config", "lazyreview"))
		v.AddConfigPath(filepath.Join(home, ".lazyreview"))
	}

	// Set defaults
	setDefaults(v)

	// Read environment variables with LAZYREVIEW_ prefix
	v.SetEnvPrefix("LAZYREVIEW")
	v.AutomaticEnv()

	// Read config file (ignore if not found)
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}

	// Unmarshal into struct
	cfg := &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("error parsing config: %w", err)
	}

	return cfg, nil
}

// setDefaults sets default values for all configuration options
func setDefaults(v *viper.Viper) {
	v.SetDefault("version", "0.1")
	v.SetDefault("default_provider", "")

	// UI defaults
	v.SetDefault("ui.theme", "lazygit")
	v.SetDefault("ui.paging", true)
	v.SetDefault("ui.show_checks", true)
	v.SetDefault("ui.vim_mode", true)
	v.SetDefault("ui.editor", "")
	v.SetDefault("ui.unicode_mode", "auto")

	// Performance defaults
	v.SetDefault("performance.cache_ttl", 120)
	v.SetDefault("performance.comment_cache_ttl", 20)
	v.SetDefault("performance.max_concurrency", 6)
	v.SetDefault("performance.rate_limit_per_second", 10)

	// AI defaults
	v.SetDefault("ai.provider", "")
	v.SetDefault("ai.model", "")
	v.SetDefault("ai.api_key", "")
	v.SetDefault("ai.base_url", "")
	v.SetDefault("ai.enabled", false)
	v.SetDefault("ai.fallback_chain", []string{"openai", "anthropic", "ollama"})
	v.SetDefault("ai.cost_warning_threshold", 10.0)
	v.SetDefault("ai.cost_monthly_limit", 50.0)
	v.SetDefault("ai.show_cost_estimate", true)
	v.SetDefault("ai.strictness", "standard")
	v.SetDefault("ai.repository_strictness", make(map[string]string))

	// Analytics defaults
	v.SetDefault("analytics.enabled", true)
	v.SetDefault("analytics.retention_days", 90)
	v.SetDefault("analytics.auto_cleanup", true)

	// Navigation keybindings
	v.SetDefault("keybindings.navigation.up", "k")
	v.SetDefault("keybindings.navigation.down", "j")
	v.SetDefault("keybindings.navigation.left", "h")
	v.SetDefault("keybindings.navigation.right", "l")
	v.SetDefault("keybindings.navigation.top", "g")
	v.SetDefault("keybindings.navigation.bottom", "G")
	v.SetDefault("keybindings.navigation.page_up", "ctrl+u")
	v.SetDefault("keybindings.navigation.page_down", "ctrl+d")

	// Action keybindings
	v.SetDefault("keybindings.actions.approve", "a")
	v.SetDefault("keybindings.actions.request_changes", "r")
	v.SetDefault("keybindings.actions.comment", "c")
	v.SetDefault("keybindings.actions.open_browser", "o")
	v.SetDefault("keybindings.actions.checkout", "C")

	// Global keybindings
	v.SetDefault("keybindings.global.quit", "q")
	v.SetDefault("keybindings.global.help", "?")
	v.SetDefault("keybindings.global.search", "/")
	v.SetDefault("keybindings.global.cancel", "esc")
	v.SetDefault("keybindings.global.confirm", "enter")
	v.SetDefault("keybindings.global.next_panel", "tab")
	v.SetDefault("keybindings.global.prev_panel", "shift+tab")

	// Chord keybindings
	v.SetDefault("keybindings.chords.enabled", true)
	v.SetDefault("keybindings.chords.timeout", 500)
	v.SetDefault("keybindings.chords.sequences", []map[string]interface{}{
		{
			"keys":        []string{"g", "g"},
			"action":      "goto_top",
			"description": "Go to top",
		},
		{
			"keys":        []string{"g", "c"},
			"action":      "general_comment",
			"description": "Add general comment",
		},
		{
			"keys":        []string{"g", "r"},
			"action":      "refresh",
			"description": "Refresh current view",
		},
	})
}

// ConfigDir returns the directory where config files are stored
func ConfigDir() (string, error) {
	// Check XDG_CONFIG_HOME first
	if xdgConfig := os.Getenv("XDG_CONFIG_HOME"); xdgConfig != "" {
		return filepath.Join(xdgConfig, "lazyreview"), nil
	}

	// Fall back to ~/.config/lazyreview
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("cannot determine home directory: %w", err)
	}

	return filepath.Join(home, ".config", "lazyreview"), nil
}

// EnsureConfigDir creates the config directory if it doesn't exist
func EnsureConfigDir() (string, error) {
	dir, err := ConfigDir()
	if err != nil {
		return "", err
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("cannot create config directory: %w", err)
	}

	return dir, nil
}

// GetProviderByName returns a provider config by name
func (c *Config) GetProviderByName(name string) *ProviderConfig {
	for i := range c.Providers {
		if c.Providers[i].Name == name {
			return &c.Providers[i]
		}
	}
	return nil
}

// GetDefaultProvider returns the default provider config
func (c *Config) GetDefaultProvider() *ProviderConfig {
	if c.DefaultProvider == "" && len(c.Providers) > 0 {
		return &c.Providers[0]
	}
	return c.GetProviderByName(c.DefaultProvider)
}
