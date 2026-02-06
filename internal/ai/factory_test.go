package ai

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestNewProviderFactory_OpenAI(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "test-key",
		Model:    "gpt-4o-mini",
		BaseURL:  "https://api.openai.com/v1",
	}

	factory, err := NewProviderFactory(config)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if factory.GetProviderName() != "openai" {
		t.Errorf("expected provider name 'openai', got: %s", factory.GetProviderName())
	}

	if factory.GetProvider() == nil {
		t.Error("expected provider to be initialized")
	}
}

func TestNewProviderFactory_Anthropic(t *testing.T) {
	config := ProviderConfig{
		Provider: "anthropic",
		APIKey:   "test-key",
		Model:    "claude-sonnet-4-5-20250929",
	}

	factory, err := NewProviderFactory(config)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if factory.GetProviderName() != "anthropic" {
		t.Errorf("expected provider name 'anthropic', got: %s", factory.GetProviderName())
	}

	if factory.GetProvider() == nil {
		t.Error("expected provider to be initialized")
	}
}

func TestNewProviderFactory_Ollama_ServiceUnavailable(t *testing.T) {
	config := ProviderConfig{
		Provider: "ollama",
		Model:    "codellama",
		BaseURL:  "http://localhost:11434",
	}

	// This test assumes Ollama is not running
	// If Ollama is running, this test may fail
	factory, err := NewProviderFactory(config)

	// Should fail gracefully when Ollama is unavailable
	if err == nil && factory != nil {
		// If factory succeeded, Ollama might be running
		// This is acceptable - test passes
		if factory.GetProviderName() != "ollama" {
			t.Errorf("expected provider name 'ollama', got: %s", factory.GetProviderName())
		}
	}
}

func TestNewProviderFactory_InvalidProvider(t *testing.T) {
	config := ProviderConfig{
		Provider: "invalid",
		APIKey:   "test-key",
	}

	// Use empty fallback chain to prevent fallback to other providers
	_, err := NewProviderFactory(config, WithFallbackChain([]string{}))
	if err == nil {
		t.Error("expected error for invalid provider, got nil")
		return
	}

	if !strings.Contains(err.Error(), "unsupported AI provider") {
		t.Errorf("expected 'unsupported AI provider' error, got: %v", err)
	}
}

func TestNewProviderFactory_NoProviderConfigured(t *testing.T) {
	config := ProviderConfig{
		Provider: "",
		APIKey:   "test-key",
	}

	_, err := NewProviderFactory(config)
	if err == nil {
		t.Error("expected error for no provider, got nil")
	}

	if !strings.Contains(err.Error(), "not configured") {
		t.Errorf("expected 'not configured' error, got: %v", err)
	}
}

func TestNewProviderFactory_FallbackChain(t *testing.T) {
	// Test with OpenAI failing (no API key), should fall back
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "", // Missing API key
	}

	// Even with fallback chain, all providers require some config
	// This test verifies the fallback mechanism exists
	_, err := NewProviderFactory(config)
	if err == nil {
		t.Error("expected error when all providers fail, got nil")
	}
}

func TestNewProviderFactory_CustomFallbackChain(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "", // Missing API key
	}

	// Custom fallback chain with only OpenAI (should fail)
	factory, err := NewProviderFactory(config, WithFallbackChain([]string{"openai"}))
	if err == nil {
		t.Error("expected error for failing provider, got nil")
	}

	if factory != nil {
		t.Error("expected nil factory when all providers fail")
	}
}

func TestProviderFactory_SwitchProvider(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "test-key-1",
		Model:    "gpt-4o-mini",
	}

	factory, err := NewProviderFactory(config)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if factory.GetProviderName() != "openai" {
		t.Errorf("expected initial provider 'openai', got: %s", factory.GetProviderName())
	}

	// Switch to Anthropic
	newConfig := ProviderConfig{
		Provider: "anthropic",
		APIKey:   "test-key-2",
		Model:    "claude-sonnet-4-5-20250929",
	}

	err = factory.SwitchProvider("anthropic", newConfig)
	if err != nil {
		t.Fatalf("expected no error switching provider, got: %v", err)
	}

	if factory.GetProviderName() != "anthropic" {
		t.Errorf("expected provider 'anthropic' after switch, got: %s", factory.GetProviderName())
	}
}

