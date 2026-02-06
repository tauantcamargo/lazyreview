package gui

import (
	"math"
	"testing"
)

func TestContrastChecker_ParseHexColor(t *testing.T) {
	cc := NewContrastChecker()

	tests := []struct {
		name     string
		hex      string
		expected RGB
		wantErr  bool
	}{
		{"Full hex", "#ff6b6b", RGB{255, 107, 107}, false},
		{"Short hex", "#f6b", RGB{255, 102, 187}, false},
		{"Black", "#000000", RGB{0, 0, 0}, false},
		{"White", "#ffffff", RGB{255, 255, 255}, false},
		{"Invalid length", "#ff", RGB{}, true},
		{"Invalid chars", "#gggggg", RGB{}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := cc.parseHexColor(tt.hex)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseHexColor() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && result != tt.expected {
				t.Errorf("parseHexColor() = %v, expected %v", result, tt.expected)
			}
		})
	}
}

func TestContrastChecker_AnsiToRGB(t *testing.T) {
	cc := NewContrastChecker()

	tests := []struct {
		name     string
		code     int
		expected RGB
	}{
		{"Black", 0, RGB{0, 0, 0}},
		{"Red", 1, RGB{128, 0, 0}},
		{"Bright White", 15, RGB{255, 255, 255}},
		{"First 216 color", 16, RGB{0, 0, 0}},
		{"Last 216 color", 231, RGB{255, 255, 255}},
		{"First grayscale", 232, RGB{8, 8, 8}},
		{"Last grayscale", 255, RGB{238, 238, 238}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := cc.ansiToRGB(tt.code)
			if result != tt.expected {
				t.Errorf("ansiToRGB(%d) = %v, expected %v", tt.code, result, tt.expected)
			}
		})
	}
}

func TestContrastChecker_CalculateContrastRatio(t *testing.T) {
	cc := NewContrastChecker()

	tests := []struct {
		name      string
		fg        RGB
		bg        RGB
		expected  float64
		tolerance float64
	}{
		{"Black on White", RGB{0, 0, 0}, RGB{255, 255, 255}, 21.0, 0.1},
		{"White on Black", RGB{255, 255, 255}, RGB{0, 0, 0}, 21.0, 0.1},
		{"Same color", RGB{128, 128, 128}, RGB{128, 128, 128}, 1.0, 0.01},
		{"Dark gray on black", RGB{64, 64, 64}, RGB{0, 0, 0}, 2.0, 0.2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := cc.calculateContrastRatio(tt.fg, tt.bg)
			if math.Abs(result-tt.expected) > tt.tolerance {
				t.Errorf("calculateContrastRatio() = %.2f, expected %.2f (tolerance %.2f)", result, tt.expected, tt.tolerance)
			}
		})
	}
}

func TestContrastChecker_CheckContrast_WCAGAA(t *testing.T) {
	cc := NewContrastChecker()

	tests := []struct {
		name          string
		foreground    string
		background    string
		shouldPass    bool
		shouldPassAAA bool
	}{
		{"Black on white (passes AAA)", "0", "15", true, true},
		{"Dark gray on white (passes AA)", "240", "15", true, true},
		{"Light gray on white (fails)", "252", "15", false, false},
		{"Hex colors high contrast", "#000000", "#ffffff", true, true},
		{"Hex colors low contrast", "#888888", "#999999", false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := cc.CheckContrast(tt.foreground, tt.background)
			if err != nil {
				t.Fatalf("CheckContrast() failed: %v", err)
			}

			if result.Passes != tt.shouldPass {
				t.Errorf("CheckContrast() Passes = %v, expected %v (ratio: %.2f)", result.Passes, tt.shouldPass, result.Ratio)
			}

			if result.PassesAAA != tt.shouldPassAAA {
				t.Errorf("CheckContrast() PassesAAA = %v, expected %v (ratio: %.2f)", result.PassesAAA, tt.shouldPassAAA, result.Ratio)
			}
		})
	}
}

