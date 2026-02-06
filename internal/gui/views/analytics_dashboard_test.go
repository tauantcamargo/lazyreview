package views

import (
	"context"
	"lazyreview/internal/services"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

func TestNewAnalyticsDashboard(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := services.DefaultAnalyticsConfig()
	config.AutoCleanup = false
	svc, err := services.NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer svc.Close()

	dashboard := NewAnalyticsDashboard(800, 600, svc)

	if dashboard.width != 800 {
		t.Errorf("expected width 800, got %d", dashboard.width)
	}
	if dashboard.height != 600 {
		t.Errorf("expected height 600, got %d", dashboard.height)
	}
	if dashboard.timeRange != TimeRangeWeek {
		t.Errorf("expected default time range week, got %d", dashboard.timeRange)
	}
	if dashboard.analyticsService != svc {
		t.Error("analytics service not set correctly")
	}
}

func TestAnalyticsDashboard_SetSize(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := services.DefaultAnalyticsConfig()
	config.AutoCleanup = false
	svc, err := services.NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer svc.Close()

	dashboard := NewAnalyticsDashboard(100, 100, svc)
	dashboard.SetSize(1024, 768)

	if dashboard.width != 1024 {
		t.Errorf("expected width 1024, got %d", dashboard.width)
	}
	if dashboard.height != 768 {
		t.Errorf("expected height 768, got %d", dashboard.height)
	}
}

func TestAnalyticsDashboard_SetThemeColors(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := services.DefaultAnalyticsConfig()
	config.AutoCleanup = false
	svc, err := services.NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer svc.Close()

	dashboard := NewAnalyticsDashboard(800, 600, svc)
	dashboard.SetThemeColors("81", "239", "170", "245", "238", "236")

	if dashboard.focusedBorder != "81" {
		t.Errorf("expected focusedBorder '81', got '%s'", dashboard.focusedBorder)
	}
	if dashboard.accent != "170" {
		t.Errorf("expected accent '170', got '%s'", dashboard.accent)
	}
}

func TestAnalyticsDashboard_CycleTimeRange(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := services.DefaultAnalyticsConfig()
	config.AutoCleanup = false
	svc, err := services.NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer svc.Close()

	dashboard := NewAnalyticsDashboard(800, 600, svc)

	tests := []struct {
		name     string
		initial  TimeRange
		expected TimeRange
	}{
		{"week to month", TimeRangeWeek, TimeRangeMonth},
		{"month to quarter", TimeRangeMonth, TimeRangeQuarter},
		{"quarter to week", TimeRangeQuarter, TimeRangeWeek},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard.timeRange = tt.initial
			dashboard.CycleTimeRange()
			if dashboard.timeRange != tt.expected {
				t.Errorf("expected time range %d, got %d", tt.expected, dashboard.timeRange)
			}
		})
	}
}

func TestAnalyticsDashboard_Update(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := services.DefaultAnalyticsConfig()
	config.AutoCleanup = false
	svc, err := services.NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer svc.Close()

	dashboard := NewAnalyticsDashboard(800, 600, svc)

	tests := []struct {
		name          string
		msg           tea.Msg
		expectCmd     bool
		checkRange    bool
		expectedRange TimeRange
	}{
		{
			name:          "tab cycles time range",
			msg:           tea.KeyMsg{Type: tea.KeyTab},
			expectCmd:     true,
			checkRange:    true,
			expectedRange: TimeRangeMonth,
		},
		{
			name:      "unknown key does nothing",
			msg:       tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'x'}},
			expectCmd: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard.timeRange = TimeRangeWeek
			updatedDashboard, cmd := dashboard.Update(tt.msg)

			if tt.expectCmd && cmd == nil {
				t.Error("expected command, got nil")
			}
			if !tt.expectCmd && cmd != nil {
				t.Error("expected no command, got command")
			}
			if tt.checkRange && updatedDashboard.timeRange != tt.expectedRange {
				t.Errorf("expected time range %d, got %d", tt.expectedRange, updatedDashboard.timeRange)
			}
		})
	}
}

