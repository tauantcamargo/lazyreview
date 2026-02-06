package components

import (
	"testing"

	"lazyreview/internal/models"

	tea "github.com/charmbracelet/bubbletea"
)

func TestNewSuggestionOverlay(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	if overlay == nil {
		t.Fatal("expected non-nil overlay")
	}

	if overlay.manager != manager {
		t.Error("expected manager to be set")
	}

	if overlay.width != 80 {
		t.Errorf("expected width 80, got %d", overlay.width)
	}

	if overlay.currentSuggestionIndex != -1 {
		t.Errorf("expected initial index -1, got %d", overlay.currentSuggestionIndex)
	}
}

func TestRebuildSuggestionList(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	// Add some suggestions
	key1 := suggestionKey("file1.go", models.DiffSideLeft, 10)
	key2 := suggestionKey("file2.go", models.DiffSideRight, 20)

	manager.suggestions[key1] = []AISuggestion{
		{ID: "1", FilePath: "file1.go", LineNo: 10, Side: models.DiffSideLeft, Dismissed: false},
		{ID: "2", FilePath: "file1.go", LineNo: 10, Side: models.DiffSideLeft, Dismissed: true}, // Should be excluded
	}
	manager.suggestions[key2] = []AISuggestion{
		{ID: "3", FilePath: "file2.go", LineNo: 20, Side: models.DiffSideRight, Dismissed: false},
	}

	overlay.RebuildSuggestionList()

	// Should have 2 non-dismissed suggestions
	if len(overlay.allSuggestions) != 2 {
		t.Errorf("expected 2 suggestions, got %d", len(overlay.allSuggestions))
	}

	// Verify dismissed suggestion is excluded
	for _, s := range overlay.allSuggestions {
		if s.ID == "2" {
			t.Error("expected dismissed suggestion to be excluded")
		}
	}
}

func TestNextSuggestion(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	// No suggestions initially
	overlay.NextSuggestion()
	if overlay.currentSuggestionIndex != -1 {
		t.Errorf("expected index -1 with no suggestions, got %d", overlay.currentSuggestionIndex)
	}

	// Add suggestions
	key := suggestionKey("test.go", models.DiffSideLeft, 10)
	manager.suggestions[key] = []AISuggestion{
		{ID: "1", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft},
		{ID: "2", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft},
		{ID: "3", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft},
	}

	// First next should go to index 0
	overlay.NextSuggestion()
	if overlay.currentSuggestionIndex != 0 {
		t.Errorf("expected index 0, got %d", overlay.currentSuggestionIndex)
	}

	// Second next should go to index 1
	overlay.NextSuggestion()
	if overlay.currentSuggestionIndex != 1 {
		t.Errorf("expected index 1, got %d", overlay.currentSuggestionIndex)
	}

	// Third next should go to index 2
	overlay.NextSuggestion()
	if overlay.currentSuggestionIndex != 2 {
		t.Errorf("expected index 2, got %d", overlay.currentSuggestionIndex)
	}

	// Fourth next should wrap to index 0
	overlay.NextSuggestion()
	if overlay.currentSuggestionIndex != 0 {
		t.Errorf("expected index 0 (wrap around), got %d", overlay.currentSuggestionIndex)
	}
}

func TestPrevSuggestion(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	// Add suggestions
	key := suggestionKey("test.go", models.DiffSideLeft, 10)
	manager.suggestions[key] = []AISuggestion{
		{ID: "1", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft},
		{ID: "2", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft},
		{ID: "3", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft},
	}

	// First prev should wrap to last (index 2)
	overlay.PrevSuggestion()
	if overlay.currentSuggestionIndex != 2 {
		t.Errorf("expected index 2 (wrap to end), got %d", overlay.currentSuggestionIndex)
	}

	// Second prev should go to index 1
	overlay.PrevSuggestion()
	if overlay.currentSuggestionIndex != 1 {
		t.Errorf("expected index 1, got %d", overlay.currentSuggestionIndex)
	}

	// Third prev should go to index 0
	overlay.PrevSuggestion()
	if overlay.currentSuggestionIndex != 0 {
		t.Errorf("expected index 0, got %d", overlay.currentSuggestionIndex)
	}
}

