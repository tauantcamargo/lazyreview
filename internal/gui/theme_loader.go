package gui

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"

	"lazyreview/internal/config"
)

// CustomTheme represents a user-defined theme loaded from YAML
type CustomTheme struct {
	Name   string            `yaml:"name"`
	Base   string            `yaml:"base"` // "dark" or "light"
	Colors map[string]string `yaml:"colors"`
}

// ThemeLoader handles loading and managing custom themes
type ThemeLoader struct {
	customThemes map[string]*CustomTheme
	themesDir    string
}

// NewThemeLoader creates a new theme loader
func NewThemeLoader() (*ThemeLoader, error) {
	configDir, err := config.ConfigDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get config directory: %w", err)
	}

	themesDir := filepath.Join(configDir, "themes")

	return &ThemeLoader{
		customThemes: make(map[string]*CustomTheme),
		themesDir:    themesDir,
	}, nil
}

// LoadCustomThemes loads all custom theme files from ~/.config/lazyreview/themes/
func (tl *ThemeLoader) LoadCustomThemes() error {
	// Create themes directory if it doesn't exist
	if err := os.MkdirAll(tl.themesDir, 0755); err != nil {
		return fmt.Errorf("failed to create themes directory: %w", err)
	}

	// Read all .yaml and .yml files
	entries, err := os.ReadDir(tl.themesDir)
	if err != nil {
		return fmt.Errorf("failed to read themes directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		if !strings.HasSuffix(name, ".yaml") && !strings.HasSuffix(name, ".yml") {
			continue
		}

		themePath := filepath.Join(tl.themesDir, name)
		if err := tl.loadThemeFile(themePath); err != nil {
			// Log error but continue loading other themes
			fmt.Fprintf(os.Stderr, "Warning: failed to load theme %s: %v\n", name, err)
			continue
		}
	}

	return nil
}

// loadThemeFile loads a single theme file
func (tl *ThemeLoader) loadThemeFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read theme file: %w", err)
	}

	var customTheme CustomTheme
	if err := yaml.Unmarshal(data, &customTheme); err != nil {
		return fmt.Errorf("failed to parse theme YAML: %w", err)
	}

	// Validate theme
	if err := tl.validateTheme(&customTheme); err != nil {
		return fmt.Errorf("invalid theme: %w", err)
	}

	// Store theme (key is lowercase name)
	key := strings.ToLower(strings.TrimSpace(customTheme.Name))
	tl.customThemes[key] = &customTheme

	return nil
}

// validateTheme validates a custom theme structure
func (tl *ThemeLoader) validateTheme(theme *CustomTheme) error {
	if theme.Name == "" {
		return fmt.Errorf("theme name is required")
	}

	// Validate base theme
	base := strings.ToLower(strings.TrimSpace(theme.Base))
	if base != "dark" && base != "light" {
		return fmt.Errorf("base must be 'dark' or 'light', got: %s", theme.Base)
	}

	// Validate color values (must be valid ANSI color codes or hex)
	for key, value := range theme.Colors {
		if err := validateColor(value); err != nil {
			return fmt.Errorf("invalid color for %s: %w", key, err)
		}
	}

	return nil
}

// validateColor validates a color value (ANSI code or hex)
func validateColor(color string) error {
	color = strings.TrimSpace(color)
	if color == "" {
		return fmt.Errorf("color cannot be empty")
	}

	// Check if it's a hex color
	if strings.HasPrefix(color, "#") {
		hex := strings.TrimPrefix(color, "#")
		if len(hex) != 6 && len(hex) != 3 {
			return fmt.Errorf("invalid hex color format: %s", color)
		}

		// Validate hex characters
		for _, c := range hex {
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
				return fmt.Errorf("invalid hex color format: %s", color)
			}
		}
		return nil
	}

	// Check if it's a valid ANSI color code (0-255)
	code, err := strconv.Atoi(color)
	if err != nil {
		return fmt.Errorf("color must be ANSI code (0-255) or hex (#RRGGBB): %s", color)
	}

	if code < 0 || code > 255 {
		return fmt.Errorf("ANSI color code must be between 0 and 255, got: %d", code)
	}

	return nil
}

// GetCustomTheme returns a custom theme by name
func (tl *ThemeLoader) GetCustomTheme(name string) (*CustomTheme, bool) {
	key := strings.ToLower(strings.TrimSpace(name))
	theme, exists := tl.customThemes[key]
	return theme, exists
}

// ListCustomThemes returns a list of all loaded custom theme names
func (tl *ThemeLoader) ListCustomThemes() []string {
	names := make([]string, 0, len(tl.customThemes))
	for _, theme := range tl.customThemes {
		names = append(names, theme.Name)
	}
	return names
}

