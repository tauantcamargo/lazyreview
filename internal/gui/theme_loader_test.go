package gui

import (
	"os"
	"path/filepath"
	"testing"
)

func TestThemeLoader_LoadCustomThemes(t *testing.T) {
	// Create temporary themes directory
	tmpDir := t.TempDir()

	loader := &ThemeLoader{
		customThemes: make(map[string]*CustomTheme),
		themesDir:    tmpDir,
	}

	// Create a valid theme file
	themeYAML := `name: "Test Theme"
base: "dark"
colors:
  accent: "#ff6b6b"
  background: "#1a1a2e"
  added: "42"
  deleted: "196"
`

	themeFile := filepath.Join(tmpDir, "test-theme.yaml")
	if err := os.WriteFile(themeFile, []byte(themeYAML), 0644); err != nil {
		t.Fatalf("Failed to write test theme file: %v", err)
	}

	// Load themes
	if err := loader.LoadCustomThemes(); err != nil {
		t.Fatalf("LoadCustomThemes failed: %v", err)
	}

	// Verify theme was loaded
	theme, exists := loader.GetCustomTheme("Test Theme")
	if !exists {
		t.Fatal("Theme was not loaded")
	}

	if theme.Name != "Test Theme" {
		t.Errorf("Expected theme name 'Test Theme', got '%s'", theme.Name)
	}

	if theme.Base != "dark" {
		t.Errorf("Expected base 'dark', got '%s'", theme.Base)
	}

	if theme.Colors["accent"] != "#ff6b6b" {
		t.Errorf("Expected accent '#ff6b6b', got '%s'", theme.Colors["accent"])
	}
}

func TestThemeLoader_ValidateTheme_InvalidBase(t *testing.T) {
	loader := &ThemeLoader{
		customThemes: make(map[string]*CustomTheme),
		themesDir:    "",
	}

	theme := &CustomTheme{
		Name: "Invalid Theme",
		Base: "invalid",
		Colors: map[string]string{
			"accent": "42",
		},
	}

	err := loader.validateTheme(theme)
	if err == nil {
		t.Fatal("Expected validation to fail for invalid base")
	}
}

func TestThemeLoader_ValidateTheme_MissingName(t *testing.T) {
	loader := &ThemeLoader{
		customThemes: make(map[string]*CustomTheme),
		themesDir:    "",
	}

	theme := &CustomTheme{
		Name: "",
		Base: "dark",
		Colors: map[string]string{
			"accent": "42",
		},
	}

	err := loader.validateTheme(theme)
	if err == nil {
		t.Fatal("Expected validation to fail for missing name")
	}
}

