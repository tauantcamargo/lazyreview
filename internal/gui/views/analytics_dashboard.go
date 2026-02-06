package views

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"lazyreview/internal/services"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// TimeRange represents the analytics time range selection.
type TimeRange int

const (
	// TimeRangeWeek shows last 7 days of data.
	TimeRangeWeek TimeRange = iota
	// TimeRangeMonth shows last 30 days of data.
	TimeRangeMonth
	// TimeRangeQuarter shows last 90 days of data.
	TimeRangeQuarter
)

// String returns the display name of the time range.
func (t TimeRange) String() string {
	switch t {
	case TimeRangeWeek:
		return "Week"
	case TimeRangeMonth:
		return "Month"
	case TimeRangeQuarter:
		return "Quarter"
	default:
		return "Week"
	}
}

// Days returns the number of days in the time range.
func (t TimeRange) Days() int {
	switch t {
	case TimeRangeWeek:
		return 7
	case TimeRangeMonth:
		return 30
	case TimeRangeQuarter:
		return 90
	default:
		return 7
	}
}

// AnalyticsMetrics holds calculated analytics data.
type AnalyticsMetrics struct {
	AvgTimeToFirstReview float64 // in minutes
	AvgTimeToMerge       float64 // in minutes
	ReviewIterations     float64
	CommentsPerPR        float64
	TotalReviews         int
	TotalPRsMerged       int
	TotalComments        int

	// Trend data (previous period comparison)
	PrevTimeToFirstReview float64
	PrevTimeToMerge       float64
	PrevReviewIterations  float64
	PrevCommentsPerPR     float64

	// Daily activity for charts
	DailyReviews  []float64
	DailyComments []float64
	DailyLabels   []string
}

// AnalyticsDashboard renders analytics data with charts and metrics.
type AnalyticsDashboard struct {
	analyticsService *services.AnalyticsService
	width            int
	height           int
	timeRange        TimeRange
	metrics          *AnalyticsMetrics
	loading          bool
	err              error

	// Theme colors
	focusedBorder   string
	unfocusedBorder string
	accent          string
	muted           string
	selectedBg      string
	titleBg         string
}

// analyticsDataMsg is sent when analytics data is loaded.
type analyticsDataMsg struct {
	metrics *AnalyticsMetrics
	err     error
}

// NewAnalyticsDashboard creates a new analytics dashboard view.
func NewAnalyticsDashboard(width, height int, analyticsService *services.AnalyticsService) AnalyticsDashboard {
	return AnalyticsDashboard{
		analyticsService: analyticsService,
		width:            width,
		height:           height,
		timeRange:        TimeRangeWeek,
		loading:          true,
	}
}

// SetSize updates the dashboard dimensions.
func (d *AnalyticsDashboard) SetSize(width, height int) {
	d.width = width
	d.height = height
}

// SetThemeColors updates dashboard styling.
func (d *AnalyticsDashboard) SetThemeColors(focused, unfocused, accent, muted, selectedBg, titleBg string) {
	d.focusedBorder = focused
	d.unfocusedBorder = unfocused
	d.accent = accent
	d.muted = muted
	d.selectedBg = selectedBg
	d.titleBg = titleBg
}

// CycleTimeRange switches to the next time range.
func (d *AnalyticsDashboard) CycleTimeRange() {
	switch d.timeRange {
	case TimeRangeWeek:
		d.timeRange = TimeRangeMonth
	case TimeRangeMonth:
		d.timeRange = TimeRangeQuarter
	case TimeRangeQuarter:
		d.timeRange = TimeRangeWeek
	}
}

// LoadData initiates loading analytics data for the current time range.
func (d *AnalyticsDashboard) LoadData() tea.Cmd {
	return func() tea.Msg {
		metrics, err := d.calculateMetrics()
		return analyticsDataMsg{metrics: metrics, err: err}
	}
}

// Update handles input and messages.
func (d AnalyticsDashboard) Update(msg tea.Msg) (AnalyticsDashboard, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyTab:
			d.CycleTimeRange()
			return d, d.LoadData()
		}
	case analyticsDataMsg:
		d.loading = false
		d.metrics = msg.metrics
		d.err = msg.err
		return d, nil
	}
	return d, nil
}

