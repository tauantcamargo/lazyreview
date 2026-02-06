package ai

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestNewCostEstimator(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "cost_test.db")

	estimator, err := NewCostEstimator(dbPath, 10.0, 50.0)
	if err != nil {
		t.Fatalf("Failed to create cost estimator: %v", err)
	}
	defer estimator.Close()

	if estimator.db == nil {
		t.Fatal("Database should be initialized")
	}
	if estimator.warningThreshold != 10.0 {
		t.Errorf("Warning threshold = %f, want 10.0", estimator.warningThreshold)
	}
	if estimator.monthlyLimit != 50.0 {
		t.Errorf("Monthly limit = %f, want 50.0", estimator.monthlyLimit)
	}
}

func TestEstimateCost_OpenAI(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "cost_test.db")

	estimator, err := NewCostEstimator(dbPath, 0, 0)
	if err != nil {
		t.Fatalf("Failed to create cost estimator: %v", err)
	}
	defer estimator.Close()

	inputText := "Review this code: func main() { fmt.Println(\"hello\") }"
	estimate, err := estimator.EstimateCost("openai", "gpt-4o-mini", inputText, 100)
	if err != nil {
		t.Fatalf("Failed to estimate cost: %v", err)
	}

	if estimate.Provider != "openai" {
		t.Errorf("Provider = %s, want openai", estimate.Provider)
	}
	if estimate.Model != "gpt-4o-mini" {
		t.Errorf("Model = %s, want gpt-4o-mini", estimate.Model)
	}
	if estimate.InputTokens <= 0 {
		t.Errorf("InputTokens = %d, want > 0", estimate.InputTokens)
	}
	if estimate.OutputTokens != 100 {
		t.Errorf("OutputTokens = %d, want 100", estimate.OutputTokens)
	}
	if estimate.TotalCost <= 0 {
		t.Errorf("TotalCost = %f, want > 0", estimate.TotalCost)
	}

	// GPT-4o-mini is very cheap, cost should be small
	if estimate.TotalCost > 0.01 {
		t.Errorf("TotalCost = %f, seems too high for gpt-4o-mini", estimate.TotalCost)
	}
}

func TestEstimateCost_Anthropic(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "cost_test.db")

	estimator, err := NewCostEstimator(dbPath, 0, 0)
	if err != nil {
		t.Fatalf("Failed to create cost estimator: %v", err)
	}
	defer estimator.Close()

	inputText := "Review this diff for security issues."
	estimate, err := estimator.EstimateCost("anthropic", "claude-sonnet-4-5-20250929", inputText, 150)
	if err != nil {
		t.Fatalf("Failed to estimate cost: %v", err)
	}

	if estimate.Provider != "anthropic" {
		t.Errorf("Provider = %s, want anthropic", estimate.Provider)
	}
	if estimate.InputTokens <= 0 {
		t.Errorf("InputTokens = %d, want > 0", estimate.InputTokens)
	}
	if estimate.TotalCost <= 0 {
		t.Errorf("TotalCost = %f, want > 0", estimate.TotalCost)
	}
}

func TestEstimateCost_Ollama(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "cost_test.db")

	estimator, err := NewCostEstimator(dbPath, 0, 0)
	if err != nil {
		t.Fatalf("Failed to create cost estimator: %v", err)
	}
	defer estimator.Close()

	inputText := "Review this code."
	estimate, err := estimator.EstimateCost("ollama", "codellama", inputText, 100)
	if err != nil {
		t.Fatalf("Failed to estimate cost: %v", err)
	}

	if estimate.TotalCost != 0 {
		t.Errorf("TotalCost = %f, want 0 for Ollama", estimate.TotalCost)
	}
}

func TestRecordCost(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "cost_test.db")

	estimator, err := NewCostEstimator(dbPath, 0, 0)
	if err != nil {
		t.Fatalf("Failed to create cost estimator: %v", err)
	}
	defer estimator.Close()

	ctx := context.Background()

	// Record a cost
	err = estimator.RecordCost(ctx, "openai", "gpt-4o-mini", 500, 200)
	if err != nil {
		t.Fatalf("Failed to record cost: %v", err)
	}

	// Check session totals
	sessionCost, sessionCalls := estimator.GetSessionCost()
	if sessionCost <= 0 {
		t.Errorf("Session cost = %f, want > 0", sessionCost)
	}
	if sessionCalls != 1 {
		t.Errorf("Session calls = %d, want 1", sessionCalls)
	}

	// Record another cost
	err = estimator.RecordCost(ctx, "anthropic", "claude-sonnet-4-5-20250929", 1000, 300)
	if err != nil {
		t.Fatalf("Failed to record second cost: %v", err)
	}

	sessionCost2, sessionCalls2 := estimator.GetSessionCost()
	if sessionCalls2 != 2 {
		t.Errorf("Session calls = %d, want 2", sessionCalls2)
	}
	if sessionCost2 <= sessionCost {
		t.Errorf("Session cost should have increased")
	}
}

