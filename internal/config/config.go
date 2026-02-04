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
	Keybindings     KeybindingsConfig `mapstructure:"keybindings"`
	Providers       []ProviderConfig  `mapstructure:"providers"`
}

// UIConfig holds UI-related settings
type UIConfig struct {
	Theme      string `mapstructure:"theme"`
	Paging     bool   `mapstructure:"paging"`
	ShowChecks bool   `mapstructure:"show_checks"`
	VimMode    bool   `mapstructure:"vim_mode"`
}

// Default returns a Config with sensible defaults
func Default() *Config {
	return &Config{
		Version:         "0.1",
		DefaultProvider: "",
		UI: UIConfig{
			Theme:      "auto",
			Paging:     true,
			ShowChecks: true,
			VimMode:    true,
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
	v.SetDefault("ui.theme", "auto")
	v.SetDefault("ui.paging", true)
	v.SetDefault("ui.show_checks", true)
	v.SetDefault("ui.vim_mode", true)

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
