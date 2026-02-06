package errors_test

import (
	"fmt"

	"lazyreview/internal/errors"
)

// Example of creating an error with a code
func ExampleNewWithCode() {
	err := errors.NewWithCode(
		errors.ErrCodeAuthRequired,
		"Not authenticated with GitHub",
		"Run: lazyreview auth login --provider github",
		"Check if your token has expired",
	)

	fmt.Println(err.Error())
	// Output: [LR-101] Not authenticated with GitHub
}

// Example of wrapping an error with a code
func ExampleWrapWithCode() {
	originalErr := fmt.Errorf("connection refused")

	err := errors.WrapWithCode(
		originalErr,
		errors.ErrCodeAPINetwork,
		"Failed to connect to GitHub API",
		"Check your internet connection",
		"Verify you can reach api.github.com",
	)

	fmt.Println(err.Error())
	// Output: [LR-202] Failed to connect to GitHub API: connection refused
}

// Example of adding context to an error
func ExampleActionableError_WithContext() {
	err := errors.NewWithCode(
		errors.ErrCodeAPIRateLimit,
		"Rate limit exceeded",
		"Wait for reset",
		"Use caching",
	)

	// Add context information
	err = err.WithContext(map[string]string{
		"provider":   "github",
		"reset_time": "2026-02-05 15:30:00",
	})

	// Context-aware suggestions will include the reset time
	suggestions := err.GetContextualSuggestions()
	fmt.Println(len(suggestions) > 2) // Context adds suggestions
	// Output: true
}

// Example of formatting error for TUI display
func ExampleActionableError_FormatTUI() {
	err := errors.NewWithCode(
		errors.ErrCodeAuthRequired,
		"Not authenticated with GitHub",
		"Run: lazyreview auth login --provider github",
	)

	// Format for beautiful TUI display with box rendering
	formatted := err.FormatTUI()
	fmt.Println(len(formatted) > 0)
	// Output: true
}

// Example of compact error formatting
func ExampleActionableError_FormatCompact() {
	err := errors.NewWithCode(
		errors.ErrCodeConfigInvalid,
		"Invalid YAML syntax in config file",
	)

	// Compact format for status bars
	compact := err.FormatCompact()
	fmt.Println(compact)
	// Output: [LR-301] Invalid YAML syntax in config file
}

// Example of using legacy constructors (backward compatible)
func ExampleAuthenticationRequired() {
	err := errors.AuthenticationRequired("github")

	fmt.Println(err.Code)
	// Output: LR-101
}

// Example of getting registry information
func ExampleGetRegistryEntry() {
	entry := errors.GetRegistryEntry(errors.ErrCodeAuthRequired)

	fmt.Println(entry.Title)
	// Output: Authentication Required
}
