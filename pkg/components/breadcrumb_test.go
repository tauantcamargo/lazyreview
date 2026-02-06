package components

import (
	"strings"
	"testing"
)

func TestNewBreadcrumb(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(80, styles)

	if bc == nil {
		t.Fatal("NewBreadcrumb returned nil")
	}

	if bc.maxWidth != 80 {
		t.Errorf("Expected maxWidth 80, got %d", bc.maxWidth)
	}

	if bc.separator != " > " {
		t.Errorf("Expected separator ' > ', got %q", bc.separator)
	}

	if len(bc.segments) != 0 {
		t.Errorf("Expected empty segments, got %d", len(bc.segments))
	}

	if bc.currentIdx != -1 {
		t.Errorf("Expected currentIdx -1, got %d", bc.currentIdx)
	}
}

func TestAddSegment(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(80, styles)

	// Add first segment
	bc.AddSegment("Home", false, true)

	if len(bc.segments) != 1 {
		t.Fatalf("Expected 1 segment, got %d", len(bc.segments))
	}

	if bc.segments[0].Label != "Home" {
		t.Errorf("Expected label 'Home', got %q", bc.segments[0].Label)
	}

	if bc.segments[0].Level != 0 {
		t.Errorf("Expected level 0, got %d", bc.segments[0].Level)
	}

	// Add current segment
	bc.AddSegment("Current", true, false)

	if len(bc.segments) != 2 {
		t.Fatalf("Expected 2 segments, got %d", len(bc.segments))
	}

	if bc.currentIdx != 1 {
		t.Errorf("Expected currentIdx 1, got %d", bc.currentIdx)
	}

	if bc.segments[0].IsCurrent {
		t.Error("First segment should not be current")
	}

	if !bc.segments[1].IsCurrent {
		t.Error("Second segment should be current")
	}
}

func TestSetSegments(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(80, styles)

	segments := []BreadcrumbSegment{
		{Label: "Home", IsCurrent: false, Clickable: true, Level: 0},
		{Label: "Repos", IsCurrent: false, Clickable: true, Level: 1},
		{Label: "PR #123", IsCurrent: true, Clickable: true, Level: 2},
	}

	bc.SetSegments(segments)

	if len(bc.segments) != 3 {
		t.Fatalf("Expected 3 segments, got %d", len(bc.segments))
	}

	if bc.currentIdx != 2 {
		t.Errorf("Expected currentIdx 2, got %d", bc.currentIdx)
	}

	if bc.segments[2].Label != "PR #123" {
		t.Errorf("Expected label 'PR #123', got %q", bc.segments[2].Label)
	}
}

func TestPopSegment(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(80, styles)

	bc.AddSegment("Home", false, true)
	bc.AddSegment("Repos", false, true)
	bc.AddSegment("PR #123", true, true)

	if len(bc.segments) != 3 {
		t.Fatalf("Expected 3 segments, got %d", len(bc.segments))
	}

	bc.PopSegment()

	if len(bc.segments) != 2 {
		t.Errorf("Expected 2 segments after pop, got %d", len(bc.segments))
	}

	if bc.currentIdx != 1 {
		t.Errorf("Expected currentIdx 1, got %d", bc.currentIdx)
	}

	if !bc.segments[1].IsCurrent {
		t.Error("Last segment should be current after pop")
	}

	// Pop until empty
	bc.PopSegment()
	bc.PopSegment()

	if len(bc.segments) != 0 {
		t.Errorf("Expected 0 segments, got %d", len(bc.segments))
	}

	if bc.currentIdx != -1 {
		t.Errorf("Expected currentIdx -1, got %d", bc.currentIdx)
	}

	// Pop from empty should not panic
	bc.PopSegment()

	if len(bc.segments) != 0 {
		t.Error("Pop on empty breadcrumb should have no effect")
	}
}

func TestGetLevel(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(80, styles)

	// Empty breadcrumb
	if level := bc.GetLevel(); level != -1 {
		t.Errorf("Expected -1 for empty breadcrumb, got %d", level)
	}

	// Single segment
	bc.AddSegment("Home", true, true)
	if level := bc.GetLevel(); level != -1 {
		t.Errorf("Expected -1 for single segment, got %d", level)
	}

	// Multiple segments
	bc.AddSegment("Repos", false, true)
	bc.AddSegment("PR #123", true, true)

	if level := bc.GetLevel(); level != 1 {
		t.Errorf("Expected level 1, got %d", level)
	}
}

