package ai

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	lazyerrors "lazyreview/internal/errors"
)

const (
	defaultAnthropicHTTPTimeout = 90 * time.Second
	maxAnthropicRetries         = 3
	initialBackoffDelay         = 1 * time.Second
	maxBackoffDelay             = 32 * time.Second

	// Claude model names
	ModelClaudeOpus4_6   = "claude-opus-4-6"
	ModelClaudeSonnet4_5 = "claude-sonnet-4-5-20250929"
	ModelClaudeHaiku4_5  = "claude-haiku-4-5-20251001"

	// Legacy Claude 3 models
	ModelClaude3Opus   = "claude-3-opus-20240229"
	ModelClaude3Sonnet = "claude-3-5-sonnet-20241022"
	ModelClaude3Haiku  = "claude-3-haiku-20240307"
)

type anthropicProvider struct {
	client  *anthropic.Client
	model   string
	timeout time.Duration
}

// NewAnthropicProviderFromEnv initializes an Anthropic provider from env vars.
// Required: ANTHROPIC_API_KEY
// Optional: LAZYREVIEW_AI_MODEL (default: claude-sonnet-4-5-20250929)
func NewAnthropicProviderFromEnv() (Provider, error) {
	apiKey := strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY"))
	if apiKey == "" {
		return nil, lazyerrors.NewWithCode(
			lazyerrors.ErrCodeAITokenMissing,
			"Anthropic API key not configured",
			"Set environment variable: ANTHROPIC_API_KEY",
			"Get your API key at: https://console.anthropic.com/",
		).WithContext(map[string]string{"env_var": "ANTHROPIC_API_KEY"})
	}

	model := strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_MODEL"))
	if model == "" {
		model = ModelClaudeSonnet4_5
	}

	return NewAnthropicProvider(apiKey, model)
}

// NewAnthropicProvider initializes an Anthropic provider from explicit values.
func NewAnthropicProvider(apiKey, model string) (Provider, error) {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return nil, lazyerrors.NewWithCode(
			lazyerrors.ErrCodeAITokenMissing,
			"Anthropic API key is required",
			"Provide a valid Anthropic API key",
			"Get your API key at: https://console.anthropic.com/",
		).WithContext(map[string]string{"env_var": "ANTHROPIC_API_KEY"})
	}

	model = strings.TrimSpace(model)
	if model == "" {
		model = ModelClaudeSonnet4_5
	}

	client := anthropic.NewClient(
		option.WithAPIKey(apiKey),
		option.WithHTTPClient(&http.Client{
			Timeout: defaultAnthropicHTTPTimeout,
		}),
	)

	return &anthropicProvider{
		client:  &client,
		model:   model,
		timeout: defaultAnthropicHTTPTimeout,
	}, nil
}

func (p *anthropicProvider) Review(ctx context.Context, req ReviewRequest) (ReviewResponse, error) {
	return p.reviewWithLimit(ctx, req, maxAIDiffChars)
}

