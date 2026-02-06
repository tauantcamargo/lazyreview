package components

import (
	"context"
	"fmt"
	"strings"
	"time"

	"lazyreview/internal/ai"
	"lazyreview/internal/models"

	"github.com/charmbracelet/lipgloss"
)

// SuggestionCategory categorizes AI suggestions by type
type SuggestionCategory string

const (
	SuggestionCategoryBug         SuggestionCategory = "bug"
	SuggestionCategorySecurity    SuggestionCategory = "security"
	SuggestionCategoryPerformance SuggestionCategory = "performance"
	SuggestionCategoryStyle       SuggestionCategory = "style"
)

// SuggestionSeverity indicates the importance level
type SuggestionSeverity string

const (
	SuggestionSeverityHigh   SuggestionSeverity = "high"
	SuggestionSeverityMedium SuggestionSeverity = "medium"
	SuggestionSeverityLow    SuggestionSeverity = "low"
)

// AISuggestion represents a single AI-generated suggestion for a diff line or range
type AISuggestion struct {
	// ID uniquely identifies this suggestion
	ID string

	// FilePath is the file this suggestion applies to
	FilePath string

	// LineNo is the line number in the diff
	LineNo int

	// Side indicates left or right side of split diff
	Side models.DiffSide

	// Category classifies the type of suggestion
	Category SuggestionCategory

	// Severity indicates importance
	Severity SuggestionSeverity

	// Title is a brief summary (one line)
	Title string

	// Description is the full explanation
	Description string

	// SuggestedCode is optional code replacement
	SuggestedCode string

	// Expanded tracks if the suggestion is currently expanded
	Expanded bool

	// Dismissed tracks if the user dismissed this suggestion
	Dismissed bool

	// Accepted tracks if the user accepted this suggestion
	Accepted bool

	// CreatedAt tracks when this suggestion was generated
	CreatedAt time.Time
}

// suggestionKey creates a unique key for storing suggestions
func suggestionKey(filePath string, side models.DiffSide, lineNo int) string {
	return fmt.Sprintf("%s|%s|%d", filePath, side, lineNo)
}

// AISuggestionManager manages AI suggestions for a diff
type AISuggestionManager struct {
	suggestions map[string][]AISuggestion // keyed by suggestionKey
	aiProvider  ai.Provider
	nextID      int

	// Loading state
	loading        map[string]bool // tracks which lines are being analyzed
	cancelFuncs    map[string]context.CancelFunc
	loadingSpinner int
}

// NewAISuggestionManager creates a new suggestion manager
func NewAISuggestionManager(aiProvider ai.Provider) *AISuggestionManager {
	return &AISuggestionManager{
		suggestions: map[string][]AISuggestion{},
		aiProvider:  aiProvider,
		nextID:      1,
		loading:     map[string]bool{},
		cancelFuncs: map[string]context.CancelFunc{},
	}
}

// LoadSuggestionsAsync starts async loading of suggestions for a file/line
func (m *AISuggestionManager) LoadSuggestionsAsync(ctx context.Context, filePath string, lineNo int, side models.DiffSide, diff string) {
	key := suggestionKey(filePath, side, lineNo)

	// Cancel any existing request for this line
	m.CancelLoadingForLine(filePath, lineNo, side)

	// Create cancellable context
	childCtx, cancel := context.WithCancel(ctx)
	m.cancelFuncs[key] = cancel
	m.loading[key] = true

	go func() {
		defer func() {
			delete(m.loading, key)
			delete(m.cancelFuncs, key)
		}()

		// Call AI provider
		resp, err := m.aiProvider.Review(childCtx, ai.ReviewRequest{
			FilePath: filePath,
			Diff:     diff,
		})

		// Check if cancelled
		select {
		case <-childCtx.Done():
			return
		default:
		}

		if err != nil {
			// Log error but don't store failed suggestions
			return
		}

		// Parse AI response into suggestions
		suggestions := m.parseAIResponse(resp, filePath, lineNo, side)

		// Store suggestions
		m.suggestions[key] = suggestions
	}()
}

// CancelLoadingForLine cancels any in-flight AI request for a specific line
func (m *AISuggestionManager) CancelLoadingForLine(filePath string, lineNo int, side models.DiffSide) {
	key := suggestionKey(filePath, side, lineNo)
	if cancel, exists := m.cancelFuncs[key]; exists {
		cancel()
	}
}

// CancelAll cancels all in-flight AI requests
func (m *AISuggestionManager) CancelAll() {
	for _, cancel := range m.cancelFuncs {
		cancel()
	}
	m.cancelFuncs = map[string]context.CancelFunc{}
	m.loading = map[string]bool{}
}

// GetSuggestions returns all suggestions for a file/line
func (m *AISuggestionManager) GetSuggestions(filePath string, lineNo int, side models.DiffSide) []AISuggestion {
	key := suggestionKey(filePath, side, lineNo)
	return m.suggestions[key]
}

// GetAllSuggestions returns all suggestions across all lines
func (m *AISuggestionManager) GetAllSuggestions() map[string][]AISuggestion {
	return m.suggestions
}

// IsLoading checks if suggestions are being loaded for a specific line
func (m *AISuggestionManager) IsLoading(filePath string, lineNo int, side models.DiffSide) bool {
	key := suggestionKey(filePath, side, lineNo)
	return m.loading[key]
}

// HasSuggestions checks if a line has any suggestions
func (m *AISuggestionManager) HasSuggestions(filePath string, lineNo int, side models.DiffSide) bool {
	key := suggestionKey(filePath, side, lineNo)
	suggestions, exists := m.suggestions[key]
	if !exists {
		return false
	}
	// Count non-dismissed suggestions
	for _, s := range suggestions {
		if !s.Dismissed {
			return true
		}
	}
	return false
}