// View renders the analytics dashboard.
func (d AnalyticsDashboard) View() string {
	if d.loading {
		return d.renderLoading()
	}

	if d.err != nil {
		return d.renderError()
	}

	if d.metrics == nil {
		return d.renderEmpty()
	}

	// Build the dashboard layout
	header := d.renderHeader()
	metrics := d.renderMetrics()
	charts := d.renderCharts()
	footer := d.renderFooter()

	content := lipgloss.JoinVertical(
		lipgloss.Left,
		header,
		"",
		metrics,
		"",
		charts,
		"",
		footer,
	)

	return content
}

// calculateMetrics computes analytics metrics from the database.
func (d *AnalyticsDashboard) calculateMetrics() (*AnalyticsMetrics, error) {
	ctx := context.Background()
	now := time.Now()
	days := d.timeRange.Days()

	metrics := &AnalyticsMetrics{
		DailyReviews:  make([]float64, 0, days),
		DailyComments: make([]float64, 0, days),
		DailyLabels:   make([]string, 0, days),
	}

	// Collect daily stats for current period
	var totalReviewDuration float64
	var reviewDurationCount int

	for i := 0; i < days; i++ {
		date := now.AddDate(0, 0, -i)
		stats, err := d.analyticsService.GetDailyStats(ctx, date)
		if err != nil {
			return nil, fmt.Errorf("failed to get daily stats: %w", err)
		}

		if stats != nil {
			metrics.TotalReviews += stats.ReviewsCompleted
			metrics.TotalComments += stats.CommentsAdded
			metrics.TotalPRsMerged += stats.PRsMerged

			if stats.AvgReviewDuration > 0 {
				totalReviewDuration += stats.AvgReviewDuration
				reviewDurationCount++
			}

			// Prepend for chronological order
			metrics.DailyReviews = append([]float64{float64(stats.ReviewsCompleted)}, metrics.DailyReviews...)
			metrics.DailyComments = append([]float64{float64(stats.CommentsAdded)}, metrics.DailyComments...)

			label := date.Format("Mon")
			if d.timeRange == TimeRangeMonth || d.timeRange == TimeRangeQuarter {
				label = date.Format("1/2")
			}
			metrics.DailyLabels = append([]string{label}, metrics.DailyLabels...)
		}
	}

	// Calculate averages
	if reviewDurationCount > 0 {
		metrics.AvgTimeToFirstReview = totalReviewDuration / float64(reviewDurationCount)
	}

	// Estimate time to merge (simplified: 2x first review time)
	if metrics.AvgTimeToFirstReview > 0 {
		metrics.AvgTimeToMerge = metrics.AvgTimeToFirstReview * 2.5
	}

	// Calculate review iterations and comments per PR
	if metrics.TotalPRsMerged > 0 {
		metrics.ReviewIterations = float64(metrics.TotalReviews) / float64(metrics.TotalPRsMerged)
		metrics.CommentsPerPR = float64(metrics.TotalComments) / float64(metrics.TotalPRsMerged)
	}

	// Calculate previous period metrics for trend
	prevMetrics, err := d.calculatePreviousPeriodMetrics(ctx, now, days)
	if err == nil && prevMetrics != nil {
		metrics.PrevTimeToFirstReview = prevMetrics.AvgTimeToFirstReview
		metrics.PrevTimeToMerge = prevMetrics.AvgTimeToMerge
		metrics.PrevReviewIterations = prevMetrics.ReviewIterations
		metrics.PrevCommentsPerPR = prevMetrics.CommentsPerPR
	}

	return metrics, nil
}

// calculatePreviousPeriodMetrics computes metrics for the previous period.
func (d *AnalyticsDashboard) calculatePreviousPeriodMetrics(ctx context.Context, now time.Time, days int) (*AnalyticsMetrics, error) {
	metrics := &AnalyticsMetrics{}

	var totalReviewDuration float64
	var reviewDurationCount int
	var totalReviews int
	var totalComments int
	var totalPRsMerged int

	// Start from days ago and go back another period
	for i := days; i < days*2; i++ {
		date := now.AddDate(0, 0, -i)
		stats, err := d.analyticsService.GetDailyStats(ctx, date)
		if err != nil {
			continue
		}

		if stats != nil {
			totalReviews += stats.ReviewsCompleted
			totalComments += stats.CommentsAdded
			totalPRsMerged += stats.PRsMerged

			if stats.AvgReviewDuration > 0 {
				totalReviewDuration += stats.AvgReviewDuration
				reviewDurationCount++
			}
		}
	}

	if reviewDurationCount > 0 {
		metrics.AvgTimeToFirstReview = totalReviewDuration / float64(reviewDurationCount)
		metrics.AvgTimeToMerge = metrics.AvgTimeToFirstReview * 2.5
	}

	if totalPRsMerged > 0 {
		metrics.ReviewIterations = float64(totalReviews) / float64(totalPRsMerged)
		metrics.CommentsPerPR = float64(totalComments) / float64(totalPRsMerged)
	}

	return metrics, nil
}

