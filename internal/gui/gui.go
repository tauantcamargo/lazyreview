package gui

import (
	"fmt"

	"lazyreview/internal/config"
	"lazyreview/pkg/components"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Panel represents different panels in the UI
type Panel int

const (
	PanelSidebar Panel = iota
	PanelContent
)

// Model is the main application model
type Model struct {
	config      *config.Config
	width       int
	height      int
	activePanel Panel
	sidebar     components.List
	content     components.List
	help        components.Help
	showHelp    bool
	ready       bool
}

// New creates a new GUI model
func New(cfg *config.Config) Model {
	// Create sidebar with navigation items
	sidebarItems := []list.Item{
		components.NewSimpleItem("prs", "Pull Requests", "View and manage PRs"),
		components.NewSimpleItem("reviews", "My Reviews", "PRs requesting your review"),
		components.NewSimpleItem("authored", "My PRs", "PRs you authored"),
		components.NewSimpleItem("settings", "Settings", "Configure LazyReview"),
	}

	sidebar := components.NewList("Navigation", sidebarItems, 30, 20)

	// Create content panel (initially empty)
	content := components.NewList("Pull Requests", []list.Item{}, 50, 20)

	return Model{
		config:      cfg,
		activePanel: PanelSidebar,
		sidebar:     sidebar,
		content:     content,
		help:        components.NewHelp(),
	}
}

// Init implements tea.Model
func (m Model) Init() tea.Cmd {
	return nil
}

// Update implements tea.Model
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c":
			return m, tea.Quit
		case "q":
			if m.showHelp {
				m.showHelp = false
				return m, nil
			}
			return m, tea.Quit
		case "?":
			m.showHelp = !m.showHelp
			return m, nil
		case "tab":
			m.switchPanel()
			return m, nil
		case "shift+tab":
			m.switchPanel()
			return m, nil
		case "h", "left":
			if m.activePanel == PanelContent {
				m.activePanel = PanelSidebar
				m.sidebar.Focus()
				m.content.Blur()
			}
			return m, nil
		case "l", "right", "enter":
			if m.activePanel == PanelSidebar {
				m.activePanel = PanelContent
				m.content.Focus()
				m.sidebar.Blur()
			}
			return m, nil
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.ready = true

		// Calculate panel dimensions
		sidebarWidth := min(40, msg.Width/4)
		contentWidth := msg.Width - sidebarWidth - 4 // padding

		// Reserve space for header, footer, and help
		headerHeight := 3
		footerHeight := 3
		panelHeight := msg.Height - headerHeight - footerHeight

		m.sidebar.SetSize(sidebarWidth, panelHeight)
		m.content.SetSize(contentWidth, panelHeight)
		m.help.SetWidth(msg.Width)

		return m, nil
	}

	// Update the active panel
	var cmd tea.Cmd
	if m.activePanel == PanelSidebar {
		m.sidebar, cmd = m.sidebar.Update(msg)
		cmds = append(cmds, cmd)
	} else {
		m.content, cmd = m.content.Update(msg)
		cmds = append(cmds, cmd)
	}

	// Update help
	m.help, cmd = m.help.Update(msg)
	cmds = append(cmds, cmd)

	return m, tea.Batch(cmds...)
}

// View implements tea.Model
func (m Model) View() string {
	if !m.ready {
		return "Loading..."
	}

	// Styles
	headerStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("170")).
		Background(lipgloss.Color("235")).
		Padding(0, 1).
		Width(m.width)

	footerStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("240")).
		Background(lipgloss.Color("235")).
		Padding(0, 1).
		Width(m.width)

	focusedStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("170"))

	unfocusedStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("240"))

	// Header
	header := headerStyle.Render("LazyReview - Code Review TUI")

	// Sidebar
	var sidebarView string
	if m.activePanel == PanelSidebar {
		sidebarView = focusedStyle.Render(m.sidebar.View())
	} else {
		sidebarView = unfocusedStyle.Render(m.sidebar.View())
	}

	// Content
	var contentView string
	if m.activePanel == PanelContent {
		contentView = focusedStyle.Render(m.content.View())
	} else {
		contentView = unfocusedStyle.Render(m.content.View())
	}

	// Main area (sidebar + content)
	mainArea := lipgloss.JoinHorizontal(lipgloss.Top, sidebarView, contentView)

	// Footer with help
	var footer string
	if m.showHelp {
		footer = m.help.View()
	} else {
		footer = footerStyle.Render("Press ? for help • q to quit")
	}

	// Combine all
	return lipgloss.JoinVertical(
		lipgloss.Left,
		header,
		mainArea,
		footer,
	)
}

// switchPanel switches between sidebar and content panels
func (m *Model) switchPanel() {
	if m.activePanel == PanelSidebar {
		m.activePanel = PanelContent
		m.content.Focus()
		m.sidebar.Blur()
	} else {
		m.activePanel = PanelSidebar
		m.sidebar.Focus()
		m.content.Blur()
	}
}

// Run starts the TUI application
func Run(cfg *config.Config) error {
	p := tea.NewProgram(
		New(cfg),
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)

	if _, err := p.Run(); err != nil {
		return fmt.Errorf("error running program: %w", err)
	}

	return nil
}