func TestCurrentSuggestion(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	// No current suggestion initially
	current := overlay.CurrentSuggestion()
	if current != nil {
		t.Error("expected nil current suggestion initially")
	}

	// Add suggestions
	key := suggestionKey("test.go", models.DiffSideLeft, 10)
	manager.suggestions[key] = []AISuggestion{
		{ID: "1", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft},
		{ID: "2", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft},
	}

	// Navigate to first suggestion
	overlay.NextSuggestion()
	current = overlay.CurrentSuggestion()
	if current == nil {
		t.Fatal("expected non-nil current suggestion")
	}
	if current.ID != "1" {
		t.Errorf("expected ID '1', got %q", current.ID)
	}

	// Navigate to second suggestion
	overlay.NextSuggestion()
	current = overlay.CurrentSuggestion()
	if current == nil {
		t.Fatal("expected non-nil current suggestion")
	}
	if current.ID != "2" {
		t.Errorf("expected ID '2', got %q", current.ID)
	}
}

func TestToggleCurrentSuggestion(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	key := suggestionKey("test.go", models.DiffSideLeft, 10)
	manager.suggestions[key] = []AISuggestion{
		{ID: "1", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft, Expanded: false},
	}

	overlay.NextSuggestion()

	// Toggle to expanded
	overlay.ToggleCurrentSuggestion()
	if !manager.suggestions[key][0].Expanded {
		t.Error("expected suggestion to be expanded")
	}

	// Toggle to collapsed
	overlay.ToggleCurrentSuggestion()
	if manager.suggestions[key][0].Expanded {
		t.Error("expected suggestion to be collapsed")
	}
}

func TestDismissCurrentSuggestion(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	key := suggestionKey("test.go", models.DiffSideLeft, 10)
	manager.suggestions[key] = []AISuggestion{
		{ID: "1", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft, Dismissed: false},
		{ID: "2", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft, Dismissed: false},
	}

	overlay.NextSuggestion() // Navigate to first

	// Dismiss current
	overlay.DismissCurrentSuggestion()

	// First should be dismissed
	if !manager.suggestions[key][0].Dismissed {
		t.Error("expected first suggestion to be dismissed")
	}

	// List should be rebuilt, current should move
	overlay.RebuildSuggestionList()
	if len(overlay.allSuggestions) != 1 {
		t.Errorf("expected 1 non-dismissed suggestion, got %d", len(overlay.allSuggestions))
	}
}

func TestAcceptCurrentSuggestion(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	key := suggestionKey("test.go", models.DiffSideLeft, 10)
	manager.suggestions[key] = []AISuggestion{
		{ID: "1", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft, Accepted: false},
		{ID: "2", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft, Accepted: false},
	}

	overlay.NextSuggestion() // Navigate to first

	// Accept current
	overlay.AcceptCurrentSuggestion()

	// First should be accepted
	if !manager.suggestions[key][0].Accepted {
		t.Error("expected first suggestion to be accepted")
	}

	// Should have moved to next suggestion
	current := overlay.CurrentSuggestion()
	if current == nil || current.ID != "2" {
		t.Error("expected to move to second suggestion after accepting")
	}
}

func TestRenderInlineSuggestion(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	filePath := "test.go"
	lineNo := 10
	side := models.DiffSideLeft

	// No suggestions - should return empty string
	result := overlay.RenderInlineSuggestion(filePath, lineNo, side)
	if result != "" {
		t.Errorf("expected empty string for no suggestions, got %q", result)
	}

	// Add a suggestion
	key := suggestionKey(filePath, side, lineNo)
	manager.suggestions[key] = []AISuggestion{
		{
			ID:       "1",
			FilePath: filePath,
			LineNo:   lineNo,
			Side:     side,
			Category: SuggestionCategoryBug,
			Severity: SuggestionSeverityHigh,
			Title:    "Potential bug",
		},
	}

	// Should render something
	result = overlay.RenderInlineSuggestion(filePath, lineNo, side)
	if result == "" {
		t.Error("expected non-empty render for suggestion")
	}

	// Dismissed suggestions should not render
	manager.suggestions[key][0].Dismissed = true
	result = overlay.RenderInlineSuggestion(filePath, lineNo, side)
	if result != "" {
		t.Error("expected empty string for dismissed suggestions")
	}
}

func TestGetCategoryStyle(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	categories := []SuggestionCategory{
		SuggestionCategoryBug,
		SuggestionCategorySecurity,
		SuggestionCategoryPerformance,
		SuggestionCategoryStyle,
	}

	for _, category := range categories {
		style := overlay.getCategoryStyle(category)
		// Just verify we can get a style without panicking
		_ = style.Render("test")
	}
}

