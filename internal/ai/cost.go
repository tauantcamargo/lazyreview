package ai

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

// ModelPricing defines pricing per 1K tokens for a model.
type ModelPricing struct {
	Name        string
	InputPer1K  float64 // Cost per 1K input tokens
	OutputPer1K float64 // Cost per 1K output tokens
}

// Standard model pricing (as of 2025).
var (
	PricingGPT4 = ModelPricing{
		Name:        "gpt-4",
		InputPer1K:  0.03,
		OutputPer1K: 0.06,
	}
	PricingGPT4o = ModelPricing{
		Name:        "gpt-4o",
		InputPer1K:  0.005,
		OutputPer1K: 0.015,
	}
	PricingGPT4oMini = ModelPricing{
		Name:        "gpt-4o-mini",
		InputPer1K:  0.00015,
		OutputPer1K: 0.0006,
	}
	PricingClaudeOpus4 = ModelPricing{
		Name:        "claude-opus-4",
		InputPer1K:  0.015,
		OutputPer1K: 0.075,
	}
	PricingClaudeSonnet4 = ModelPricing{
		Name:        "claude-sonnet-4",
		InputPer1K:  0.003,
		OutputPer1K: 0.015,
	}
	PricingClaudeHaiku4 = ModelPricing{
		Name:        "claude-haiku-4",
		InputPer1K:  0.0008,
		OutputPer1K: 0.004,
	}
	PricingClaude3Opus = ModelPricing{
		Name:        "claude-3-opus",
		InputPer1K:  0.015,
		OutputPer1K: 0.075,
	}
	PricingClaude3Sonnet = ModelPricing{
		Name:        "claude-3-sonnet",
		InputPer1K:  0.003,
		OutputPer1K: 0.015,
	}
	PricingClaude3Haiku = ModelPricing{
		Name:        "claude-3-haiku",
		InputPer1K:  0.00025,
		OutputPer1K: 0.00125,
	}
	PricingOllama = ModelPricing{
		Name:        "ollama",
		InputPer1K:  0.0,
		OutputPer1K: 0.0,
	}
)

// CostEstimate represents an estimated cost for a review.
type CostEstimate struct {
	Provider     string
	Model        string
	InputTokens  int
	OutputTokens int
	TotalCost    float64
}

// CostRecord represents a persisted cost record in the database.
type CostRecord struct {
	ID           string
	Provider     string
	Model        string
	InputTokens  int
	OutputTokens int
	Cost         float64
	Timestamp    time.Time
}

// MonthlyCost represents aggregated cost for a month.
type MonthlyCost struct {
	Month      string // Format: "2025-01"
	TotalCost  float64
	TotalCalls int
}

// CostEstimator estimates and tracks AI review costs.
type CostEstimator struct {
	db                *sql.DB
	warningThreshold  float64 // Monthly warning threshold
	monthlyLimit      float64 // Monthly limit (0 = no limit)
	sessionCostTotal  float64
	sessionCallsTotal int
}

const costDBSchema = `
CREATE TABLE IF NOT EXISTS ai_costs (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_costs_timestamp ON ai_costs(timestamp);
CREATE INDEX IF NOT EXISTS idx_ai_costs_provider_model ON ai_costs(provider, model);
`

// NewCostEstimator creates a cost estimator with SQLite persistence.
func NewCostEstimator(dbPath string, warningThreshold, monthlyLimit float64) (*CostEstimator, error) {
	// Create directory if needed
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create cost database directory: %w", err)
	}

	// Open database
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open cost database: %w", err)
	}

	// Initialize schema
	if _, err := db.Exec(costDBSchema); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize cost schema: %w", err)
	}

	return &CostEstimator{
		db:               db,
		warningThreshold: warningThreshold,
		monthlyLimit:     monthlyLimit,
	}, nil
}

// Close closes the database connection.
func (e *CostEstimator) Close() error {
	if e.db != nil {
		return e.db.Close()
	}
	return nil
}

