package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

const defaultOpenAIBaseURL = "https://api.openai.com/v1"
const defaultOpenAIHTTPTimeout = 90 * time.Second
const maxAIDiffChars = 45000
const retryAIDiffChars = 22000

type openAIProvider struct {
	apiKey  string
	model   string
	baseURL string
	client  *http.Client
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIRequest struct {
	Model       string          `json:"model"`
	Messages    []openAIMessage `json:"messages"`
	Temperature float32         `json:"temperature"`
}

type openAIResponse struct {
	Choices []struct {
		Message openAIMessage `json:"message"`
	} `json:"choices"`
}

type reviewEnvelope struct {
	Decision string `json:"decision"`
	Comment  string `json:"comment"`
}

// NewOpenAIProviderFromEnv initializes an OpenAI provider from env vars.
// Required: LAZYREVIEW_AI_API_KEY
// Optional: LAZYREVIEW_AI_MODEL (default: gpt-4o-mini), LAZYREVIEW_AI_BASE_URL
func NewOpenAIProviderFromEnv() (Provider, error) {
	apiKey := strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_API_KEY"))
	if apiKey == "" {
		return nil, errors.New("LAZYREVIEW_AI_API_KEY not set")
	}
	model := strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_MODEL"))
	if model == "" {
		model = "gpt-4o-mini"
	}
	baseURL := strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_BASE_URL"))
	if baseURL == "" {
		baseURL = defaultOpenAIBaseURL
	}

	return &openAIProvider{
		apiKey:  apiKey,
		model:   model,
		baseURL: baseURL,
		client:  &http.Client{Timeout: defaultOpenAIHTTPTimeout},
	}, nil
}

// NewOpenAIProvider initializes an OpenAI provider from explicit values.
func NewOpenAIProvider(apiKey, model, baseURL string) (Provider, error) {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return nil, errors.New("AI API key is required")
	}
	model = strings.TrimSpace(model)
	if model == "" {
		model = "gpt-4o-mini"
	}
	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		baseURL = defaultOpenAIBaseURL
	}

	return &openAIProvider{
		apiKey:  apiKey,
		model:   model,
		baseURL: baseURL,
		client:  &http.Client{Timeout: defaultOpenAIHTTPTimeout},
	}, nil
}

func (p *openAIProvider) Review(ctx context.Context, req ReviewRequest) (ReviewResponse, error) {
	return p.reviewWithLimit(ctx, req, maxAIDiffChars)
}

func (p *openAIProvider) reviewWithLimit(ctx context.Context, req ReviewRequest, maxChars int) (ReviewResponse, error) {
	systemPrompt := "You are a senior code reviewer. Return only JSON with fields: decision (approve|request_changes|comment) and comment."
	diffText, truncated := truncateForAI(req.Diff, maxChars)
	userPrompt := fmt.Sprintf("Review this diff for %s.\n\n```diff\n%s\n```", req.FilePath, diffText)
	if truncated {
		userPrompt = "Note: diff was truncated for latency/performance.\n\n" + userPrompt
	}

	payload := openAIRequest{
		Model: p.model,
		Messages: []openAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: 0.2,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return ReviewResponse{}, fmt.Errorf("failed to encode request: %w", err)
	}

	reqURL := strings.TrimRight(p.baseURL, "/") + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(body))
	if err != nil {
		return ReviewResponse{}, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		if truncated && maxChars > retryAIDiffChars && isTimeoutError(err) {
			return p.reviewWithLimit(ctx, req, retryAIDiffChars)
		}
		return ReviewResponse{}, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		msg := strings.TrimSpace(string(body))
		if msg == "" {
			return ReviewResponse{}, fmt.Errorf("AI provider returned %s", resp.Status)
		}
		return ReviewResponse{}, fmt.Errorf("AI provider returned %s: %s", resp.Status, msg)
	}

	var decoded openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return ReviewResponse{}, fmt.Errorf("failed to decode response: %w", err)
	}
	if len(decoded.Choices) == 0 {
		return ReviewResponse{}, errors.New("AI provider returned no choices")
	}

	content := strings.TrimSpace(decoded.Choices[0].Message.Content)
	envelope, err := parseReviewEnvelope(content)
	if err != nil {
		return ReviewResponse{}, fmt.Errorf("failed to parse AI response: %w", err)
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

func parseReviewEnvelope(content string) (reviewEnvelope, error) {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return reviewEnvelope{}, errors.New("empty AI response")
	}

	// Try strict JSON first.
	var envelope reviewEnvelope
	if err := json.Unmarshal([]byte(trimmed), &envelope); err == nil {
		return normalizeEnvelope(envelope, trimmed), nil
	}

	// Handle fenced markdown blocks: ```json ... ```
	if strings.HasPrefix(trimmed, "```") {
		lines := strings.Split(trimmed, "\n")
		if len(lines) >= 2 {
			start := 1
			end := len(lines)
			if strings.HasPrefix(strings.TrimSpace(lines[len(lines)-1]), "```") {
				end--
			}
			block := strings.TrimSpace(strings.Join(lines[start:end], "\n"))
			if err := json.Unmarshal([]byte(block), &envelope); err == nil {
				return normalizeEnvelope(envelope, block), nil
			}
			trimmed = block
		}
	}

	// Fallback: find first JSON object in mixed text.
	start := strings.Index(trimmed, "{")
	end := strings.LastIndex(trimmed, "}")
	if start >= 0 && end > start {
		candidate := strings.TrimSpace(trimmed[start : end+1])
		if err := json.Unmarshal([]byte(candidate), &envelope); err == nil {
			return normalizeEnvelope(envelope, candidate), nil
		}
	}

	// Final fallback: interpret free-form text instead of failing.
	return reviewEnvelope{
		Decision: inferDecisionFromText(trimmed),
		Comment:  trimmed,
	}, nil
}

func normalizeEnvelope(envelope reviewEnvelope, fallbackComment string) reviewEnvelope {
	envelope.Decision = strings.TrimSpace(envelope.Decision)
	envelope.Comment = strings.TrimSpace(envelope.Comment)
	if envelope.Comment == "" {
		envelope.Comment = strings.TrimSpace(fallbackComment)
	}
	if envelope.Decision == "" {
		envelope.Decision = inferDecisionFromText(envelope.Comment)
	}
	return envelope
}

func inferDecisionFromText(text string) string {
	lower := strings.ToLower(strings.TrimSpace(text))
	switch {
	case strings.Contains(lower, "request changes"), strings.Contains(lower, "changes requested"), strings.Contains(lower, "blocker"):
		return string(DecisionRequestChanges)
	case strings.Contains(lower, "approve"), strings.Contains(lower, "approved"), strings.Contains(lower, "lgtm"):
		return string(DecisionApprove)
	default:
		return string(DecisionComment)
	}
}

func truncateForAI(diff string, maxChars int) (string, bool) {
	diff = strings.TrimSpace(diff)
	if maxChars <= 0 || len(diff) <= maxChars {
		return diff, false
	}
	head := (maxChars * 7) / 10
	if head < 1 {
		head = maxChars / 2
	}
	tail := maxChars - head
	if tail < 1 {
		tail = 1
	}
	return diff[:head] + "\n...\n[TRUNCATED]\n...\n" + diff[len(diff)-tail:], true
}

func isTimeoutError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	return errors.As(err, &netErr) && netErr.Timeout()
}