func (p *anthropicProvider) reviewWithLimit(ctx context.Context, req ReviewRequest, maxChars int) (ReviewResponse, error) {
	// Use strictness level to generate appropriate system prompt
	strictness := req.Strictness
	if !strictness.IsValid() {
		strictness = StrictnessStandard
	}
	systemPrompt := strictness.GetSystemPrompt()

	// Build user prompt with strictness context
	diffText, truncated := truncateForAI(req.Diff, maxChars)
	userPrompt := strictness.GetUserPromptPrefix() +
		fmt.Sprintf("Review this diff for %s.\n\n```diff\n%s\n```", req.FilePath, diffText)
	if truncated {
		userPrompt = "Note: diff was truncated for latency/performance.\n\n" + userPrompt
	}

	// Calculate max tokens based on the model
	maxTokens := p.calculateMaxTokens()

	var response *anthropic.Message
	var err error

	// Retry logic with exponential backoff
	for attempt := 0; attempt < maxAnthropicRetries; attempt++ {
		response, err = p.callAPI(ctx, systemPrompt, userPrompt, maxTokens)

		if err == nil {
			break
		}

		// Check if error is retryable
		if !p.isRetryableError(err) {
			return ReviewResponse{}, p.mapError(err)
		}

		// If truncated and this is a timeout, retry with smaller diff
		if truncated && maxChars > retryAIDiffChars && p.isTimeoutError(err) {
			return p.reviewWithLimit(ctx, req, retryAIDiffChars)
		}

		// Apply exponential backoff
		if attempt < maxAnthropicRetries-1 {
			backoffDelay := p.calculateBackoff(attempt)
			time.Sleep(backoffDelay)
		}
	}

	if err != nil {
		return ReviewResponse{}, p.mapError(err)
	}

	// Extract text content from response
	content, err := p.extractTextContent(response)
	if err != nil {
		return ReviewResponse{}, lazyerrors.WrapWithCode(
			err,
			lazyerrors.ErrCodeAIProviderError,
			"Failed to extract content from AI response",
			"Verify the AI provider is responding correctly",
			"Try again with a different model if the issue persists",
		).WithContext(map[string]string{"provider": "anthropic"})
	}

	// Parse the review envelope
	envelope, err := parseReviewEnvelope(content)
	if err != nil {
		return ReviewResponse{}, lazyerrors.WrapWithCode(
			err,
			lazyerrors.ErrCodeAIProviderError,
			"Failed to parse AI response",
			"The AI response was not in the expected format",
			"Try again or use a different model",
		).WithContext(map[string]string{"provider": "anthropic"})
	}

	decision := Decision(strings.ToLower(strings.TrimSpace(envelope.Decision)))
	switch decision {
	case DecisionApprove, DecisionRequestChanges, DecisionComment:
	default:
		decision = DecisionComment
	}

	return ReviewResponse{
		Decision: decision,
		Comment:  strings.TrimSpace(envelope.Comment),
	}, nil
}

func (p *anthropicProvider) callAPI(ctx context.Context, systemPrompt, userPrompt string, maxTokens int) (*anthropic.Message, error) {
	return p.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:       anthropic.Model(p.model),
		MaxTokens:   int64(maxTokens),
		Temperature: anthropic.Float(0.2),
		System: []anthropic.TextBlockParam{
			{
				Text: systemPrompt,
			},
		},
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(userPrompt)),
		},
	})
}

func (p *anthropicProvider) extractTextContent(message *anthropic.Message) (string, error) {
	if message == nil {
		return "", errors.New("nil message")
	}

	var textParts []string
	for _, block := range message.Content {
		// Check if this is a text block by checking the Type field
		if block.Type == "text" && block.Text != "" {
			textParts = append(textParts, block.Text)
		}
	}

	if len(textParts) == 0 {
		return "", errors.New("no text content in response")
	}

	return strings.Join(textParts, "\n"), nil
}

func (p *anthropicProvider) calculateMaxTokens() int {
	// Claude 4 models support up to 128K output tokens for Opus 4.6
	// and 64K for Sonnet/Haiku. We use conservative values for reviews.
	switch {
	case strings.Contains(p.model, "opus-4"):
		return 4096 // Conservative for reviews
	case strings.Contains(p.model, "sonnet-4"):
		return 2048
	case strings.Contains(p.model, "haiku-4"):
		return 2048
	case strings.Contains(p.model, "claude-3-opus"):
		return 4096
	case strings.Contains(p.model, "claude-3") && strings.Contains(p.model, "sonnet"):
		return 2048
	case strings.Contains(p.model, "claude-3") && strings.Contains(p.model, "haiku"):
		return 2048
	default:
		return 2048 // Safe default
	}
}

func (p *anthropicProvider) calculateBackoff(attempt int) time.Duration {
	backoff := time.Duration(float64(initialBackoffDelay) * math.Pow(2, float64(attempt)))
	if backoff > maxBackoffDelay {
		backoff = maxBackoffDelay
	}
	return backoff
}

func (p *anthropicProvider) isRetryableError(err error) bool {
	if err == nil {
		return false
	}

	// Check for rate limit errors (429)
	if strings.Contains(err.Error(), "429") || strings.Contains(err.Error(), "rate_limit") {
		return true
	}

	// Check for server errors (5xx)
	if strings.Contains(err.Error(), "500") || strings.Contains(err.Error(), "502") ||
		strings.Contains(err.Error(), "503") || strings.Contains(err.Error(), "504") {
		return true
	}

	// Check for timeout errors
	if p.isTimeoutError(err) {
		return true
	}

	return false
}

