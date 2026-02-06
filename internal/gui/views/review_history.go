package views

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"lazyreview/internal/models"
	"lazyreview/internal/services"
	"lazyreview/pkg/components"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// ReviewFilter represents the review state filter
type ReviewFilter int

const (
	FilterAll ReviewFilter = iota
	FilterApproved
	FilterChangesRequested
	FilterCommented
)

// TimeFilter represents time-based filtering
type TimeFilter int

const (
	TimeAll TimeFilter = iota
	TimeLastWeek
	TimeLastMonth
	TimeLastQuarter
)

// ExportFormat represents the export file format
type ExportFormat int

const (
	ExportMarkdown ExportFormat = iota
	ExportJSON
)

// ReviewHistoryItem represents a PR review in the history list
type ReviewHistoryItem struct {
	pr           models.PullRequest
	reviewState  models.ReviewState
	reviewedAt   time.Time
	providerType string
	host         string
	commentCount int
}

func (i ReviewHistoryItem) Title() string {
	stateIcon := ""
	switch i.reviewState {
	case models.ReviewStateApproved:
		stateIcon = "✓"
	case models.ReviewStateChangesRequested:
		stateIcon = "✗"
	case models.ReviewStateCommented:
		stateIcon = "💬"
	}

	return fmt.Sprintf("%s #%d %s", stateIcon, i.pr.Number, i.pr.Title)
}

func (i ReviewHistoryItem) Description() string {
	parts := []string{
		fmt.Sprintf("%s/%s", i.pr.Repository.Owner, i.pr.Repository.Name),
		i.formatTimeAgo(i.reviewedAt),
	}

	if i.commentCount > 0 {
		parts = append(parts, fmt.Sprintf("%d comments", i.commentCount))
	}

	return strings.Join(parts, " • ")
}

func (i ReviewHistoryItem) FilterValue() string {
	return fmt.Sprintf("#%d %s %s/%s", i.pr.Number, i.pr.Title, i.pr.Repository.Owner, i.pr.Repository.Name)
}

func (i ReviewHistoryItem) formatTimeAgo(t time.Time) string {
	duration := time.Since(t)

	if duration < time.Minute {
		return "just now"
	}
	if duration < time.Hour {
		mins := int(duration.Minutes())
		return fmt.Sprintf("%dm ago", mins)
	}
	if duration < 24*time.Hour {
		hours := int(duration.Hours())
		return fmt.Sprintf("%dh ago", hours)
	}
	if duration < 7*24*time.Hour {
		days := int(duration.Hours() / 24)
		if days == 1 {
			return "1 day ago"
		}
		return fmt.Sprintf("%d days ago", days)
	}
	if duration < 30*24*time.Hour {
		weeks := int(duration.Hours() / (24 * 7))
		if weeks == 1 {
			return "1 week ago"
		}
		return fmt.Sprintf("%d weeks ago", weeks)
	}
	if duration < 365*24*time.Hour {
		months := int(duration.Hours() / (24 * 30))
		if months == 1 {
			return "1 month ago"
		}
		return fmt.Sprintf("%d months ago", months)
	}

	years := int(duration.Hours() / (24 * 365))
	if years == 1 {
		return "1 year ago"
	}
	return fmt.Sprintf("%d years ago", years)
}

// ReviewHistory manages the review history view
type ReviewHistory struct {
	list             components.VirtualList
	analyticsService *services.AnalyticsService
	allReviews       []ReviewHistoryItem
	currentFilter    ReviewFilter
	currentTime      TimeFilter
	width            int
	height           int
	status           string
	keyMap           reviewHistoryKeyMap
	focusedBorder    string
	unfocusedBorder  string
	accent           string
	muted            string
	selectedBg       string
	titleBg          string
	pageSize         int
	currentPage      int
	totalPages       int
}

// reviewHistoryKeyMap defines keybindings for review history
type reviewHistoryKeyMap struct {
	NextFilter key.Binding
	PrevFilter key.Binding
	NextTime   key.Binding
	PrevTime   key.Binding
	Export     key.Binding
	NextPage   key.Binding
	PrevPage   key.Binding
	Refresh    key.Binding
}

