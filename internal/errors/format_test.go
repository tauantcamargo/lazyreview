package errors

import (
	"strings"
	"testing"
)

// Test FormatCompact
func TestFormatCompact(t *testing.T) {
	tests := []struct {
		name     string
		err      *ActionableError
		contains []string
	}{
		{
			name: "With code and underlying error",
			err: WrapWithCode(
				&testError{msg: "connection timeout"},
				ErrCodeAPINetwork,
				"Failed to connect",
			),
			contains: []string{"LR-202", "Failed to connect", "connection timeout"},
		},
		{
			name: "Without underlying error",
			err: NewWithCode(
				ErrCodeAuthRequired,
				"Authentication needed",
			),
			contains: []string{"LR-101", "Authentication needed"},
		},
		{
			name: "Without code",
			err: &ActionableError{
				Message: "Simple error",
			},
			contains: []string{"Simple error"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.err.FormatCompact()

			for _, want := range tt.contains {
				if !strings.Contains(got, want) {
					t.Errorf("FormatCompact() = %v, should contain %v", got, want)
				}
			}
		})
	}
}

// Test FormatMarkdown
func TestFormatMarkdown(t *testing.T) {
	err := NewWithCode(
		ErrCodeAuthRequired,
		"Not authenticated",
		"Suggestion 1",
		"Suggestion 2",
	)

	markdown := err.FormatMarkdown()

	// Should contain markdown formatting
	if !strings.Contains(markdown, "##") {
		t.Error("Markdown should contain heading")
	}

	if !strings.Contains(markdown, "**Error:**") {
		t.Error("Markdown should contain bold error label")
	}

	if !strings.Contains(markdown, "### How to fix") {
		t.Error("Markdown should contain suggestions section")
	}

	if !strings.Contains(markdown, "1. Suggestion 1") {
		t.Error("Markdown should contain numbered suggestions")
	}
}

// Test FormatMarkdown with all fields
func TestFormatMarkdownComplete(t *testing.T) {
	err := WrapWithCode(
		&testError{msg: "underlying error"},
		ErrCodeAPINetwork,
		"Network failure",
		"Check connection",
	)

	markdown := err.FormatMarkdown()

	// Should contain all sections
	requiredSections := []string{
		"LR-202",
		"**Error:**",
		"**Details:**",
		"### How to fix",
		"For more help:",
	}

	for _, section := range requiredSections {
		if !strings.Contains(markdown, section) {
			t.Errorf("Markdown should contain %q", section)
		}
	}
}

// Test FormatTUI with no code
func TestFormatTUINoCode(t *testing.T) {
	err := &ActionableError{
		Message:     "Simple error",
		Suggestions: []string{"Fix it"},
	}

	formatted := err.FormatTUI()

	if formatted == "" {
		t.Error("FormatTUI should return non-empty string")
	}

	if !strings.Contains(formatted, "Simple error") {
		t.Error("Should contain error message")
	}
}

// Test FormatTUI with all features
func TestFormatTUIComplete(t *testing.T) {
	err := WrapWithCode(
		&testError{msg: "timeout"},
		ErrCodeAPINetwork,
		"Connection failed",
		"Suggestion 1",
		"Suggestion 2",
	)
	err = err.WithContext(map[string]string{"host": "api.github.com"})

	formatted := err.FormatTUI()

	// Verify all parts are present
	checks := []string{
		"LR-202",
		"Connection failed",
		"timeout",
		"Suggestion 1",
		"How to fix:",
	}

	for _, check := range checks {
		if !strings.Contains(formatted, check) {
			t.Errorf("FormatTUI should contain %q, got: %s", check, formatted)
		}
	}
}

// Test FormatTUIWithTheme with custom colors
func TestFormatTUIWithThemeColors(t *testing.T) {
	err := NewWithCode(ErrCodeAuthRequired, "Test error", "Fix suggestion")

	// Test with different color codes
	themes := []struct {
		name   string
		error  string
		accent string
		muted  string
	}{
		{"Red theme", "196", "81", "240"},
		{"Blue theme", "33", "75", "245"},
		{"Green theme", "42", "77", "243"},
	}

	for _, theme := range themes {
		t.Run(theme.name, func(t *testing.T) {
			formatted := err.FormatTUIWithTheme(theme.error, theme.accent, theme.muted)

			if formatted == "" {
				t.Error("FormatTUIWithTheme should return non-empty string")
			}

			// Should still contain core content
			if !strings.Contains(formatted, "Test error") {
				t.Error("Should contain error message regardless of theme")
			}
		})
	}
}

