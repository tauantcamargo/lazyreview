package errors

import (
	"errors"
	"strings"
	"testing"
)

// Test error codes are unique and follow LR-xxx format
func TestErrorCodes(t *testing.T) {
	tests := []struct {
		name string
		code ErrorCode
		want string
	}{
		{"Auth: Not authenticated", ErrCodeAuthRequired, "LR-101"},
		{"Auth: Token expired", ErrCodeAuthTokenExpired, "LR-102"},
		{"Auth: Insufficient permissions", ErrCodeAuthInsufficientPerms, "LR-103"},
		{"Auth: SAML required", ErrCodeAuthSAMLRequired, "LR-104"},
		{"API: Rate limit", ErrCodeAPIRateLimit, "LR-201"},
		{"API: Network error", ErrCodeAPINetwork, "LR-202"},
		{"API: Invalid response", ErrCodeAPIInvalidResponse, "LR-203"},
		{"API: Not found", ErrCodeAPINotFound, "LR-204"},
		{"Config: Invalid", ErrCodeConfigInvalid, "LR-301"},
		{"Config: Missing file", ErrCodeConfigMissing, "LR-302"},
		{"Config: Provider not found", ErrCodeConfigProviderNotFound, "LR-303"},
		{"AI: Provider error", ErrCodeAIProviderError, "LR-401"},
		{"AI: Token missing", ErrCodeAITokenMissing, "LR-402"},
		{"AI: Rate limit", ErrCodeAIRateLimit, "LR-403"},
		{"Internal: Unexpected", ErrCodeInternalUnexpected, "LR-501"},
		{"Internal: Storage error", ErrCodeInternalStorage, "LR-502"},
	}

	seen := make(map[string]bool)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := string(tt.code)
			if got != tt.want {
				t.Errorf("ErrorCode = %v, want %v", got, tt.want)
			}

			// Check uniqueness
			if seen[got] {
				t.Errorf("ErrorCode %v is not unique", got)
			}
			seen[got] = true
		})
	}
}

// Test error registry provides lookup
func TestErrorRegistry(t *testing.T) {
	tests := []struct {
		code          ErrorCode
		expectTitle   string
		expectHelp    bool
		expectContext bool
	}{
		{
			code:          ErrCodeAuthRequired,
			expectTitle:   "Authentication Required",
			expectHelp:    true,
			expectContext: true,
		},
		{
			code:          ErrCodeAPIRateLimit,
			expectTitle:   "API Rate Limit Exceeded",
			expectHelp:    true,
			expectContext: true,
		},
		{
			code:          ErrCodeConfigInvalid,
			expectTitle:   "Invalid Configuration",
			expectHelp:    true,
			expectContext: true,
		},
	}

	for _, tt := range tests {
		t.Run(string(tt.code), func(t *testing.T) {
			entry, exists := errorRegistry[tt.code]
			if !exists {
				t.Errorf("ErrorCode %v not found in registry", tt.code)
				return
			}

			if entry.Title != tt.expectTitle {
				t.Errorf("Title = %v, want %v", entry.Title, tt.expectTitle)
			}

			if tt.expectHelp && entry.HelpURL == "" {
				t.Errorf("Expected HelpURL to be set")
			}

			if tt.expectContext && len(entry.ContextActions) == 0 {
				t.Errorf("Expected ContextActions to be set")
			}
		})
	}
}

// Test ActionableError with code
func TestActionableErrorWithCode(t *testing.T) {
	err := NewWithCode(ErrCodeAuthRequired, "Not authenticated", "Run auth login")

	if err.Code != ErrCodeAuthRequired {
		t.Errorf("Code = %v, want %v", err.Code, ErrCodeAuthRequired)
	}

	if err.Message != "Not authenticated" {
		t.Errorf("Message = %v, want 'Not authenticated'", err.Message)
	}

	if len(err.Suggestions) != 1 || err.Suggestions[0] != "Run auth login" {
		t.Errorf("Suggestions not set correctly")
	}

	// Error() should include code
	errStr := err.Error()
	if !strings.Contains(errStr, "LR-101") {
		t.Errorf("Error() should include code, got: %v", errStr)
	}
}

