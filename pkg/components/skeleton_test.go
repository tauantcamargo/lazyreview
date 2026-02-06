package components

import (
	"strings"
	"testing"

	"github.com/charmbracelet/lipgloss"
)

// TestDefaultSkeletonStyles tests default skeleton styles
func TestDefaultSkeletonStyles(t *testing.T) {
	styles := DefaultSkeletonStyles()

	// Just verify styles are initialized, don't compare colors directly
	if styles.Loading.GetForeground() == nil {
		t.Error("expected loading style to have foreground color")
	}

	if styles.Stale.GetForeground() == nil {
		t.Error("expected stale style to have foreground color")
	}

	if styles.Error.GetForeground() == nil {
		t.Error("expected error style to have foreground color")
	}
}

// TestNewSkeleton tests creating a new skeleton
func TestNewSkeleton(t *testing.T) {
	skeleton := NewSkeleton(80, 10, StateLoading)

	if skeleton.width != 80 {
		t.Errorf("expected width 80, got %d", skeleton.width)
	}

	if skeleton.height != 10 {
		t.Errorf("expected height 10, got %d", skeleton.height)
	}

	if skeleton.state != StateLoading {
		t.Errorf("expected StateLoading, got %v", skeleton.state)
	}
}

// TestSkeleton_WithMessage tests setting custom message
func TestSkeleton_WithMessage(t *testing.T) {
	skeleton := NewSkeleton(80, 10, StateLoading).
		WithMessage("Custom loading message")

	if skeleton.message != "Custom loading message" {
		t.Errorf("expected custom message, got %s", skeleton.message)
	}
}

// TestSkeleton_WithStyles tests setting custom styles
func TestSkeleton_WithStyles(t *testing.T) {
	customStyles := SkeletonStyles{
		Loading: lipgloss.NewStyle().Foreground(lipgloss.Color("123")),
		Stale:   lipgloss.NewStyle().Foreground(lipgloss.Color("124")),
		Error:   lipgloss.NewStyle().Foreground(lipgloss.Color("125")),
	}

	skeleton := NewSkeleton(80, 10, StateLoading).
		WithStyles(customStyles)

	if skeleton.styles.Loading.GetForeground() != lipgloss.Color("123") {
		t.Error("expected custom loading style")
	}
}

// TestSkeleton_ViewLoading tests rendering loading state
func TestSkeleton_ViewLoading(t *testing.T) {
	skeleton := NewSkeleton(80, 5, StateLoading)
	view := skeleton.View()

	if view == "" {
		t.Error("expected non-empty view")
	}

	// Should contain loading indicator
	if !strings.Contains(view, "Loading") {
		t.Error("expected view to contain 'Loading'")
	}

	// Should have multiple lines
	lines := strings.Split(view, "\n")
	if len(lines) < 2 {
		t.Errorf("expected at least 2 lines, got %d", len(lines))
	}
}

// TestSkeleton_ViewStale tests rendering stale state
func TestSkeleton_ViewStale(t *testing.T) {
	skeleton := NewSkeleton(80, 5, StateStale)
	view := skeleton.View()

	if view == "" {
		t.Error("expected non-empty view")
	}

	// Should contain refresh indicator
	if !strings.Contains(view, "⟳") {
		t.Error("expected view to contain refresh symbol")
	}

	if !strings.Contains(view, "Refresh") {
		t.Error("expected view to contain 'Refresh'")
	}
}

// TestSkeleton_ViewError tests rendering error state
func TestSkeleton_ViewError(t *testing.T) {
	skeleton := NewSkeleton(80, 5, StateError)
	view := skeleton.View()

	if view == "" {
		t.Error("expected non-empty view")
	}

	// Should contain error indicator
	if !strings.Contains(view, "✗") {
		t.Error("expected view to contain error symbol")
	}

	if !strings.Contains(view, "Failed") {
		t.Error("expected view to contain 'Failed'")
	}
}

// TestSkeleton_ViewEmpty tests rendering empty state
func TestSkeleton_ViewEmpty(t *testing.T) {
	skeleton := NewSkeleton(80, 5, StateEmpty)
	view := skeleton.View()

	if view == "" {
		t.Error("expected non-empty view")
	}

	if !strings.Contains(view, "No data") {
		t.Error("expected view to contain 'No data'")
	}
}

// TestSkeleton_CustomMessage tests custom messages for each state
func TestSkeleton_CustomMessage(t *testing.T) {
	tests := []struct {
		state   LoadState
		message string
	}{
		{StateLoading, "Loading custom data..."},
		{StateStale, "Updating data..."},
		{StateError, "Custom error message"},
	}

	for _, tt := range tests {
		t.Run(tt.message, func(t *testing.T) {
			skeleton := NewSkeleton(80, 5, tt.state).
				WithMessage(tt.message)

			view := skeleton.View()
			if !strings.Contains(view, tt.message) {
				t.Errorf("expected view to contain '%s'", tt.message)
			}
		})
	}
}