// defaultReviewHistoryKeyMap returns default keybindings
func defaultReviewHistoryKeyMap() reviewHistoryKeyMap {
	return reviewHistoryKeyMap{
		NextFilter: key.NewBinding(
			key.WithKeys("tab"),
			key.WithHelp("tab", "next filter"),
		),
		PrevFilter: key.NewBinding(
			key.WithKeys("shift+tab"),
			key.WithHelp("shift+tab", "prev filter"),
		),
		NextTime: key.NewBinding(
			key.WithKeys("t"),
			key.WithHelp("t", "next time filter"),
		),
		PrevTime: key.NewBinding(
			key.WithKeys("T"),
			key.WithHelp("T", "prev time filter"),
		),
		Export: key.NewBinding(
			key.WithKeys("e"),
			key.WithHelp("e", "export"),
		),
		NextPage: key.NewBinding(
			key.WithKeys("n"),
			key.WithHelp("n", "next page"),
		),
		PrevPage: key.NewBinding(
			key.WithKeys("p"),
			key.WithHelp("p", "prev page"),
		),
		Refresh: key.NewBinding(
			key.WithKeys("r"),
			key.WithHelp("r", "refresh"),
		),
	}
}

// NewReviewHistory creates a new review history view
func NewReviewHistory(db *sql.DB, width, height int) (*ReviewHistory, error) {
	analyticsService, err := services.NewAnalyticsService(db, services.DefaultAnalyticsConfig())
	if err != nil {
		return nil, fmt.Errorf("failed to create analytics service: %w", err)
	}

	vlist := components.NewVirtualList("Review History", []list.Item{}, width, height-4)

	rh := &ReviewHistory{
		list:             vlist,
		analyticsService: analyticsService,
		allReviews:       []ReviewHistoryItem{},
		currentFilter:    FilterAll,
		currentTime:      TimeAll,
		width:            width,
		height:           height,
		keyMap:           defaultReviewHistoryKeyMap(),
		pageSize:         50,
		currentPage:      0,
		totalPages:       0,
	}

	return rh, nil
}

// LoadData loads review history from analytics service
func (r *ReviewHistory) LoadData(ctx context.Context) error {
	start, end := r.calculateTimeRange()

	events, err := r.analyticsService.GetEventsByDateRange(ctx, start, end)
	if err != nil {
		return fmt.Errorf("failed to load review events: %w", err)
	}

	r.allReviews = r.processEvents(events)
	r.applyFilters()

	return nil
}

// calculateTimeRange calculates the time range based on current time filter
func (r *ReviewHistory) calculateTimeRange() (time.Time, time.Time) {
	now := time.Now()
	end := now
	var start time.Time

	switch r.currentTime {
	case TimeLastWeek:
		start = now.AddDate(0, 0, -7)
	case TimeLastMonth:
		start = now.AddDate(0, -1, 0)
	case TimeLastQuarter:
		start = now.AddDate(0, -3, 0)
	default:
		start = now.AddDate(-10, 0, 0) // 10 years ago (all time)
	}

	return start, end
}

// processEvents converts analytics events into review history items
func (r *ReviewHistory) processEvents(events []services.ReviewEvent) []ReviewHistoryItem {
	// Group events by PR
	prEvents := make(map[string][]services.ReviewEvent)

	for _, event := range events {
		if event.Type == services.EventReviewApprove ||
			event.Type == services.EventReviewRequestChanges ||
			event.Type == services.EventReviewComment {
			prKey := fmt.Sprintf("%s|%s|%s|%s|%d",
				event.ProviderType, event.Host, event.Owner, event.Repo, event.PRNumber)
			prEvents[prKey] = append(prEvents[prKey], event)
		}
	}

	// Convert to review history items
	items := []ReviewHistoryItem{}

	for _, events := range prEvents {
		if len(events) == 0 {
			continue
		}

		// Sort events by timestamp (newest first)
		sort.Slice(events, func(i, j int) bool {
			return events[i].Timestamp.After(events[j].Timestamp)
		})

		latestEvent := events[0]

		// Determine review state from latest event
		reviewState := models.ReviewStatePending
		switch latestEvent.Type {
		case services.EventReviewApprove:
			reviewState = models.ReviewStateApproved
		case services.EventReviewRequestChanges:
			reviewState = models.ReviewStateChangesRequested
		case services.EventReviewComment:
			reviewState = models.ReviewStateCommented
		}

		// Count comments
		commentCount := 0
		for _, e := range events {
			if e.Type == services.EventReviewComment {
				commentCount++
			}
		}

		// Extract PR metadata from event metadata
		pr := models.PullRequest{
			Number: latestEvent.PRNumber,
			Repository: models.Repository{
				Owner: latestEvent.Owner,
				Name:  latestEvent.Repo,
			},
		}

		// Try to extract title from metadata
		if title, ok := latestEvent.Metadata["title"].(string); ok {
			pr.Title = title
		} else {
			pr.Title = fmt.Sprintf("PR #%d", latestEvent.PRNumber)
		}

		item := ReviewHistoryItem{
			pr:           pr,
			reviewState:  reviewState,
			reviewedAt:   latestEvent.Timestamp,
			providerType: latestEvent.ProviderType,
			host:         latestEvent.Host,
			commentCount: commentCount,
		}

		items = append(items, item)
	}

	// Sort by reviewed time (newest first)
	sort.Slice(items, func(i, j int) bool {
		return items[i].reviewedAt.After(items[j].reviewedAt)
	})

	return items
}