func TestAnalyticsDashboard_LoadData(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := services.DefaultAnalyticsConfig()
	config.AutoCleanup = false
	svc, err := services.NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer svc.Close()

	ctx := context.Background()
	now := time.Now()

	// Seed test data
	for i := 0; i < 7; i++ {
		date := now.AddDate(0, 0, -i)
		if err := svc.AggregateDaily(ctx, date); err != nil {
			t.Fatalf("failed to seed daily stats: %v", err)
		}
	}

	dashboard := NewAnalyticsDashboard(800, 600, svc)

	cmd := dashboard.LoadData()
	if cmd == nil {
		t.Error("expected command from LoadData, got nil")
	}

	// Execute the command and check the message
	msg := cmd()
	if _, ok := msg.(analyticsDataMsg); !ok {
		t.Errorf("expected analyticsDataMsg, got %T", msg)
	}
}

func TestAnalyticsDashboard_CalculateMetrics(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := services.DefaultAnalyticsConfig()
	config.AutoCleanup = false
	svc, err := services.NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer svc.Close()

	ctx := context.Background()

	// Manually insert daily stats instead of using AggregateDaily
	// This avoids the complex logic in AggregateDaily that requires events table
	for i := 0; i < 7; i++ {
		date := time.Now().AddDate(0, 0, -i)
		dateStr := date.Format("2006-01-02")

		query := `
			INSERT INTO analytics_daily_stats
			(date, reviews_started, reviews_completed, comments_added, prs_merged, avg_review_duration_minutes)
			VALUES (?, ?, ?, ?, ?, ?)
		`
		_, err := db.ExecContext(ctx, query, dateStr, 2, 2, 5, 1, 30.0)
		if err != nil {
			t.Fatalf("failed to insert test data: %v", err)
		}
	}

	dashboard := NewAnalyticsDashboard(800, 600, svc)
	dashboard.timeRange = TimeRangeWeek

	metrics, err := dashboard.calculateMetrics()
	if err != nil {
		t.Fatalf("calculateMetrics failed: %v", err)
	}

	if metrics == nil {
		t.Fatal("expected metrics, got nil")
	}

	// Basic validation
	if metrics.AvgTimeToFirstReview < 0 {
		t.Error("AvgTimeToFirstReview should not be negative")
	}
	if metrics.ReviewIterations < 0 {
		t.Error("ReviewIterations should not be negative")
	}
	if metrics.TotalReviews != 14 { // 2 per day * 7 days
		t.Errorf("expected 14 total reviews, got %d", metrics.TotalReviews)
	}
}

func TestAnalyticsDashboard_View(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := services.DefaultAnalyticsConfig()
	config.AutoCleanup = false
	svc, err := services.NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer svc.Close()

	dashboard := NewAnalyticsDashboard(800, 600, svc)
	dashboard.SetThemeColors("81", "239", "170", "245", "238", "236")

	// View before loading data should show loading state
	view := dashboard.View()
	if view == "" {
		t.Error("expected non-empty view")
	}

	// Load some test data
	ctx := context.Background()
	for i := 0; i < 3; i++ {
		date := time.Now().AddDate(0, 0, -i)
		if err := svc.AggregateDaily(ctx, date); err != nil {
			t.Fatalf("failed to aggregate daily stats: %v", err)
		}
	}

	// Load data and render
	cmd := dashboard.LoadData()
	msg := cmd()
	dashboard, _ = dashboard.Update(msg)

	view = dashboard.View()
	if view == "" {
		t.Error("expected non-empty view after loading data")
	}

	// Check for key elements in the view
	expectedElements := []string{
		"Analytics Dashboard",
		"Week",
		"Average Time to First Review",
		"Average Time to Merge",
		"Review Iterations per PR",
		"Comments per PR",
		"Review Activity Trend",
	}

	for _, element := range expectedElements {
		if !containsString(view, element) {
			t.Errorf("view missing expected element: %s", element)
		}
	}
}

func TestFormatDuration(t *testing.T) {
	tests := []struct {
		name     string
		minutes  float64
		expected string
	}{
		{"zero", 0, "0m"},
		{"minutes only", 45, "45m"},
		{"hours no minutes", 120, "2h"},
		{"hours and minutes", 125, "2h 5m"},
		{"days and hours", 1500, "1d 1h"},
		{"days no hours", 1440, "1d"},
		{"large duration", 10080, "7d"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatDuration(tt.minutes)
			if result != tt.expected {
				t.Errorf("formatDuration(%f) = %s, expected %s", tt.minutes, result, tt.expected)
			}
		})
	}
}

