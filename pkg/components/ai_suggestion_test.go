package components

import (
	"context"
	"testing"
	"time"

	"lazyreview/internal/ai"
	"lazyreview/internal/models"
)

// mockAIProvider implements ai.Provider for testing
type mockAIProvider struct {
	response ai.ReviewResponse
	err      error
	delay    time.Duration
}

func (m *mockAIProvider) Review(ctx context.Context, req ai.ReviewRequest) (ai.ReviewResponse, error) {
	if m.delay > 0 {
		select {
		case <-time.After(m.delay):
		case <-ctx.Done():
			return ai.ReviewResponse{}, ctx.Err()
		}
	}
	return m.response, m.err
}

func TestNewAISuggestionManager(t *testing.T) {
	provider := &mockAIProvider{}
	manager := NewAISuggestionManager(provider)

	if manager == nil {
		t.Fatal("expected non-nil manager")
	}

	if manager.suggestions == nil {
		t.Error("expected suggestions map to be initialized")
	}

	if manager.loading == nil {
		t.Error("expected loading map to be initialized")
	}

	if manager.cancelFuncs == nil {
		t.Error("expected cancelFuncs map to be initialized")
	}

	if manager.nextID != 1 {
		t.Errorf("expected nextID to be 1, got %d", manager.nextID)
	}
}