// applyFilters applies current filters and pagination
func (r *ReviewHistory) applyFilters() {
	filtered := []ReviewHistoryItem{}

	for _, item := range r.allReviews {
		// Apply review state filter
		if r.currentFilter != FilterAll {
			switch r.currentFilter {
			case FilterApproved:
				if item.reviewState != models.ReviewStateApproved {
					continue
				}
			case FilterChangesRequested:
				if item.reviewState != models.ReviewStateChangesRequested {
					continue
				}
			case FilterCommented:
				if item.reviewState != models.ReviewStateCommented {
					continue
				}
			}
		}

		filtered = append(filtered, item)
	}

	// Calculate pagination
	r.totalPages = (len(filtered) + r.pageSize - 1) / r.pageSize
	if r.totalPages == 0 {
		r.totalPages = 1
	}

	// Ensure current page is valid
	if r.currentPage >= r.totalPages {
		r.currentPage = r.totalPages - 1
	}
	if r.currentPage < 0 {
		r.currentPage = 0
	}

	// Apply pagination
	start := r.currentPage * r.pageSize
	end := start + r.pageSize
	if end > len(filtered) {
		end = len(filtered)
	}

	paginated := []ReviewHistoryItem{}
	if start < len(filtered) {
		paginated = filtered[start:end]
	}

	// Convert to list items
	listItems := make([]list.Item, len(paginated))
	for i, item := range paginated {
		listItems[i] = item
	}

	r.list.SetItems(listItems)

	// Update title with filter info
	title := r.buildTitle()
	r.list.SetTitle(title)
}

// buildTitle creates the list title with filter information
func (r *ReviewHistory) buildTitle() string {
	filterName := ""
	switch r.currentFilter {
	case FilterAll:
		filterName = "All"
	case FilterApproved:
		filterName = "Approved"
	case FilterChangesRequested:
		filterName = "Changes Requested"
	case FilterCommented:
		filterName = "Commented"
	}

	timeName := ""
	switch r.currentTime {
	case TimeAll:
		timeName = "All Time"
	case TimeLastWeek:
		timeName = "Last Week"
	case TimeLastMonth:
		timeName = "Last Month"
	case TimeLastQuarter:
		timeName = "Last Quarter"
	}

	pageInfo := ""
	if r.totalPages > 1 {
		pageInfo = fmt.Sprintf(" | Page %d/%d", r.currentPage+1, r.totalPages)
	}

	return fmt.Sprintf("Review History: %s • %s%s", filterName, timeName, pageInfo)
}

// SetSize updates the view size
func (r *ReviewHistory) SetSize(width, height int) {
	r.width = width
	r.height = height
	r.list.SetSize(width, height-4)
}

// SetThemeColors updates styling
func (r *ReviewHistory) SetThemeColors(focused, unfocused, accent, muted, selectedBg, titleBg string) {
	r.focusedBorder = focused
	r.unfocusedBorder = unfocused
	r.accent = accent
	r.muted = muted
	r.selectedBg = selectedBg
	r.titleBg = titleBg
	r.list.SetThemeColors(accent, muted, selectedBg, titleBg)
}

// Update handles input
func (r *ReviewHistory) Update(msg tea.Msg) (tea.Cmd, error) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, r.keyMap.NextFilter):
			r.nextFilter()
			return nil, nil
		case key.Matches(msg, r.keyMap.PrevFilter):
			r.prevFilter()
			return nil, nil
		case key.Matches(msg, r.keyMap.NextTime):
			r.nextTimeFilter()
			return nil, nil
		case key.Matches(msg, r.keyMap.PrevTime):
			r.prevTimeFilter()
			return nil, nil
		case key.Matches(msg, r.keyMap.Export):
			return r.openExportDialog(), nil
		case key.Matches(msg, r.keyMap.NextPage):
			r.nextPage()
			return nil, nil
		case key.Matches(msg, r.keyMap.PrevPage):
			r.prevPage()
			return nil, nil
		case key.Matches(msg, r.keyMap.Refresh):
			return r.refresh(), nil
		}
	}

	var cmd tea.Cmd
	r.list, cmd = r.list.Update(msg)
	return cmd, nil
}