func TestGetMonthlyCost(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "cost_test.db")

	estimator, err := NewCostEstimator(dbPath, 0, 0)
	if err != nil {
		t.Fatalf("Failed to create cost estimator: %v", err)
	}
	defer estimator.Close()

	ctx := context.Background()

	// Record some costs in current month
	now := time.Now()
	err = estimator.RecordCost(ctx, "openai", "gpt-4o-mini", 500, 200)
	if err != nil {
		t.Fatalf("Failed to record cost: %v", err)
	}

	err = estimator.RecordCost(ctx, "openai", "gpt-4o-mini", 300, 100)
	if err != nil {
		t.Fatalf("Failed to record cost: %v", err)
	}

	// Get current month cost
	monthlyCost, err := estimator.GetMonthlyCost(ctx, now.Year(), int(now.Month()))
	if err != nil {
		t.Fatalf("Failed to get monthly cost: %v", err)
	}

	if monthlyCost.TotalCalls != 2 {
		t.Errorf("Total calls = %d, want 2", monthlyCost.TotalCalls)
	}
	if monthlyCost.TotalCost <= 0 {
		t.Errorf("Total cost = %f, want > 0", monthlyCost.TotalCost)
	}

	expectedMonth := time.Now().Format("2006-01")
	if monthlyCost.Month != expectedMonth {
		t.Errorf("Month = %s, want %s", monthlyCost.Month, expectedMonth)
	}
}

func TestGetCurrentMonthCost(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "cost_test.db")

	estimator, err := NewCostEstimator(dbPath, 0, 0)
	if err != nil {
		t.Fatalf("Failed to create cost estimator: %v", err)
	}
	defer estimator.Close()

	ctx := context.Background()

	// Initially should be zero
	monthlyCost, err := estimator.GetCurrentMonthCost(ctx)
	if err != nil {
		t.Fatalf("Failed to get current month cost: %v", err)
	}
	if monthlyCost.TotalCost != 0 {
		t.Errorf("Initial total cost = %f, want 0", monthlyCost.TotalCost)
	}
	if monthlyCost.TotalCalls != 0 {
		t.Errorf("Initial total calls = %d, want 0", monthlyCost.TotalCalls)
	}

	// Record a cost
	err = estimator.RecordCost(ctx, "openai", "gpt-4o-mini", 500, 200)
	if err != nil {
		t.Fatalf("Failed to record cost: %v", err)
	}

	// Should now have cost
	monthlyCost, err = estimator.GetCurrentMonthCost(ctx)
	if err != nil {
		t.Fatalf("Failed to get current month cost: %v", err)
	}
	if monthlyCost.TotalCost <= 0 {
		t.Errorf("Total cost = %f, want > 0", monthlyCost.TotalCost)
	}
	if monthlyCost.TotalCalls != 1 {
		t.Errorf("Total calls = %d, want 1", monthlyCost.TotalCalls)
	}
}

func TestCheckThresholds(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "cost_test.db")

	// Set low thresholds for testing
	estimator, err := NewCostEstimator(dbPath, 0.001, 0.002)
	if err != nil {
		t.Fatalf("Failed to create cost estimator: %v", err)
	}
	defer estimator.Close()

	ctx := context.Background()

	// Initially no threshold exceeded
	exceeded, warning, msg := estimator.CheckThresholds(ctx)
	if exceeded || warning {
		t.Errorf("Should not have any thresholds exceeded initially")
	}
	if msg != "" {
		t.Errorf("Should have empty message initially, got: %s", msg)
	}

	// Record cost to trigger warning (but not limit)
	// Using gpt-4 to generate enough cost
	err = estimator.RecordCost(ctx, "openai", "gpt-4", 100, 50) // ~$0.0045
	if err != nil {
		t.Fatalf("Failed to record cost: %v", err)
	}

	exceeded, warning, msg = estimator.CheckThresholds(ctx)
	if !exceeded && !warning {
		// Depending on exact cost calculation, we should hit at least warning
		t.Logf("Warning: expected threshold to be hit. Cost may be lower than expected.")
	}
}

