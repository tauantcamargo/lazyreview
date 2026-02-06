package ai

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	lazyerrors "lazyreview/internal/errors"
)

func TestNewAnthropicProviderFromEnv_MissingKey(t *testing.T) {
	// Save and restore env
	oldKey := os.Getenv("ANTHROPIC_API_KEY")
	defer os.Setenv("ANTHROPIC_API_KEY", oldKey)

	os.Unsetenv("ANTHROPIC_API_KEY")

	_, err := NewAnthropicProviderFromEnv()
	if err == nil {
		t.Fatal("expected error for missing API key")
	}

	var actionableErr *lazyerrors.ActionableError
	if !errors.As(err, &actionableErr) {
		t.Fatalf("expected ActionableError, got %T", err)
	}

	if actionableErr.Code != lazyerrors.ErrCodeAITokenMissing {
		t.Errorf("expected code %s, got %s", lazyerrors.ErrCodeAITokenMissing, actionableErr.Code)
	}
}

func TestNewAnthropicProviderFromEnv_DefaultModel(t *testing.T) {
	// Save and restore env
	oldKey := os.Getenv("ANTHROPIC_API_KEY")
	oldModel := os.Getenv("LAZYREVIEW_AI_MODEL")
	defer func() {
		os.Setenv("ANTHROPIC_API_KEY", oldKey)
		os.Setenv("LAZYREVIEW_AI_MODEL", oldModel)
	}()

	os.Setenv("ANTHROPIC_API_KEY", "test-key")
	os.Unsetenv("LAZYREVIEW_AI_MODEL")

	provider, err := NewAnthropicProviderFromEnv()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	ap, ok := provider.(*anthropicProvider)
	if !ok {
		t.Fatalf("expected *anthropicProvider, got %T", provider)
	}

	if ap.model != ModelClaudeSonnet4_5 {
		t.Errorf("expected default model %s, got %s", ModelClaudeSonnet4_5, ap.model)
	}
}

func TestNewAnthropicProviderFromEnv_CustomModel(t *testing.T) {
	// Save and restore env
	oldKey := os.Getenv("ANTHROPIC_API_KEY")
	oldModel := os.Getenv("LAZYREVIEW_AI_MODEL")
	defer func() {
		os.Setenv("ANTHROPIC_API_KEY", oldKey)
		os.Setenv("LAZYREVIEW_AI_MODEL", oldModel)
	}()

	os.Setenv("ANTHROPIC_API_KEY", "test-key")
	os.Setenv("LAZYREVIEW_AI_MODEL", ModelClaudeOpus4_6)

	provider, err := NewAnthropicProviderFromEnv()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	ap, ok := provider.(*anthropicProvider)
	if !ok {
		t.Fatalf("expected *anthropicProvider, got %T", provider)
	}

	if ap.model != ModelClaudeOpus4_6 {
		t.Errorf("expected model %s, got %s", ModelClaudeOpus4_6, ap.model)
	}
}

func TestNewAnthropicProvider_EmptyKey(t *testing.T) {
	_, err := NewAnthropicProvider("", ModelClaudeSonnet4_5)
	if err == nil {
		t.Fatal("expected error for empty API key")
	}

	var actionableErr *lazyerrors.ActionableError
	if !errors.As(err, &actionableErr) {
		t.Fatalf("expected ActionableError, got %T", err)
	}

	if actionableErr.Code != lazyerrors.ErrCodeAITokenMissing {
		t.Errorf("expected code %s, got %s", lazyerrors.ErrCodeAITokenMissing, actionableErr.Code)
	}
}