// EstimateCost estimates the cost of a review request before sending.
func (e *CostEstimator) EstimateCost(provider, model string, inputText string, estimatedOutputTokens int) (*CostEstimate, error) {
	pricing := e.getPricing(provider, model)

	// Count input tokens
	inputTokens := e.countTokens(provider, model, inputText)

	// Calculate cost
	inputCost := (float64(inputTokens) / 1000.0) * pricing.InputPer1K
	outputCost := (float64(estimatedOutputTokens) / 1000.0) * pricing.OutputPer1K
	totalCost := inputCost + outputCost

	return &CostEstimate{
		Provider:     provider,
		Model:        model,
		InputTokens:  inputTokens,
		OutputTokens: estimatedOutputTokens,
		TotalCost:    totalCost,
	}, nil
}

// RecordCost records the actual cost after a review is completed.
func (e *CostEstimator) RecordCost(ctx context.Context, provider, model string, inputTokens, outputTokens int) error {
	pricing := e.getPricing(provider, model)

	inputCost := (float64(inputTokens) / 1000.0) * pricing.InputPer1K
	outputCost := (float64(outputTokens) / 1000.0) * pricing.OutputPer1K
	totalCost := inputCost + outputCost

	// Generate ID
	id := fmt.Sprintf("%d-%s-%s", time.Now().UnixNano(), provider, model)

	// Insert record with proper datetime formatting
	timestamp := time.Now().UTC().Format("2006-01-02 15:04:05")
	_, err := e.db.ExecContext(ctx,
		`INSERT INTO ai_costs (id, provider, model, input_tokens, output_tokens, cost, timestamp)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, provider, model, inputTokens, outputTokens, totalCost, timestamp,
	)
	if err != nil {
		return fmt.Errorf("failed to record cost: %w", err)
	}

	// Update session totals
	e.sessionCostTotal += totalCost
	e.sessionCallsTotal++

	return nil
}

// GetMonthlyCost returns the total cost for a given month.
func (e *CostEstimator) GetMonthlyCost(ctx context.Context, year, month int) (*MonthlyCost, error) {
	startOfMonth := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endOfMonth := startOfMonth.AddDate(0, 1, 0)

	var totalCost float64
	var totalCalls int

	err := e.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(cost), 0), COUNT(*)
		 FROM ai_costs
		 WHERE timestamp >= ? AND timestamp < ?`,
		startOfMonth, endOfMonth,
	).Scan(&totalCost, &totalCalls)
	if err != nil {
		return nil, fmt.Errorf("failed to get monthly cost: %w", err)
	}

	monthStr := fmt.Sprintf("%04d-%02d", year, month)
	return &MonthlyCost{
		Month:      monthStr,
		TotalCost:  totalCost,
		TotalCalls: totalCalls,
	}, nil
}

// GetCurrentMonthCost returns the cost for the current month.
func (e *CostEstimator) GetCurrentMonthCost(ctx context.Context) (*MonthlyCost, error) {
	now := time.Now()
	return e.GetMonthlyCost(ctx, now.Year(), int(now.Month()))
}

// GetSessionCost returns the accumulated cost for the current session.
func (e *CostEstimator) GetSessionCost() (float64, int) {
	return e.sessionCostTotal, e.sessionCallsTotal
}

// CheckThresholds checks if any cost thresholds have been exceeded.
// Returns (exceeded, warning, error message).
func (e *CostEstimator) CheckThresholds(ctx context.Context) (bool, bool, string) {
	currentMonth, err := e.GetCurrentMonthCost(ctx)
	if err != nil {
		return false, false, ""
	}

	if e.monthlyLimit > 0 && currentMonth.TotalCost >= e.monthlyLimit {
		return true, false, fmt.Sprintf("Monthly cost limit exceeded: $%.4f / $%.2f", currentMonth.TotalCost, e.monthlyLimit)
	}

	if e.warningThreshold > 0 && currentMonth.TotalCost >= e.warningThreshold {
		return false, true, fmt.Sprintf("Monthly cost warning: $%.4f / $%.2f", currentMonth.TotalCost, e.warningThreshold)
	}

	return false, false, ""
}