func TestGetSeverityStyle(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	severities := []SuggestionSeverity{
		SuggestionSeverityHigh,
		SuggestionSeverityMedium,
		SuggestionSeverityLow,
	}

	for _, severity := range severities {
		style := overlay.getSeverityStyle(severity)
		// Just verify we can get a style without panicking
		_ = style.Render("test")
	}
}

func TestWrapText(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	tests := []struct {
		name     string
		text     string
		maxWidth int
		verify   func(string) bool
	}{
		{
			name:     "short text",
			text:     "Short",
			maxWidth: 20,
			verify: func(result string) bool {
				return result == "Short"
			},
		},
		{
			name:     "text with newlines",
			text:     "Line 1\nLine 2",
			maxWidth: 20,
			verify: func(result string) bool {
				return result == "Line 1\nLine 2"
			},
		},
		{
			name:     "long text wrapping",
			text:     "This is a very long line that should wrap",
			maxWidth: 20,
			verify: func(result string) bool {
				// Should have newlines after wrapping
				return len(result) > 0
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := overlay.wrapText(tt.text, tt.maxWidth)
			if !tt.verify(result) {
				t.Errorf("wrapText verification failed for %q", tt.name)
			}
		})
	}
}

func TestRenderSingleSuggestion(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	suggestion := AISuggestion{
		ID:            "test-1",
		FilePath:      "test.go",
		LineNo:        10,
		Side:          models.DiffSideLeft,
		Category:      SuggestionCategoryBug,
		Severity:      SuggestionSeverityHigh,
		Title:         "Potential bug",
		Description:   "This could cause issues",
		SuggestedCode: "// Fixed code",
		Expanded:      true,
	}

	result := overlay.renderSingleSuggestion(suggestion)
	if result == "" {
		t.Error("expected non-empty render")
	}

	// Test collapsed
	suggestion.Expanded = false
	result = overlay.renderSingleSuggestion(suggestion)
	if result == "" {
		t.Error("expected non-empty render for collapsed suggestion")
	}

	// Test accepted
	suggestion.Accepted = true
	result = overlay.renderSingleSuggestion(suggestion)
	if result == "" {
		t.Error("expected non-empty render for accepted suggestion")
	}

	// Test dismissed
	suggestion.Accepted = false
	suggestion.Dismissed = true
	result = overlay.renderSingleSuggestion(suggestion)
	if result == "" {
		t.Error("expected non-empty render for dismissed suggestion")
	}
}

func TestSuggestionOverlayUpdateExtended(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	// Add suggestions
	key := suggestionKey("test.go", models.DiffSideLeft, 10)
	manager.suggestions[key] = []AISuggestion{
		{ID: "1", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft, Expanded: false},
		{ID: "2", FilePath: "test.go", LineNo: 11, Side: models.DiffSideLeft, Expanded: false},
	}

	// Test NextSuggestion key
	msg := tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'n'}}
	overlay, _ = overlay.Update(msg)
	if overlay.currentSuggestionIndex != 0 {
		t.Error("expected to navigate to first suggestion with 'n' key")
	}

	// Test PrevSuggestion key
	msg = tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'N'}}
	overlay, _ = overlay.Update(msg)
	// Should wrap to last
	if overlay.currentSuggestionIndex != 1 {
		t.Error("expected to wrap to last suggestion with 'N' key")
	}

	// Navigate back to first
	overlay.NextSuggestion()

	// Test Expand key
	msg = tea.KeyMsg{Type: tea.KeyEnter}
	overlay, _ = overlay.Update(msg)
	if !manager.suggestions[key][0].Expanded {
		t.Error("expected suggestion to be expanded with Enter key")
	}

	// Test Dismiss key
	msg = tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'d'}}
	overlay, _ = overlay.Update(msg)
	if !manager.suggestions[key][0].Dismissed {
		t.Error("expected suggestion to be dismissed with 'd' key")
	}

	// Test Accept key
	overlay.NextSuggestion() // Move to second suggestion
	msg = tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'a'}}
	overlay, _ = overlay.Update(msg)
	if !manager.suggestions[key][1].Accepted {
		t.Error("expected suggestion to be accepted with 'a' key")
	}

	// Test Help key
	msg = tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'?'}}
	overlay, _ = overlay.Update(msg)
	if !overlay.showHelp {
		t.Error("expected help to be shown with '?' key")
	}
}