func TestRenderSimple(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(100, styles)

	bc.AddSegment("Home", false, true)
	bc.AddSegment("Repos", true, true)

	rendered := bc.Render()

	// Should contain both labels and separator
	plainText := stripANSI(rendered)

	if !strings.Contains(plainText, "Home") {
		t.Error("Rendered output should contain 'Home'")
	}

	if !strings.Contains(plainText, "Repos") {
		t.Error("Rendered output should contain 'Repos'")
	}

	if !strings.Contains(plainText, ">") {
		t.Error("Rendered output should contain separator '>'")
	}
}

func TestRenderEmpty(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(100, styles)

	rendered := bc.Render()

	if rendered != "" {
		t.Errorf("Expected empty string for empty breadcrumb, got %q", rendered)
	}
}

func TestRenderAbbreviation(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(40, styles) // Narrow width to force abbreviation

	bc.AddSegment("Dashboard", false, true)
	bc.AddSegment("golang/go", false, true)
	bc.AddSegment("PR #12345: Add new feature", false, true)
	bc.AddSegment("Files", false, true)
	bc.AddSegment("src/runtime/proc.go", true, false)

	rendered := bc.Render()
	plainText := stripANSI(rendered)

	// Should contain ellipsis for abbreviation
	if !strings.Contains(plainText, "...") {
		t.Error("Long breadcrumb should be abbreviated with '...'")
	}

	// Should still contain first segment
	if !strings.Contains(plainText, "Dashboard") {
		t.Error("Abbreviated breadcrumb should contain first segment")
	}

	// Should contain some part of the file name (at least the extension or part of name)
	if !strings.Contains(plainText, "proc") && !strings.Contains(plainText, ".go") && !strings.Contains(plainText, "runtime") {
		t.Errorf("Abbreviated breadcrumb should contain part of current segment, got: %q", plainText)
	}
}

func TestBreadcrumbClear(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(80, styles)

	bc.AddSegment("Home", false, true)
	bc.AddSegment("Repos", true, true)

	bc.Clear()

	if len(bc.segments) != 0 {
		t.Errorf("Expected 0 segments after clear, got %d", len(bc.segments))
	}

	if bc.currentIdx != -1 {
		t.Errorf("Expected currentIdx -1 after clear, got %d", bc.currentIdx)
	}
}

func TestDepth(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(80, styles)

	if bc.Depth() != 0 {
		t.Errorf("Expected depth 0 for empty breadcrumb, got %d", bc.Depth())
	}

	bc.AddSegment("Home", false, true)
	if bc.Depth() != 1 {
		t.Errorf("Expected depth 1, got %d", bc.Depth())
	}

	bc.AddSegment("Repos", true, true)
	if bc.Depth() != 2 {
		t.Errorf("Expected depth 2, got %d", bc.Depth())
	}
}

func TestCurrentLevel(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(80, styles)

	if bc.CurrentLevel() != -1 {
		t.Errorf("Expected currentLevel -1 for empty breadcrumb, got %d", bc.CurrentLevel())
	}

	bc.AddSegment("Home", false, true)
	bc.AddSegment("Repos", true, true)

	if bc.CurrentLevel() != 1 {
		t.Errorf("Expected currentLevel 1, got %d", bc.CurrentLevel())
	}
}

func TestSetMaxWidth(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(80, styles)

	bc.SetMaxWidth(120)

	if bc.maxWidth != 120 {
		t.Errorf("Expected maxWidth 120, got %d", bc.maxWidth)
	}
}

func TestBuildBreadcrumbPath_ViewOnly(t *testing.T) {
	segments := BuildBreadcrumbPath("my_prs", "", "", 0, "", "", "")

	if len(segments) != 1 {
		t.Fatalf("Expected 1 segment, got %d", len(segments))
	}

	if segments[0].Label != "My PRs" {
		t.Errorf("Expected 'My PRs', got %q", segments[0].Label)
	}

	if !segments[0].IsCurrent {
		t.Error("View segment should be current when only segment")
	}
}