func TestContrastChecker_CheckContrast_InvalidColors(t *testing.T) {
	cc := NewContrastChecker()

	tests := []struct {
		name       string
		foreground string
		background string
	}{
		{"Invalid foreground", "invalid", "0"},
		{"Invalid background", "0", "invalid"},
		{"Both invalid", "invalid", "invalid"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := cc.CheckContrast(tt.foreground, tt.background)
			if err == nil {
				t.Error("CheckContrast() should fail with invalid colors")
			}
		})
	}
}

func TestContrastChecker_RelativeLuminance(t *testing.T) {
	cc := NewContrastChecker()

	tests := []struct {
		name      string
		rgb       RGB
		expected  float64
		tolerance float64
	}{
		{"Black", RGB{0, 0, 0}, 0.0, 0.001},
		{"White", RGB{255, 255, 255}, 1.0, 0.001},
		{"Red", RGB{255, 0, 0}, 0.2126, 0.01},
		{"Green", RGB{0, 255, 0}, 0.7152, 0.01},
		{"Blue", RGB{0, 0, 255}, 0.0722, 0.01},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := cc.relativeLuminance(tt.rgb)
			if math.Abs(result-tt.expected) > tt.tolerance {
				t.Errorf("relativeLuminance() = %.4f, expected %.4f", result, tt.expected)
			}
		})
	}
}

func TestContrastChecker_SRGB(t *testing.T) {
	cc := NewContrastChecker()

	tests := []struct {
		name      string
		channel   float64
		expected  float64
		tolerance float64
	}{
		{"Low value", 0.02, 0.00154, 0.0001},
		{"Mid value", 0.5, 0.2140, 0.001},
		{"High value", 1.0, 1.0, 0.001},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := cc.sRGB(tt.channel)
			if math.Abs(result-tt.expected) > tt.tolerance {
				t.Errorf("sRGB() = %.4f, expected %.4f", result, tt.expected)
			}
		})
	}
}

func TestContrastChecker_CheckThemeContrast(t *testing.T) {
	cc := NewContrastChecker()

	// Test with a theme that should have good contrast
	theme := uiTheme{
		Name:           "test-theme",
		Added:          "10", // Bright green
		Deleted:        "9",  // Bright red
		Context:        "15", // White
		CursorBg:       "0",  // Black
		SelectionBg:    "4",  // Blue
		File:           "14", // Cyan
		TreeDir:        "15", // White
		TreeSelectedBg: "0",  // Black
		Accent:         "14", // Cyan
		HeaderBg:       "0",  // Black
		Muted:          "8",  // Gray
		LineNo:         "7",  // Light gray
	}

	issues := cc.CheckThemeContrast(theme)

	// A well-designed theme should have no or few issues
	if len(issues) > 3 {
		t.Errorf("Expected few contrast issues, got %d", len(issues))
		for _, issue := range issues {
			t.Logf("Issue: %s - ratio %.2f (required %.2f)", issue.Context, issue.Ratio, issue.Required)
		}
	}
}

func TestContrastChecker_CheckThemeContrast_LowContrast(t *testing.T) {
	cc := NewContrastChecker()

	// Test with a theme that should have contrast issues
	theme := uiTheme{
		Name:           "low-contrast",
		Added:          "240", // Very dark gray
		Deleted:        "240", // Very dark gray
		Context:        "240", // Very dark gray
		CursorBg:       "236", // Slightly lighter gray
		SelectionBg:    "237", // Slightly lighter gray
		File:           "240", // Very dark gray
		TreeDir:        "240", // Very dark gray
		TreeSelectedBg: "237", // Slightly lighter gray
		Accent:         "240", // Very dark gray
		HeaderBg:       "236", // Slightly lighter gray
		Muted:          "238", // Gray
		LineNo:         "240", // Very dark gray
	}

	issues := cc.CheckThemeContrast(theme)

	// This theme should have multiple contrast issues
	if len(issues) == 0 {
		t.Error("Expected contrast issues with low-contrast theme")
	}
}