// Test FormatWithSuggestions (legacy method)
func TestFormatWithSuggestions(t *testing.T) {
	err := WrapWithCode(
		&testError{msg: "original error"},
		ErrCodeConfigInvalid,
		"Invalid config",
		"Suggestion 1",
		"Suggestion 2",
	)

	formatted := err.FormatWithSuggestions()

	checks := []string{
		"Error: Invalid config",
		"Details: original error",
		"How to fix:",
		"1. Suggestion 1",
		"2. Suggestion 2",
		"For more help:",
	}

	for _, check := range checks {
		if !strings.Contains(formatted, check) {
			t.Errorf("FormatWithSuggestions should contain %q", check)
		}
	}
}

// Test empty suggestions
func TestFormatWithNoSuggestions(t *testing.T) {
	err := NewWithCode(ErrCodeInternalUnexpected, "Something went wrong")

	formatted := err.FormatWithSuggestions()

	if strings.Contains(formatted, "How to fix:") {
		t.Error("Should not show suggestions section when empty")
	}
}

// Test error without help URL
func TestFormatWithoutHelpURL(t *testing.T) {
	err := &ActionableError{
		Message:     "Test error",
		Suggestions: []string{"Fix it"},
	}

	formatted := err.FormatWithSuggestions()

	if strings.Contains(formatted, "For more help:") {
		t.Error("Should not show help section when URL is empty")
	}
}

// Helper error type for testing
type testError struct {
	msg string
}

func (e *testError) Error() string {
	return e.msg
}

// Test context-aware suggestions with empty context
func TestGetContextualSuggestionsEmpty(t *testing.T) {
	err := NewWithCode(ErrCodeAuthRequired, "Test error", "Suggestion 1")

	suggestions := err.GetContextualSuggestions()

	if len(suggestions) != 1 {
		t.Errorf("Expected 1 suggestion without context, got %d", len(suggestions))
	}

	if suggestions[0] != "Suggestion 1" {
		t.Errorf("Expected 'Suggestion 1', got %v", suggestions[0])
	}
}

// Test GetContextualSuggestions preserves original order
func TestGetContextualSuggestionsOrder(t *testing.T) {
	err := NewWithCode(
		ErrCodeAPIRateLimit,
		"Rate limited",
		"Wait",
		"Use cache",
	)
	err = err.WithContext(map[string]string{"reset_time": "15:00"})

	suggestions := err.GetContextualSuggestions()

	// Context suggestion should come first
	found := false
	for _, s := range suggestions {
		if strings.Contains(s, "15:00") {
			found = true
			break
		}
	}

	if !found {
		t.Errorf("Context-aware suggestion not found in: %v", suggestions)
	}

	// Original suggestions should still be present
	hasWait := false
	hasCache := false
	for _, s := range suggestions {
		if s == "Wait" {
			hasWait = true
		}
		if s == "Use cache" {
			hasCache = true
		}
	}

	if !hasWait || !hasCache {
		t.Errorf("Original suggestions should be preserved, got: %v", suggestions)
	}
}

// Test error code without registry entry
func TestFormatWithUnknownCode(t *testing.T) {
	err := &ActionableError{
		Code:        "LR-999",
		Message:     "Unknown error",
		Suggestions: []string{"Try again"},
	}

	formatted := err.FormatTUI()

	// Should still format correctly
	if !strings.Contains(formatted, "LR-999") {
		t.Error("Should display unknown error code")
	}

	if !strings.Contains(formatted, "Unknown error") {
		t.Error("Should display error message")
	}
}

// Test New (legacy constructor without code)
func TestNewLegacy(t *testing.T) {
	err := New("Test message", "Suggestion 1", "Suggestion 2")

	if err.Code != "" {
		t.Errorf("Legacy New() should not set code, got: %v", err.Code)
	}

	if err.Message != "Test message" {
		t.Errorf("Message = %v, want 'Test message'", err.Message)
	}

	if len(err.Suggestions) != 2 {
		t.Errorf("Expected 2 suggestions, got %d", len(err.Suggestions))
	}
}

// Test Wrap (legacy constructor without code)
func TestWrapLegacy(t *testing.T) {
	originalErr := &testError{msg: "original"}
	err := Wrap(originalErr, "Wrapped message", "Suggestion")

	if err.Code != "" {
		t.Errorf("Legacy Wrap() should not set code, got: %v", err.Code)
	}

	if err.Err != originalErr {
		t.Error("Original error not preserved")
	}

	if err.Message != "Wrapped message" {
		t.Errorf("Message = %v, want 'Wrapped message'", err.Message)
	}
}

// Benchmark FormatMarkdown
func BenchmarkFormatMarkdown(b *testing.B) {
	err := NewWithCode(
		ErrCodeAuthRequired,
		"Not authenticated",
		"Suggestion 1",
		"Suggestion 2",
		"Suggestion 3",
	)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = err.FormatMarkdown()
	}
}

// Benchmark FormatCompact
func BenchmarkFormatCompact(b *testing.B) {
	err := WrapWithCode(
		&testError{msg: "timeout"},
		ErrCodeAPINetwork,
		"Connection failed",
	)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = err.FormatCompact()
	}
}