func TestSuggestionKey(t *testing.T) {
	tests := []struct {
		filePath string
		side     models.DiffSide
		lineNo   int
		expected string
	}{
		{"file.go", models.DiffSideLeft, 10, "file.go|LEFT|10"},
		{"path/to/file.ts", models.DiffSideRight, 42, "path/to/file.ts|RIGHT|42"},
		{"", models.DiffSideLeft, 0, "|LEFT|0"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			result := suggestionKey(tt.filePath, tt.side, tt.lineNo)
			if result != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestLoadSuggestionsAsync(t *testing.T) {
	provider := &mockAIProvider{
		response: ai.ReviewResponse{
			Decision: ai.DecisionComment,
			Comment:  "This looks good but could be improved",
		},
	}

	manager := NewAISuggestionManager(provider)
	ctx := context.Background()

	filePath := "test.go"
	lineNo := 10
	side := models.DiffSideRight
	diff := "some diff content"

	manager.LoadSuggestionsAsync(ctx, filePath, lineNo, side, diff)

	// Wait for async operation
	time.Sleep(50 * time.Millisecond)

	suggestions := manager.GetSuggestions(filePath, lineNo, side)
	if len(suggestions) == 0 {
		t.Error("expected suggestions to be loaded")
	}

	if suggestions[0].FilePath != filePath {
		t.Errorf("expected file path %q, got %q", filePath, suggestions[0].FilePath)
	}

	if suggestions[0].LineNo != lineNo {
		t.Errorf("expected line number %d, got %d", lineNo, suggestions[0].LineNo)
	}
}

func TestCancelLoadingForLine(t *testing.T) {
	provider := &mockAIProvider{
		response: ai.ReviewResponse{
			Decision: ai.DecisionComment,
			Comment:  "Test comment",
		},
		delay: 100 * time.Millisecond,
	}

	manager := NewAISuggestionManager(provider)
	ctx := context.Background()

	filePath := "test.go"
	lineNo := 10
	side := models.DiffSideRight

	// Start async loading
	manager.LoadSuggestionsAsync(ctx, filePath, lineNo, side, "diff")

	// Immediately cancel
	manager.CancelLoadingForLine(filePath, lineNo, side)

	// Wait to ensure cancellation
	time.Sleep(150 * time.Millisecond)

	// Should not have suggestions since it was cancelled
	suggestions := manager.GetSuggestions(filePath, lineNo, side)
	if len(suggestions) > 0 {
		t.Error("expected no suggestions after cancellation")
	}
}

func TestCancelAll(t *testing.T) {
	provider := &mockAIProvider{
		response: ai.ReviewResponse{
			Decision: ai.DecisionComment,
			Comment:  "Test comment",
		},
		delay: 100 * time.Millisecond,
	}

	manager := NewAISuggestionManager(provider)
	ctx := context.Background()

	// Start multiple async operations
	manager.LoadSuggestionsAsync(ctx, "file1.go", 10, models.DiffSideLeft, "diff1")
	manager.LoadSuggestionsAsync(ctx, "file2.go", 20, models.DiffSideRight, "diff2")
	manager.LoadSuggestionsAsync(ctx, "file3.go", 30, models.DiffSideLeft, "diff3")

	// Cancel all
	manager.CancelAll()

	// Wait to ensure cancellation
	time.Sleep(150 * time.Millisecond)

	// None should have suggestions
	if len(manager.GetSuggestions("file1.go", 10, models.DiffSideLeft)) > 0 {
		t.Error("expected no suggestions for file1.go")
	}
	if len(manager.GetSuggestions("file2.go", 20, models.DiffSideRight)) > 0 {
		t.Error("expected no suggestions for file2.go")
	}
	if len(manager.GetSuggestions("file3.go", 30, models.DiffSideLeft)) > 0 {
		t.Error("expected no suggestions for file3.go")
	}
}

func TestHasSuggestions(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})

	filePath := "test.go"
	lineNo := 10
	side := models.DiffSideRight

	// Initially no suggestions
	if manager.HasSuggestions(filePath, lineNo, side) {
		t.Error("expected no suggestions initially")
	}

	// Add a suggestion
	key := suggestionKey(filePath, side, lineNo)
	manager.suggestions[key] = []AISuggestion{
		{
			ID:       "test-1",
			FilePath: filePath,
			LineNo:   lineNo,
			Side:     side,
		},
	}

	// Should have suggestions now
	if !manager.HasSuggestions(filePath, lineNo, side) {
		t.Error("expected to have suggestions")
	}

	// Dismiss the suggestion
	manager.suggestions[key][0].Dismissed = true

	// Should not have suggestions (dismissed)
	if manager.HasSuggestions(filePath, lineNo, side) {
		t.Error("expected no suggestions after dismissing all")
	}
}

func TestToggleExpanded(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})

	suggestion := AISuggestion{
		ID:       "test-1",
		FilePath: "test.go",
		LineNo:   10,
		Side:     models.DiffSideRight,
		Expanded: false,
	}

	key := suggestionKey("test.go", models.DiffSideRight, 10)
	manager.suggestions[key] = []AISuggestion{suggestion}

	// Toggle to expanded
	expanded := manager.ToggleExpanded("test-1")
	if !expanded {
		t.Error("expected suggestion to be expanded")
	}

	// Verify state changed
	if !manager.suggestions[key][0].Expanded {
		t.Error("expected Expanded to be true")
	}

	// Toggle back to collapsed
	expanded = manager.ToggleExpanded("test-1")
	if expanded {
		t.Error("expected suggestion to be collapsed")
	}

	// Verify state changed
	if manager.suggestions[key][0].Expanded {
		t.Error("expected Expanded to be false")
	}
}

func TestDismissSuggestion(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})

	suggestion := AISuggestion{
		ID:        "test-1",
		FilePath:  "test.go",
		LineNo:    10,
		Side:      models.DiffSideRight,
		Dismissed: false,
	}

	key := suggestionKey("test.go", models.DiffSideRight, 10)
	manager.suggestions[key] = []AISuggestion{suggestion}

	// Dismiss
	result := manager.DismissSuggestion("test-1")
	if !result {
		t.Error("expected DismissSuggestion to return true")
	}

	// Verify state changed
	if !manager.suggestions[key][0].Dismissed {
		t.Error("expected Dismissed to be true")
	}

	// Dismiss non-existent suggestion
	result = manager.DismissSuggestion("non-existent")
	if result {
		t.Error("expected DismissSuggestion to return false for non-existent ID")
	}
}

