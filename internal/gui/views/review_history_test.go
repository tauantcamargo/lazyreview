package views

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"lazyreview/internal/models"
	"lazyreview/internal/services"

	tea "github.com/charmbracelet/bubbletea"
)

func seedTestData(t *testing.T, analyticsService *services.AnalyticsService) {
	t.Helper()

	ctx := context.Background()
	now := time.Now()

	events := []services.ReviewEvent{
		{
			ID:           "evt-1",
			Type:         services.EventReviewApprove,
			ProviderType: "github",
			Host:         "github.com",
			Owner:        "owner1",
			Repo:         "repo1",
			PRNumber:     1,
			Timestamp:    now.Add(-1 * time.Hour),
			Metadata: map[string]interface{}{
				"title": "Add feature A",
			},
		},
		{
			ID:           "evt-2",
			Type:         services.EventReviewRequestChanges,
			ProviderType: "github",
			Host:         "github.com",
			Owner:        "owner1",
			Repo:         "repo1",
			PRNumber:     2,
			Timestamp:    now.Add(-2 * 24 * time.Hour),
			Metadata: map[string]interface{}{
				"title": "Fix bug B",
			},
		},
		{
			ID:           "evt-3",
			Type:         services.EventReviewComment,
			ProviderType: "github",
			Host:         "github.com",
			Owner:        "owner2",
			Repo:         "repo2",
			PRNumber:     3,
			Timestamp:    now.Add(-8 * 24 * time.Hour),
			Metadata: map[string]interface{}{
				"title": "Update documentation",
			},
		},
		{
			ID:           "evt-4",
			Type:         services.EventReviewApprove,
			ProviderType: "github",
			Host:         "github.com",
			Owner:        "owner2",
			Repo:         "repo2",
			PRNumber:     4,
			Timestamp:    now.Add(-40 * 24 * time.Hour),
			Metadata: map[string]interface{}{
				"title": "Refactor module C",
			},
		},
	}

	for _, event := range events {
		if err := analyticsService.TrackEvent(ctx, event); err != nil {
			t.Fatalf("failed to seed event: %v", err)
		}
	}
}

func TestNewReviewHistory(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	if rh.analyticsService == nil {
		t.Error("analytics service should not be nil")
	}

	if rh.currentFilter != FilterAll {
		t.Errorf("expected FilterAll, got %v", rh.currentFilter)
	}

	if rh.currentTime != TimeAll {
		t.Errorf("expected TimeAll, got %v", rh.currentTime)
	}

	if rh.pageSize != 50 {
		t.Errorf("expected pageSize 50, got %d", rh.pageSize)
	}

	if rh.currentPage != 0 {
		t.Errorf("expected currentPage 0, got %d", rh.currentPage)
	}
}

func TestLoadData(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	seedTestData(t, rh.analyticsService)

	ctx := context.Background()
	if err := rh.LoadData(ctx); err != nil {
		t.Fatalf("LoadData failed: %v", err)
	}

	if len(rh.allReviews) == 0 {
		t.Error("expected reviews to be loaded")
	}

	// Should have 4 PRs (one event per PR)
	if len(rh.allReviews) != 4 {
		t.Errorf("expected 4 reviews, got %d", len(rh.allReviews))
	}

	// Verify reviews are sorted by time (newest first)
	for i := 0; i < len(rh.allReviews)-1; i++ {
		if rh.allReviews[i].reviewedAt.Before(rh.allReviews[i+1].reviewedAt) {
			t.Error("reviews should be sorted by newest first")
		}
	}
}

func TestCalculateTimeRange(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	tests := []struct {
		name     string
		filter   TimeFilter
		expected time.Duration
	}{
		{"Last Week", TimeLastWeek, 7 * 24 * time.Hour},
		{"Last Month", TimeLastMonth, 30 * 24 * time.Hour},
		{"Last Quarter", TimeLastQuarter, 90 * 24 * time.Hour},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rh.currentTime = tt.filter
			start, end := rh.calculateTimeRange()

			duration := end.Sub(start)
			expectedDuration := tt.expected

			// Allow 2 day tolerance for month/quarter calculation (due to varying month lengths)
			if duration < expectedDuration-48*time.Hour || duration > expectedDuration+48*time.Hour {
				t.Errorf("expected duration ~%v, got %v", expectedDuration, duration)
			}
		})
	}
}