// Test WrapWithCode
func TestWrapWithCode(t *testing.T) {
	originalErr := errors.New("connection refused")
	err := WrapWithCode(originalErr, ErrCodeAPINetwork, "Failed to connect")

	if err.Code != ErrCodeAPINetwork {
		t.Errorf("Code = %v, want %v", err.Code, ErrCodeAPINetwork)
	}

	if err.Err != originalErr {
		t.Errorf("Original error not preserved")
	}

	unwrapped := errors.Unwrap(err)
	if unwrapped != originalErr {
		t.Errorf("Unwrap() should return original error")
	}
}

// Test GetRegistryEntry
func TestGetRegistryEntry(t *testing.T) {
	entry := GetRegistryEntry(ErrCodeAuthRequired)
	if entry == nil {
		t.Fatal("Expected registry entry, got nil")
	}

	if entry.Title != "Authentication Required" {
		t.Errorf("Title = %v, want 'Authentication Required'", entry.Title)
	}

	// Test non-existent code
	nonExistent := GetRegistryEntry("LR-999")
	if nonExistent != nil {
		t.Errorf("Expected nil for non-existent code, got %v", nonExistent)
	}
}

// Test FormatTUI
func TestFormatTUI(t *testing.T) {
	err := NewWithCode(ErrCodeAuthRequired, "Not authenticated", "Suggestion 1", "Suggestion 2")
	formatted := err.FormatTUI()

	// Should contain error code
	if !strings.Contains(formatted, "LR-101") {
		t.Errorf("Formatted output should contain error code")
	}

	// Should contain message
	if !strings.Contains(formatted, "Not authenticated") {
		t.Errorf("Formatted output should contain message")
	}

	// Should contain suggestions
	if !strings.Contains(formatted, "Suggestion 1") {
		t.Errorf("Formatted output should contain suggestions")
	}

	// Should contain box characters (unicode box drawing)
	// lipgloss RoundedBorder uses ╭ ╮ ╯ ╰
	if !strings.Contains(formatted, "╭") && !strings.Contains(formatted, "┌") && !strings.Contains(formatted, "╔") {
		t.Errorf("Formatted output should contain box drawing characters, got: %s", formatted)
	}
}

// Test context-aware suggestions
func TestContextAwareSuggestions(t *testing.T) {
	tests := []struct {
		name     string
		code     ErrorCode
		context  map[string]string
		contains []string
	}{
		{
			name: "Auth with provider",
			code: ErrCodeAuthRequired,
			context: map[string]string{
				"provider": "github",
			},
			contains: []string{"github"},
		},
		{
			name: "Rate limit with reset time",
			code: ErrCodeAPIRateLimit,
			context: map[string]string{
				"reset_time": "2026-02-05 15:30:00",
			},
			contains: []string{"2026-02-05 15:30:00"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := NewWithCode(tt.code, "Test error")
			err = err.WithContext(tt.context)

			suggestions := err.GetContextualSuggestions()
			found := false
			for _, suggestion := range suggestions {
				for _, search := range tt.contains {
					if strings.Contains(suggestion, search) {
						found = true
						break
					}
				}
				if found {
					break
				}
			}

			if !found {
				t.Errorf("Expected suggestions to contain one of %v, got: %v", tt.contains, suggestions)
			}
		})
	}
}