func TestAcceptSuggestion(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})

	suggestion := AISuggestion{
		ID:       "test-1",
		FilePath: "test.go",
		LineNo:   10,
		Side:     models.DiffSideRight,
		Accepted: false,
	}

	key := suggestionKey("test.go", models.DiffSideRight, 10)
	manager.suggestions[key] = []AISuggestion{suggestion}

	// Accept
	result := manager.AcceptSuggestion("test-1")
	if !result {
		t.Error("expected AcceptSuggestion to return true")
	}

	// Verify state changed
	if !manager.suggestions[key][0].Accepted {
		t.Error("expected Accepted to be true")
	}

	// Accept non-existent suggestion
	result = manager.AcceptSuggestion("non-existent")
	if result {
		t.Error("expected AcceptSuggestion to return false for non-existent ID")
	}
}

func TestCategorizeResponse(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})

	tests := []struct {
		name             string
		response         ai.ReviewResponse
		comment          string
		expectedCategory SuggestionCategory
		expectedSeverity SuggestionSeverity
	}{
		{
			name:             "security issue",
			response:         ai.ReviewResponse{Decision: ai.DecisionRequestChanges},
			comment:          "This has a security vulnerability",
			expectedCategory: SuggestionCategorySecurity,
			expectedSeverity: SuggestionSeverityHigh,
		},
		{
			name:             "bug issue",
			response:         ai.ReviewResponse{Decision: ai.DecisionRequestChanges},
			comment:          "This will cause a bug",
			expectedCategory: SuggestionCategoryBug,
			expectedSeverity: SuggestionSeverityHigh,
		},
		{
			name:             "performance issue",
			response:         ai.ReviewResponse{Decision: ai.DecisionComment},
			comment:          "This could be optimized for better performance",
			expectedCategory: SuggestionCategoryPerformance,
			expectedSeverity: SuggestionSeverityLow,
		},
		{
			name:             "style issue",
			response:         ai.ReviewResponse{Decision: ai.DecisionComment},
			comment:          "Consider using a different naming convention",
			expectedCategory: SuggestionCategoryStyle,
			expectedSeverity: SuggestionSeverityLow,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			category, severity := manager.categorizeResponse(tt.response, tt.comment)

			if category != tt.expectedCategory {
				t.Errorf("expected category %v, got %v", tt.expectedCategory, category)
			}

			if severity != tt.expectedSeverity {
				t.Errorf("expected severity %v, got %v", tt.expectedSeverity, severity)
			}
		})
	}
}

func TestExtractTitle(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})

	tests := []struct {
		name     string
		comment  string
		expected string
	}{
		{
			name:     "single line",
			comment:  "This is a simple comment",
			expected: "This is a simple comment",
		},
		{
			name:     "multi line",
			comment:  "First line is title\nSecond line is details",
			expected: "First line is title",
		},
		{
			name:     "long line",
			comment:  "This is a very long comment that exceeds the maximum allowed length for a title and should be truncated with ellipsis",
			expected: "This is a very long comment that exceeds the maximum allowed length for a tit...",
		},
		{
			name:     "empty lines",
			comment:  "\n\n\nActual content\nMore content",
			expected: "Actual content",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := manager.extractTitle(tt.comment)
			if result != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestRenderSuggestionIndicator(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})

	filePath := "test.go"
	lineNo := 10
	side := models.DiffSideRight

	// No suggestions - should return space
	indicator := manager.RenderSuggestionIndicator(filePath, lineNo, side)
	if indicator != " " {
		t.Errorf("expected space for no suggestions, got %q", indicator)
	}

	// Add high severity suggestion
	key := suggestionKey(filePath, side, lineNo)
	manager.suggestions[key] = []AISuggestion{
		{
			ID:       "test-1",
			Severity: SuggestionSeverityHigh,
		},
	}

	indicator = manager.RenderSuggestionIndicator(filePath, lineNo, side)
	if indicator == " " {
		t.Error("expected indicator for high severity suggestion")
	}

	// Test loading state
	manager.loading[key] = true
	indicator = manager.RenderSuggestionIndicator(filePath, lineNo, side)
	if indicator == " " {
		t.Error("expected loading indicator")
	}
}