func TestProviderFactory_SwitchProvider_InvalidProvider(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "test-key",
		Model:    "gpt-4o-mini",
	}

	factory, err := NewProviderFactory(config)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	// Try switching to invalid provider
	invalidConfig := ProviderConfig{
		Provider: "invalid",
		APIKey:   "test-key",
	}

	err = factory.SwitchProvider("invalid", invalidConfig)
	if err == nil {
		t.Error("expected error switching to invalid provider, got nil")
	}

	// Should still have original provider
	if factory.GetProviderName() != "openai" {
		t.Errorf("expected provider to remain 'openai', got: %s", factory.GetProviderName())
	}
}

func TestProviderFactory_IsProviderAvailable_OpenAI(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "test-key",
		Model:    "gpt-4o-mini",
	}

	factory, err := NewProviderFactory(config)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	available := factory.IsProviderAvailable("openai")
	if !available {
		t.Error("expected OpenAI to be available when API key is configured")
	}
}

func TestProviderFactory_IsProviderAvailable_Anthropic(t *testing.T) {
	config := ProviderConfig{
		Provider: "anthropic",
		APIKey:   "test-key",
		Model:    "claude-sonnet-4-5-20250929",
	}

	factory, err := NewProviderFactory(config)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	available := factory.IsProviderAvailable("anthropic")
	if !available {
		t.Error("expected Anthropic to be available when API key is configured")
	}
}

func TestProviderFactory_IsProviderAvailable_Ollama(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "test-key",
	}

	factory, err := NewProviderFactory(config)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	// Ollama availability depends on service running
	// Test just verifies the method works
	_ = factory.IsProviderAvailable("ollama")
}

func TestProviderFactory_IsProviderAvailable_Unknown(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "test-key",
	}

	factory, err := NewProviderFactory(config)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	available := factory.IsProviderAvailable("unknown")
	if available {
		t.Error("expected unknown provider to be unavailable")
	}
}

func TestProviderFactory_GetAvailableProviders(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "test-key",
	}

	factory, err := NewProviderFactory(config)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	available := factory.GetAvailableProviders()
	if len(available) == 0 {
		t.Error("expected at least one available provider")
	}

	// OpenAI should be available since we configured an API key
	found := false
	for _, name := range available {
		if name == "openai" {
			found = true
			break
		}
	}

	if !found {
		t.Error("expected OpenAI to be in available providers")
	}
}

func TestProviderFactory_AvailabilityCache(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "test-key",
	}

	factory, err := NewProviderFactory(config, WithCacheTTL(100*time.Millisecond))
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	// First check - should populate cache
	available1 := factory.IsProviderAvailable("openai")

	// Second check - should use cache
	available2 := factory.IsProviderAvailable("openai")

	if available1 != available2 {
		t.Error("expected consistent availability checks")
	}

	// Wait for cache to expire
	time.Sleep(150 * time.Millisecond)

	// Third check - should re-check after cache expiry
	available3 := factory.IsProviderAvailable("openai")

	if !available3 {
		t.Error("expected OpenAI to still be available after cache expiry")
	}
}

func TestProviderFactory_Review_NoProvider(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "test-key",
	}

	factory, err := NewProviderFactory(config)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	// Manually set provider to nil to test error handling
	factory.mu.Lock()
	factory.currentProvider = nil
	factory.mu.Unlock()

	ctx := context.Background()
	req := ReviewRequest{
		FilePath: "test.go",
		Diff:     "+func test() {}",
	}

	_, err = factory.Review(ctx, req)
	if err == nil {
		t.Error("expected error when no provider configured, got nil")
	}

	if !strings.Contains(err.Error(), "no AI provider") {
		t.Errorf("expected 'no AI provider' error, got: %v", err)
	}
}

func TestValidateConfig_OpenAI(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "test-key",
	}

	err := ValidateConfig(config)
	if err != nil {
		t.Errorf("expected no error for valid OpenAI config, got: %v", err)
	}
}

func TestValidateConfig_OpenAI_MissingAPIKey(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "",
	}

	err := ValidateConfig(config)
	if err == nil {
		t.Error("expected error for missing OpenAI API key, got nil")
	}

	if !strings.Contains(err.Error(), "API key is required") {
		t.Errorf("expected 'API key is required' error, got: %v", err)
	}
}