// TestNewSkeletonListItem tests creating a skeleton list item
func TestNewSkeletonListItem(t *testing.T) {
	item := NewSkeletonListItem(80, StateLoading)

	if item.width != 80 {
		t.Errorf("expected width 80, got %d", item.width)
	}

	if item.state != StateLoading {
		t.Errorf("expected StateLoading, got %v", item.state)
	}
}

// TestSkeletonListItem_ViewLoading tests rendering loading list item
func TestSkeletonListItem_ViewLoading(t *testing.T) {
	item := NewSkeletonListItem(80, StateLoading)
	view := item.View()

	if view == "" {
		t.Error("expected non-empty view")
	}

	// Should have multiple lines (title + description)
	lines := strings.Split(view, "\n")
	if len(lines) < 2 {
		t.Errorf("expected at least 2 lines, got %d", len(lines))
	}

	// Should contain skeleton characters
	if !strings.Contains(view, "▓") && !strings.Contains(view, "░") {
		t.Error("expected view to contain skeleton characters")
	}
}

// TestSkeletonListItem_ViewStale tests rendering stale list item
func TestSkeletonListItem_ViewStale(t *testing.T) {
	item := NewSkeletonListItem(80, StateStale)
	view := item.View()

	if view == "" {
		t.Error("expected non-empty view")
	}

	if !strings.Contains(view, "⟳") {
		t.Error("expected view to contain refresh symbol")
	}

	if !strings.Contains(view, "Refresh") {
		t.Error("expected view to contain 'Refresh'")
	}
}

// TestSkeletonListItem_ViewError tests rendering error list item
func TestSkeletonListItem_ViewError(t *testing.T) {
	item := NewSkeletonListItem(80, StateError)
	view := item.View()

	if view == "" {
		t.Error("expected non-empty view")
	}

	if !strings.Contains(view, "✗") {
		t.Error("expected view to contain error symbol")
	}

	if !strings.Contains(view, "Failed") {
		t.Error("expected view to contain 'Failed'")
	}
}

// TestNewSkeletonDiff tests creating a skeleton diff
func TestNewSkeletonDiff(t *testing.T) {
	diff := NewSkeletonDiff(80, 20)

	if diff.width != 80 {
		t.Errorf("expected width 80, got %d", diff.width)
	}

	if diff.height != 20 {
		t.Errorf("expected height 20, got %d", diff.height)
	}
}

// TestSkeletonDiff_View tests rendering skeleton diff
func TestSkeletonDiff_View(t *testing.T) {
	diff := NewSkeletonDiff(80, 10)
	view := diff.View()

	if view == "" {
		t.Error("expected non-empty view")
	}

	lines := strings.Split(view, "\n")
	if len(lines) < 5 {
		t.Errorf("expected at least 5 lines, got %d", len(lines))
	}

	// Should contain diff prefixes
	hasPlusLine := false
	hasMinusLine := false
	for _, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), "+") {
			hasPlusLine = true
		}
		if strings.HasPrefix(strings.TrimSpace(line), "-") {
			hasMinusLine = true
		}
	}

	if !hasPlusLine {
		t.Error("expected view to contain addition lines")
	}

	if !hasMinusLine {
		t.Error("expected view to contain deletion lines")
	}
}

// TestNewSkeletonFileTree tests creating a skeleton file tree
func TestNewSkeletonFileTree(t *testing.T) {
	tree := NewSkeletonFileTree(80, 15)

	if tree.width != 80 {
		t.Errorf("expected width 80, got %d", tree.width)
	}

	if tree.height != 15 {
		t.Errorf("expected height 15, got %d", tree.height)
	}
}

// TestSkeletonFileTree_View tests rendering skeleton file tree
func TestSkeletonFileTree_View(t *testing.T) {
	tree := NewSkeletonFileTree(80, 10)
	view := tree.View()

	if view == "" {
		t.Error("expected non-empty view")
	}

	// Should have header
	if !strings.Contains(view, "Files") {
		t.Error("expected view to contain 'Files' header")
	}

	lines := strings.Split(view, "\n")
	if len(lines) < 2 {
		t.Errorf("expected at least 2 lines, got %d", len(lines))
	}

	// Should contain tree characters
	if !strings.Contains(view, "└─") {
		t.Error("expected view to contain tree characters")
	}
}

// TestNewLoadingIndicator tests creating a loading indicator
func TestNewLoadingIndicator(t *testing.T) {
	indicator := NewLoadingIndicator()

	if len(indicator.frames) == 0 {
		t.Error("expected non-empty frames")
	}

	if indicator.frame != 0 {
		t.Errorf("expected initial frame 0, got %d", indicator.frame)
	}
}

// TestLoadingIndicator_Next tests animation frames
func TestLoadingIndicator_Next(t *testing.T) {
	indicator := NewLoadingIndicator()
	totalFrames := len(indicator.frames)

	// Advance through all frames
	for i := 0; i < totalFrames; i++ {
		if indicator.frame != i {
			t.Errorf("expected frame %d, got %d", i, indicator.frame)
		}
		indicator.Next()
	}

	// Should wrap back to 0
	if indicator.frame != 0 {
		t.Errorf("expected frame to wrap to 0, got %d", indicator.frame)
	}
}

