package gui

import (
	"context"
	"fmt"
	"time"

	"lazyreview/internal/auth"
	"lazyreview/internal/config"
	"lazyreview/internal/models"
	"lazyreview/pkg/components"
	"lazyreview/pkg/providers"

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
	PanelFiles
	PanelDiff
)

// Mode represents the current input mode
type Mode int

const (
	ModeNormal Mode = iota
	ModeSearch
	ModeCommand
)

// ViewState represents which view is currently displayed
type ViewState int

const (
	ViewList   ViewState = iota // PR list view
	ViewDetail                  // PR detail view (files + diff)
)

// Message types for async operations
type prListMsg struct {
	prs []models.PullRequest
}

type prDetailMsg struct {
	pr *models.PullRequest
}

type prFilesMsg struct {
	files []models.FileChange
}

type prDiffMsg struct {
	diff *models.Diff
}

type errMsg struct {
	err error
}

type providerReadyMsg struct {
	provider providers.Provider
}

// Model is the main application model
type Model struct {
	config      *config.Config
	width       int
	height      int
	activePanel Panel
	mode        Mode
	viewState   ViewState
	sidebar     components.List
	content     components.List
	fileTree    components.FileTree
	diffViewer  components.DiffViewer
	help        components.Help
	keyMap      KeyMap
	keySeq      *KeySequence
	showHelp    bool
	ready       bool
	statusMsg   string

	// Provider and auth
	provider    providers.Provider
	authService *auth.Service

	// Current PR state
	currentPR    *models.PullRequest
	currentDiff  *models.Diff
	currentFiles []models.FileChange
	prList       []models.PullRequest

	// Loading states
	isLoading      bool
	loadingMessage string
	lastError      error
}

// New creates a new GUI model
func New(cfg *config.Config, provider providers.Provider, authService *auth.Service) Model {
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

	// Create file tree (for PR detail view)
	fileTree := components.NewFileTree(30, 20)

	// Create diff viewer (for PR detail view)
	diffViewer := components.NewDiffViewer(50, 20)

	return Model{
		config:         cfg,
		provider:       provider,
		authService:    authService,
		activePanel:    PanelSidebar,
		mode:           ModeNormal,
		viewState:      ViewList,
		sidebar:        sidebar,
		content:        content,
		fileTree:       fileTree,
		diffViewer:     diffViewer,
		help:           components.NewHelp(),
		keyMap:         DefaultKeyMap(),
		keySeq:         NewKeySequence(),
		isLoading:      true,
		loadingMessage: "Initializing...",
	}
}

