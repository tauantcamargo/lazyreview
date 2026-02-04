package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

const defaultOpenAIBaseURL = "https://api.openai.com/v1"

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
		client:  &http.Client{Timeout: 30 * time.Second},
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
		client:  &http.Client{Timeout: 30 * time.Second},
	}, nil
}

func (p *openAIProvider) Review(ctx context.Context, req ReviewRequest) (ReviewResponse, error) {
	systemPrompt := "You are a senior code reviewer. Return only JSON with fields: decision (approve|request_changes|comment) and comment."
	userPrompt := fmt.Sprintf("Review this diff for %s.\n\n```diff\n%s\n```", req.FilePath, req.Diff)

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
		return ReviewResponse{}, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ReviewResponse{}, fmt.Errorf("AI provider returned %s", resp.Status)
	}

	var decoded openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return ReviewResponse{}, fmt.Errorf("failed to decode response: %w", err)
	}
	if len(decoded.Choices) == 0 {
		return ReviewResponse{}, errors.New("AI provider returned no choices")
	}

	content := strings.TrimSpace(decoded.Choices[0].Message.Content)
	var envelope reviewEnvelope
	if err := json.Unmarshal([]byte(content), &envelope); err != nil {
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