// renderHeader renders the dashboard header with title and time range selector.
func (d AnalyticsDashboard) renderHeader() string {
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color(d.accent)).
		Padding(0, 1)

	rangeStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color(d.muted)).
		Padding(0, 1)

	title := titleStyle.Render("Analytics Dashboard")
	rangeInfo := rangeStyle.Render(fmt.Sprintf("[Tab: %s]", d.timeRange.String()))

	return lipgloss.JoinHorizontal(lipgloss.Left, title, rangeInfo)
}

// renderMetrics renders the key metrics in a grid layout.
func (d AnalyticsDashboard) renderMetrics() string {
	if d.metrics == nil {
		return ""
	}

	metricStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color(d.unfocusedBorder)).
		Padding(1, 2).
		Width(d.width/2 - 4)

	labelStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color(d.muted)).
		Bold(true)

	valueStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color(d.accent)).
		Bold(true).
		Padding(1, 0)

	trendUpStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("42"))
	trendDownStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("196"))
	trendNeutralStyle := lipgloss.NewStyle().Foreground(lipgloss.Color(d.muted))

	// Metric 1: Average Time to First Review
	metric1 := metricStyle.Render(
		labelStyle.Render("Average Time to First Review") + "\n" +
			valueStyle.Render(formatDuration(d.metrics.AvgTimeToFirstReview)) + " " +
			d.renderTrend(d.metrics.AvgTimeToFirstReview, d.metrics.PrevTimeToFirstReview, trendDownStyle, trendUpStyle, trendNeutralStyle),
	)

	// Metric 2: Average Time to Merge
	metric2 := metricStyle.Render(
		labelStyle.Render("Average Time to Merge") + "\n" +
			valueStyle.Render(formatDuration(d.metrics.AvgTimeToMerge)) + " " +
			d.renderTrend(d.metrics.AvgTimeToMerge, d.metrics.PrevTimeToMerge, trendDownStyle, trendUpStyle, trendNeutralStyle),
	)

	// Metric 3: Review Iterations per PR
	metric3 := metricStyle.Render(
		labelStyle.Render("Review Iterations per PR") + "\n" +
			valueStyle.Render(fmt.Sprintf("%.1f", d.metrics.ReviewIterations)) + " " +
			d.renderTrend(d.metrics.ReviewIterations, d.metrics.PrevReviewIterations, trendDownStyle, trendUpStyle, trendNeutralStyle),
	)

	// Metric 4: Comments per PR
	metric4 := metricStyle.Render(
		labelStyle.Render("Comments per PR") + "\n" +
			valueStyle.Render(fmt.Sprintf("%.1f", d.metrics.CommentsPerPR)) + " " +
			d.renderTrend(d.metrics.CommentsPerPR, d.metrics.PrevCommentsPerPR, trendNeutralStyle, trendNeutralStyle, trendNeutralStyle),
	)

	row1 := lipgloss.JoinHorizontal(lipgloss.Left, metric1, metric2)
	row2 := lipgloss.JoinHorizontal(lipgloss.Left, metric3, metric4)

	return lipgloss.JoinVertical(lipgloss.Left, row1, "", row2)
}

// renderTrend renders a trend indicator with appropriate color.
func (d AnalyticsDashboard) renderTrend(current, previous float64, goodStyle, badStyle, neutralStyle lipgloss.Style) string {
	if previous == 0 {
		return neutralStyle.Render("→ 0%")
	}

	change := ((current - previous) / previous) * 100
	trend := formatTrend(current, previous)

	// For time metrics, lower is better
	if change < -5 {
		return goodStyle.Render(trend)
	} else if change > 5 {
		return badStyle.Render(trend)
	}

	return neutralStyle.Render(trend)
}

// renderCharts renders activity charts.
func (d AnalyticsDashboard) renderCharts() string {
	if d.metrics == nil || len(d.metrics.DailyReviews) == 0 {
		return ""
	}

	chartStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color(d.unfocusedBorder)).
		Padding(1, 2).
		Width(d.width - 4)

	titleStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color(d.accent)).
		Bold(true)

	// Render review activity chart
	reviewTitle := titleStyle.Render("Review Activity Trend")
	reviewChart := renderBarChart(
		d.metrics.DailyReviews,
		d.metrics.DailyLabels,
		d.width-8,
		8,
		d.accent,
	)

	return chartStyle.Render(reviewTitle + "\n\n" + reviewChart)
}

