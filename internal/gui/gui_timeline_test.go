package gui

import (
	"testing"
	"time"

	"lazyreview/internal/models"
)

func TestSanitizeSavedFilters(t *testing.T) {
	input := []savedFilter{
		{Name: "urgent", Query: "label:urgent"},
		{Name: "Urgent", Query: "label:p0"},
		{Name: "  ", Query: "anything"},
		{Name: "mine", Query: "  "},
	}

	got := sanitizeSavedFilters(input)
	if len(got) != 1 {
		t.Fatalf("expected 1 filter, got %d", len(got))
	}
	if got[0].Name != "urgent" {
		t.Fatalf("expected first filter to be urgent, got %q", got[0].Name)
	}
}

func TestBuildTimelineItemsIncludesCommentJumpTarget(t *testing.T) {
	now := time.Now()
	pr := &models.PullRequest{
		Number:      12,
		Author:      models.User{Login: "alice"},
		CommitCount: 2,
		CreatedAt:   now.Add(-2 * time.Hour),
		UpdatedAt:   now.Add(-time.Hour),
	}
	comments := []models.Comment{
		{
			ID:        "c1",
			Author:    models.User{Login: "bob"},
			Body:      "looks good",
			Path:      "app/main.go",
			Line:      42,
			Side:      models.DiffSideRight,
			CreatedAt: now.Add(-30 * time.Minute),
		},
	}

	items, targets := buildTimelineItems(pr, nil, comments)
	if len(items) == 0 {
		t.Fatal("expected timeline items, got none")
	}
	target, ok := targets["comment-c1"]
	if !ok {
		t.Fatalf("expected jump target for comment-c1")
	}
	if target.Path != "app/main.go" || target.Line != 42 || target.Side != models.DiffSideRight {
		t.Fatalf("unexpected target: %+v", target)
	}
}