func TestBuildBreadcrumbPath_WithRepo(t *testing.T) {
	segments := BuildBreadcrumbPath("current_repo", "golang", "go", 0, "", "", "")

	if len(segments) != 2 {
		t.Fatalf("Expected 2 segments, got %d", len(segments))
	}

	if segments[0].Label != "Current Repo" {
		t.Errorf("Expected 'Current Repo', got %q", segments[0].Label)
	}

	if segments[1].Label != "golang/go" {
		t.Errorf("Expected 'golang/go', got %q", segments[1].Label)
	}

	if !segments[1].IsCurrent {
		t.Error("Repo segment should be current when no PR selected")
	}
}

func TestBuildBreadcrumbPath_WithPR(t *testing.T) {
	segments := BuildBreadcrumbPath("review_requests", "golang", "go", 12345, "Add new feature", "", "")

	if len(segments) < 3 {
		t.Fatalf("Expected at least 3 segments, got %d", len(segments))
	}

	// Find PR segment
	var prSegment *BreadcrumbSegment
	for i := range segments {
		if strings.Contains(segments[i].Label, "PR #") {
			prSegment = &segments[i]
			break
		}
	}

	if prSegment == nil {
		t.Fatal("Expected PR segment in breadcrumb")
	}

	if !strings.Contains(prSegment.Label, "12345") {
		t.Errorf("PR segment should contain number: %q", prSegment.Label)
	}

	if !strings.Contains(prSegment.Label, "Add new feature") {
		t.Errorf("PR segment should contain title: %q", prSegment.Label)
	}

	if !prSegment.IsCurrent {
		t.Error("PR segment should be current when no file selected")
	}
}

func TestBuildBreadcrumbPath_WithDetailMode(t *testing.T) {
	segments := BuildBreadcrumbPath("my_prs", "golang", "go", 12345, "Fix bug", "Files", "")

	// Should have: View > Repo > PR > Files
	if len(segments) != 4 {
		t.Fatalf("Expected 4 segments, got %d", len(segments))
	}

	if segments[3].Label != "Files" {
		t.Errorf("Expected 'Files', got %q", segments[3].Label)
	}

	if !segments[3].IsCurrent {
		t.Error("Detail mode segment should be current when no file selected")
	}
}

func TestBuildBreadcrumbPath_WithFile(t *testing.T) {
	segments := BuildBreadcrumbPath("my_prs", "golang", "go", 12345, "Fix bug", "Files", "src/runtime/proc.go")

	// Should have: View > Repo > PR > Files > File
	if len(segments) != 5 {
		t.Fatalf("Expected 5 segments, got %d", len(segments))
	}

	if !strings.Contains(segments[4].Label, "proc.go") {
		t.Errorf("Expected file name, got %q", segments[4].Label)
	}

	if !segments[4].IsCurrent {
		t.Error("File segment should be current")
	}

	if segments[4].Clickable {
		t.Error("File segment should not be clickable")
	}
}

func TestBuildBreadcrumbPath_LongFileName(t *testing.T) {
	longPath := "very/long/path/to/some/deeply/nested/directory/structure/file.go"
	segments := BuildBreadcrumbPath("my_prs", "golang", "go", 123, "Title", "Files", longPath)

	// Find file segment
	fileSegment := segments[len(segments)-1]

	// Should be shortened with ellipsis
	if !strings.Contains(fileSegment.Label, "...") {
		t.Error("Long file path should be abbreviated")
	}

	// Should still contain the file name
	if !strings.Contains(fileSegment.Label, "file.go") {
		t.Errorf("Abbreviated path should contain file name: %q", fileSegment.Label)
	}
}

func TestBuildBreadcrumbPath_LongPRTitle(t *testing.T) {
	longTitle := "This is a very long PR title that should be truncated to fit in the breadcrumb"
	segments := BuildBreadcrumbPath("my_prs", "golang", "go", 123, longTitle, "", "")

	// Find PR segment
	var prSegment *BreadcrumbSegment
	for i := range segments {
		if strings.Contains(segments[i].Label, "PR #") {
			prSegment = &segments[i]
			break
		}
	}

	if prSegment == nil {
		t.Fatal("Expected PR segment")
	}

	// Should be truncated
	if !strings.Contains(prSegment.Label, "...") {
		t.Error("Long PR title should be truncated")
	}

	// Should not exceed reasonable length
	if len(prSegment.Label) > 50 {
		t.Errorf("Truncated PR title too long: %d chars", len(prSegment.Label))
	}
}

