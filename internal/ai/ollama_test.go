package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestNewOllamaProvider_Success(t *testing.T) {
	// Create a test server that mocks Ollama API
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tags" {
			w.WriteHeader(http.StatusOK)
			response := ollamaTagsResponse{
				Models: []struct {
					Name string `json:"name"`
				}{
					{Name: "codellama:latest"},
					{Name: "llama3.2:latest"},
				},
			}
			json.NewEncoder(w).Encode(response)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	provider, err := NewOllamaProvider(server.URL, "codellama")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if provider == nil {
		t.Fatal("expected provider to be non-nil")
	}

	ollamaP, ok := provider.(*ollamaProvider)
	if !ok {
		t.Fatal("expected provider to be *ollamaProvider")
	}

	if ollamaP.model != "codellama" {
		t.Errorf("expected model 'codellama', got %q", ollamaP.model)
	}
}

func TestNewOllamaProvider_ServiceUnavailable(t *testing.T) {
	_, err := NewOllamaProvider("http://localhost:99999", "codellama")
	if err == nil {
		t.Fatal("expected error when service is unavailable")
	}

	if !strings.Contains(err.Error(), "Ollama service unavailable") {
		t.Errorf("expected 'Ollama service unavailable' in error, got: %v", err)
	}
}

func TestNewOllamaProvider_ModelNotAvailable(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tags" {
			w.WriteHeader(http.StatusOK)
			response := ollamaTagsResponse{
				Models: []struct {
					Name string `json:"name"`
				}{
					{Name: "llama3.2:latest"},
				},
			}
			json.NewEncoder(w).Encode(response)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	_, err := NewOllamaProvider(server.URL, "codellama")
	if err == nil {
		t.Fatal("expected error when model is not available")
	}

	if !strings.Contains(err.Error(), "not available") {
		t.Errorf("expected 'not available' in error, got: %v", err)
	}
}

func TestOllamaProvider_Review_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/tags":
			w.WriteHeader(http.StatusOK)
			response := ollamaTagsResponse{
				Models: []struct {
					Name string `json:"name"`
				}{
					{Name: "codellama:latest"},
				},
			}
			json.NewEncoder(w).Encode(response)

		case "/api/generate":
			w.WriteHeader(http.StatusOK)
			// Simulate streaming response
			responses := []ollamaGenerateResponse{
				{Response: `{"decision":"approve",`, Done: false},
				{Response: `"comment":"LGTM"}`, Done: true},
			}
			for _, resp := range responses {
				data, _ := json.Marshal(resp)
				fmt.Fprintln(w, string(data))
				if f, ok := w.(http.Flusher); ok {
					f.Flush()
				}
			}

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	provider, err := NewOllamaProvider(server.URL, "codellama")
	if err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	ctx := context.Background()
	req := ReviewRequest{
		FilePath: "test.go",
		Diff:     "+func hello() { return \"world\" }",
	}

	resp, err := provider.Review(ctx, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Decision != DecisionApprove {
		t.Errorf("expected decision 'approve', got %q", resp.Decision)
	}

	if resp.Comment != "LGTM" {
		t.Errorf("expected comment 'LGTM', got %q", resp.Comment)
	}
}

func TestOllamaProvider_Review_RequestChanges(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/tags":
			w.WriteHeader(http.StatusOK)
			response := ollamaTagsResponse{
				Models: []struct {
					Name string `json:"name"`
				}{
					{Name: "codellama:latest"},
				},
			}
			json.NewEncoder(w).Encode(response)

		case "/api/generate":
			w.WriteHeader(http.StatusOK)
			response := ollamaGenerateResponse{
				Response: `{"decision":"request_changes","comment":"Missing tests"}`,
				Done:     true,
			}
			data, _ := json.Marshal(response)
			fmt.Fprintln(w, string(data))

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	provider, err := NewOllamaProvider(server.URL, "codellama")
	if err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	ctx := context.Background()
	req := ReviewRequest{
		FilePath: "test.go",
		Diff:     "+func hello() { return \"world\" }",
	}

	resp, err := provider.Review(ctx, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Decision != DecisionRequestChanges {
		t.Errorf("expected decision 'request_changes', got %q", resp.Decision)
	}

	if resp.Comment != "Missing tests" {
		t.Errorf("expected comment 'Missing tests', got %q", resp.Comment)
	}
}

func TestOllamaProvider_Review_Comment(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/tags":
			w.WriteHeader(http.StatusOK)
			response := ollamaTagsResponse{
				Models: []struct {
					Name string `json:"name"`
				}{
					{Name: "codellama:latest"},
				},
			}
			json.NewEncoder(w).Encode(response)

		case "/api/generate":
			w.WriteHeader(http.StatusOK)
			response := ollamaGenerateResponse{
				Response: `{"decision":"comment","comment":"Consider adding documentation"}`,
				Done:     true,
			}
			data, _ := json.Marshal(response)
			fmt.Fprintln(w, string(data))

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	provider, err := NewOllamaProvider(server.URL, "codellama")
	if err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	ctx := context.Background()
	req := ReviewRequest{
		FilePath: "test.go",
		Diff:     "+func hello() { return \"world\" }",
	}

	resp, err := provider.Review(ctx, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Decision != DecisionComment {
		t.Errorf("expected decision 'comment', got %q", resp.Decision)
	}

	if resp.Comment != "Consider adding documentation" {
		t.Errorf("expected comment 'Consider adding documentation', got %q", resp.Comment)
	}
}

func TestOllamaProvider_Review_Timeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/tags":
			w.WriteHeader(http.StatusOK)
			response := ollamaTagsResponse{
				Models: []struct {
					Name string `json:"name"`
				}{
					{Name: "codellama:latest"},
				},
			}
			json.NewEncoder(w).Encode(response)

		case "/api/generate":
			// Simulate timeout by sleeping longer than context deadline
			time.Sleep(2 * time.Second)
			w.WriteHeader(http.StatusOK)

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	provider, err := NewOllamaProvider(server.URL, "codellama")
	if err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	// Create a context with short timeout
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	req := ReviewRequest{
		FilePath: "test.go",
		Diff:     "+func hello() { return \"world\" }",
	}

	_, err = provider.Review(ctx, req)
	if err == nil {
		t.Fatal("expected timeout error")
	}

	if !strings.Contains(err.Error(), "AI review failed") {
		t.Errorf("expected 'AI review failed' in error, got: %v", err)
	}
}

func TestOllamaProvider_Review_EmptyResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/tags":
			w.WriteHeader(http.StatusOK)
			response := ollamaTagsResponse{
				Models: []struct {
					Name string `json:"name"`
				}{
					{Name: "codellama:latest"},
				},
			}
			json.NewEncoder(w).Encode(response)

		case "/api/generate":
			w.WriteHeader(http.StatusOK)
			response := ollamaGenerateResponse{
				Response: "",
				Done:     true,
			}
			data, _ := json.Marshal(response)
			fmt.Fprintln(w, string(data))

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	provider, err := NewOllamaProvider(server.URL, "codellama")
	if err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	ctx := context.Background()
	req := ReviewRequest{
		FilePath: "test.go",
		Diff:     "+func hello() { return \"world\" }",
	}

	_, err = provider.Review(ctx, req)
	if err == nil {
		t.Fatal("expected error for empty response")
	}

	if !strings.Contains(err.Error(), "empty response") {
		t.Errorf("expected 'empty response' in error, got: %v", err)
	}
}