// ToggleExpanded toggles the expanded state of a suggestion
func (m *AISuggestionManager) ToggleExpanded(suggestionID string) bool {
	for key := range m.suggestions {
		for i := range m.suggestions[key] {
			if m.suggestions[key][i].ID == suggestionID {
				m.suggestions[key][i].Expanded = !m.suggestions[key][i].Expanded
				return m.suggestions[key][i].Expanded
			}
		}
	}
	return false
}

// DismissSuggestion marks a suggestion as dismissed
func (m *AISuggestionManager) DismissSuggestion(suggestionID string) bool {
	for key := range m.suggestions {
		for i := range m.suggestions[key] {
			if m.suggestions[key][i].ID == suggestionID {
				m.suggestions[key][i].Dismissed = true
				m.suggestions[key][i].Expanded = false
				return true
			}
		}
	}
	return false
}

// AcceptSuggestion marks a suggestion as accepted
func (m *AISuggestionManager) AcceptSuggestion(suggestionID string) bool {
	for key := range m.suggestions {
		for i := range m.suggestions[key] {
			if m.suggestions[key][i].ID == suggestionID {
				m.suggestions[key][i].Accepted = true
				m.suggestions[key][i].Expanded = false
				return true
			}
		}
	}
	return false
}

// Clear removes all suggestions
func (m *AISuggestionManager) Clear() {
	m.suggestions = map[string][]AISuggestion{}
}

// parseAIResponse converts AI review response into categorized suggestions
func (m *AISuggestionManager) parseAIResponse(resp ai.ReviewResponse, filePath string, lineNo int, side models.DiffSide) []AISuggestion {
	// Parse the AI comment into structured suggestions
	// For now, create a single suggestion from the response
	// In the future, we could parse the comment for multiple issues

	comment := strings.TrimSpace(resp.Comment)
	if comment == "" {
		return nil
	}

	// Determine category and severity from decision and content
	category, severity := m.categorizeResponse(resp, comment)

	suggestion := AISuggestion{
		ID:          fmt.Sprintf("ai-%d", m.nextID),
		FilePath:    filePath,
		LineNo:      lineNo,
		Side:        side,
		Category:    category,
		Severity:    severity,
		Title:       m.extractTitle(comment),
		Description: comment,
		Expanded:    false,
		Dismissed:   false,
		Accepted:    false,
		CreatedAt:   time.Now(),
	}

	m.nextID++

	return []AISuggestion{suggestion}
}

// categorizeResponse determines category and severity from AI response
func (m *AISuggestionManager) categorizeResponse(resp ai.ReviewResponse, comment string) (SuggestionCategory, SuggestionSeverity) {
	lower := strings.ToLower(comment)

	// Determine category
	category := SuggestionCategoryStyle
	if strings.Contains(lower, "bug") || strings.Contains(lower, "error") || strings.Contains(lower, "crash") {
		category = SuggestionCategoryBug
	} else if strings.Contains(lower, "security") || strings.Contains(lower, "vulnerability") || strings.Contains(lower, "unsafe") {
		category = SuggestionCategorySecurity
	} else if strings.Contains(lower, "performance") || strings.Contains(lower, "slow") || strings.Contains(lower, "optimize") {
		category = SuggestionCategoryPerformance
	}

	// Determine severity
	severity := SuggestionSeverityMedium
	if resp.Decision == ai.DecisionRequestChanges {
		severity = SuggestionSeverityHigh
	} else if resp.Decision == ai.DecisionComment {
		severity = SuggestionSeverityLow
	}

	// Override severity for critical keywords
	if category == SuggestionCategorySecurity || category == SuggestionCategoryBug {
		if strings.Contains(lower, "critical") || strings.Contains(lower, "severe") {
			severity = SuggestionSeverityHigh
		}
	}

	return category, severity
}

// extractTitle extracts a brief title from the full comment
func (m *AISuggestionManager) extractTitle(comment string) string {
	lines := strings.Split(comment, "\n")
	if len(lines) == 0 {
		return "AI Suggestion"
	}

	// Use first non-empty line as title
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			// Truncate to reasonable length
			if len(line) > 80 {
				return line[:77] + "..."
			}
			return line
		}
	}

	return "AI Suggestion"
}

// RenderSuggestionIndicator renders a small indicator for lines with suggestions
func (m *AISuggestionManager) RenderSuggestionIndicator(filePath string, lineNo int, side models.DiffSide) string {
	if m.IsLoading(filePath, lineNo, side) {
		// Animated loading indicator
		spinners := []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
		spinner := spinners[m.loadingSpinner%len(spinners)]
		return lipgloss.NewStyle().Foreground(lipgloss.Color("39")).Render(spinner) // Blue
	}

	suggestions := m.GetSuggestions(filePath, lineNo, side)
	if len(suggestions) == 0 {
		return " "
	}

	// Count non-dismissed suggestions by severity
	hasHigh := false
	hasMedium := false
	hasLow := false

	for _, s := range suggestions {
		if s.Dismissed {
			continue
		}
		switch s.Severity {
		case SuggestionSeverityHigh:
			hasHigh = true
		case SuggestionSeverityMedium:
			hasMedium = true
		case SuggestionSeverityLow:
			hasLow = true
		}
	}

	// Show highest severity indicator
	if hasHigh {
		return lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Render("●") // Red
	}
	if hasMedium {
		return lipgloss.NewStyle().Foreground(lipgloss.Color("220")).Render("●") // Yellow
	}
	if hasLow {
		return lipgloss.NewStyle().Foreground(lipgloss.Color("39")).Render("●") // Blue
	}

	return " "
}

// IncrementSpinner increments the loading spinner animation frame
func (m *AISuggestionManager) IncrementSpinner() {
	m.loadingSpinner++
}