func TestApplyFilters(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	seedTestData(t, rh.analyticsService)

	ctx := context.Background()
	if err := rh.LoadData(ctx); err != nil {
		t.Fatalf("LoadData failed: %v", err)
	}

	tests := []struct {
		name     string
		filter   ReviewFilter
		expected int
	}{
		{"All", FilterAll, 4},
		{"Approved", FilterApproved, 2},
		{"Changes Requested", FilterChangesRequested, 1},
		{"Commented", FilterCommented, 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rh.currentFilter = tt.filter
			rh.applyFilters()

			if rh.list.ItemCount() != tt.expected {
				t.Errorf("expected %d items, got %d", tt.expected, rh.list.ItemCount())
			}
		})
	}
}

func TestPagination(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	// Create more items than page size
	rh.pageSize = 2
	rh.allReviews = []ReviewHistoryItem{
		{pr: models.PullRequest{Number: 1}, reviewState: models.ReviewStateApproved},
		{pr: models.PullRequest{Number: 2}, reviewState: models.ReviewStateApproved},
		{pr: models.PullRequest{Number: 3}, reviewState: models.ReviewStateApproved},
		{pr: models.PullRequest{Number: 4}, reviewState: models.ReviewStateApproved},
		{pr: models.PullRequest{Number: 5}, reviewState: models.ReviewStateApproved},
	}

	rh.applyFilters()

	if rh.totalPages != 3 {
		t.Errorf("expected 3 pages, got %d", rh.totalPages)
	}

	if rh.list.ItemCount() != 2 {
		t.Errorf("expected 2 items on page 1, got %d", rh.list.ItemCount())
	}

	// Move to next page
	rh.nextPage()
	if rh.currentPage != 1 {
		t.Errorf("expected page 1, got %d", rh.currentPage)
	}

	if rh.list.ItemCount() != 2 {
		t.Errorf("expected 2 items on page 2, got %d", rh.list.ItemCount())
	}

	// Move to last page
	rh.nextPage()
	if rh.currentPage != 2 {
		t.Errorf("expected page 2, got %d", rh.currentPage)
	}

	if rh.list.ItemCount() != 1 {
		t.Errorf("expected 1 item on page 3, got %d", rh.list.ItemCount())
	}

	// Try to go beyond last page
	rh.nextPage()
	if rh.currentPage != 2 {
		t.Errorf("should stay on last page, got %d", rh.currentPage)
	}

	// Go back to previous page
	rh.prevPage()
	if rh.currentPage != 1 {
		t.Errorf("expected page 1, got %d", rh.currentPage)
	}
}

func TestFilterCycling(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	if rh.currentFilter != FilterAll {
		t.Errorf("expected FilterAll, got %v", rh.currentFilter)
	}

	rh.nextFilter()
	if rh.currentFilter != FilterApproved {
		t.Errorf("expected FilterApproved, got %v", rh.currentFilter)
	}

	rh.nextFilter()
	if rh.currentFilter != FilterChangesRequested {
		t.Errorf("expected FilterChangesRequested, got %v", rh.currentFilter)
	}

	rh.nextFilter()
	if rh.currentFilter != FilterCommented {
		t.Errorf("expected FilterCommented, got %v", rh.currentFilter)
	}

	rh.nextFilter()
	if rh.currentFilter != FilterAll {
		t.Errorf("expected FilterAll (wrapped), got %v", rh.currentFilter)
	}

	// Test reverse
	rh.prevFilter()
	if rh.currentFilter != FilterCommented {
		t.Errorf("expected FilterCommented, got %v", rh.currentFilter)
	}
}

func TestTimeFilterCycling(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	if rh.currentTime != TimeAll {
		t.Errorf("expected TimeAll, got %v", rh.currentTime)
	}

	rh.nextTimeFilter()
	if rh.currentTime != TimeLastWeek {
		t.Errorf("expected TimeLastWeek, got %v", rh.currentTime)
	}

	rh.nextTimeFilter()
	if rh.currentTime != TimeLastMonth {
		t.Errorf("expected TimeLastMonth, got %v", rh.currentTime)
	}

	rh.nextTimeFilter()
	if rh.currentTime != TimeLastQuarter {
		t.Errorf("expected TimeLastQuarter, got %v", rh.currentTime)
	}

	rh.nextTimeFilter()
	if rh.currentTime != TimeAll {
		t.Errorf("expected TimeAll (wrapped), got %v", rh.currentTime)
	}
}