// nextFilter cycles to next review filter
func (r *ReviewHistory) nextFilter() {
	r.currentFilter = (r.currentFilter + 1) % 4
	r.currentPage = 0
	r.applyFilters()
}

// prevFilter cycles to previous review filter
func (r *ReviewHistory) prevFilter() {
	r.currentFilter = (r.currentFilter + 3) % 4
	r.currentPage = 0
	r.applyFilters()
}

// nextTimeFilter cycles to next time filter
func (r *ReviewHistory) nextTimeFilter() {
	r.currentTime = (r.currentTime + 1) % 4
	r.currentPage = 0
}

// prevTimeFilter cycles to previous time filter
func (r *ReviewHistory) prevTimeFilter() {
	r.currentTime = (r.currentTime + 3) % 4
	r.currentPage = 0
}

// nextPage advances to next page
func (r *ReviewHistory) nextPage() {
	if r.currentPage < r.totalPages-1 {
		r.currentPage++
		r.applyFilters()
	}
}

// prevPage goes to previous page
func (r *ReviewHistory) prevPage() {
	if r.currentPage > 0 {
		r.currentPage--
		r.applyFilters()
	}
}

// refresh reloads data
func (r *ReviewHistory) refresh() tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		if err := r.LoadData(ctx); err != nil {
			return errMsg{err: err}
		}
		return refreshCompleteMsg{}
	}
}

type refreshCompleteMsg struct{}
type errMsg struct{ err error }

// openExportDialog opens export format selection
func (r *ReviewHistory) openExportDialog() tea.Cmd {
	return func() tea.Msg {
		// For now, default to markdown export
		// In a full implementation, this would show a dialog
		if err := r.exportData(ExportMarkdown); err != nil {
			return errMsg{err: err}
		}
		return exportCompleteMsg{format: ExportMarkdown}
	}
}

type exportCompleteMsg struct {
	format ExportFormat
}

// exportData exports review history to file
func (r *ReviewHistory) exportData(format ExportFormat) error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %w", err)
	}

	timestamp := time.Now().Format("20060102-150405")
	var filename string

	switch format {
	case ExportMarkdown:
		filename = filepath.Join(homeDir, fmt.Sprintf("review-history-%s.md", timestamp))
		return r.exportMarkdown(filename)
	case ExportJSON:
		filename = filepath.Join(homeDir, fmt.Sprintf("review-history-%s.json", timestamp))
		return r.exportJSON(filename)
	default:
		return fmt.Errorf("unsupported export format")
	}
}