// Init implements tea.Model
func (m Model) Init() tea.Cmd {
	// For now, we'll use mock repository data
	// In the future, this could come from config or user input
	return fetchPRList(m.provider, "golang", "go")
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
			if m.viewState == ViewDetail {
				// In detail view, move between diff and file tree, or go back
				if m.activePanel == PanelDiff {
					m.activePanel = PanelFiles
					m.fileTree.Focus()
					m.diffViewer.Blur()
				} else {
					// Go back to list view
					m.exitDetailView()
				}
			} else if m.activePanel == PanelContent {
				m.activePanel = PanelSidebar
				m.sidebar.Focus()
				m.content.Blur()
			}
			return m, nil

		case key.Matches(msg, m.keyMap.Right), key.Matches(msg, m.keyMap.Select):
			if m.viewState == ViewList {
				if m.activePanel == PanelSidebar {
					m.activePanel = PanelContent
					m.content.Focus()
					m.sidebar.Blur()
				} else if m.activePanel == PanelContent {
					// Enter PR detail view
					cmd := m.enterDetailView()
					return m, cmd
				}
			} else {
				// In detail view, move between file tree and diff
				if m.activePanel == PanelFiles {
					m.activePanel = PanelDiff
					m.diffViewer.Focus()
					m.fileTree.Blur()
				}
			}
			return m, nil

		case key.Matches(msg, m.keyMap.Back):
			// Go back from detail view to list view
			if m.viewState == ViewDetail {
				m.viewState = ViewList
				m.activePanel = PanelContent
				m.currentPR = nil
				m.currentDiff = nil
				m.currentFiles = nil
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
			if m.viewState == ViewDetail && m.currentPR != nil {
				m.statusMsg = fmt.Sprintf("Approving PR #%d... (not yet implemented)", m.currentPR.Number)
			} else {
				m.statusMsg = "Approve: Select a PR first"
			}
			return m, nil

		case key.Matches(msg, m.keyMap.RequestChanges):
			if m.viewState == ViewDetail && m.currentPR != nil {
				m.statusMsg = fmt.Sprintf("Requesting changes on PR #%d... (not yet implemented)", m.currentPR.Number)
			} else {
				m.statusMsg = "Request Changes: Select a PR first"
			}
			return m, nil

		case key.Matches(msg, m.keyMap.Comment):
			if m.viewState == ViewDetail {
				file := m.fileTree.SelectedPath()
				if file != "" {
					m.statusMsg = fmt.Sprintf("Comment on %s... (not yet implemented)", file)
				} else {
					m.statusMsg = "Comment: Select a file first"
				}
			} else {
				m.statusMsg = "Comment: Enter PR view first"
			}
			return m, nil

		case key.Matches(msg, m.keyMap.OpenBrowser):
			if m.viewState == ViewDetail && m.currentPR != nil {
				m.statusMsg = fmt.Sprintf("Opening PR #%d in browser... (not yet implemented)", m.currentPR.Number)
			} else {
				m.statusMsg = "Open in browser: Select a PR first"
			}
			return m, nil

		case key.Matches(msg, m.keyMap.Refresh):
			if m.viewState == ViewList {
				m.isLoading = true
				m.loadingMessage = "Refreshing pull requests..."
				m.statusMsg = "Refreshing..."
				// Use hardcoded owner/repo for now
				return m, fetchPRList(m.provider, "golang", "go")
			}
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

		// List view components
		m.sidebar.SetSize(sidebarWidth, panelHeight)
		m.content.SetSize(contentWidth, panelHeight)

		// Detail view components
		fileTreeWidth := min(40, msg.Width/4)
		diffWidth := msg.Width - fileTreeWidth - 4
		m.fileTree.SetSize(fileTreeWidth, panelHeight)
		m.diffViewer.SetSize(diffWidth, panelHeight)

		m.help.SetWidth(msg.Width)

		return m, nil

	case prListMsg:
		m.isLoading = false
		m.prList = msg.prs

		// Convert PRs to list items
		items := make([]list.Item, len(msg.prs))
		for i, pr := range msg.prs {
			title := fmt.Sprintf("#%d: %s", pr.Number, pr.Title)
			desc := fmt.Sprintf("by %s • %s", pr.Author.Login, pr.State)
			items[i] = components.NewSimpleItem(fmt.Sprintf("%d", pr.Number), title, desc)
		}
		contentWidth := m.width - 44
		contentHeight := m.height - 6
		m.content = components.NewList("Pull Requests", items, contentWidth, contentHeight)
		m.statusMsg = fmt.Sprintf("Loaded %d pull requests", len(msg.prs))
		return m, nil

	case prDetailMsg:
		m.currentPR = msg.pr
		m.isLoading = false
		m.statusMsg = fmt.Sprintf("Loaded PR #%d details", msg.pr.Number)
		return m, nil

	case prFilesMsg:
		m.currentFiles = msg.files
		m.fileTree.SetFiles(msg.files)
		m.isLoading = false
		m.statusMsg = fmt.Sprintf("Loaded %d files", len(msg.files))
		return m, nil

	case prDiffMsg:
		m.currentDiff = msg.diff
		m.diffViewer.SetDiff(msg.diff)
		m.isLoading = false
		m.statusMsg = fmt.Sprintf("Loaded diff (+%d -%d)", msg.diff.Additions, msg.diff.Deletions)
		return m, nil

	case errMsg:
		m.isLoading = false
		m.lastError = msg.err
		m.statusMsg = fmt.Sprintf("Error: %s", msg.err.Error())
		return m, nil

	case keyTimeoutMsg:
		m.keySeq.Reset()
		return m, nil
	}

	// Update the active panel based on view state
	var cmd tea.Cmd
	if m.viewState == ViewList {
		if m.activePanel == PanelSidebar {
			m.sidebar, cmd = m.sidebar.Update(msg)
			cmds = append(cmds, cmd)
		} else {
			m.content, cmd = m.content.Update(msg)
			cmds = append(cmds, cmd)
		}
	} else {
		// Detail view
		if m.activePanel == PanelFiles {
			m.fileTree, cmd = m.fileTree.Update(msg)
			cmds = append(cmds, cmd)
		} else {
			m.diffViewer, cmd = m.diffViewer.Update(msg)
			cmds = append(cmds, cmd)
		}
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

	// Show loading overlay if loading
	if m.isLoading && m.loadingMessage != "" {
		return fmt.Sprintf("\n\n  %s\n\n", m.loadingMessage)
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
	var headerText string
	if m.viewState == ViewList {
		headerText = "LazyReview - Code Review TUI"
	} else if m.currentPR != nil {
		headerText = fmt.Sprintf("LazyReview - PR #%d: %s", m.currentPR.Number, m.currentPR.Title)
	} else {
		headerText = "LazyReview - PR Details"
	}
	header := headerStyle.Render(headerText)

	var mainArea string
	if m.viewState == ViewList {
		// List view: sidebar + content
		var sidebarView, contentView string
		if m.activePanel == PanelSidebar {
			sidebarView = focusedStyle.Render(m.sidebar.View())
		} else {
			sidebarView = unfocusedStyle.Render(m.sidebar.View())
		}

		if m.activePanel == PanelContent {
			contentView = focusedStyle.Render(m.content.View())
		} else {
			contentView = unfocusedStyle.Render(m.content.View())
		}

		mainArea = lipgloss.JoinHorizontal(lipgloss.Top, sidebarView, contentView)
	} else {
		// Detail view: file tree + diff viewer
		var fileTreeView, diffView string
		if m.activePanel == PanelFiles {
			fileTreeView = focusedStyle.Render(m.fileTree.View())
		} else {
			fileTreeView = unfocusedStyle.Render(m.fileTree.View())
		}

		if m.activePanel == PanelDiff {
			diffView = focusedStyle.Render(m.diffViewer.View())
		} else {
			diffView = unfocusedStyle.Render(m.diffViewer.View())
		}

		mainArea = lipgloss.JoinHorizontal(lipgloss.Top, fileTreeView, diffView)
	}

	// Footer with help or status
	var footer string
	if m.showHelp {
		footer = m.help.View()
	} else if m.statusMsg != "" {
		footer = footerStyle.Render(m.statusMsg)
	} else if m.viewState == ViewDetail {
		footer = footerStyle.Render("j/k:navigate  h/l:panels  n/N:next/prev file  a:approve  r:request changes  c:comment  esc:back  ?:help")
	} else {
		footer = footerStyle.Render("j/k:navigate  h/l:panels  enter:view PR  ?:help  q:quit")
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
	if m.viewState == ViewList {
		if m.activePanel == PanelSidebar {
			m.activePanel = PanelContent
			m.content.Focus()
			m.sidebar.Blur()
		} else {
			m.activePanel = PanelSidebar
			m.sidebar.Focus()
			m.content.Blur()
		}
	} else {
		// Detail view
		if m.activePanel == PanelFiles {
			m.activePanel = PanelDiff
			m.diffViewer.Focus()
			m.fileTree.Blur()
		} else {
			m.activePanel = PanelFiles
			m.fileTree.Focus()
			m.diffViewer.Blur()
		}
	}
}

func (m *Model) enterDetailView() tea.Cmd {
	// Get the selected PR from the content list
	selectedItem := m.content.SelectedItem()
	if selectedItem == nil {
		m.statusMsg = "No PR selected"
		return nil
	}

	// Find the PR number from the selected item
	simpleItem, ok := selectedItem.(components.SimpleItem)
	if !ok {
		m.statusMsg = "Invalid selection"
		return nil
	}

	// Parse PR number from the item ID
	var prNumber int
	_, err := fmt.Sscanf(simpleItem.ID(), "%d", &prNumber)
	if err != nil {
		m.statusMsg = fmt.Sprintf("Invalid PR number: %s", err.Error())
		return nil
	}

	// Find the PR in our list
	var selectedPR *models.PullRequest
	for i := range m.prList {
		if m.prList[i].Number == prNumber {
			selectedPR = &m.prList[i]
			break
		}
	}

	if selectedPR == nil {
		m.statusMsg = "PR not found in list"
		return nil
	}

	// Change view state
	m.viewState = ViewDetail
	m.activePanel = PanelFiles
	m.fileTree.Focus()
	m.isLoading = true
	m.loadingMessage = fmt.Sprintf("Loading PR #%d...", prNumber)

	// For now, use hardcoded owner/repo (later this should come from config or selection)
	owner := "golang"
	repo := "go"

	// Fetch PR details, files, and diff in parallel
	return tea.Batch(
		fetchPRDetail(m.provider, owner, repo, prNumber),
		fetchPRFiles(m.provider, owner, repo, prNumber),
		fetchPRDiff(m.provider, owner, repo, prNumber),
	)
}

func (m *Model) exitDetailView() {
	m.viewState = ViewList
	m.activePanel = PanelContent
	m.currentPR = nil
	m.currentDiff = nil
	m.currentFiles = nil
	m.statusMsg = ""
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

// Async command functions

func fetchPRList(provider providers.Provider, owner, repo string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		opts := providers.DefaultListOptions()
		prs, err := provider.ListPullRequests(ctx, owner, repo, opts)
		if err != nil {
			return errMsg{err}
		}
		return prListMsg{prs}
	}
}

func fetchPRDetail(provider providers.Provider, owner, repo string, number int) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		pr, err := provider.GetPullRequest(ctx, owner, repo, number)
		if err != nil {
			return errMsg{err}
		}
		return prDetailMsg{pr}
	}
}

func fetchPRFiles(provider providers.Provider, owner, repo string, number int) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		files, err := provider.GetPullRequestFiles(ctx, owner, repo, number)
		if err != nil {
			return errMsg{err}
		}
		return prFilesMsg{files}
	}
}

func fetchPRDiff(provider providers.Provider, owner, repo string, number int) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		diff, err := provider.GetPullRequestDiff(ctx, owner, repo, number)
		if err != nil {
			return errMsg{err}
		}
		return prDiffMsg{diff}
	}
}

// Run starts the TUI application
func Run(cfg *config.Config, provider providers.Provider, authService *auth.Service) error {
	p := tea.NewProgram(
		New(cfg, provider, authService),
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)

	if _, err := p.Run(); err != nil {
		return fmt.Errorf("error running program: %w", err)
	}

	return nil
}