func TestUpdate(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	tests := []struct {
		name     string
		key      string
		expected func(*ReviewHistory) bool
	}{
		{
			name: "Tab cycles filter",
			key:  "tab",
			expected: func(r *ReviewHistory) bool {
				return r.currentFilter == FilterApproved
			},
		},
		{
			name: "t cycles time filter",
			key:  "t",
			expected: func(r *ReviewHistory) bool {
				return r.currentTime == TimeLastWeek
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset state
			rh.currentFilter = FilterAll
			rh.currentTime = TimeAll

			msg := tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(tt.key)}
			if tt.key == "tab" {
				msg = tea.KeyMsg{Type: tea.KeyTab}
			}

			_, err := rh.Update(msg)
			if err != nil {
				t.Fatalf("Update failed: %v", err)
			}

			if !tt.expected(rh) {
				t.Errorf("expected condition not met after key %s", tt.key)
			}
		})
	}
}

func TestExportMarkdown(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	// Set up test data
	now := time.Now()
	rh.allReviews = []ReviewHistoryItem{
		{
			pr: models.PullRequest{
				Number: 123,
				Title:  "Test PR",
				Repository: models.Repository{
					Owner: "test-owner",
					Name:  "test-repo",
				},
			},
			reviewState:  models.ReviewStateApproved,
			reviewedAt:   now,
			commentCount: 5,
		},
	}

	tmpDir := t.TempDir()
	filename := filepath.Join(tmpDir, "test-export.md")

	if err := rh.exportMarkdown(filename); err != nil {
		t.Fatalf("exportMarkdown failed: %v", err)
	}

	data, err := os.ReadFile(filename)
	if err != nil {
		t.Fatalf("failed to read exported file: %v", err)
	}

	content := string(data)

	// Verify content
	if !contains(content, "# Review History") {
		t.Error("missing title")
	}

	if !contains(content, "## Approved") {
		t.Error("missing Approved section")
	}

	if !contains(content, "#123 Test PR") {
		t.Error("missing PR title")
	}

	if !contains(content, "test-owner/test-repo") {
		t.Error("missing repository")
	}

	if !contains(content, "**Comments:** 5") {
		t.Error("missing comment count")
	}

	if !contains(content, "## Summary") {
		t.Error("missing summary")
	}

	if !contains(content, "Total Reviews: 1") {
		t.Error("missing total count")
	}
}

func TestExportJSON(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	// Set up test data
	now := time.Now()
	rh.allReviews = []ReviewHistoryItem{
		{
			pr: models.PullRequest{
				Number: 123,
				Title:  "Test PR",
				Repository: models.Repository{
					Owner: "test-owner",
					Name:  "test-repo",
				},
			},
			reviewState:  models.ReviewStateApproved,
			reviewedAt:   now,
			commentCount: 5,
			providerType: "github",
			host:         "github.com",
		},
	}

	tmpDir := t.TempDir()
	filename := filepath.Join(tmpDir, "test-export.json")

	if err := rh.exportJSON(filename); err != nil {
		t.Fatalf("exportJSON failed: %v", err)
	}

	data, err := os.ReadFile(filename)
	if err != nil {
		t.Fatalf("failed to read exported file: %v", err)
	}

	var exported []map[string]interface{}
	if err := json.Unmarshal(data, &exported); err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}

	if len(exported) != 1 {
		t.Errorf("expected 1 item, got %d", len(exported))
	}

	item := exported[0]

	if item["pr_number"] != float64(123) {
		t.Errorf("expected pr_number 123, got %v", item["pr_number"])
	}

	if item["title"] != "Test PR" {
		t.Errorf("expected title 'Test PR', got %v", item["title"])
	}

	if item["repository"] != "test-owner/test-repo" {
		t.Errorf("expected repository 'test-owner/test-repo', got %v", item["repository"])
	}

	if item["review_state"] != "approved" {
		t.Errorf("expected review_state 'approved', got %v", item["review_state"])
	}

	if item["comment_count"] != float64(5) {
		t.Errorf("expected comment_count 5, got %v", item["comment_count"])
	}
}

func TestSelectedPR(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	// No items selected initially
	if pr := rh.SelectedPR(); pr != nil {
		t.Error("expected nil PR when no items")
	}

	// Add items
	rh.allReviews = []ReviewHistoryItem{
		{
			pr: models.PullRequest{Number: 1},
		},
		{
			pr: models.PullRequest{Number: 2},
		},
	}
	rh.applyFilters()

	// Should return first item
	pr := rh.SelectedPR()
	if pr == nil {
		t.Fatal("expected PR to be selected")
	}

	if pr.Number != 1 {
		t.Errorf("expected PR #1, got #%d", pr.Number)
	}
}