func TestFormatTrend(t *testing.T) {
	tests := []struct {
		name     string
		current  float64
		previous float64
		expected string
	}{
		{"increase", 100, 80, "↑ 25%"},
		{"decrease", 80, 100, "↓ 20%"},
		{"no change", 100, 100, "→ 0%"},
		{"small increase", 100.1, 100, "→ 0%"},
		{"small decrease", 100, 100.1, "→ 0%"},
		{"zero previous", 100, 0, "→ 0%"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatTrend(tt.current, tt.previous)
			if result != tt.expected {
				t.Errorf("formatTrend(%f, %f) = %s, expected %s", tt.current, tt.previous, result, tt.expected)
			}
		})
	}
}

func TestRenderBarChart(t *testing.T) {
	t.Run("normal data", func(t *testing.T) {
		data := []float64{5, 10, 8, 12, 6}
		labels := []string{"Mon", "Tue", "Wed", "Thu", "Fri"}

		chart := renderBarChart(data, labels, 50, 10, "81")

		if chart == "" {
			t.Error("expected non-empty chart")
		}

		// Check for basic chart elements
		for _, label := range labels {
			if !containsString(chart, label) {
				t.Errorf("chart missing label: %s", label)
			}
		}
	})

	t.Run("empty data", func(t *testing.T) {
		chart := renderBarChart([]float64{}, []string{}, 50, 10, "81")
		if chart != "No data" {
			t.Errorf("expected 'No data', got '%s'", chart)
		}
	})

	t.Run("all zeros", func(t *testing.T) {
		data := []float64{0, 0, 0}
		labels := []string{"A", "B", "C"}
		chart := renderBarChart(data, labels, 50, 10, "81")
		if chart != "No activity" {
			t.Errorf("expected 'No activity', got '%s'", chart)
		}
	})
}

func TestTimeRange_String(t *testing.T) {
	tests := []struct {
		name     string
		tr       TimeRange
		expected string
	}{
		{"week", TimeRangeWeek, "Week"},
		{"month", TimeRangeMonth, "Month"},
		{"quarter", TimeRangeQuarter, "Quarter"},
		{"invalid", TimeRange(999), "Week"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.tr.String()
			if result != tt.expected {
				t.Errorf("TimeRange.String() = %s, expected %s", result, tt.expected)
			}
		})
	}
}

func TestTimeRange_Days(t *testing.T) {
	tests := []struct {
		name     string
		tr       TimeRange
		expected int
	}{
		{"week", TimeRangeWeek, 7},
		{"month", TimeRangeMonth, 30},
		{"quarter", TimeRangeQuarter, 90},
		{"invalid", TimeRange(999), 7},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.tr.Days()
			if result != tt.expected {
				t.Errorf("TimeRange.Days() = %d, expected %d", result, tt.expected)
			}
		})
	}
}

func TestAnalyticsDashboard_ErrorState(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := services.DefaultAnalyticsConfig()
	config.AutoCleanup = false
	svc, err := services.NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer svc.Close()

	dashboard := NewAnalyticsDashboard(800, 600, svc)
	dashboard.SetThemeColors("81", "239", "170", "245", "238", "236")
	dashboard.loading = false
	dashboard.err = context.Canceled

	view := dashboard.View()
	if !containsString(view, "Error loading analytics") {
		t.Error("expected error message in view")
	}
}

func TestAnalyticsDashboard_EmptyState(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := services.DefaultAnalyticsConfig()
	config.AutoCleanup = false
	svc, err := services.NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer svc.Close()

	dashboard := NewAnalyticsDashboard(800, 600, svc)
	dashboard.SetThemeColors("81", "239", "170", "245", "238", "236")
	dashboard.loading = false
	dashboard.metrics = nil

	view := dashboard.View()
	if !containsString(view, "No analytics data available") {
		t.Error("expected empty state message in view")
	}
}

// Helper function to check if a string contains a substring
func containsString(s, substr string) bool {
	return contains(s, substr)
}