func TestOllamaProvider_Review_HTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/tags":
			w.WriteHeader(http.StatusOK)
			response := ollamaTagsResponse{
				Models: []struct {
					Name string `json:"name"`
				}{
					{Name: "codellama:latest"},
				},
			}
			json.NewEncoder(w).Encode(response)

		case "/api/generate":
			w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintln(w, "Internal server error")

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	provider, err := NewOllamaProvider(server.URL, "codellama")
	if err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	ctx := context.Background()
	req := ReviewRequest{
		FilePath: "test.go",
		Diff:     "+func hello() { return \"world\" }",
	}

	_, err = provider.Review(ctx, req)
	if err == nil {
		t.Fatal("expected error for HTTP 500")
	}

	if !strings.Contains(err.Error(), "500") {
		t.Errorf("expected '500' in error, got: %v", err)
	}
}

func TestOllamaProvider_Review_MalformedJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/tags":
			w.WriteHeader(http.StatusOK)
			response := ollamaTagsResponse{
				Models: []struct {
					Name string `json:"name"`
				}{
					{Name: "codellama:latest"},
				},
			}
			json.NewEncoder(w).Encode(response)

		case "/api/generate":
			w.WriteHeader(http.StatusOK)
			response := ollamaGenerateResponse{
				Response: `not a valid json`,
				Done:     true,
			}
			data, _ := json.Marshal(response)
			fmt.Fprintln(w, string(data))

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	provider, err := NewOllamaProvider(server.URL, "codellama")
	if err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	ctx := context.Background()
	req := ReviewRequest{
		FilePath: "test.go",
		Diff:     "+func hello() { return \"world\" }",
	}

	// Should still work with fallback to text inference
	resp, err := provider.Review(ctx, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should default to comment when decision can't be inferred
	if resp.Decision != DecisionComment {
		t.Errorf("expected decision 'comment' for malformed JSON, got %q", resp.Decision)
	}
}

func TestOllamaProvider_Review_TruncatedDiff(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/tags":
			w.WriteHeader(http.StatusOK)
			response := ollamaTagsResponse{
				Models: []struct {
					Name string `json:"name"`
				}{
					{Name: "codellama:latest"},
				},
			}
			json.NewEncoder(w).Encode(response)

		case "/api/generate":
			w.WriteHeader(http.StatusOK)
			response := ollamaGenerateResponse{
				Response: `{"decision":"approve","comment":"LGTM"}`,
				Done:     true,
			}
			data, _ := json.Marshal(response)
			fmt.Fprintln(w, string(data))

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	provider, err := NewOllamaProvider(server.URL, "codellama")
	if err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	// Create a very large diff that will be truncated
	largeDiff := strings.Repeat("+line\n", 50000)

	ctx := context.Background()
	req := ReviewRequest{
		FilePath: "test.go",
		Diff:     largeDiff,
	}

	resp, err := provider.Review(ctx, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Decision != DecisionApprove {
		t.Errorf("expected decision 'approve', got %q", resp.Decision)
	}
}

func TestIsOllamaAvailable(t *testing.T) {
	// This will fail if Ollama is not running locally
	// Just ensure the function doesn't panic
	_ = IsOllamaAvailable()
}

func TestOllamaProvider_DefaultValues(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tags" {
			w.WriteHeader(http.StatusOK)
			response := ollamaTagsResponse{
				Models: []struct {
					Name string `json:"name"`
				}{
					{Name: "codellama:latest"},
				},
			}
			json.NewEncoder(w).Encode(response)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	// Test with empty strings - should use defaults
	provider, err := NewOllamaProvider(server.URL, "")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	ollamaP, ok := provider.(*ollamaProvider)
	if !ok {
		t.Fatal("expected provider to be *ollamaProvider")
	}

	if ollamaP.model != defaultOllamaModel {
		t.Errorf("expected default model %q, got %q", defaultOllamaModel, ollamaP.model)
	}
}