func TestReviewHistoryItem_FormatTimeAgo(t *testing.T) {
	item := ReviewHistoryItem{}

	tests := []struct {
		name     string
		time     time.Time
		expected string
	}{
		{"just now", time.Now().Add(-30 * time.Second), "just now"},
		{"minutes ago", time.Now().Add(-5 * time.Minute), "5m ago"},
		{"hours ago", time.Now().Add(-3 * time.Hour), "3h ago"},
		{"1 day ago", time.Now().Add(-25 * time.Hour), "1 day ago"},
		{"days ago", time.Now().Add(-3 * 24 * time.Hour), "3 days ago"},
		{"1 week ago", time.Now().Add(-8 * 24 * time.Hour), "1 week ago"},
		{"weeks ago", time.Now().Add(-3 * 7 * 24 * time.Hour), "3 weeks ago"},
		{"1 month ago", time.Now().Add(-35 * 24 * time.Hour), "1 month ago"},
		{"months ago", time.Now().Add(-3 * 30 * 24 * time.Hour), "3 months ago"},
		{"1 year ago", time.Now().Add(-400 * 24 * time.Hour), "1 year ago"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := item.formatTimeAgo(tt.time)
			if result != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, result)
			}
		})
	}
}

func TestReviewHistoryItem_Title(t *testing.T) {
	tests := []struct {
		name     string
		state    models.ReviewState
		prNumber int
		prTitle  string
		expected string
	}{
		{
			name:     "approved",
			state:    models.ReviewStateApproved,
			prNumber: 123,
			prTitle:  "Test PR",
			expected: "✓ #123 Test PR",
		},
		{
			name:     "changes requested",
			state:    models.ReviewStateChangesRequested,
			prNumber: 456,
			prTitle:  "Fix bug",
			expected: "✗ #456 Fix bug",
		},
		{
			name:     "commented",
			state:    models.ReviewStateCommented,
			prNumber: 789,
			prTitle:  "Update docs",
			expected: "💬 #789 Update docs",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			item := ReviewHistoryItem{
				pr: models.PullRequest{
					Number: tt.prNumber,
					Title:  tt.prTitle,
				},
				reviewState: tt.state,
			}

			result := item.Title()
			if result != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, result)
			}
		})
	}
}

func TestSetSize(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	rh.SetSize(200, 100)

	if rh.width != 200 {
		t.Errorf("expected width 200, got %d", rh.width)
	}

	if rh.height != 100 {
		t.Errorf("expected height 100, got %d", rh.height)
	}
}

func TestSetThemeColors(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	rh.SetThemeColors("focused", "unfocused", "accent", "muted", "selected", "title")

	if rh.focusedBorder != "focused" {
		t.Error("focusedBorder not set")
	}

	if rh.unfocusedBorder != "unfocused" {
		t.Error("unfocusedBorder not set")
	}

	if rh.accent != "accent" {
		t.Error("accent not set")
	}
}

func TestView(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	view := rh.View()

	if view == "" {
		t.Error("view should not be empty")
	}

	// Should contain help text
	if !contains(view, "tab/shift+tab filter") {
		t.Error("view should contain help text")
	}
}

func TestBuildTitle(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	tests := []struct {
		name        string
		filter      ReviewFilter
		timeFilter  TimeFilter
		currentPage int
		totalPages  int
		expected    string
	}{
		{
			name:       "All filters",
			filter:     FilterAll,
			timeFilter: TimeAll,
			expected:   "Review History: All • All Time",
		},
		{
			name:       "Approved filter",
			filter:     FilterApproved,
			timeFilter: TimeLastWeek,
			expected:   "Review History: Approved • Last Week",
		},
		{
			name:        "With pagination",
			filter:      FilterAll,
			timeFilter:  TimeAll,
			currentPage: 1,
			totalPages:  3,
			expected:    "Review History: All • All Time | Page 2/3",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rh.currentFilter = tt.filter
			rh.currentTime = tt.timeFilter
			rh.currentPage = tt.currentPage
			rh.totalPages = tt.totalPages

			title := rh.buildTitle()
			if title != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, title)
			}
		})
	}
}