// ResolveTheme resolves a theme name to a uiTheme
// Checks custom themes first, then falls back to built-in themes
func (tl *ThemeLoader) ResolveTheme(name string) uiTheme {
	// Check for custom theme first
	if customTheme, exists := tl.GetCustomTheme(name); exists {
		return tl.buildThemeFromCustom(customTheme)
	}

	// Fall back to built-in themes
	return resolveTheme(name)
}

// buildThemeFromCustom builds a uiTheme from a CustomTheme
func (tl *ThemeLoader) buildThemeFromCustom(custom *CustomTheme) uiTheme {
	// Start with base theme
	base := resolveTheme(custom.Base)

	// Override with custom colors
	theme := uiTheme{
		Name:            custom.Name,
		Added:           tl.getColorOrDefault(custom, "added", base.Added),
		Deleted:         tl.getColorOrDefault(custom, "deleted", base.Deleted),
		Context:         tl.getColorOrDefault(custom, "context", base.Context),
		Hunk:            tl.getColorOrDefault(custom, "hunk", base.Hunk),
		LineNo:          tl.getColorOrDefault(custom, "line_no", base.LineNo),
		File:            tl.getColorOrDefault(custom, "file", base.File),
		CursorBg:        tl.getColorOrDefault(custom, "cursor_bg", base.CursorBg),
		SelectionBg:     tl.getColorOrDefault(custom, "selection_bg", base.SelectionBg),
		TreeSelectedBg:  tl.getColorOrDefault(custom, "tree_selected_bg", base.TreeSelectedBg),
		TreeAdded:       tl.getColorOrDefault(custom, "tree_added", base.TreeAdded),
		TreeDeleted:     tl.getColorOrDefault(custom, "tree_deleted", base.TreeDeleted),
		TreeModified:    tl.getColorOrDefault(custom, "tree_modified", base.TreeModified),
		TreeRenamed:     tl.getColorOrDefault(custom, "tree_renamed", base.TreeRenamed),
		TreeDir:         tl.getColorOrDefault(custom, "tree_dir", base.TreeDir),
		TreeComment:     tl.getColorOrDefault(custom, "tree_comment", base.TreeComment),
		Accent:          tl.getColorOrDefault(custom, "accent", base.Accent),
		HeaderBg:        tl.getColorOrDefault(custom, "header_bg", base.HeaderBg),
		FooterBg:        tl.getColorOrDefault(custom, "footer_bg", base.FooterBg),
		BorderFocused:   tl.getColorOrDefault(custom, "border_focused", base.BorderFocused),
		BorderUnfocused: tl.getColorOrDefault(custom, "border_unfocused", base.BorderUnfocused),
		Muted:           tl.getColorOrDefault(custom, "muted", base.Muted),
	}

	return theme
}

// getColorOrDefault gets a color from custom theme or returns the default
func (tl *ThemeLoader) getColorOrDefault(custom *CustomTheme, key, defaultValue string) string {
	if value, exists := custom.Colors[key]; exists {
		return value
	}
	return defaultValue
}

// ExportTheme exports a built-in theme as a custom theme YAML file
func (tl *ThemeLoader) ExportTheme(themeName, outputPath string) error {
	theme := resolveTheme(themeName)

	customTheme := CustomTheme{
		Name: theme.Name,
		Base: "dark", // Assume dark base for most themes
		Colors: map[string]string{
			"added":            theme.Added,
			"deleted":          theme.Deleted,
			"context":          theme.Context,
			"hunk":             theme.Hunk,
			"line_no":          theme.LineNo,
			"file":             theme.File,
			"cursor_bg":        theme.CursorBg,
			"selection_bg":     theme.SelectionBg,
			"tree_selected_bg": theme.TreeSelectedBg,
			"tree_added":       theme.TreeAdded,
			"tree_deleted":     theme.TreeDeleted,
			"tree_modified":    theme.TreeModified,
			"tree_renamed":     theme.TreeRenamed,
			"tree_dir":         theme.TreeDir,
			"tree_comment":     theme.TreeComment,
			"accent":           theme.Accent,
			"header_bg":        theme.HeaderBg,
			"footer_bg":        theme.FooterBg,
			"border_focused":   theme.BorderFocused,
			"border_unfocused": theme.BorderUnfocused,
			"muted":            theme.Muted,
		},
	}

	data, err := yaml.Marshal(&customTheme)
	if err != nil {
		return fmt.Errorf("failed to marshal theme: %w", err)
	}

	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write theme file: %w", err)
	}

	return nil
}