func TestNewAnthropicProvider_DefaultModel(t *testing.T) {
	provider, err := NewAnthropicProvider("test-key", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	ap, ok := provider.(*anthropicProvider)
	if !ok {
		t.Fatalf("expected *anthropicProvider, got %T", provider)
	}

	if ap.model != ModelClaudeSonnet4_5 {
		t.Errorf("expected default model %s, got %s", ModelClaudeSonnet4_5, ap.model)
	}
}

func TestCalculateMaxTokens(t *testing.T) {
	tests := []struct {
		model    string
		expected int
	}{
		{ModelClaudeOpus4_6, 4096},
		{ModelClaudeSonnet4_5, 2048},
		{ModelClaudeHaiku4_5, 2048},
		{ModelClaude3Opus, 4096},
		{ModelClaude3Sonnet, 2048},
		{ModelClaude3Haiku, 2048},
		{"unknown-model", 2048}, // default
	}

	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			p := &anthropicProvider{model: tt.model}
			got := p.calculateMaxTokens()
			if got != tt.expected {
				t.Errorf("calculateMaxTokens() = %d, want %d", got, tt.expected)
			}
		})
	}
}

func TestCalculateBackoff(t *testing.T) {
	p := &anthropicProvider{}

	tests := []struct {
		attempt     int
		minExpected time.Duration
		maxExpected time.Duration
	}{
		{0, 1 * time.Second, 1 * time.Second},
		{1, 2 * time.Second, 2 * time.Second},
		{2, 4 * time.Second, 4 * time.Second},
		{3, 8 * time.Second, 8 * time.Second},
		{4, 16 * time.Second, 16 * time.Second},
		{5, 32 * time.Second, 32 * time.Second},
		{6, 32 * time.Second, 32 * time.Second}, // capped at maxBackoffDelay
		{10, 32 * time.Second, 32 * time.Second},
	}

	for _, tt := range tests {
		t.Run(string(rune(tt.attempt)), func(t *testing.T) {
			got := p.calculateBackoff(tt.attempt)
			if got < tt.minExpected || got > tt.maxExpected {
				t.Errorf("calculateBackoff(%d) = %v, want between %v and %v",
					tt.attempt, got, tt.minExpected, tt.maxExpected)
			}
		})
	}
}