func TestHighContrastTheme(t *testing.T) {
	theme := HighContrastTheme()

	if theme.Name != "high-contrast" {
		t.Errorf("Expected theme name 'high-contrast', got '%s'", theme.Name)
	}

	// Verify key colors are set to high-contrast values
	if theme.Added != "10" { // Bright green
		t.Errorf("Expected added '10', got '%s'", theme.Added)
	}

	if theme.Deleted != "15" { // Bright white (changed for better contrast)
		t.Errorf("Expected deleted '15', got '%s'", theme.Deleted)
	}

	if theme.Context != "15" { // Bright white
		t.Errorf("Expected context '15', got '%s'", theme.Context)
	}

	// Check high-contrast theme meets WCAG standards
	cc := NewContrastChecker()
	issues := cc.CheckThemeContrast(theme)

	if len(issues) > 0 {
		t.Errorf("High-contrast theme should have no contrast issues, got %d", len(issues))
		for _, issue := range issues {
			t.Logf("Issue: %s - ratio %.2f (required %.2f)", issue.Context, issue.Ratio, issue.Required)
		}
	}
}

func TestContrastChecker_ParseColor_BothFormats(t *testing.T) {
	cc := NewContrastChecker()

	tests := []struct {
		name    string
		color   string
		wantErr bool
	}{
		{"Valid ANSI", "42", false},
		{"Valid hex full", "#ff6b6b", false},
		{"Valid hex short", "#f6b", false},
		{"Invalid ANSI", "999", true},
		{"Invalid format", "rgb(255,0,0)", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := cc.parseColor(tt.color)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseColor() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestContrastChecker_ContrastRatio_Symmetry(t *testing.T) {
	cc := NewContrastChecker()

	fg := RGB{100, 150, 200}
	bg := RGB{50, 50, 50}

	ratio1 := cc.calculateContrastRatio(fg, bg)
	ratio2 := cc.calculateContrastRatio(bg, fg)

	if math.Abs(ratio1-ratio2) > 0.001 {
		t.Errorf("Contrast ratio should be symmetric, got %.3f and %.3f", ratio1, ratio2)
	}
}

func TestContrastChecker_EdgeCases(t *testing.T) {
	cc := NewContrastChecker()

	// Edge case: same color
	result, err := cc.CheckContrast("#808080", "#808080")
	if err != nil {
		t.Fatalf("CheckContrast() failed: %v", err)
	}

	if result.Ratio < 0.9 || result.Ratio > 1.1 {
		t.Errorf("Same color contrast should be ~1.0, got %.2f", result.Ratio)
	}

	// Edge case: maximum contrast
	result, err = cc.CheckContrast("#000000", "#ffffff")
	if err != nil {
		t.Fatalf("CheckContrast() failed: %v", err)
	}

	if result.Ratio < 20.5 || result.Ratio > 21.5 {
		t.Errorf("Maximum contrast should be ~21.0, got %.2f", result.Ratio)
	}
}

func TestContrastChecker_ColorSpaceTransform(t *testing.T) {
	cc := NewContrastChecker()

	// Test that RGB to luminance transform is correct
	// Pure red should have luminance ~0.2126
	red := RGB{255, 0, 0}
	lum := cc.relativeLuminance(red)

	if math.Abs(lum-0.2126) > 0.01 {
		t.Errorf("Red luminance should be ~0.2126, got %.4f", lum)
	}

	// Pure green should have luminance ~0.7152
	green := RGB{0, 255, 0}
	lum = cc.relativeLuminance(green)

	if math.Abs(lum-0.7152) > 0.01 {
		t.Errorf("Green luminance should be ~0.7152, got %.4f", lum)
	}

	// Pure blue should have luminance ~0.0722
	blue := RGB{0, 0, 255}
	lum = cc.relativeLuminance(blue)

	if math.Abs(lum-0.0722) > 0.01 {
		t.Errorf("Blue luminance should be ~0.0722, got %.4f", lum)
	}
}