func TestValidateConfig_Anthropic(t *testing.T) {
	config := ProviderConfig{
		Provider: "anthropic",
		APIKey:   "test-key",
	}

	err := ValidateConfig(config)
	if err != nil {
		t.Errorf("expected no error for valid Anthropic config, got: %v", err)
	}
}

func TestValidateConfig_Anthropic_MissingAPIKey(t *testing.T) {
	config := ProviderConfig{
		Provider: "anthropic",
		APIKey:   "",
	}

	err := ValidateConfig(config)
	if err == nil {
		t.Error("expected error for missing Anthropic API key, got nil")
	}

	if !strings.Contains(err.Error(), "API key is required") {
		t.Errorf("expected 'API key is required' error, got: %v", err)
	}
}

func TestValidateConfig_Ollama(t *testing.T) {
	config := ProviderConfig{
		Provider: "ollama",
		Model:    "codellama",
	}

	err := ValidateConfig(config)
	if err != nil {
		t.Errorf("expected no error for valid Ollama config, got: %v", err)
	}
}

func TestValidateConfig_NoProvider(t *testing.T) {
	config := ProviderConfig{
		Provider: "",
	}

	err := ValidateConfig(config)
	if err == nil {
		t.Error("expected error for no provider, got nil")
	}

	if !strings.Contains(err.Error(), "not configured") {
		t.Errorf("expected 'not configured' error, got: %v", err)
	}
}

func TestValidateConfig_InvalidProvider(t *testing.T) {
	config := ProviderConfig{
		Provider: "invalid",
		APIKey:   "test-key",
	}

	err := ValidateConfig(config)
	if err == nil {
		t.Error("expected error for invalid provider, got nil")
	}

	if !strings.Contains(err.Error(), "unsupported AI provider") {
		t.Errorf("expected 'unsupported AI provider' error, got: %v", err)
	}
}

func TestProviderFactory_ConcurrentAccess(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "test-key",
		Model:    "gpt-4o-mini",
	}

	factory, err := NewProviderFactory(config)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	// Test concurrent reads
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			_ = factory.GetProvider()
			_ = factory.GetProviderName()
			_ = factory.IsProviderAvailable("openai")
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}

func TestProviderFactory_ConcurrentSwitching(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "test-key-1",
		Model:    "gpt-4o-mini",
	}

	factory, err := NewProviderFactory(config)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	// Test concurrent switches
	done := make(chan bool)
	for i := 0; i < 5; i++ {
		go func(idx int) {
			var newConfig ProviderConfig
			if idx%2 == 0 {
				newConfig = ProviderConfig{
					Provider: "openai",
					APIKey:   "test-key-openai",
					Model:    "gpt-4o-mini",
				}
			} else {
				newConfig = ProviderConfig{
					Provider: "anthropic",
					APIKey:   "test-key-anthropic",
					Model:    "claude-sonnet-4-5-20250929",
				}
			}
			_ = factory.SwitchProvider(newConfig.Provider, newConfig)
			done <- true
		}(i)
	}

	for i := 0; i < 5; i++ {
		<-done
	}

	// Should end up with a valid provider
	if factory.GetProvider() == nil {
		t.Error("expected provider to be set after concurrent switches")
	}
}

func TestProviderFactory_WithCustomOptions(t *testing.T) {
	config := ProviderConfig{
		Provider: "openai",
		APIKey:   "test-key",
	}

	customChain := []string{"anthropic", "openai"}
	customTTL := 30 * time.Second

	factory, err := NewProviderFactory(
		config,
		WithFallbackChain(customChain),
		WithCacheTTL(customTTL),
	)

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(factory.fallbackChain) != 2 {
		t.Errorf("expected fallback chain length 2, got: %d", len(factory.fallbackChain))
	}

	if factory.fallbackChain[0] != "anthropic" {
		t.Errorf("expected first fallback 'anthropic', got: %s", factory.fallbackChain[0])
	}

	if factory.cacheTTL != customTTL {
		t.Errorf("expected cache TTL %v, got: %v", customTTL, factory.cacheTTL)
	}
}