// Test legacy constructor compatibility
func TestLegacyConstructors(t *testing.T) {
	t.Run("AuthenticationRequired", func(t *testing.T) {
		err := AuthenticationRequired("github")
		if err.Code != ErrCodeAuthRequired {
			t.Errorf("Code = %v, want %v", err.Code, ErrCodeAuthRequired)
		}
		if !strings.Contains(err.Message, "github") {
			t.Errorf("Message should contain provider name")
		}
	})

	t.Run("TokenExpired", func(t *testing.T) {
		err := TokenExpired("gitlab")
		if err.Code != ErrCodeAuthTokenExpired {
			t.Errorf("Code = %v, want %v", err.Code, ErrCodeAuthTokenExpired)
		}
	})

	t.Run("RateLimitExceeded", func(t *testing.T) {
		err := RateLimitExceeded("github", "15:30")
		if err.Code != ErrCodeAPIRateLimit {
			t.Errorf("Code = %v, want %v", err.Code, ErrCodeAPIRateLimit)
		}
	})

	t.Run("NetworkError", func(t *testing.T) {
		originalErr := errors.New("timeout")
		err := NetworkError(originalErr)
		if err.Code != ErrCodeAPINetwork {
			t.Errorf("Code = %v, want %v", err.Code, ErrCodeAPINetwork)
		}
		if err.Err != originalErr {
			t.Errorf("Original error not preserved")
		}
	})

	t.Run("ConfigurationError", func(t *testing.T) {
		err := ConfigurationError("invalid YAML")
		if err.Code != ErrCodeConfigInvalid {
			t.Errorf("Code = %v, want %v", err.Code, ErrCodeConfigInvalid)
		}
	})

	t.Run("InsufficientPermissions", func(t *testing.T) {
		err := InsufficientPermissions("github", []string{"repo", "read:org"})
		if err.Code != ErrCodeAuthInsufficientPerms {
			t.Errorf("Code = %v, want %v", err.Code, ErrCodeAuthInsufficientPerms)
		}
		if !strings.Contains(err.Message, "github") {
			t.Errorf("Message should contain provider name")
		}
		if !strings.Contains(err.GetContextualSuggestions()[0], "repo") {
			t.Errorf("Context should include required scopes")
		}
	})

	t.Run("SAMLRequired", func(t *testing.T) {
		err := SAMLRequired("my-org")
		if err.Code != ErrCodeAuthSAMLRequired {
			t.Errorf("Code = %v, want %v", err.Code, ErrCodeAuthSAMLRequired)
		}
		if !strings.Contains(err.Message, "my-org") {
			t.Errorf("Message should contain organization name")
		}
	})

	t.Run("ProviderNotSupported", func(t *testing.T) {
		err := ProviderNotSupported("invalid-provider")
		if err.Code != ErrCodeConfigProviderNotFound {
			t.Errorf("Code = %v, want %v", err.Code, ErrCodeConfigProviderNotFound)
		}
		if !strings.Contains(err.Message, "invalid-provider") {
			t.Errorf("Message should contain provider name")
		}
	})
}

// Test FormatTUIWithTheme
func TestFormatTUIWithTheme(t *testing.T) {
	err := NewWithCode(ErrCodeAuthRequired, "Not authenticated")

	// Test with different color modes
	formatted := err.FormatTUIWithTheme("196", "81", "240")

	if formatted == "" {
		t.Error("FormatTUIWithTheme should return non-empty string")
	}

	// Should still contain essential information
	if !strings.Contains(formatted, "LR-101") {
		t.Errorf("Formatted output should contain error code")
	}
}

// Test error immutability
func TestErrorImmutability(t *testing.T) {
	original := NewWithCode(ErrCodeAuthRequired, "Original message")

	// WithContext should return new instance
	modified := original.WithContext(map[string]string{"provider": "github"})

	if len(original.Context) != 0 {
		t.Error("Original error should not be modified")
	}

	if len(modified.Context) == 0 {
		t.Error("Modified error should have context")
	}

	// WithHelp should return new instance
	original2 := NewWithCode(ErrCodeInternalUnexpected, "Original message")
	originalHelpURL := original2.HelpURL
	modified2 := original2.WithHelp("https://custom-help.example.com")

	if original2.HelpURL != originalHelpURL {
		t.Errorf("Original error HelpURL should not be modified, got: %v, want: %v", original2.HelpURL, originalHelpURL)
	}

	if modified2.HelpURL != "https://custom-help.example.com" {
		t.Errorf("Modified error should have new help URL, got: %v", modified2.HelpURL)
	}
}

// Benchmark FormatTUI
func BenchmarkFormatTUI(b *testing.B) {
	err := NewWithCode(
		ErrCodeAuthRequired,
		"Not authenticated",
		"Suggestion 1",
		"Suggestion 2",
		"Suggestion 3",
	)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = err.FormatTUI()
	}
}

// Benchmark GetContextualSuggestions
func BenchmarkGetContextualSuggestions(b *testing.B) {
	err := NewWithCode(ErrCodeAuthRequired, "Not authenticated")
	err = err.WithContext(map[string]string{
		"provider":  "github",
		"operation": "list_prs",
	})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = err.GetContextualSuggestions()
	}
}
