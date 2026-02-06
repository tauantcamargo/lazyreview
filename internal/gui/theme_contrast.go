package gui

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// ContrastResult represents the result of a contrast check
type ContrastResult struct {
	Ratio      float64
	Passes     bool // Passes WCAG AA (4.5:1 for normal text)
	PassesAAA  bool // Passes WCAG AAA (7:1 for normal text)
	Foreground RGB
	Background RGB
}

// RGB represents an RGB color
type RGB struct {
	R, G, B uint8
}

// ContrastChecker validates WCAG contrast ratios for themes
type ContrastChecker struct{}

// NewContrastChecker creates a new contrast checker
func NewContrastChecker() *ContrastChecker {
	return &ContrastChecker{}
}

// CheckThemeContrast validates all text/background combinations in a theme
func (cc *ContrastChecker) CheckThemeContrast(theme uiTheme) []ContrastIssue {
	issues := []ContrastIssue{}

	// Define text/background pairs to check
	checks := []struct {
		name       string
		foreground string
		background string
	}{
		{"Added text on cursor", theme.Added, theme.CursorBg},
		{"Deleted text on cursor", theme.Deleted, theme.CursorBg},
		{"Context text on cursor", theme.Context, theme.CursorBg},
		{"File text on selection", theme.File, theme.SelectionBg},
		{"Tree text on selection", theme.TreeDir, theme.TreeSelectedBg},
		{"Accent on header", theme.Accent, theme.HeaderBg},
		{"Muted on header", theme.Muted, theme.HeaderBg},
		{"Line numbers on background", theme.LineNo, "0"}, // Assume black background
	}

	for _, check := range checks {
		result, err := cc.CheckContrast(check.foreground, check.background)
		if err != nil {
			// Skip invalid colors
			continue
		}

		if !result.Passes {
			issues = append(issues, ContrastIssue{
				Context:    check.name,
				Ratio:      result.Ratio,
				Required:   4.5,
				Foreground: check.foreground,
				Background: check.background,
			})
		}
	}

	return issues
}

// ContrastIssue represents a contrast ratio issue
type ContrastIssue struct {
	Context    string
	Ratio      float64
	Required   float64
	Foreground string
	Background string
}

// CheckContrast checks the contrast ratio between two colors
func (cc *ContrastChecker) CheckContrast(foreground, background string) (*ContrastResult, error) {
	fgRGB, err := cc.parseColor(foreground)
	if err != nil {
		return nil, fmt.Errorf("invalid foreground color: %w", err)
	}

	bgRGB, err := cc.parseColor(background)
	if err != nil {
		return nil, fmt.Errorf("invalid background color: %w", err)
	}

	ratio := cc.calculateContrastRatio(fgRGB, bgRGB)

	return &ContrastResult{
		Ratio:      ratio,
		Passes:     ratio >= 4.5, // WCAG AA
		PassesAAA:  ratio >= 7.0, // WCAG AAA
		Foreground: fgRGB,
		Background: bgRGB,
	}, nil
}

// parseColor converts a color string (ANSI code or hex) to RGB
func (cc *ContrastChecker) parseColor(color string) (RGB, error) {
	color = strings.TrimSpace(color)

	// Handle hex colors
	if strings.HasPrefix(color, "#") {
		return cc.parseHexColor(color)
	}

	// Handle ANSI color codes (0-255)
	code, err := strconv.Atoi(color)
	if err != nil {
		return RGB{}, fmt.Errorf("invalid color format: %s", color)
	}

	if code < 0 || code > 255 {
		return RGB{}, fmt.Errorf("ANSI color code must be between 0 and 255, got: %d", code)
	}

	return cc.ansiToRGB(code), nil
}

// parseHexColor parses a hex color string (#RRGGBB or #RGB)
func (cc *ContrastChecker) parseHexColor(hex string) (RGB, error) {
	hex = strings.TrimPrefix(hex, "#")

	// Expand short form (#RGB to #RRGGBB)
	if len(hex) == 3 {
		hex = string([]byte{hex[0], hex[0], hex[1], hex[1], hex[2], hex[2]})
	}

	if len(hex) != 6 {
		return RGB{}, fmt.Errorf("invalid hex color length: %s", hex)
	}

	r, err := strconv.ParseUint(hex[0:2], 16, 8)
	if err != nil {
		return RGB{}, err
	}

	g, err := strconv.ParseUint(hex[2:4], 16, 8)
	if err != nil {
		return RGB{}, err
	}

	b, err := strconv.ParseUint(hex[4:6], 16, 8)
	if err != nil {
		return RGB{}, err
	}

	return RGB{R: uint8(r), G: uint8(g), B: uint8(b)}, nil
}