func TestThemeLoader_ValidateColor(t *testing.T) {
	tests := []struct {
		name    string
		color   string
		wantErr bool
	}{
		{"Valid ANSI code", "42", false},
		{"Valid hex color", "#ff6b6b", false},
		{"Valid short hex", "#f6b", false},
		{"Invalid ANSI code", "300", true},
		{"Invalid hex length", "#ff", true},
		{"Invalid hex format", "#gggggg", true},
		{"Empty color", "", true},
		{"Invalid format", "invalid", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateColor(tt.color)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateColor() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestThemeLoader_ResolveTheme_Custom(t *testing.T) {
	loader := &ThemeLoader{
		customThemes: make(map[string]*CustomTheme),
		themesDir:    "",
	}

	// Add a custom theme
	customTheme := &CustomTheme{
		Name: "My Theme",
		Base: "dark",
		Colors: map[string]string{
			"accent":         "#ff6b6b",
			"added":          "10",
			"border_focused": "14",
		},
	}

	loader.customThemes["my theme"] = customTheme

	// Resolve the custom theme
	theme := loader.ResolveTheme("My Theme")

	if theme.Name != "My Theme" {
		t.Errorf("Expected theme name 'My Theme', got '%s'", theme.Name)
	}

	if theme.Accent != "#ff6b6b" {
		t.Errorf("Expected accent '#ff6b6b', got '%s'", theme.Accent)
	}

	if theme.Added != "10" {
		t.Errorf("Expected added '10', got '%s'", theme.Added)
	}

	if theme.BorderFocused != "14" {
		t.Errorf("Expected border_focused '14', got '%s'", theme.BorderFocused)
	}
}

func TestThemeLoader_ResolveTheme_BuiltIn(t *testing.T) {
	loader := &ThemeLoader{
		customThemes: make(map[string]*CustomTheme),
		themesDir:    "",
	}

	// Resolve a built-in theme
	theme := loader.ResolveTheme("lazygit")

	if theme.Name != "lazygit" {
		t.Errorf("Expected theme name 'lazygit', got '%s'", theme.Name)
	}

	// Verify some colors are set
	if theme.Accent == "" {
		t.Error("Expected accent color to be set")
	}
}

func TestThemeLoader_BuildThemeFromCustom_Inheritance(t *testing.T) {
	loader := &ThemeLoader{
		customThemes: make(map[string]*CustomTheme),
		themesDir:    "",
	}

	customTheme := &CustomTheme{
		Name: "Partial Theme",
		Base: "lazygit",
		Colors: map[string]string{
			"accent": "#00ff00", // Override only accent
		},
	}

	theme := loader.buildThemeFromCustom(customTheme)

	// Accent should be overridden
	if theme.Accent != "#00ff00" {
		t.Errorf("Expected accent '#00ff00', got '%s'", theme.Accent)
	}

	// Other colors should inherit from base (lazygit)
	baseTheme := resolveTheme("lazygit")
	if theme.Added != baseTheme.Added {
		t.Errorf("Expected added to inherit from base, got '%s'", theme.Added)
	}

	if theme.Deleted != baseTheme.Deleted {
		t.Errorf("Expected deleted to inherit from base, got '%s'", theme.Deleted)
	}
}

func TestThemeLoader_ListCustomThemes(t *testing.T) {
	loader := &ThemeLoader{
		customThemes: make(map[string]*CustomTheme),
		themesDir:    "",
	}

	// Add some custom themes
	loader.customThemes["theme1"] = &CustomTheme{Name: "Theme 1", Base: "dark"}
	loader.customThemes["theme2"] = &CustomTheme{Name: "Theme 2", Base: "light"}

	themes := loader.ListCustomThemes()

	if len(themes) != 2 {
		t.Errorf("Expected 2 themes, got %d", len(themes))
	}
}

func TestThemeLoader_ExportTheme(t *testing.T) {
	tmpDir := t.TempDir()

	loader := &ThemeLoader{
		customThemes: make(map[string]*CustomTheme),
		themesDir:    tmpDir,
	}

	outputPath := filepath.Join(tmpDir, "exported-lazygit.yaml")

	// Export the lazygit theme
	if err := loader.ExportTheme("lazygit", outputPath); err != nil {
		t.Fatalf("ExportTheme failed: %v", err)
	}

	// Verify file was created
	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Fatal("Exported theme file was not created")
	}

	// Verify file content
	data, err := os.ReadFile(outputPath)
	if err != nil {
		t.Fatalf("Failed to read exported file: %v", err)
	}

	content := string(data)
	if !containsString(content, "name: lazygit") {
		t.Error("Exported theme should contain name")
	}

	if !containsString(content, "base: dark") {
		t.Error("Exported theme should contain base")
	}

	if !containsString(content, "colors:") {
		t.Error("Exported theme should contain colors section")
	}
}

func TestThemeLoader_LoadInvalidYAML(t *testing.T) {
	tmpDir := t.TempDir()

	loader := &ThemeLoader{
		customThemes: make(map[string]*CustomTheme),
		themesDir:    tmpDir,
	}

	// Create an invalid YAML file
	invalidYAML := `name: "Test Theme"
base: dark
colors:
  accent: #ff6b6b
    invalid indentation
`

	themeFile := filepath.Join(tmpDir, "invalid-theme.yaml")
	if err := os.WriteFile(themeFile, []byte(invalidYAML), 0644); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	// Load themes (should not fail, but invalid theme should be skipped)
	if err := loader.LoadCustomThemes(); err != nil {
		t.Fatalf("LoadCustomThemes should not fail on invalid theme: %v", err)
	}

	// Verify theme was not loaded
	_, exists := loader.GetCustomTheme("Test Theme")
	if exists {
		t.Error("Invalid theme should not have been loaded")
	}
}

func TestThemeLoader_CaseInsensitiveThemeNames(t *testing.T) {
	loader := &ThemeLoader{
		customThemes: make(map[string]*CustomTheme),
		themesDir:    "",
	}

	customTheme := &CustomTheme{
		Name: "My Theme",
		Base: "dark",
		Colors: map[string]string{
			"accent": "#ff6b6b",
		},
	}

	loader.customThemes["my theme"] = customTheme

	// Test various case combinations
	testCases := []string{
		"my theme",
		"My Theme",
		"MY THEME",
		"mY tHeMe",
	}

	for _, name := range testCases {
		theme, exists := loader.GetCustomTheme(name)
		if !exists {
			t.Errorf("Theme should be found with name '%s'", name)
		}

		if theme.Name != "My Theme" {
			t.Errorf("Expected theme name 'My Theme', got '%s'", theme.Name)
		}
	}
}

func TestThemeLoader_SkipNonYAMLFiles(t *testing.T) {
	tmpDir := t.TempDir()

	loader := &ThemeLoader{
		customThemes: make(map[string]*CustomTheme),
		themesDir:    tmpDir,
	}

	// Create some non-YAML files
	files := []string{
		"theme.txt",
		"theme.json",
		"README.md",
	}

	for _, file := range files {
		filePath := filepath.Join(tmpDir, file)
		if err := os.WriteFile(filePath, []byte("content"), 0644); err != nil {
			t.Fatalf("Failed to write test file: %v", err)
		}
	}

	// Load themes (should skip non-YAML files)
	if err := loader.LoadCustomThemes(); err != nil {
		t.Fatalf("LoadCustomThemes should not fail: %v", err)
	}

	// Verify no themes were loaded
	if len(loader.customThemes) != 0 {
		t.Errorf("Expected 0 themes, got %d", len(loader.customThemes))
	}
}

func TestThemeLoader_SkipDirectories(t *testing.T) {
	tmpDir := t.TempDir()

	loader := &ThemeLoader{
		customThemes: make(map[string]*CustomTheme),
		themesDir:    tmpDir,
	}

	// Create a subdirectory
	subDir := filepath.Join(tmpDir, "subdirectory")
	if err := os.Mkdir(subDir, 0755); err != nil {
		t.Fatalf("Failed to create subdirectory: %v", err)
	}

	// Load themes (should skip directories)
	if err := loader.LoadCustomThemes(); err != nil {
		t.Fatalf("LoadCustomThemes should not fail: %v", err)
	}

	// Verify no themes were loaded
	if len(loader.customThemes) != 0 {
		t.Errorf("Expected 0 themes, got %d", len(loader.customThemes))
	}
}

func TestThemeLoader_MultipleThemeFiles(t *testing.T) {
	tmpDir := t.TempDir()

	loader := &ThemeLoader{
		customThemes: make(map[string]*CustomTheme),
		themesDir:    tmpDir,
	}

	// Create multiple theme files
	themes := []struct {
		filename string
		name     string
	}{
		{"theme1.yaml", "Theme One"},
		{"theme2.yml", "Theme Two"},
		{"theme3.yaml", "Theme Three"},
	}

	for _, theme := range themes {
		content := "name: \"" + theme.name + "\"\nbase: \"dark\"\ncolors:\n  accent: \"42\"\n"
		filePath := filepath.Join(tmpDir, theme.filename)
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			t.Fatalf("Failed to write theme file: %v", err)
		}
	}

	// Load themes
	if err := loader.LoadCustomThemes(); err != nil {
		t.Fatalf("LoadCustomThemes failed: %v", err)
	}

	// Verify all themes were loaded
	if len(loader.customThemes) != 3 {
		t.Errorf("Expected 3 themes, got %d", len(loader.customThemes))
	}

	// Verify each theme by name
	for _, theme := range themes {
		if _, exists := loader.GetCustomTheme(theme.name); !exists {
			t.Errorf("Theme '%s' was not loaded", theme.name)
		}
	}
}

// Helper function
func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || (len(s) > 0 && (s[0:len(substr)] == substr || containsString(s[1:], substr))))
}