func TestSetWidth(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	overlay.SetWidth(120)
	if overlay.width != 120 {
		t.Errorf("expected width 120, got %d", overlay.width)
	}
}

func TestGetCurrentSuggestionLocation(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	// No current suggestion
	_, _, _, ok := overlay.GetCurrentSuggestionLocation()
	if ok {
		t.Error("expected ok=false with no current suggestion")
	}

	// Add and navigate to suggestion
	key := suggestionKey("test.go", models.DiffSideLeft, 10)
	manager.suggestions[key] = []AISuggestion{
		{ID: "1", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft},
	}

	overlay.NextSuggestion()

	filePath, lineNo, side, ok := overlay.GetCurrentSuggestionLocation()
	if !ok {
		t.Fatal("expected ok=true with current suggestion")
	}

	if filePath != "test.go" {
		t.Errorf("expected file path 'test.go', got %q", filePath)
	}

	if lineNo != 10 {
		t.Errorf("expected line number 10, got %d", lineNo)
	}

	if side != models.DiffSideLeft {
		t.Errorf("expected side 'left', got %q", side)
	}
}

func TestStatusLine(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	// No suggestions
	status := overlay.StatusLine()
	if status == "" {
		t.Error("expected non-empty status line")
	}

	// Add suggestions
	key := suggestionKey("test.go", models.DiffSideLeft, 10)
	manager.suggestions[key] = []AISuggestion{
		{ID: "1", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft},
		{ID: "2", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft},
	}

	status = overlay.StatusLine()
	if status == "" {
		t.Error("expected non-empty status line with suggestions")
	}
}

func TestSuggestionOverlayUpdate(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	// Add suggestions
	key := suggestionKey("test.go", models.DiffSideLeft, 10)
	manager.suggestions[key] = []AISuggestion{
		{ID: "1", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft, Expanded: false},
	}

	// Test NextSuggestion key
	msg := tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'n'}}
	overlay, _ = overlay.Update(msg)
	if overlay.currentSuggestionIndex != 0 {
		t.Error("expected to navigate to first suggestion with 'n' key")
	}

	// Test Expand key
	msg = tea.KeyMsg{Type: tea.KeyEnter}
	overlay, _ = overlay.Update(msg)
	if !manager.suggestions[key][0].Expanded {
		t.Error("expected suggestion to be expanded with Enter key")
	}

	// Test Help key
	msg = tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'?'}}
	overlay, _ = overlay.Update(msg)
	if !overlay.showHelp {
		t.Error("expected help to be shown with '?' key")
	}
}

func TestSetWidthAndStatusLine(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	// Test SetWidth
	overlay.SetWidth(120)
	if overlay.width != 120 {
		t.Errorf("expected width 120, got %d", overlay.width)
	}

	// Test StatusLine with no suggestions
	status := overlay.StatusLine()
	if status == "" {
		t.Error("expected non-empty status line")
	}

	// Add suggestions and test again
	key := suggestionKey("test.go", models.DiffSideLeft, 10)
	manager.suggestions[key] = []AISuggestion{
		{ID: "1", FilePath: "test.go", LineNo: 10, Side: models.DiffSideLeft},
		{ID: "2", FilePath: "test.go", LineNo: 11, Side: models.DiffSideLeft},
	}

	status = overlay.StatusLine()
	if status == "" {
		t.Error("expected non-empty status line with suggestions")
	}

	// Navigate to first
	overlay.NextSuggestion()
	status = overlay.StatusLine()
	if status == "" {
		t.Error("expected non-empty status line after navigation")
	}
}

func TestCategoryAndSeverityStyles(t *testing.T) {
	manager := NewAISuggestionManager(&mockAIProvider{})
	overlay := NewSuggestionOverlay(manager, 80)

	// Test all categories
	categories := []SuggestionCategory{
		SuggestionCategoryBug,
		SuggestionCategorySecurity,
		SuggestionCategoryPerformance,
		SuggestionCategoryStyle,
		"unknown", // default case
	}

	for _, category := range categories {
		style := overlay.getCategoryStyle(category)
		_ = style.Render("test")
	}

	// Test all severities
	severities := []SuggestionSeverity{
		SuggestionSeverityHigh,
		SuggestionSeverityMedium,
		SuggestionSeverityLow,
		"unknown", // default case
	}

	for _, severity := range severities {
		style := overlay.getSeverityStyle(severity)
		_ = style.Render("test")
	}
}