// TestLoadingIndicator_View tests rendering indicator
func TestLoadingIndicator_View(t *testing.T) {
	indicator := NewLoadingIndicator()
	view := indicator.View()

	if view == "" {
		t.Error("expected non-empty view")
	}

	// Should be one of the spinner characters
	found := false
	for _, frame := range indicator.frames {
		if strings.Contains(view, frame) {
			found = true
			break
		}
	}

	if !found {
		t.Error("expected view to contain a spinner frame")
	}
}

// TestLoadingIndicator_WithFrames tests custom frames
func TestLoadingIndicator_WithFrames(t *testing.T) {
	customFrames := []string{".", "..", "..."}
	indicator := NewLoadingIndicator().WithFrames(customFrames)

	if len(indicator.frames) != len(customFrames) {
		t.Errorf("expected %d frames, got %d", len(customFrames), len(indicator.frames))
	}

	view := indicator.View()
	if !strings.Contains(view, ".") {
		t.Error("expected view to contain custom frame")
	}
}

// TestLoadingIndicator_WithStyle tests custom style
func TestLoadingIndicator_WithStyle(t *testing.T) {
	customStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("200"))
	indicator := NewLoadingIndicator().WithStyle(customStyle)

	if indicator.style.GetForeground() != lipgloss.Color("200") {
		t.Error("expected custom style")
	}
}

// TestNewStaleIndicator tests creating a stale indicator
func TestNewStaleIndicator(t *testing.T) {
	indicator := NewStaleIndicator()

	if indicator.style.GetForeground() == nil {
		t.Error("expected style to have foreground color")
	}
}

// TestStaleIndicator_View tests rendering stale indicator
func TestStaleIndicator_View(t *testing.T) {
	indicator := NewStaleIndicator()
	view := indicator.View()

	if view == "" {
		t.Error("expected non-empty view")
	}

	if !strings.Contains(view, "⟳") {
		t.Error("expected view to contain refresh symbol")
	}
}

// TestNewErrorIndicator tests creating an error indicator
func TestNewErrorIndicator(t *testing.T) {
	message := "Test error"
	indicator := NewErrorIndicator(message)

	if indicator.message != message {
		t.Errorf("expected message '%s', got '%s'", message, indicator.message)
	}

	if indicator.style.GetForeground() == nil {
		t.Error("expected style to have foreground color")
	}
}

// TestErrorIndicator_View tests rendering error indicator
func TestErrorIndicator_View(t *testing.T) {
	message := "Test error message"
	indicator := NewErrorIndicator(message)
	view := indicator.View()

	if view == "" {
		t.Error("expected non-empty view")
	}

	if !strings.Contains(view, "✗") {
		t.Error("expected view to contain error symbol")
	}

	if !strings.Contains(view, message) {
		t.Errorf("expected view to contain message '%s'", message)
	}
}

// TestErrorIndicator_ViewNoMessage tests rendering without message
func TestErrorIndicator_ViewNoMessage(t *testing.T) {
	indicator := NewErrorIndicator("")
	view := indicator.View()

	if view == "" {
		t.Error("expected non-empty view")
	}

	if !strings.Contains(view, "✗") {
		t.Error("expected view to contain error symbol")
	}

	// Should just be the symbol, no message
	lines := strings.Split(view, " ")
	if len(lines) > 1 && lines[1] != "" {
		t.Error("expected only error symbol without message")
	}
}

// TestSkeleton_ViewWidthHeightBounds tests boundary conditions
func TestSkeleton_ViewWidthHeightBounds(t *testing.T) {
	tests := []struct {
		name   string
		width  int
		height int
	}{
		{"zero width", 0, 5},
		{"zero height", 80, 0},
		{"negative width", -10, 5},
		{"negative height", 80, -5},
		{"small dimensions", 1, 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			skeleton := NewSkeleton(tt.width, tt.height, StateLoading)
			view := skeleton.View()

			// Should not panic and should return something
			if view == "" {
				t.Error("expected non-empty view even with edge case dimensions")
			}
		})
	}
}

// TestSkeletonListItem_EmptyState tests empty state rendering
func TestSkeletonListItem_EmptyState(t *testing.T) {
	item := NewSkeletonListItem(80, StateEmpty)
	view := item.View()

	if view != "" {
		t.Error("expected empty view for StateEmpty")
	}
}

// TestSkeletonDiff_Patterns tests diff line patterns
func TestSkeletonDiff_Patterns(t *testing.T) {
	diff := NewSkeletonDiff(80, 10)
	view := diff.View()

	lines := strings.Split(view, "\n")

	// Skip header line
	if len(lines) < 2 {
		t.Fatal("expected at least 2 lines")
	}

	// Verify pattern variety
	hasAddition := false
	hasDeletion := false

	for i := 1; i < len(lines); i++ {
		line := lines[i]
		// Look for patterns in the rendered output
		if strings.Contains(line, "+") {
			hasAddition = true
		}
		if strings.Contains(line, "-") {
			hasDeletion = true
		}
	}

	if !hasAddition {
		t.Error("expected at least one addition line pattern")
	}

	if !hasDeletion {
		t.Error("expected at least one deletion line pattern")
	}
}