func TestStatusMethods(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	// Initially empty
	if rh.Status() != "" {
		t.Error("expected empty status initially")
	}

	// Set status
	rh.SetStatus("Loading...")
	if rh.Status() != "Loading..." {
		t.Errorf("expected 'Loading...', got %s", rh.Status())
	}
}

func TestReviewHistoryItem_Description(t *testing.T) {
	item := ReviewHistoryItem{
		pr: models.PullRequest{
			Number: 123,
			Repository: models.Repository{
				Owner: "test-owner",
				Name:  "test-repo",
			},
		},
		reviewedAt:   time.Now().Add(-2 * time.Hour),
		commentCount: 3,
	}

	desc := item.Description()

	if !contains(desc, "test-owner/test-repo") {
		t.Error("description should contain repository")
	}

	if !contains(desc, "ago") {
		t.Error("description should contain time ago")
	}

	if !contains(desc, "3 comments") {
		t.Error("description should contain comment count")
	}
}

func TestReviewHistoryItem_FilterValue(t *testing.T) {
	item := ReviewHistoryItem{
		pr: models.PullRequest{
			Number: 456,
			Title:  "Fix bug",
			Repository: models.Repository{
				Owner: "owner",
				Name:  "repo",
			},
		},
	}

	filterVal := item.FilterValue()

	if !contains(filterVal, "#456") {
		t.Error("filter value should contain PR number")
	}

	if !contains(filterVal, "Fix bug") {
		t.Error("filter value should contain title")
	}

	if !contains(filterVal, "owner/repo") {
		t.Error("filter value should contain repository")
	}
}

func TestPrevTimeFilter(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	rh.currentTime = TimeLastWeek
	rh.prevTimeFilter()

	if rh.currentTime != TimeAll {
		t.Errorf("expected TimeAll, got %v", rh.currentTime)
	}
}

func TestRenderFilterChips(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	rh.SetThemeColors("focused", "unfocused", "170", "240", "selected", "title")

	chips := rh.renderFilterChips()

	if chips == "" {
		t.Error("filter chips should not be empty")
	}

	// Should contain filter labels
	expectedLabels := []string{"All", "Approved", "Changes Requested", "Commented", "All Time", "Last Week", "Last Month", "Last Quarter"}
	for _, label := range expectedLabels {
		if !contains(chips, label) {
			t.Errorf("chips should contain label: %s", label)
		}
	}
}

func TestRenderHelp(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	help := rh.renderHelp()

	if !contains(help, "tab/shift+tab filter") {
		t.Error("help should contain filter keybinding")
	}

	if !contains(help, "t/T time") {
		t.Error("help should contain time keybinding")
	}

	if !contains(help, "e export") {
		t.Error("help should contain export keybinding")
	}

	if !contains(help, "n/p page") {
		t.Error("help should contain page keybinding")
	}
}

func TestClose(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}

	if err := rh.Close(); err != nil {
		t.Errorf("Close failed: %v", err)
	}
}

func TestUpdateMessages(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	rh, err := NewReviewHistory(db, 100, 50)
	if err != nil {
		t.Fatalf("NewReviewHistory failed: %v", err)
	}
	defer rh.Close()

	// Test window size message
	msg := tea.WindowSizeMsg{Width: 200, Height: 100}
	_, err = rh.Update(msg)
	if err != nil {
		t.Errorf("Update with WindowSizeMsg failed: %v", err)
	}

	// Test next page key - need enough items for pagination
	rh.pageSize = 2
	rh.allReviews = make([]ReviewHistoryItem, 0, 10)
	for i := 0; i < 10; i++ {
		rh.allReviews = append(rh.allReviews, ReviewHistoryItem{
			pr:          models.PullRequest{Number: i + 1},
			reviewState: models.ReviewStateApproved,
		})
	}
	rh.applyFilters()

	// Should start at page 0
	if rh.currentPage != 0 {
		t.Errorf("expected page 0 initially, got %d", rh.currentPage)
	}

	// Move to next page
	msg2 := tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'n'}}
	_, err = rh.Update(msg2)
	if err != nil {
		t.Errorf("Update with next page key failed: %v", err)
	}

	if rh.currentPage != 1 {
		t.Errorf("expected page 1, got %d", rh.currentPage)
	}

	// Test prev page key
	msg3 := tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'p'}}
	_, err = rh.Update(msg3)
	if err != nil {
		t.Errorf("Update with prev page key failed: %v", err)
	}

	if rh.currentPage != 0 {
		t.Errorf("expected page 0, got %d", rh.currentPage)
	}
}