// ansiToRGB converts an ANSI 256 color code to RGB
func (cc *ContrastChecker) ansiToRGB(code int) RGB {
	// Standard 16 colors (0-15)
	if code < 16 {
		return cc.ansi16ToRGB(code)
	}

	// 216 color cube (16-231)
	if code >= 16 && code <= 231 {
		idx := code - 16
		r := (idx / 36) * 51
		g := ((idx % 36) / 6) * 51
		b := (idx % 6) * 51
		return RGB{R: uint8(r), G: uint8(g), B: uint8(b)}
	}

	// Grayscale (232-255)
	if code >= 232 {
		gray := uint8(8 + (code-232)*10)
		return RGB{R: gray, G: gray, B: gray}
	}

	return RGB{R: 0, G: 0, B: 0}
}

// ansi16ToRGB converts ANSI 16 color codes to RGB
func (cc *ContrastChecker) ansi16ToRGB(code int) RGB {
	colors := []RGB{
		{0, 0, 0},       // 0: Black
		{128, 0, 0},     // 1: Red
		{0, 128, 0},     // 2: Green
		{128, 128, 0},   // 3: Yellow
		{0, 0, 128},     // 4: Blue
		{128, 0, 128},   // 5: Magenta
		{0, 128, 128},   // 6: Cyan
		{192, 192, 192}, // 7: White
		{128, 128, 128}, // 8: Bright Black (Gray)
		{255, 0, 0},     // 9: Bright Red
		{0, 255, 0},     // 10: Bright Green
		{255, 255, 0},   // 11: Bright Yellow
		{0, 0, 255},     // 12: Bright Blue
		{255, 0, 255},   // 13: Bright Magenta
		{0, 255, 255},   // 14: Bright Cyan
		{255, 255, 255}, // 15: Bright White
	}

	if code >= 0 && code < len(colors) {
		return colors[code]
	}

	return RGB{0, 0, 0}
}

// calculateContrastRatio calculates WCAG contrast ratio between two RGB colors
func (cc *ContrastChecker) calculateContrastRatio(fg, bg RGB) float64 {
	l1 := cc.relativeLuminance(fg)
	l2 := cc.relativeLuminance(bg)

	// Ensure l1 is the lighter color
	if l2 > l1 {
		l1, l2 = l2, l1
	}

	return (l1 + 0.05) / (l2 + 0.05)
}

// relativeLuminance calculates the relative luminance of an RGB color
func (cc *ContrastChecker) relativeLuminance(rgb RGB) float64 {
	// Convert to sRGB
	r := cc.sRGB(float64(rgb.R) / 255.0)
	g := cc.sRGB(float64(rgb.G) / 255.0)
	b := cc.sRGB(float64(rgb.B) / 255.0)

	// Calculate luminance
	return 0.2126*r + 0.7152*g + 0.0722*b
}

// sRGB applies the sRGB gamma correction
func (cc *ContrastChecker) sRGB(channel float64) float64 {
	if channel <= 0.03928 {
		return channel / 12.92
	}
	return math.Pow((channel+0.055)/1.055, 2.4)
}

// HighContrastTheme creates a high-contrast accessibility theme
func HighContrastTheme() uiTheme {
	return uiTheme{
		Name:            "high-contrast",
		Added:           "10", // Bright green
		Deleted:         "15", // Bright white (for better contrast on dark cursor)
		Context:         "15", // Bright white
		Hunk:            "14", // Bright cyan
		LineNo:          "7",  // White
		File:            "11", // Bright yellow
		CursorBg:        "4",  // Blue background (darker for better contrast)
		SelectionBg:     "4",  // Blue background
		TreeSelectedBg:  "4",  // Blue background
		TreeAdded:       "10", // Bright green
		TreeDeleted:     "9",  // Bright red
		TreeModified:    "11", // Bright yellow
		TreeRenamed:     "14", // Bright cyan
		TreeDir:         "15", // Bright white
		TreeComment:     "11", // Bright yellow
		Accent:          "14", // Bright cyan
		HeaderBg:        "0",  // Black
		FooterBg:        "0",  // Black
		BorderFocused:   "14", // Bright cyan
		BorderUnfocused: "8",  // Gray
		Muted:           "7",  // White
	}
}