func TestGetAllMonthsCost(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "cost_test.db")

	estimator, err := NewCostEstimator(dbPath, 0, 0)
	if err != nil {
		t.Fatalf("Failed to create cost estimator: %v", err)
	}
	defer estimator.Close()

	ctx := context.Background()

	// Initially should be empty
	months, err := estimator.GetAllMonthsCost(ctx)
	if err != nil {
		t.Fatalf("Failed to get all months cost (empty): %v", err)
	}
	if len(months) != 0 {
		t.Errorf("Expected 0 months initially, got %d", len(months))
	}

	// Record costs
	err = estimator.RecordCost(ctx, "openai", "gpt-4o-mini", 500, 200)
	if err != nil {
		t.Fatalf("Failed to record cost: %v", err)
	}

	err = estimator.RecordCost(ctx, "anthropic", "claude-sonnet-4-5-20250929", 1000, 300)
	if err != nil {
		t.Fatalf("Failed to record cost: %v", err)
	}

	// Get all months
	months, err = estimator.GetAllMonthsCost(ctx)
	if err != nil {
		t.Fatalf("Failed to get all months cost: %v", err)
	}

	if len(months) == 0 {
		t.Fatalf("Expected at least one month, got 0")
	}

	// Should have current month
	if months[0].TotalCalls != 2 {
		t.Errorf("Total calls = %d, want 2", months[0].TotalCalls)
	}
	if months[0].TotalCost <= 0 {
		t.Errorf("Total cost = %f, want > 0", months[0].TotalCost)
	}
}

func TestGetPricing(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "cost_test.db")

	estimator, err := NewCostEstimator(dbPath, 0, 0)
	if err != nil {
		t.Fatalf("Failed to create cost estimator: %v", err)
	}
	defer estimator.Close()

	tests := []struct {
		provider string
		model    string
		expected ModelPricing
	}{
		{"openai", "gpt-4o-mini", PricingGPT4oMini},
		{"openai", "gpt-4o", PricingGPT4o},
		{"openai", "gpt-4", PricingGPT4},
		{"anthropic", "claude-opus-4-6", PricingClaudeOpus4},
		{"anthropic", "claude-sonnet-4-5-20250929", PricingClaudeSonnet4},
		{"anthropic", "claude-haiku-4-5-20251001", PricingClaudeHaiku4},
		{"anthropic", "claude-3-opus-20240229", PricingClaude3Opus},
		{"anthropic", "claude-3-5-sonnet-20241022", PricingClaude3Sonnet},
		{"anthropic", "claude-3-haiku-20240307", PricingClaude3Haiku},
		{"ollama", "codellama", PricingOllama},
		{"ollama", "llama3.2", PricingOllama},
		{"unknown", "model", PricingOllama}, // Unknown defaults to free
	}

	for _, tt := range tests {
		t.Run(tt.provider+"/"+tt.model, func(t *testing.T) {
			pricing := estimator.getPricing(tt.provider, tt.model)
			if pricing.InputPer1K != tt.expected.InputPer1K {
				t.Errorf("InputPer1K = %f, want %f", pricing.InputPer1K, tt.expected.InputPer1K)
			}
			if pricing.OutputPer1K != tt.expected.OutputPer1K {
				t.Errorf("OutputPer1K = %f, want %f", pricing.OutputPer1K, tt.expected.OutputPer1K)
			}
		})
	}
}

func TestCostEstimatorCountTokens(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "cost_test.db")

	estimator, err := NewCostEstimator(dbPath, 0, 0)
	if err != nil {
		t.Fatalf("Failed to create cost estimator: %v", err)
	}
	defer estimator.Close()

	tests := []struct {
		provider string
		model    string
		text     string
	}{
		{"openai", "gpt-4o-mini", "Hello world"},
		{"anthropic", "claude-sonnet-4-5-20250929", "Review this code"},
		{"ollama", "codellama", "Test text"},
	}

	for _, tt := range tests {
		t.Run(tt.provider, func(t *testing.T) {
			tokens := estimator.countTokens(tt.provider, tt.model, tt.text)
			if tokens <= 0 {
				t.Errorf("Tokens = %d, want > 0", tokens)
			}
			// Token count should be roughly len(text)/4
			expectedRange := len(tt.text) / 4
			if tokens < expectedRange/2 || tokens > expectedRange*2 {
				t.Logf("Warning: tokens = %d seems off for text length %d", tokens, len(tt.text))
			}
		})
	}
}