func (p *anthropicProvider) isTimeoutError(err error) bool {
	if err == nil {
		return false
	}

	// Check for context deadline exceeded
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}

	// Check for timeout in error message
	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "timeout") || strings.Contains(errStr, "deadline")
}

func (p *anthropicProvider) mapError(err error) error {
	if err == nil {
		return nil
	}

	errStr := err.Error()

	// Handle rate limiting (429)
	if strings.Contains(errStr, "429") || strings.Contains(errStr, "rate_limit") {
		return lazyerrors.WrapWithCode(
			err,
			lazyerrors.ErrCodeAIRateLimit,
			"Anthropic API rate limit exceeded",
			"Wait a few moments before retrying",
			"Consider upgrading your Anthropic API plan",
			"Reduce the frequency of AI review requests",
		).WithContext(map[string]string{"provider": "anthropic"})
	}

	// Handle authentication errors (401)
	if strings.Contains(errStr, "401") || strings.Contains(errStr, "unauthorized") || strings.Contains(errStr, "invalid api key") {
		return lazyerrors.WrapWithCode(
			err,
			lazyerrors.ErrCodeAITokenMissing,
			"Invalid or missing Anthropic API key",
			"Check that ANTHROPIC_API_KEY is set correctly",
			"Verify your API key at: https://console.anthropic.com/",
			"Generate a new API key if needed",
		).WithContext(map[string]string{"env_var": "ANTHROPIC_API_KEY"})
	}

	// Handle insufficient quota/permissions (403)
	if strings.Contains(errStr, "403") || strings.Contains(errStr, "forbidden") || strings.Contains(errStr, "quota") {
		return lazyerrors.WrapWithCode(
			err,
			lazyerrors.ErrCodeAIProviderError,
			"Insufficient Anthropic API quota or permissions",
			"Check your Anthropic account billing and quota",
			"Visit: https://console.anthropic.com/settings/usage",
			"Upgrade your plan if needed",
		).WithContext(map[string]string{"provider": "anthropic"})
	}

	// Handle model not found (404)
	if strings.Contains(errStr, "404") || strings.Contains(errStr, "not_found") {
		return lazyerrors.WrapWithCode(
			err,
			lazyerrors.ErrCodeAIProviderError,
			fmt.Sprintf("Model '%s' not found or not accessible", p.model),
			"Verify the model name is correct",
			fmt.Sprintf("Try using a different model (e.g., %s)", ModelClaudeSonnet4_5),
			"Check available models at: https://docs.anthropic.com/claude/models",
		).WithContext(map[string]string{"provider": "anthropic", "model": p.model})
	}

	// Handle overloaded errors (529)
	if strings.Contains(errStr, "529") || strings.Contains(errStr, "overloaded") {
		return lazyerrors.WrapWithCode(
			err,
			lazyerrors.ErrCodeAIProviderError,
			"Anthropic API is temporarily overloaded",
			"Wait a few moments and retry",
			"Try using a different model if available",
		).WithContext(map[string]string{"provider": "anthropic"})
	}

	// Handle timeout errors
	if p.isTimeoutError(err) {
		return lazyerrors.WrapWithCode(
			err,
			lazyerrors.ErrCodeAIProviderError,
			"Request to Anthropic API timed out",
			"The diff may be too large - try reviewing smaller changes",
			"Check your network connection",
			"Increase timeout if needed",
		).WithContext(map[string]string{"provider": "anthropic"})
	}

	// Generic AI provider error
	return lazyerrors.WrapWithCode(
		err,
		lazyerrors.ErrCodeAIProviderError,
		"Anthropic API request failed",
		"Check Anthropic service status at: https://status.anthropic.com/",
		"Verify your API key and permissions",
		"Try again in a few moments",
	).WithContext(map[string]string{"provider": "anthropic"})
}

// CountTokens estimates the number of tokens in the given text.
// Anthropic uses a similar tokenization scheme to OpenAI.
// This is a rough approximation: ~4 characters per token for English text.
func CountTokens(text string) int {
	if text == "" {
		return 0
	}
	// Conservative estimate: 4 chars per token
	return (len(text) + 3) / 4
}