// GetAllMonthsCost returns cost for all months.
func (e *CostEstimator) GetAllMonthsCost(ctx context.Context) ([]MonthlyCost, error) {
	rows, err := e.db.QueryContext(ctx,
		`SELECT strftime('%Y-%m', timestamp) as month, COALESCE(SUM(cost), 0), COUNT(*)
		 FROM ai_costs
		 WHERE timestamp IS NOT NULL
		 GROUP BY month
		 ORDER BY month DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get all months cost: %w", err)
	}
	defer rows.Close()

	var results []MonthlyCost
	for rows.Next() {
		var mc MonthlyCost
		var month sql.NullString
		if err := rows.Scan(&month, &mc.TotalCost, &mc.TotalCalls); err != nil {
			return nil, fmt.Errorf("failed to scan monthly cost: %w", err)
		}
		if month.Valid {
			mc.Month = month.String
			results = append(results, mc)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating monthly costs: %w", err)
	}

	return results, nil
}

// getPricing returns the pricing for a given provider and model.
func (e *CostEstimator) getPricing(provider, model string) ModelPricing {
	switch provider {
	case "openai":
		if containsAny(model, "gpt-4o-mini") {
			return PricingGPT4oMini
		}
		if containsAny(model, "gpt-4o") {
			return PricingGPT4o
		}
		if containsAny(model, "gpt-4") {
			return PricingGPT4
		}
		return PricingGPT4oMini // Default to mini

	case "anthropic":
		if containsAny(model, "opus-4") {
			return PricingClaudeOpus4
		}
		if containsAny(model, "sonnet-4") {
			return PricingClaudeSonnet4
		}
		if containsAny(model, "haiku-4") {
			return PricingClaudeHaiku4
		}
		if containsAny(model, "claude-3-opus") {
			return PricingClaude3Opus
		}
		if containsAny(model, "claude-3") && containsAny(model, "sonnet") {
			return PricingClaude3Sonnet
		}
		if containsAny(model, "claude-3") && containsAny(model, "haiku") {
			return PricingClaude3Haiku
		}
		return PricingClaudeSonnet4 // Default to Sonnet 4

	case "ollama":
		return PricingOllama

	default:
		return PricingOllama // Unknown provider = free
	}
}

// countTokens estimates token count for the given text.
func (e *CostEstimator) countTokens(provider, model, text string) int {
	switch provider {
	case "openai":
		// Use tiktoken-based estimation
		return estimateTokensOpenAI(text)

	case "anthropic":
		// Use simple character-based estimation (from anthropic.go)
		return CountTokens(text)

	case "ollama":
		// Rough estimate for local models
		return (len(text) + 3) / 4

	default:
		// Conservative estimate: 4 chars per token
		return (len(text) + 3) / 4
	}
}

// estimateTokensOpenAI estimates OpenAI token count.
// This is a simplified approximation. For production use, integrate tiktoken-go.
// GPT models use ~4 chars per token on average for English text.
func estimateTokensOpenAI(text string) int {
	if text == "" {
		return 0
	}

	// Conservative estimate: count words and punctuation
	// Average: ~1.3 tokens per word for English
	// For now, use character-based approximation
	chars := len(text)

	// OpenAI models average ~4 chars per token
	return (chars + 3) / 4
}

// containsAny checks if s contains any of the substrings.
func containsAny(s string, substrings ...string) bool {
	for _, substr := range substrings {
		if len(substr) > 0 && len(s) >= len(substr) {
			for i := 0; i <= len(s)-len(substr); i++ {
				if s[i:i+len(substr)] == substr {
					return true
				}
			}
		}
	}
	return false
}

// FormatCost formats a cost value as a currency string.
func FormatCost(cost float64) string {
	if cost < 0.01 {
		return fmt.Sprintf("$%.4f", cost)
	}
	return fmt.Sprintf("$%.2f", cost)
}