func TestIsRetryableError(t *testing.T) {
	p := &anthropicProvider{}

	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
		{
			name:     "rate limit error",
			err:      errors.New("429 rate limit exceeded"),
			expected: true,
		},
		{
			name:     "rate_limit in message",
			err:      errors.New("rate_limit_error"),
			expected: true,
		},
		{
			name:     "server error 500",
			err:      errors.New("500 internal server error"),
			expected: true,
		},
		{
			name:     "server error 503",
			err:      errors.New("503 service unavailable"),
			expected: true,
		},
		{
			name:     "timeout error",
			err:      context.DeadlineExceeded,
			expected: true,
		},
		{
			name:     "client error 400",
			err:      errors.New("400 bad request"),
			expected: false,
		},
		{
			name:     "authentication error",
			err:      errors.New("401 unauthorized"),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := p.isRetryableError(tt.err)
			if got != tt.expected {
				t.Errorf("isRetryableError() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestIsTimeoutError(t *testing.T) {
	p := &anthropicProvider{}

	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
		{
			name:     "context deadline exceeded",
			err:      context.DeadlineExceeded,
			expected: true,
		},
		{
			name:     "timeout in message",
			err:      errors.New("request timeout"),
			expected: true,
		},
		{
			name:     "deadline in message",
			err:      errors.New("deadline exceeded"),
			expected: true,
		},
		{
			name:     "other error",
			err:      errors.New("some other error"),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := p.isTimeoutError(tt.err)
			if got != tt.expected {
				t.Errorf("isTimeoutError() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestMapError(t *testing.T) {
	p := &anthropicProvider{model: ModelClaudeSonnet4_5}

	tests := []struct {
		name         string
		err          error
		expectedCode lazyerrors.ErrorCode
	}{
		{
			name:         "nil error",
			err:          nil,
			expectedCode: "",
		},
		{
			name:         "rate limit 429",
			err:          errors.New("429 rate limit exceeded"),
			expectedCode: lazyerrors.ErrCodeAIRateLimit,
		},
		{
			name:         "rate_limit text",
			err:          errors.New("rate_limit_error"),
			expectedCode: lazyerrors.ErrCodeAIRateLimit,
		},
		{
			name:         "unauthorized 401",
			err:          errors.New("401 unauthorized"),
			expectedCode: lazyerrors.ErrCodeAITokenMissing,
		},
		{
			name:         "invalid api key",
			err:          errors.New("invalid api key"),
			expectedCode: lazyerrors.ErrCodeAITokenMissing,
		},
		{
			name:         "forbidden 403",
			err:          errors.New("403 forbidden"),
			expectedCode: lazyerrors.ErrCodeAIProviderError,
		},
		{
			name:         "quota exceeded",
			err:          errors.New("quota exceeded"),
			expectedCode: lazyerrors.ErrCodeAIProviderError,
		},
		{
			name:         "not found 404",
			err:          errors.New("404 not found"),
			expectedCode: lazyerrors.ErrCodeAIProviderError,
		},
		{
			name:         "overloaded 529",
			err:          errors.New("529 overloaded"),
			expectedCode: lazyerrors.ErrCodeAIProviderError,
		},
		{
			name:         "timeout",
			err:          context.DeadlineExceeded,
			expectedCode: lazyerrors.ErrCodeAIProviderError,
		},
		{
			name:         "generic error",
			err:          errors.New("some error"),
			expectedCode: lazyerrors.ErrCodeAIProviderError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := p.mapError(tt.err)

			if tt.expectedCode == "" {
				if got != nil {
					t.Errorf("mapError() = %v, want nil", got)
				}
				return
			}

			if got == nil {
				t.Fatal("mapError() = nil, want error")
			}

			var actionableErr *lazyerrors.ActionableError
			if !errors.As(got, &actionableErr) {
				t.Fatalf("expected ActionableError, got %T", got)
			}

			if actionableErr.Code != tt.expectedCode {
				t.Errorf("mapError() code = %s, want %s", actionableErr.Code, tt.expectedCode)
			}
		})
	}
}

func TestCountTokens(t *testing.T) {
	tests := []struct {
		name     string
		text     string
		expected int
	}{
		{
			name:     "empty string",
			text:     "",
			expected: 0,
		},
		{
			name:     "short text",
			text:     "Hello, world!",
			expected: 4, // 13 chars / 4 = 3.25 -> 4
		},
		{
			name:     "100 chars",
			text:     strings.Repeat("a", 100),
			expected: 25, // 100 / 4 = 25
		},
		{
			name:     "1000 chars",
			text:     strings.Repeat("a", 1000),
			expected: 250, // 1000 / 4 = 250
		},
		{
			name:     "single char",
			text:     "a",
			expected: 1, // (1 + 3) / 4 = 1
		},
		{
			name:     "three chars",
			text:     "abc",
			expected: 1, // (3 + 3) / 4 = 1
		},
		{
			name:     "four chars",
			text:     "abcd",
			expected: 1, // (4 + 3) / 4 = 1
		},
		{
			name:     "five chars",
			text:     "abcde",
			expected: 2, // (5 + 3) / 4 = 2
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CountTokens(tt.text)
			if got != tt.expected {
				t.Errorf("CountTokens() = %d, want %d", got, tt.expected)
			}
		})
	}
}

func TestExtractTextContent(t *testing.T) {
	p := &anthropicProvider{}

	t.Run("nil message", func(t *testing.T) {
		_, err := p.extractTextContent(nil)
		if err == nil {
			t.Fatal("expected error for nil message")
		}
	})

	// Note: Testing with real Message objects would require the anthropic SDK types
	// In a real implementation, you would mock these or use integration tests
}

func TestModelConstants(t *testing.T) {
	tests := []struct {
		name     string
		constant string
		expected string
	}{
		{"Opus 4.6", ModelClaudeOpus4_6, "claude-opus-4-6"},
		{"Sonnet 4.5", ModelClaudeSonnet4_5, "claude-sonnet-4-5-20250929"},
		{"Haiku 4.5", ModelClaudeHaiku4_5, "claude-haiku-4-5-20251001"},
		{"Claude 3 Opus", ModelClaude3Opus, "claude-3-opus-20240229"},
		{"Claude 3 Sonnet", ModelClaude3Sonnet, "claude-3-5-sonnet-20241022"},
		{"Claude 3 Haiku", ModelClaude3Haiku, "claude-3-haiku-20240307"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.constant != tt.expected {
				t.Errorf("constant = %q, want %q", tt.constant, tt.expected)
			}
		})
	}
}