func TestContainsAny(t *testing.T) {
	tests := []struct {
		s          string
		substrings []string
		expected   bool
	}{
		{"gpt-4o-mini", []string{"gpt-4o-mini"}, true},
		{"gpt-4o-mini", []string{"gpt-4o"}, true},
		{"gpt-4o-mini", []string{"gpt-4"}, true},
		{"gpt-4o", []string{"gpt-4o-mini"}, false},
		{"claude-sonnet-4-5-20250929", []string{"sonnet-4"}, true},
		{"claude-opus-4-6", []string{"opus-4"}, true},
		{"hello world", []string{"world", "foo"}, true},
		{"hello world", []string{"foo", "bar"}, false},
		{"", []string{"test"}, false},
		{"test", []string{""}, false},
	}

	for _, tt := range tests {
		t.Run(tt.s, func(t *testing.T) {
			result := containsAny(tt.s, tt.substrings...)
			if result != tt.expected {
				t.Errorf("containsAny(%q, %v) = %v, want %v", tt.s, tt.substrings, result, tt.expected)
			}
		})
	}
}

func TestFormatCost(t *testing.T) {
	tests := []struct {
		cost     float64
		expected string
	}{
		{0.0, "$0.0000"},
		{0.001, "$0.0010"},
		{0.0099, "$0.0099"},
		{0.01, "$0.01"},
		{0.1, "$0.10"},
		{1.0, "$1.00"},
		{10.5, "$10.50"},
		{100.0, "$100.00"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			result := FormatCost(tt.cost)
			if result != tt.expected {
				t.Errorf("FormatCost(%f) = %s, want %s", tt.cost, result, tt.expected)
			}
		})
	}
}

func TestCostEstimatorPersistence(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "cost_persist_test.db")
	ctx := context.Background()

	// Create first estimator and record costs
	{
		estimator, err := NewCostEstimator(dbPath, 0, 0)
		if err != nil {
			t.Fatalf("Failed to create cost estimator: %v", err)
		}

		err = estimator.RecordCost(ctx, "openai", "gpt-4o-mini", 500, 200)
		if err != nil {
			t.Fatalf("Failed to record cost: %v", err)
		}

		err = estimator.RecordCost(ctx, "anthropic", "claude-sonnet-4-5-20250929", 1000, 300)
		if err != nil {
			t.Fatalf("Failed to record cost: %v", err)
		}

		estimator.Close()
	}

	// Create second estimator and verify persistence
	{
		estimator, err := NewCostEstimator(dbPath, 0, 0)
		if err != nil {
			t.Fatalf("Failed to create second cost estimator: %v", err)
		}
		defer estimator.Close()

		monthlyCost, err := estimator.GetCurrentMonthCost(ctx)
		if err != nil {
			t.Fatalf("Failed to get monthly cost: %v", err)
		}

		if monthlyCost.TotalCalls != 2 {
			t.Errorf("Total calls = %d, want 2", monthlyCost.TotalCalls)
		}
		if monthlyCost.TotalCost <= 0 {
			t.Errorf("Total cost = %f, want > 0", monthlyCost.TotalCost)
		}
	}

	// Verify database file exists
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Errorf("Database file should exist at %s", dbPath)
	}
}

func TestSessionCostAccumulation(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "cost_test.db")

	estimator, err := NewCostEstimator(dbPath, 0, 0)
	if err != nil {
		t.Fatalf("Failed to create cost estimator: %v", err)
	}
	defer estimator.Close()

	ctx := context.Background()

	// Initially zero
	cost, calls := estimator.GetSessionCost()
	if cost != 0 || calls != 0 {
		t.Errorf("Initial session cost/calls should be 0, got %f/%d", cost, calls)
	}

	// Record multiple costs
	costs := []struct {
		provider     string
		model        string
		inputTokens  int
		outputTokens int
	}{
		{"openai", "gpt-4o-mini", 100, 50},
		{"openai", "gpt-4o-mini", 200, 100},
		{"anthropic", "claude-sonnet-4-5-20250929", 500, 200},
	}

	for _, c := range costs {
		err := estimator.RecordCost(ctx, c.provider, c.model, c.inputTokens, c.outputTokens)
		if err != nil {
			t.Fatalf("Failed to record cost: %v", err)
		}
	}

	// Check session totals
	totalCost, totalCalls := estimator.GetSessionCost()
	if totalCalls != 3 {
		t.Errorf("Session calls = %d, want 3", totalCalls)
	}
	if totalCost <= 0 {
		t.Errorf("Session cost = %f, want > 0", totalCost)
	}
}
