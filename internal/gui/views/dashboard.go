package views

import (
	"fmt"
	"strings"

	"lazyreview/internal/models"
	"lazyreview/pkg/components"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// DashboardSection groups PRs under a label.
type DashboardSection struct {
	Title string
	Items components.List
}

// Dashboard renders grouped PRs.
type Dashboard struct {
	sections        []DashboardSection
	activeSection   int
	width           int
	height          int
	status          string
	focusedBorder   string
	unfocusedBorder string
	accent          string
	muted           string
	selectedBg      string
	titleBg         string
}

// NewDashboard creates a new dashboard view.
func NewDashboard(width, height int) Dashboard {
	sections := []DashboardSection{
		{Title: "Needs Your Review", Items: components.NewList("Needs Your Review", []list.Item{}, width, height)},
		{Title: "Your PRs", Items: components.NewList("Your PRs", []list.Item{}, width, height)},
		{Title: "Watching / All", Items: components.NewList("Watching / All", []list.Item{}, width, height)},
	}
	return Dashboard{sections: sections, width: width, height: height}
}

// SetSize updates the dashboard size.
func (d *Dashboard) SetSize(width, height int) {
	d.width = width
	d.height = height
	sectionHeight := max(5, height/len(d.sections))
	for i := range d.sections {
		d.sections[i].Items.SetSize(width, sectionHeight-1)
	}
}

// SetThemeColors updates dashboard styling.
func (d *Dashboard) SetThemeColors(focused, unfocused, accent, muted, selectedBg, titleBg string) {
	d.focusedBorder = focused
	d.unfocusedBorder = unfocused
	d.accent = accent
	d.muted = muted
	d.selectedBg = selectedBg
	d.titleBg = titleBg
	for i := range d.sections {
		d.sections[i].Items.SetThemeColors(accent, muted, selectedBg, titleBg)
	}
}

// SetData sets PR data for sections.
func (d *Dashboard) SetData(needsReview, myPRs, all []models.PullRequest) {
	sections := [][]models.PullRequest{needsReview, myPRs, all}
	for i := range d.sections {
		items := make([]list.Item, 0, len(sections[i]))
		for _, pr := range sections[i] {
			title := fmt.Sprintf("#%d %s", pr.Number, pr.Title)
			desc := fmt.Sprintf("%s/%s • %s", pr.Repository.Owner, pr.Repository.Name, pr.Author.Login)
			items = append(items, dashboardPRItem{pr: pr, title: title, description: desc})
		}
		if len(items) == 0 {
			items = []list.Item{components.NewSimpleItem("empty", "No pull requests", "")}
		}
		d.sections[i].Items.SetItems(items)
	}
}

// Update handles input.
func (d Dashboard) Update(msg tea.Msg) (Dashboard, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "tab":
			d.activeSection = (d.activeSection + 1) % len(d.sections)
			return d, nil
		case "shift+tab":
			d.activeSection = (d.activeSection + len(d.sections) - 1) % len(d.sections)
			return d, nil
		}
	}

	var cmd tea.Cmd
	if d.activeSection >= 0 && d.activeSection < len(d.sections) {
		d.sections[d.activeSection].Items, cmd = d.sections[d.activeSection].Items.Update(msg)
	}
	return d, cmd
}

// SelectedPR returns the selected PR from the active section.
func (d Dashboard) SelectedPR() *models.PullRequest {
	if d.activeSection < 0 || d.activeSection >= len(d.sections) {
		return nil
	}
	item := d.sections[d.activeSection].Items.SelectedItem()
	if item == nil {
		return nil
	}
	selected, ok := item.(dashboardPRItem)
	if !ok {
		return nil
	}
	return &selected.pr
}

// Status returns the dashboard status.
func (d Dashboard) Status() string {
	return d.status
}

// SetStatus sets a status message.
func (d *Dashboard) SetStatus(status string) {
	d.status = status
}

// View renders the dashboard sections.
func (d Dashboard) View() string {
	if len(d.sections) == 0 {
		return ""
	}
	sectionHeight := max(5, d.height/len(d.sections))
	blocks := make([]string, 0, len(d.sections))
	for i, section := range d.sections {
		section.Items.SetSize(d.width, sectionHeight-1)
		borderColor := lipgloss.Color("240")
		if d.unfocusedBorder != "" {
			borderColor = lipgloss.Color(d.unfocusedBorder)
		}
		if i == d.activeSection {
			if d.focusedBorder != "" {
				borderColor = lipgloss.Color(d.focusedBorder)
			} else {
				borderColor = lipgloss.Color("170")
			}
		}
		box := lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(borderColor).
			Width(d.width).
			Height(sectionHeight)
		blocks = append(blocks, box.Render(section.Items.View()))
	}
	return strings.Join(blocks, "\n")
}

type dashboardPRItem struct {
	pr          models.PullRequest
	title       string
	description string
}

func (d dashboardPRItem) Title() string       { return d.title }
func (d dashboardPRItem) Description() string { return d.description }
func (d dashboardPRItem) FilterValue() string { return d.title }
