package gui

import (
	"fmt"

	"lazyreview/internal/config"
	"lazyreview/pkg/components"

	"github.com/charmbracelet/bubbles/key"
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

// Mode represents the current input mode
type Mode int

const (
	ModeNormal Mode = iota
	ModeSearch
	ModeCommand
)

// Model is the main application model
type Model struct {
	config      *config.Config
	width       int
	height      int
	activePanel Panel
	mode        Mode
	sidebar     components.List
	content     components.List
	help        components.Help
	keyMap      KeyMap
	keySeq      *KeySequence
	showHelp    bool
	ready       bool
	statusMsg   string
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
		mode:        ModeNormal,
		sidebar:     sidebar,
		content:     content,
		help:        components.NewHelp(),
		keyMap:      DefaultKeyMap(),
		keySeq:      NewKeySequence(),
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
		// Track key sequence for multi-key bindings like "gg"
		keyStr := msg.String()
		m.keySeq.Add(keyStr)

		// Check for "gg" sequence (go to top)
		if m.keySeq.IsSequence("g", "g") {
			m.keySeq.Reset()
			m.goToTop()
			return m, nil
		}

		// Handle single key bindings
		switch {
		case key.Matches(msg, m.keyMap.Quit):
			if m.showHelp {
				m.showHelp = false
				return m, nil
			}
			return m, tea.Quit

		case key.Matches(msg, m.keyMap.Help):
			m.showHelp = !m.showHelp
			return m, nil

		case key.Matches(msg, m.keyMap.NextPanel):
			m.switchPanel()
			return m, nil

		case key.Matches(msg, m.keyMap.PrevPanel):
			m.switchPanel()
			return m, nil

		case key.Matches(msg, m.keyMap.Left):
			if m.activePanel == PanelContent {
				m.activePanel = PanelSidebar
				m.sidebar.Focus()
				m.content.Blur()
			}
			return m, nil

		case key.Matches(msg, m.keyMap.Right), key.Matches(msg, m.keyMap.Select):
			if m.activePanel == PanelSidebar {
				m.activePanel = PanelContent
				m.content.Focus()
				m.sidebar.Blur()
			}
			return m, nil

		case key.Matches(msg, m.keyMap.Bottom):
			m.goToBottom()
			return m, nil

		case key.Matches(msg, m.keyMap.HalfUp):
			m.halfPageUp()
			return m, nil

		case key.Matches(msg, m.keyMap.HalfDown):
			m.halfPageDown()
			return m, nil

		case key.Matches(msg, m.keyMap.PageUp):
			m.pageUp()
			return m, nil

		case key.Matches(msg, m.keyMap.PageDown):
			m.pageDown()
			return m, nil

		// Action keys (show status message for now)
		case key.Matches(msg, m.keyMap.Approve):
			m.statusMsg = "Approve: Select a PR first"
			return m, nil

		case key.Matches(msg, m.keyMap.RequestChanges):
			m.statusMsg = "Request Changes: Select a PR first"
			return m, nil

		case key.Matches(msg, m.keyMap.Comment):
			m.statusMsg = "Comment: Select a PR first"
			return m, nil

		case key.Matches(msg, m.keyMap.OpenBrowser):
			m.statusMsg = "Open in browser: Select a PR first"
			return m, nil

		case key.Matches(msg, m.keyMap.Refresh):
			m.statusMsg = "Refreshing..."
			return m, nil

		case key.Matches(msg, m.keyMap.Search):
			m.statusMsg = "Search: Type to filter"
			// Let the list handle the search
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.ready = true

		// Calculate panel dimensions
		sidebarWidth := min(40, msg.Width/4)
		contentWidth := msg.Width - sidebarWidth - 4

		// Reserve space for header, footer
		headerHeight := 3
		footerHeight := 3
		panelHeight := msg.Height - headerHeight - footerHeight

		m.sidebar.SetSize(sidebarWidth, panelHeight)
		m.content.SetSize(contentWidth, panelHeight)
		m.help.SetWidth(msg.Width)

		return m, nil

	case keyTimeoutMsg:
		m.keySeq.Reset()
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

	// Footer with help or status
	var footer string
	if m.showHelp {
		footer = m.help.View()
	} else if m.statusMsg != "" {
		footer = footerStyle.Render(m.statusMsg)
	} else {
		footer = footerStyle.Render("j/k:navigate  h/l:panels  ?:help  q:quit")
	}

	// Combine all
	return lipgloss.JoinVertical(
		lipgloss.Left,
		header,
		mainArea,
		footer,
	)
}

// Navigation helpers

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

func (m *Model) goToTop() {
	// The list component handles this via the 'g' key in its Update
	// We send a synthetic message to move to index 0
	if m.activePanel == PanelSidebar {
		// Move sidebar to top
	} else {
		// Move content to top
	}
}

func (m *Model) goToBottom() {
	// Move to bottom of current list
}

func (m *Model) halfPageUp() {
	// Move up half a page
}

func (m *Model) halfPageDown() {
	// Move down half a page
}

func (m *Model) pageUp() {
	// Move up a full page
}

func (m *Model) pageDown() {
	// Move down a full page
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
