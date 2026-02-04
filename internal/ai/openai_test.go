package ai

import "testing"

func TestParseReviewEnvelope_JSON(t *testing.T) {
	content := `{"decision":"approve","comment":"Looks good"}`
	env, err := parseReviewEnvelope(content)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if env.Decision != "approve" {
		t.Fatalf("expected approve, got %q", env.Decision)
	}
	if env.Comment != "Looks good" {
		t.Fatalf("unexpected comment: %q", env.Comment)
	}
}

func TestParseReviewEnvelope_FencedJSON(t *testing.T) {
	content := "```json\n{\"decision\":\"comment\",\"comment\":\"Need tests\"}\n```"
	env, err := parseReviewEnvelope(content)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if env.Decision != "comment" {
		t.Fatalf("expected comment, got %q", env.Decision)
	}
}

func TestParseReviewEnvelope_MixedTextFallback(t *testing.T) {
	content := "Please approve this.\n{\"decision\":\"approve\",\"comment\":\"ok\"}\nthanks"
	env, err := parseReviewEnvelope(content)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if env.Decision != "approve" {
		t.Fatalf("expected approve, got %q", env.Decision)
	}
	if env.Comment != "ok" {
		t.Fatalf("expected comment from json, got %q", env.Comment)
	}
}

func TestParseReviewEnvelope_FreeTextDecisionInference(t *testing.T) {
	content := "I recommend request changes due to missing tests."
	env, err := parseReviewEnvelope(content)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if env.Decision != "request_changes" {
		t.Fatalf("expected request_changes, got %q", env.Decision)
	}
}
