package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"lazyreview/internal/errors"
)

const defaultOllamaHost = "http://localhost:11434"
const defaultOllamaModel = "codellama"
const defaultOllamaHTTPTimeout = 180 * time.Second
const ollamaHealthCheckTimeout = 5 * time.Second

// Supported Ollama models for code review
const (
	ModelCodeLlama = "codellama"
	ModelLlama     = "llama3.2"
	ModelMistral   = "mistral"
)

type ollamaProvider struct {
	host   string
	model  string
	client *http.Client
}

type ollamaGenerateRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
	Format string `json:"format,omitempty"`
}

type ollamaGenerateResponse struct {
	Response string `json:"response"`
	Done     bool   `json:"done"`
}

type ollamaTagsResponse struct {
	Models []struct {
		Name string `json:"name"`
	} `json:"models"`
}

// NewOllamaProviderFromEnv initializes an Ollama provider from env vars.
// Optional: LAZYREVIEW_AI_OLLAMA_HOST (default: http://localhost:11434)
//
//	LAZYREVIEW_AI_MODEL (default: codellama)
func NewOllamaProviderFromEnv() (Provider, error) {
	host := strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_OLLAMA_HOST"))
	if host == "" {
		host = defaultOllamaHost
	}

	model := strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_MODEL"))
	if model == "" {
		model = defaultOllamaModel
	}

	return NewOllamaProvider(host, model)
}

// NewOllamaProvider initializes an Ollama provider from explicit values.
func NewOllamaProvider(host, model string) (Provider, error) {
	host = strings.TrimSpace(host)
	if host == "" {
		host = defaultOllamaHost
	}

	model = strings.TrimSpace(model)
	if model == "" {
		model = defaultOllamaModel
	}

	provider := &ollamaProvider{
		host:   strings.TrimRight(host, "/"),
		model:  model,
		client: &http.Client{Timeout: defaultOllamaHTTPTimeout},
	}

	// Perform health check
	if err := provider.healthCheck(); err != nil {
		return nil, errors.WrapWithCode(
			err,
			errors.ErrCodeAIProviderError,
			"Ollama service unavailable",
			fmt.Sprintf("Ensure Ollama is running at %s", host),
			"Run: ollama serve",
			"Check if the host and port are correct",
		).WithContext(map[string]string{"host": host})
	}

	// Check if model is available
	if err := provider.checkModelAvailability(); err != nil {
		return nil, errors.WrapWithCode(
			err,
			errors.ErrCodeAIProviderError,
			fmt.Sprintf("Model '%s' not available", model),
			fmt.Sprintf("Pull the model: ollama pull %s", model),
			"Run: ollama list (to see available models)",
			"Or specify a different model via LAZYREVIEW_AI_MODEL",
		).WithContext(map[string]string{
			"host":  host,
			"model": model,
		})
	}

	return provider, nil
}

func (p *ollamaProvider) healthCheck() error {
	ctx, cancel := context.WithTimeout(context.Background(), ollamaHealthCheckTimeout)
	defer cancel()

	reqURL := p.host + "/api/tags"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("health check returned %s: %s", resp.Status, string(body))
	}

	return nil
}

func (p *ollamaProvider) checkModelAvailability() error {
	ctx, cancel := context.WithTimeout(context.Background(), ollamaHealthCheckTimeout)
	defer cancel()

	reqURL := p.host + "/api/tags"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create model check request: %w", err)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("model check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("model check returned %s: %s", resp.Status, string(body))
	}

	var tags ollamaTagsResponse
	if err := json.NewDecoder(resp.Body).Decode(&tags); err != nil {
		return fmt.Errorf("failed to decode model list: %w", err)
	}

	// Check if the requested model exists
	modelFound := false
	for _, m := range tags.Models {
		// Model names in Ollama may have tags (e.g., "codellama:latest")
		if strings.HasPrefix(m.Name, p.model) {
			modelFound = true
			break
		}
	}

	if !modelFound {
		availableModels := make([]string, 0, len(tags.Models))
		for _, m := range tags.Models {
			availableModels = append(availableModels, m.Name)
		}
		return fmt.Errorf("model '%s' not found. Available: %s", p.model, strings.Join(availableModels, ", "))
	}

	return nil
}

func (p *ollamaProvider) Review(ctx context.Context, req ReviewRequest) (ReviewResponse, error) {
	return p.reviewWithRetry(ctx, req, maxAIDiffChars)
}

func (p *ollamaProvider) reviewWithRetry(ctx context.Context, req ReviewRequest, maxChars int) (ReviewResponse, error) {
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

	// Combine system and user prompts for Ollama
	prompt := systemPrompt + "\n\n" + userPrompt

	// Use streaming for better responsiveness on long diffs
	content, err := p.generateWithStreaming(ctx, prompt)
	if err != nil {
		// Retry with smaller diff on timeout
		if truncated && maxChars > retryAIDiffChars && isTimeoutError(err) {
			return p.reviewWithRetry(ctx, req, retryAIDiffChars)
		}
		return ReviewResponse{}, errors.WrapWithCode(
			err,
			errors.ErrCodeAIProviderError,
			"AI review failed",
			"Check Ollama service status",
			"Verify the model is loaded",
			"Consider using a smaller diff",
		).WithContext(map[string]string{
			"host":  p.host,
			"model": p.model,
		})
	}

	envelope, err := parseReviewEnvelope(content)
	if err != nil {
		return ReviewResponse{}, errors.WrapWithCode(
			err,
			errors.ErrCodeAIProviderError,
			"Failed to parse AI response",
			"The model may not be following the expected format",
			"Try a different model or adjust the prompt",
		).WithContext(map[string]string{
			"host":     p.host,
			"model":    p.model,
			"response": content,
		})
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

func (p *ollamaProvider) generateWithStreaming(ctx context.Context, prompt string) (string, error) {
	payload := ollamaGenerateRequest{
		Model:  p.model,
		Prompt: prompt,
		Stream: true,
		Format: "json",
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to encode request: %w", err)
	}

	reqURL := p.host + "/api/generate"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		if isTimeoutError(err) {
			return "", fmt.Errorf("request timeout: %w", err)
		}
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		msg := strings.TrimSpace(string(respBody))
		if msg == "" {
			return "", fmt.Errorf("Ollama returned %s", resp.Status)
		}
		return "", fmt.Errorf("Ollama returned %s: %s", resp.Status, msg)
	}

	// Read streaming response line by line
	var fullResponse strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024) // 64KB initial, 1MB max

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var chunk ollamaGenerateResponse
		if err := json.Unmarshal(line, &chunk); err != nil {
			// Skip malformed lines
			continue
		}

		fullResponse.WriteString(chunk.Response)

		if chunk.Done {
			break
		}
	}

	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("failed to read streaming response: %w", err)
	}

	content := strings.TrimSpace(fullResponse.String())
	if content == "" {
		return "", fmt.Errorf("empty response from Ollama")
	}

	return content, nil
}

// IsOllamaAvailable checks if Ollama service is reachable at the default host.
func IsOllamaAvailable() bool {
	ctx, cancel := context.WithTimeout(context.Background(), ollamaHealthCheckTimeout)
	defer cancel()

	client := &http.Client{Timeout: ollamaHealthCheckTimeout}
	reqURL := defaultOllamaHost + "/api/tags"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return false
	}

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}
