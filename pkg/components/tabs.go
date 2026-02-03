package components

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// Tab represents a single tab label.
type Tab struct {
	ID    string
	Label string
}

// Tabs renders a simple tab bar.
type Tabs struct {
	tabs     []Tab
	selected int

	selectedStyle lipgloss.Style
	idleStyle     lipgloss.Style
	dividerStyle  lipgloss.Style
}

// NewTabs creates a new Tabs component.
func NewTabs(tabs []Tab) Tabs {
	selectedStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("170")).
		Background(lipgloss.Color("235")).
		Padding(0, 1)
	idleStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("245")).
		Background(lipgloss.Color("236")).
		Padding(0, 1)
	dividerStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("238"))

	return Tabs{
		tabs:          tabs,
		selected:      0,
		selectedStyle: selectedStyle,
		idleStyle:     idleStyle,
		dividerStyle:  dividerStyle,
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// SetTabs replaces the tab list.
func (t *Tabs) SetTabs(tabs []Tab) {
	t.tabs = tabs
	if t.selected >= len(tabs) {
		t.selected = max(0, len(tabs)-1)
	}
}

// Count returns the number of tabs.
func (t Tabs) Count() int {
	return len(t.tabs)
}

// Selected returns the selected index.
func (t Tabs) Selected() int {
	return t.selected
}

// SelectedTab returns the selected tab.
func (t Tabs) SelectedTab() *Tab {
	if t.selected < 0 || t.selected >= len(t.tabs) {
		return nil
	}
	return &t.tabs[t.selected]
}

// Select sets the selected index.
func (t *Tabs) Select(index int) {
	if index < 0 || index >= len(t.tabs) {
		return
	}
	t.selected = index
}

// View renders the tab bar within a width.
func (t Tabs) View(width int) string {
	if len(t.tabs) == 0 {
		return ""
	}
	parts := make([]string, 0, len(t.tabs))
	for i, tab := range t.tabs {
		label := tab.Label
		if i == t.selected {
			parts = append(parts, t.selectedStyle.Render(label))
		} else {
			parts = append(parts, t.idleStyle.Render(label))
		}
	}
	divider := t.dividerStyle.Render("|")
	line := strings.Join(parts, divider)
	if width > 0 {
		return lipgloss.NewStyle().Width(width).Render(line)
	}
	return line
}