func TestFormatViewMode(t *testing.T) {
	tests := []struct {
		mode     string
		expected string
	}{
		{"my_prs", "My PRs"},
		{"review_requests", "Review Requests"},
		{"assigned_to_me", "Assigned to Me"},
		{"current_repo", "Current Repo"},
		{"workspaces", "Workspaces"},
		{"workspace", "Workspace"},
		{"dashboard", "Dashboard"},
		{"repo_selector", "Repos"},
		{"unknown", "LazyReview"},
	}

	for _, tt := range tests {
		t.Run(tt.mode, func(t *testing.T) {
			result := formatViewMode(tt.mode)
			if result != tt.expected {
				t.Errorf("Expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestDefaultBreadcrumbStyles(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")

	// Verify styles are initialized by rendering a test string
	if styles.CurrentSegment.Render("test") == "" {
		t.Error("CurrentSegment style should be initialized")
	}

	if styles.ClickableSegment.Render("test") == "" {
		t.Error("ClickableSegment style should be initialized")
	}

	if styles.Separator.Render("test") == "" {
		t.Error("Separator style should be initialized")
	}
}

func TestDefaultBreadcrumbStyles_DefaultColors(t *testing.T) {
	styles := DefaultBreadcrumbStyles("", "")

	// Should use default colors when empty strings provided
	// This test just ensures no panic occurs
	if styles.CurrentSegment.Render("test") == "" {
		t.Error("Should provide default styles even with empty color strings")
	}
}

func TestRenderSegments(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(80, styles)

	segments := []BreadcrumbSegment{
		{Label: "Home", IsCurrent: false, Clickable: true, Level: 0},
		{Label: "Current", IsCurrent: true, Clickable: false, Level: 1},
	}

	rendered := bc.renderSegments(segments)
	plainText := stripANSI(rendered)

	if !strings.Contains(plainText, "Home") {
		t.Error("Should contain 'Home'")
	}

	if !strings.Contains(plainText, "Current") {
		t.Error("Should contain 'Current'")
	}

	if !strings.Contains(plainText, ">") {
		t.Error("Should contain separator")
	}
}

func TestTruncateSegments(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(20, styles) // Very narrow width

	segments := []BreadcrumbSegment{
		{Label: "VeryLongFirstSegment", IsCurrent: false, Clickable: true, Level: 0},
		{Label: "VeryLongSecondSegment", IsCurrent: true, Clickable: false, Level: 1},
	}

	rendered := bc.truncateSegments(segments)
	plainText := stripANSI(rendered)

	// Should contain truncation markers
	if !strings.Contains(plainText, "...") {
		t.Error("Truncated segments should contain '...'")
	}

	// Total length should fit within maxWidth (with some tolerance for ANSI codes)
	if len(plainText) > 30 {
		t.Errorf("Truncated output too long: %d chars", len(plainText))
	}
}

func TestGetSegments(t *testing.T) {
	styles := DefaultBreadcrumbStyles("170", "240")
	bc := NewBreadcrumb(80, styles)

	bc.AddSegment("Home", false, true)
	bc.AddSegment("Current", true, false)

	segments := bc.GetSegments()

	if len(segments) != 2 {
		t.Fatalf("Expected 2 segments, got %d", len(segments))
	}

	if segments[0].Label != "Home" {
		t.Errorf("Expected first segment 'Home', got %q", segments[0].Label)
	}

	if segments[1].Label != "Current" {
		t.Errorf("Expected second segment 'Current', got %q", segments[1].Label)
	}
}

// Helper function to strip ANSI escape codes for plain text comparison
func stripANSI(s string) string {
	// Simple ANSI stripper for testing purposes
	// In production, use lipgloss.Width() for accurate width calculation
	inEscape := false
	result := strings.Builder{}

	for _, r := range s {
		if r == '\x1b' {
			inEscape = true
			continue
		}
		if inEscape {
			if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
				inEscape = false
			}
			continue
		}
		result.WriteRune(r)
	}

	return result.String()
}