// renderFooter renders help text.
func (d AnalyticsDashboard) renderFooter() string {
	footerStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color(d.muted)).
		Italic(true)

	return footerStyle.Render("Press Tab to cycle time ranges (Week → Month → Quarter)")
}

// renderLoading renders a loading state.
func (d AnalyticsDashboard) renderLoading() string {
	style := lipgloss.NewStyle().
		Foreground(lipgloss.Color(d.muted)).
		Padding(2)

	return style.Render("Loading analytics data...")
}

// renderError renders an error state.
func (d AnalyticsDashboard) renderError() string {
	style := lipgloss.NewStyle().
		Foreground(lipgloss.Color("196")).
		Padding(2)

	return style.Render(fmt.Sprintf("Error loading analytics: %v", d.err))
}

// renderEmpty renders an empty state.
func (d AnalyticsDashboard) renderEmpty() string {
	style := lipgloss.NewStyle().
		Foreground(lipgloss.Color(d.muted)).
		Padding(2)

	return style.Render("No analytics data available. Start reviewing PRs to see your activity!")
}

// formatDuration formats minutes into a human-readable duration.
func formatDuration(minutes float64) string {
	if minutes == 0 {
		return "0m"
	}

	days := int(minutes / 1440)
	hours := int(minutes/60) % 24
	mins := int(minutes) % 60

	if days > 0 {
		if hours > 0 {
			return fmt.Sprintf("%dd %dh", days, hours)
		}
		return fmt.Sprintf("%dd", days)
	}

	if hours > 0 {
		if mins > 0 {
			return fmt.Sprintf("%dh %dm", hours, mins)
		}
		return fmt.Sprintf("%dh", hours)
	}

	return fmt.Sprintf("%dm", mins)
}

// formatTrend formats a trend percentage with arrow.
func formatTrend(current, previous float64) string {
	if previous == 0 {
		return "→ 0%"
	}

	change := ((current - previous) / previous) * 100

	if change > 0.5 {
		return fmt.Sprintf("↑ %.0f%%", math.Abs(change))
	} else if change < -0.5 {
		return fmt.Sprintf("↓ %.0f%%", math.Abs(change))
	}

	return "→ 0%"
}

// renderBarChart renders a simple ASCII bar chart.
func renderBarChart(data []float64, labels []string, width, height int, color string) string {
	if len(data) == 0 {
		return "No data"
	}

	// Find max value for scaling
	maxVal := 0.0
	for _, v := range data {
		if v > maxVal {
			maxVal = v
		}
	}

	if maxVal == 0 {
		return "No activity"
	}

	// Calculate bar width
	barWidth := (width - 10) / len(data)
	if barWidth < 2 {
		barWidth = 2
	}

	chartHeight := height - 2 // Reserve space for labels

	barStyle := lipgloss.NewStyle().Foreground(lipgloss.Color(color))
	labelStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("245"))

	// Build chart rows from top to bottom
	rows := make([]string, chartHeight+1)

	// Draw bars from top to bottom
	for i := 0; i < chartHeight; i++ {
		threshold := maxVal * (float64(chartHeight-i) / float64(chartHeight))
		row := ""

		for j, value := range data {
			if value >= threshold {
				bar := strings.Repeat("█", barWidth)
				row += barStyle.Render(bar)
			} else {
				row += strings.Repeat(" ", barWidth)
			}

			// Add spacing between bars
			if j < len(data)-1 {
				row += " "
			}
		}

		// Add value scale on the right
		if i == 0 {
			row += fmt.Sprintf("  %.0f", maxVal)
		} else if i == chartHeight-1 {
			row += "  0"
		}

		rows[i] = row
	}

	// Add labels at the bottom
	labelRow := ""
	for i, label := range labels {
		// Truncate or pad label to fit bar width
		if len(label) > barWidth {
			label = label[:barWidth]
		} else {
			label = label + strings.Repeat(" ", barWidth-len(label))
		}

		labelRow += labelStyle.Render(label)

		if i < len(labels)-1 {
			labelRow += " "
		}
	}
	rows[chartHeight] = labelRow

	return strings.Join(rows, "\n")
}