// exportMarkdown exports to markdown format
func (r *ReviewHistory) exportMarkdown(filename string) error {
	var b strings.Builder

	b.WriteString("# Review History\n\n")
	b.WriteString(fmt.Sprintf("Generated: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))

	// Group by review state
	approved := []ReviewHistoryItem{}
	changesRequested := []ReviewHistoryItem{}
	commented := []ReviewHistoryItem{}

	for _, item := range r.allReviews {
		switch item.reviewState {
		case models.ReviewStateApproved:
			approved = append(approved, item)
		case models.ReviewStateChangesRequested:
			changesRequested = append(changesRequested, item)
		case models.ReviewStateCommented:
			commented = append(commented, item)
		}
	}

	// Write sections
	r.writeMarkdownSection(&b, "Approved", approved)
	r.writeMarkdownSection(&b, "Changes Requested", changesRequested)
	r.writeMarkdownSection(&b, "Commented", commented)

	// Write summary
	b.WriteString("\n## Summary\n\n")
	b.WriteString(fmt.Sprintf("- Total Reviews: %d\n", len(r.allReviews)))
	b.WriteString(fmt.Sprintf("- Approved: %d\n", len(approved)))
	b.WriteString(fmt.Sprintf("- Changes Requested: %d\n", len(changesRequested)))
	b.WriteString(fmt.Sprintf("- Commented: %d\n", len(commented)))

	if err := os.WriteFile(filename, []byte(b.String()), 0644); err != nil {
		return fmt.Errorf("failed to write markdown file: %w", err)
	}

	return nil
}

// writeMarkdownSection writes a section to the markdown output
func (r *ReviewHistory) writeMarkdownSection(b *strings.Builder, title string, items []ReviewHistoryItem) {
	if len(items) == 0 {
		return
	}

	b.WriteString(fmt.Sprintf("\n## %s (%d)\n\n", title, len(items)))

	for _, item := range items {
		b.WriteString(fmt.Sprintf("### #%d %s\n\n", item.pr.Number, item.pr.Title))
		b.WriteString(fmt.Sprintf("- **Repository:** %s/%s\n", item.pr.Repository.Owner, item.pr.Repository.Name))
		b.WriteString(fmt.Sprintf("- **Reviewed:** %s\n", item.reviewedAt.Format("2006-01-02 15:04:05")))
		if item.commentCount > 0 {
			b.WriteString(fmt.Sprintf("- **Comments:** %d\n", item.commentCount))
		}
		b.WriteString("\n")
	}
}

// exportJSON exports to JSON format
func (r *ReviewHistory) exportJSON(filename string) error {
	type ExportItem struct {
		PRNumber     int       `json:"pr_number"`
		Title        string    `json:"title"`
		Repository   string    `json:"repository"`
		ReviewState  string    `json:"review_state"`
		ReviewedAt   time.Time `json:"reviewed_at"`
		CommentCount int       `json:"comment_count"`
		ProviderType string    `json:"provider_type"`
		Host         string    `json:"host"`
	}

	items := make([]ExportItem, len(r.allReviews))
	for i, item := range r.allReviews {
		items[i] = ExportItem{
			PRNumber:     item.pr.Number,
			Title:        item.pr.Title,
			Repository:   fmt.Sprintf("%s/%s", item.pr.Repository.Owner, item.pr.Repository.Name),
			ReviewState:  string(item.reviewState),
			ReviewedAt:   item.reviewedAt,
			CommentCount: item.commentCount,
			ProviderType: item.providerType,
			Host:         item.host,
		}
	}

	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write JSON file: %w", err)
	}

	return nil
}

// SelectedPR returns the currently selected PR
func (r *ReviewHistory) SelectedPR() *models.PullRequest {
	item := r.list.SelectedItem()
	if item == nil {
		return nil
	}

	historyItem, ok := item.(ReviewHistoryItem)
	if !ok {
		return nil
	}

	return &historyItem.pr
}

// Status returns the current status message
func (r *ReviewHistory) Status() string {
	return r.status
}

// SetStatus sets a status message
func (r *ReviewHistory) SetStatus(status string) {
	r.status = status
}

// View renders the review history view
func (r *ReviewHistory) View() string {
	var b strings.Builder

	// Render filter chips
	b.WriteString(r.renderFilterChips())
	b.WriteString("\n\n")

	// Render list
	b.WriteString(r.list.View())

	// Render help
	b.WriteString("\n")
	b.WriteString(r.renderHelp())

	return b.String()
}

// renderFilterChips renders the filter selection chips
func (r *ReviewHistory) renderFilterChips() string {
	filters := []struct {
		filter ReviewFilter
		label  string
	}{
		{FilterAll, "All"},
		{FilterApproved, "Approved"},
		{FilterChangesRequested, "Changes Requested"},
		{FilterCommented, "Commented"},
	}

	times := []struct {
		time  TimeFilter
		label string
	}{
		{TimeAll, "All Time"},
		{TimeLastWeek, "Last Week"},
		{TimeLastMonth, "Last Month"},
		{TimeLastQuarter, "Last Quarter"},
	}

	accent := r.accent
	if accent == "" {
		accent = "170"
	}
	muted := r.muted
	if muted == "" {
		muted = "240"
	}

	selectedStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("0")).
		Background(lipgloss.Color(accent)).
		Padding(0, 1).
		Bold(true)

	normalStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color(muted)).
		Background(lipgloss.Color("235")).
		Padding(0, 1)

	var chips []string

	// Review state filters
	for _, f := range filters {
		if f.filter == r.currentFilter {
			chips = append(chips, selectedStyle.Render(f.label))
		} else {
			chips = append(chips, normalStyle.Render(f.label))
		}
	}

	chips = append(chips, "  ")

	// Time filters
	for _, t := range times {
		if t.time == r.currentTime {
			chips = append(chips, selectedStyle.Render(t.label))
		} else {
			chips = append(chips, normalStyle.Render(t.label))
		}
	}

	return strings.Join(chips, " ")
}

// renderHelp renders help text
func (r *ReviewHistory) renderHelp() string {
	helpStyle := lipgloss.NewStyle().Foreground(lipgloss.Color(r.muted))
	if r.muted == "" {
		helpStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("240"))
	}

	return helpStyle.Render("tab/shift+tab filter • t/T time • e export • n/p page • r refresh • q back")
}

// Close cleans up resources
func (r *ReviewHistory) Close() error {
	if r.analyticsService != nil {
		return r.analyticsService.Close()
	}
	return nil
}