func TestClear(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})

	// Add some suggestions
	manager.suggestions["key1"] = []AISuggestion{{ID: "1"}}
	manager.suggestions["key2"] = []AISuggestion{{ID: "2"}}

	// Clear
	manager.Clear()

	if len(manager.suggestions) != 0 {
		t.Errorf("expected 0 suggestions after clear, got %d", len(manager.suggestions))
	}
}

func TestIsLoading(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})

	filePath := "test.go"
	lineNo := 10
	side := models.DiffSideRight

	// Initially not loading
	if manager.IsLoading(filePath, lineNo, side) {
		t.Error("expected not loading initially")
	}

	// Mark as loading
	key := suggestionKey(filePath, side, lineNo)
	manager.loading[key] = true

	// Should be loading now
	if !manager.IsLoading(filePath, lineNo, side) {
		t.Error("expected to be loading")
	}
}

func TestIncrementSpinner(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})

	initial := manager.loadingSpinner
	manager.IncrementSpinner()

	if manager.loadingSpinner != initial+1 {
		t.Errorf("expected loadingSpinner to increment from %d to %d, got %d", initial, initial+1, manager.loadingSpinner)
	}
}

func TestGetAllSuggestions(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})

	// Add multiple suggestions
	key1 := suggestionKey("file1.go", models.DiffSideLeft, 10)
	key2 := suggestionKey("file2.go", models.DiffSideRight, 20)

	manager.suggestions[key1] = []AISuggestion{{ID: "1"}}
	manager.suggestions[key2] = []AISuggestion{{ID: "2"}}

	all := manager.GetAllSuggestions()

	if len(all) != 2 {
		t.Errorf("expected 2 entries, got %d", len(all))
	}
}

func TestParseAIResponse(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})

	resp := ai.ReviewResponse{
		Decision: ai.DecisionRequestChanges,
		Comment:  "This has a critical security vulnerability in the authentication logic",
	}

	suggestions := manager.parseAIResponse(resp, "test.go", 10, models.DiffSideRight)

	if len(suggestions) == 0 {
		t.Fatal("expected at least one suggestion")
	}

	s := suggestions[0]
	if s.Category != SuggestionCategorySecurity {
		t.Errorf("expected category security, got %s", s.Category)
	}

	if s.Severity != SuggestionSeverityHigh {
		t.Errorf("expected severity high, got %s", s.Severity)
	}

	// Test empty comment
	emptyResp := ai.ReviewResponse{Decision: ai.DecisionComment, Comment: ""}
	emptySuggestions := manager.parseAIResponse(emptyResp, "test.go", 10, models.DiffSideRight)

	if len(emptySuggestions) != 0 {
		t.Error("expected no suggestions for empty comment")
	}
}

func TestGetSuggestions(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})

	key := suggestionKey("test.go", models.DiffSideLeft, 10)
	expected := []AISuggestion{{ID: "1"}}
	manager.suggestions[key] = expected

	result := manager.GetSuggestions("test.go", 10, models.DiffSideLeft)
	if len(result) != 1 || result[0].ID != "1" {
		t.Error("expected to get suggestion")
	}
}

func TestCancelAllCalls(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})

	// Add some cancel functions
	manager.cancelFuncs["key1"] = func() {}
	manager.cancelFuncs["key2"] = func() {}
	manager.loading["key1"] = true
	manager.loading["key2"] = true

	manager.CancelAll()

	if len(manager.cancelFuncs) != 0 {
		t.Errorf("expected empty cancelFuncs map, got %d entries", len(manager.cancelFuncs))
	}

	if len(manager.loading) != 0 {
		t.Errorf("expected empty loading map, got %d entries", len(manager.loading))
	}
}
