package gui

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"lazyreview/internal/auth"
	"lazyreview/internal/config"
	"lazyreview/internal/gui/views"
	"lazyreview/internal/models"
	"lazyreview/internal/storage"
	"lazyreview/pkg/components"
	"lazyreview/pkg/providers"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/spinner"
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

// ViewMode represents the current sidebar view mode
type ViewMode string

const (
	ViewModeCurrentRepo    ViewMode = "current_repo"
	ViewModeMyPRs          ViewMode = "my_prs"
	ViewModeReviewRequests ViewMode = "review_requests"
	ViewModeSettings       ViewMode = "settings"
	ViewModeWorkspaces     ViewMode = "workspaces"
	ViewModeRepoSelector   ViewMode = "repo_selector"
	ViewModeWorkspace      ViewMode = "workspace"
)

// Message types for async operations
type prListMsg struct {
	prs []models.PullRequest
}

type userPRsMsg struct {
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

type reviewResultMsg struct {
	action string // "approve", "request_changes", "comment"
	err    error
}

type commentSubmitMsg struct {
	body     string
	filePath string // empty for general comment
	line     int    // 0 for general comment
	err      error
}

type workspaceTabsMsg struct {
	tabs []models.WorkspaceTab
	err  error
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
	textInput   components.TextInput
	help        components.Help
	keyMap      KeyMap
	keySeq      *KeySequence
	showHelp    bool
	ready       bool
	statusMsg   string

	// Workspace storage and views
	storage            storage.Storage
	workspaceManager   views.WorkspaceManager
	repoSelector       views.RepoSelector
	workspaceTabs      components.Tabs
	workspaceTabItems  []models.WorkspaceTab
	currentWorkspace   models.WorkspaceTab
	workspaceRepoFilter []storage.RepoRef

	// Provider and auth
	provider    providers.Provider
	authService *auth.Service

	// Git context
	gitOwner string
	gitRepo  string

	// Current view mode
	currentViewMode ViewMode

	// Current PR state
	currentPR    *models.PullRequest
	currentDiff  *models.Diff
	currentFiles []models.FileChange
	prList       []models.PullRequest

	// Loading states
	isLoading      bool
	loadingMessage string
	lastError      error
	spinner        spinner.Model
}

// New creates a new GUI model
func New(cfg *config.Config, provider providers.Provider, authService *auth.Service, owner, repo string, store storage.Storage) Model {
	// Create sidebar with navigation items
	sidebarItems := []list.Item{
		components.NewSimpleItem("my_prs", "My PRs", "PRs you authored (all repos)"),
		components.NewSimpleItem("review_requests", "Review Requests", "PRs needing your review"),
		components.NewSimpleItem("current_repo", "Current Repo", "PRs in detected repo"),
		components.NewSimpleItem("workspaces", "Workspaces", "Create and manage repo groups"),
		components.NewSimpleItem("settings", "Settings", "Configure LazyReview"),
	}

	sidebar := components.NewList("Navigation", sidebarItems, 30, 20)

	// Create content panel (initially empty)
	content := components.NewList("Pull Requests", []list.Item{}, 50, 20)

	// Create file tree (for PR detail view)
	fileTree := components.NewFileTree(30, 20)

	// Create diff viewer (for PR detail view)
	diffViewer := components.NewDiffViewer(50, 20)

	// Create text input component
	textInput := components.NewTextInput()

	// Create loading spinner
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("170"))

	// Start with "My PRs" view by default
	initialViewMode := ViewModeMyPRs

	workspaceManager := views.NewWorkspaceManager(store, 50, 20)
	repoSelector := views.NewRepoSelector(provider, store, "", 50, 20)
	workspaceTabs := components.NewTabs(nil)

	return Model{
		config:          cfg,
		provider:        provider,
		authService:     authService,
		storage:         store,
		gitOwner:        owner,
		gitRepo:         repo,
		activePanel:     PanelSidebar,
		mode:            ModeNormal,
		viewState:       ViewList,
		currentViewMode: initialViewMode,
		sidebar:         sidebar,
		content:         content,
		fileTree:        fileTree,
		diffViewer:      diffViewer,
		textInput:       textInput,
		help:            components.NewHelp(),
		keyMap:          DefaultKeyMap(),
		keySeq:          NewKeySequence(),
		workspaceManager: workspaceManager,
		repoSelector:     repoSelector,
		workspaceTabs:    workspaceTabs,
		isLoading:       true,
		loadingMessage:  "Loading your pull requests...",
		spinner:         s,
	}
}

// Init implements tea.Model
func (m Model) Init() tea.Cmd {
	// Start with "My PRs" view by default
	opts := providers.UserPROptions{
		Involvement: "authored",
		State:       models.PRStateOpen,
		PerPage:     50,
		Page:        1,
	}
	// Start spinner and fetch PRs
	cmds := []tea.Cmd{m.spinner.Tick, fetchUserPRs(m.provider, opts)}
	if m.storage != nil {
		cmds = append(cmds, loadWorkspaceTabs(m.storage))
	}
	return tea.Batch(cmds...)
}

// Update implements tea.Model
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		// If text input is visible, handle its keys first
		if m.textInput.IsVisible() {
			switch msg.String() {
			case "ctrl+s":
				// Submit comment
				return m.submitComment()
			case "esc":
				// Cancel comment
				m.textInput.Hide()
				m.statusMsg = "Comment cancelled"
				return m, nil
			default:
				// Pass to text input
				var cmd tea.Cmd
				m.textInput, cmd = m.textInput.Update(msg)
				return m, cmd
			}
		}

		// Track key sequence for multi-key bindings like "gg"
		keyStr := msg.String()
		m.keySeq.Add(keyStr)

		// Check for "gg" sequence (go to top)
		if m.keySeq.IsSequence("g", "g") {
			m.keySeq.Reset()
			m.goToTop()
			return m, nil
		}

		// Quick workspace tab switch with number keys
		if m.viewState == ViewList && m.tabsVisible() {
			if idx, ok := parseDigitKey(keyStr); ok {
				if idx < len(m.workspaceTabItems) {
					cmd := m.selectWorkspaceTab(idx)
					return m, cmd
				}
			}
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
			if m.currentViewMode == ViewModeWorkspaces || m.currentViewMode == ViewModeRepoSelector {
				break
			}
			if m.viewState == ViewList {
				if m.activePanel == PanelSidebar {
					// Handle sidebar selection
					selectedItem := m.sidebar.SelectedItem()
					if selectedItem != nil {
						simpleItem, ok := selectedItem.(components.SimpleItem)
						if ok {
							// Check if this view is already loaded - just move to content panel
							viewID := simpleItem.ID()
							alreadyLoaded := (viewID == "my_prs" && m.currentViewMode == ViewModeMyPRs && len(m.prList) > 0) ||
								(viewID == "review_requests" && m.currentViewMode == ViewModeReviewRequests && len(m.prList) > 0) ||
								(viewID == "current_repo" && m.currentViewMode == ViewModeCurrentRepo && len(m.prList) > 0)

							if alreadyLoaded {
								// Just move focus to content panel, don't reload
								m.activePanel = PanelContent
								m.content.Focus()
								m.sidebar.Blur()
								return m, nil
							}

							cmd := m.handleSidebarSelection(viewID)
							return m, cmd
						}
					}
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

		// Action keys
		case key.Matches(msg, m.keyMap.Approve):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState == ViewDetail && m.currentPR != nil {
				m.statusMsg = fmt.Sprintf("Approving PR #%d...", m.currentPR.Number)
				m.isLoading = true
				m.loadingMessage = "Submitting approval..."
				owner := m.gitOwner
				repo := m.gitRepo
				if owner == "" || repo == "" {
					owner = "golang"
					repo = "go"
				}
				return m, approveReview(m.provider, owner, repo, m.currentPR.Number)
			} else {
				m.statusMsg = "Approve: Select a PR first"
			}
			return m, nil

		case key.Matches(msg, m.keyMap.RequestChanges):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState == ViewDetail && m.currentPR != nil {
				m.statusMsg = fmt.Sprintf("Requesting changes on PR #%d...", m.currentPR.Number)
				m.isLoading = true
				m.loadingMessage = "Submitting change request..."
				owner := m.gitOwner
				repo := m.gitRepo
				if owner == "" || repo == "" {
					owner = "golang"
					repo = "go"
				}
				return m, requestChanges(m.provider, owner, repo, m.currentPR.Number)
			} else {
				m.statusMsg = "Request Changes: Select a PR first"
			}
			return m, nil

		case key.Matches(msg, m.keyMap.Comment):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState == ViewDetail && m.currentPR != nil {
				// Line comment - get current line from diff viewer
				filePath, lineNo, isCode := m.diffViewer.CurrentLineInfo()
				if isCode && lineNo > 0 {
					context := fmt.Sprintf("%s:%d", filePath, lineNo)
					m.textInput.Show(components.TextInputLineComment, "Comment on line", context)
					m.textInput.SetSize(m.width-20, m.height-10)
					return m, nil
				} else {
					m.statusMsg = "Comment: Position cursor on a code line first"
				}
			} else {
				m.statusMsg = "Comment: Enter PR view first"
			}
			return m, nil

		case key.Matches(msg, m.keyMap.GeneralComment):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState == ViewDetail && m.currentPR != nil {
				// General PR comment
				m.textInput.Show(components.TextInputGeneralComment, "General PR Comment", "")
				m.textInput.SetSize(m.width-20, m.height-10)
				return m, nil
			} else {
				m.statusMsg = "Comment: Enter PR view first"
			}
			return m, nil

		case key.Matches(msg, m.keyMap.OpenBrowser):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState == ViewDetail && m.currentPR != nil {
				m.statusMsg = fmt.Sprintf("Opening PR #%d in browser... (not yet implemented)", m.currentPR.Number)
			} else {
				m.statusMsg = "Open in browser: Select a PR first"
			}
			return m, nil

		case key.Matches(msg, m.keyMap.Refresh):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState == ViewList {
				m.isLoading = true
				m.loadingMessage = "Refreshing pull requests..."
				m.statusMsg = "Refreshing..."
				// Use detected owner/repo or default
				owner := m.gitOwner
				repo := m.gitRepo
				if owner == "" || repo == "" {
					owner = "golang"
					repo = "go"
				}
				return m, fetchPRList(m.provider, owner, repo)
			}
			return m, nil

		case key.Matches(msg, m.keyMap.Search):
			m.statusMsg = "Search: Type to filter"
			// Let the list handle the search
		}

	case tea.WindowSizeMsg:
		m.applyLayout(msg.Width, msg.Height)
		return m, nil

	case prListMsg:
		m.isLoading = false
		m.prList = msg.prs

		if len(msg.prs) == 0 {
			m.statusMsg = "No open PRs in this repository. Try 'My PRs' to see PRs from all your repos."
			items := []list.Item{
				components.NewSimpleItem("empty", "No pull requests found", "Select 'My PRs' from sidebar to see PRs from all repos"),
			}
			contentWidth := m.width - 44
			contentHeight := m.height - 6
			m.content = components.NewList("Pull Requests", items, contentWidth, contentHeight)
			return m, nil
		}

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

	case userPRsMsg:
		m.isLoading = false
		prs := msg.prs
		if len(m.workspaceRepoFilter) > 0 {
			prs = filterPRsByRepos(prs, m.workspaceRepoFilter)
		}
		m.prList = prs

		if len(prs) == 0 {
			var emptyMsg string
			switch m.currentViewMode {
			case ViewModeMyPRs:
				emptyMsg = "You have no open PRs across all repositories"
			case ViewModeReviewRequests:
				emptyMsg = "No PRs currently requesting your review"
			case ViewModeWorkspace:
				if m.currentWorkspace.Name != "" {
					emptyMsg = fmt.Sprintf("No PRs found for %s", m.currentWorkspace.Name)
				} else {
					emptyMsg = "No PRs found for this workspace"
				}
			default:
				emptyMsg = "No pull requests found"
			}
			m.statusMsg = emptyMsg
			items := []list.Item{
				components.NewSimpleItem("empty", emptyMsg, "PRs will appear here when available"),
			}
			contentWidth := m.width - 44
			contentHeight := m.height - 6
			m.content = components.NewList("Pull Requests", items, contentWidth, contentHeight)
			return m, nil
		}

		// Convert PRs to list items
		items := make([]list.Item, len(prs))
		for i, pr := range prs {
			title := fmt.Sprintf("#%d %s", pr.Number, pr.Title)
			// Include repo name since these are from multiple repos
			desc := fmt.Sprintf("%s/%s • by %s • %s", pr.Repository.Owner, pr.Repository.Name, pr.Author.Login, pr.State)
			items[i] = components.NewSimpleItem(fmt.Sprintf("%d", pr.Number), title, desc)
		}
		contentWidth := m.width - 44
		contentHeight := m.height - 6
		m.content = components.NewList("Pull Requests", items, contentWidth, contentHeight)
		m.statusMsg = fmt.Sprintf("Loaded %d pull requests", len(prs))
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

		// If we're in detail view and got an error, go back to list view
		if m.viewState == ViewDetail {
			m.exitDetailView()

			// Check for SAML SSO errors
			if providers.IsSAMLError(msg.err) {
				m.statusMsg = "Cannot view PR: SAML SSO required. Authorize token at github.com/settings/tokens"
			} else {
				m.statusMsg = fmt.Sprintf("Cannot view PR: %s", msg.err.Error())
			}
			return m, nil
		}

		// Check for SAML SSO errors and show helpful message
		if providers.IsSAMLError(msg.err) {
			m.statusMsg = "SAML SSO required - Authorize your token at: github.com/settings/tokens"
			// Update content list to show helpful instructions
			items := []list.Item{
				components.NewSimpleItem("saml_error", "Organization requires SAML SSO", "Your token needs authorization for this org"),
				components.NewSimpleItem("saml_step1", "Step 1: Go to github.com/settings/tokens", "Open your GitHub token settings"),
				components.NewSimpleItem("saml_step2", "Step 2: Find your token", "Click 'Configure SSO' next to it"),
				components.NewSimpleItem("saml_step3", "Step 3: Authorize the organization", "Click 'Authorize' for the org"),
				components.NewSimpleItem("saml_tip", "Tip: Try 'My PRs' view", "Shows PRs from repos you have access to"),
			}
			contentWidth := m.width - 44
			contentHeight := m.height - 6
			m.content = components.NewList("SAML Authorization Required", items, contentWidth, contentHeight)
			return m, nil
		}

		m.statusMsg = fmt.Sprintf("Error: %s", msg.err.Error())
		return m, nil

	case reviewResultMsg:
		m.isLoading = false
		m.loadingMessage = ""
		if msg.err != nil {
			m.lastError = msg.err
			m.statusMsg = fmt.Sprintf("Review action failed: %s", msg.err.Error())
		} else {
			switch msg.action {
			case "approve":
				m.statusMsg = "PR approved successfully!"
			case "request_changes":
				m.statusMsg = "Changes requested successfully!"
			default:
				m.statusMsg = "Review action completed"
			}
		}
		return m, nil

	case commentSubmitMsg:
		m.isLoading = false
		m.loadingMessage = ""
		m.textInput.Hide()
		if msg.err != nil {
			m.lastError = msg.err
			m.statusMsg = fmt.Sprintf("Comment failed: %s", msg.err.Error())
		} else {
			if msg.filePath != "" && msg.line > 0 {
				m.statusMsg = fmt.Sprintf("Comment added to %s:%d", msg.filePath, msg.line)
			} else {
				m.statusMsg = "Comment added to PR"
			}
		}
		return m, nil

	case workspaceTabsMsg:
		if msg.err != nil {
			m.statusMsg = fmt.Sprintf("Failed to load workspaces: %s", msg.err.Error())
			return m, nil
		}
		m.workspaceTabItems = msg.tabs
		tabs := make([]components.Tab, 0, len(msg.tabs))
		for _, tab := range msg.tabs {
			tabs = append(tabs, components.Tab{ID: tab.ID, Label: tab.Name})
		}
		m.workspaceTabs.SetTabs(tabs)
		if m.currentWorkspace.ID != "" {
			m.setWorkspaceTabByID(m.currentWorkspace.ID)
		} else {
			m.setWorkspaceTabByKind(models.WorkspaceKindMyPRs)
		}
		m.applyLayout(m.width, m.height)
		return m, nil

	case views.OpenRepoSelectorMsg:
		m.currentViewMode = ViewModeRepoSelector
		m.activePanel = PanelContent
		m.repoSelector = views.NewRepoSelector(m.provider, m.storage, msg.WorkspaceID, m.contentWidth(), m.contentHeight())
		m.statusMsg = fmt.Sprintf("Selecting repos for workspace %s", msg.WorkspaceID)
		m.applyLayout(m.width, m.height)
		return m, m.repoSelector.Load()

	case views.RepoSelectorCloseMsg:
		m.currentViewMode = ViewModeWorkspaces
		m.activePanel = PanelContent
		m.statusMsg = "Returned to workspace manager"
		m.workspaceManager.Refresh()
		m.applyLayout(m.width, m.height)
		return m, nil

	case views.WorkspacesChangedMsg:
		if m.storage != nil {
			return m, loadWorkspaceTabs(m.storage)
		}
		return m, nil

	case keyTimeoutMsg:
		m.keySeq.Reset()
		return m, nil

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	}

	// Update the active panel based on view state
	var cmd tea.Cmd
	if !m.textInput.IsVisible() {
		if m.viewState == ViewList {
			if m.activePanel == PanelSidebar {
				m.sidebar, cmd = m.sidebar.Update(msg)
				cmds = append(cmds, cmd)
			} else {
				switch m.currentViewMode {
				case ViewModeWorkspaces:
					m.workspaceManager, cmd = m.workspaceManager.Update(msg)
				case ViewModeRepoSelector:
					m.repoSelector, cmd = m.repoSelector.Update(msg)
				default:
					m.content, cmd = m.content.Update(msg)
				}
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
		loadingStyle := lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("170")).
			Padding(2, 4)

		spinnerView := m.spinner.View()
		loadingText := fmt.Sprintf("%s %s", spinnerView, m.loadingMessage)

		return lipgloss.Place(
			m.width,
			m.height,
			lipgloss.Center,
			lipgloss.Center,
			loadingStyle.Render(loadingText),
		)
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
		switch m.currentViewMode {
		case ViewModeMyPRs:
			headerText = fmt.Sprintf("LazyReview - My PRs (%d)", len(m.prList))
		case ViewModeReviewRequests:
			headerText = fmt.Sprintf("LazyReview - Review Requests (%d)", len(m.prList))
		case ViewModeWorkspace:
			if m.currentWorkspace.Name != "" {
				headerText = fmt.Sprintf("LazyReview - %s (%d)", m.currentWorkspace.Name, len(m.prList))
			} else {
				headerText = fmt.Sprintf("LazyReview - Workspace (%d)", len(m.prList))
			}
		case ViewModeCurrentRepo:
			if m.gitOwner != "" && m.gitRepo != "" {
				headerText = fmt.Sprintf("LazyReview - %s/%s", m.gitOwner, m.gitRepo)
			} else {
				headerText = "LazyReview - Current Repo"
			}
		case ViewModeWorkspaces:
			headerText = "LazyReview - Workspace Manager"
		case ViewModeRepoSelector:
			headerText = "LazyReview - Repo Selector"
		default:
			headerText = "LazyReview - Code Review TUI"
		}
	} else if m.currentPR != nil {
		headerText = fmt.Sprintf("LazyReview - PR #%d: %s", m.currentPR.Number, m.currentPR.Title)
	} else {
		headerText = "LazyReview - PR Details"
	}
	header := headerStyle.Render(headerText)

	tabsView := ""
	if m.tabsVisible() {
		tabsView = m.workspaceTabs.View(m.width)
	}

	var mainArea string
	if m.viewState == ViewList {
		// List view: sidebar + content
		var sidebarView, contentView string
		if m.activePanel == PanelSidebar {
			sidebarView = focusedStyle.Render(m.sidebar.View())
		} else {
			sidebarView = unfocusedStyle.Render(m.sidebar.View())
		}

		var rawContent string
		switch m.currentViewMode {
		case ViewModeWorkspaces:
			rawContent = m.workspaceManager.View()
		case ViewModeRepoSelector:
			rawContent = m.repoSelector.View()
		default:
			rawContent = m.content.View()
		}

		if m.activePanel == PanelContent {
			contentView = focusedStyle.Render(rawContent)
		} else {
			contentView = unfocusedStyle.Render(rawContent)
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
	status := m.statusMsg
	if status == "" {
		switch m.currentViewMode {
		case ViewModeWorkspaces:
			status = m.workspaceManager.Status()
		case ViewModeRepoSelector:
			status = m.repoSelector.Status()
		}
	}
	if m.showHelp {
		footer = m.help.View()
	} else if status != "" {
		footer = footerStyle.Render(status)
	} else if m.currentViewMode == ViewModeWorkspaces {
		footer = footerStyle.Render("n:new  e:edit  d:delete  a:add repo  x:remove repo  J/K:reorder  tab:switch panel  esc:back  ?:help")
	} else if m.currentViewMode == ViewModeRepoSelector {
		footer = footerStyle.Render("enter:add repo  a:add repo  tab:switch panel  /:filter  r:refresh  esc:back  ?:help")
	} else if m.viewState == ViewDetail {
		footer = footerStyle.Render("j/k:navigate  h/l:panels  n/N:next/prev file  a:approve  r:request changes  c:line comment  C:PR comment  d:toggle view  esc:back  ?:help")
	} else {
		footer = footerStyle.Render("j/k:navigate  h/l:panels  enter:view PR  ?:help  q:quit")
	}

	// Combine all
	sections := []string{header}
	if tabsView != "" {
		sections = append(sections, tabsView)
	}
	sections = append(sections, mainArea, footer)
	view := lipgloss.JoinVertical(lipgloss.Left, sections...)

	// Show text input overlay if visible
	if m.textInput.IsVisible() {
		inputView := m.textInput.View()
		// Layer the input on top of the main view (centered)
		return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, inputView)
	}

	return view
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

	// Check if this is the empty state item
	if simpleItem.ID() == "empty" {
		m.statusMsg = "No PR to view"
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
	m.applyLayout(m.width, m.height)

	// Use owner/repo from the selected PR (for cross-repo views)
	// or from git context (for current repo view)
	owner := selectedPR.Repository.Owner
	repo := selectedPR.Repository.Name

	// Fallback to git context if PR doesn't have repo info
	if owner == "" {
		owner = m.gitOwner
	}
	if repo == "" {
		repo = m.gitRepo
	}

	// Fallback to default if still empty
	if owner == "" || repo == "" {
		owner = "golang"
		repo = "go"
	}

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
	m.applyLayout(m.width, m.height)
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

func (m *Model) submitComment() (tea.Model, tea.Cmd) {
	body := m.textInput.Value()
	if body == "" {
		m.statusMsg = "Comment cannot be empty"
		return *m, nil
	}

	if m.currentPR == nil {
		m.statusMsg = "No PR selected"
		m.textInput.Hide()
		return *m, nil
	}

	// Get owner/repo
	owner := m.gitOwner
	repo := m.gitRepo
	if owner == "" || repo == "" {
		owner = "golang"
		repo = "go"
	}

	m.isLoading = true
	m.loadingMessage = "Submitting comment..."

	mode := m.textInput.Mode()
	if mode == components.TextInputLineComment {
		// Parse file path and line from context
		context := m.textInput.Context()
		// Context format is "filepath:line"
		// Split by last colon to handle file paths with colons
		lastColon := -1
		for i := len(context) - 1; i >= 0; i-- {
			if context[i] == ':' {
				lastColon = i
				break
			}
		}

		if lastColon == -1 {
			m.statusMsg = "Invalid line context format"
			m.textInput.Hide()
			m.isLoading = false
			return *m, nil
		}

		filePath := context[:lastColon]
		var line int
		_, err := fmt.Sscanf(context[lastColon+1:], "%d", &line)
		if err != nil {
			m.statusMsg = fmt.Sprintf("Failed to parse line number: %s", err.Error())
			m.textInput.Hide()
			m.isLoading = false
			return *m, nil
		}

		return *m, submitLineComment(m.provider, owner, repo, m.currentPR.Number, body, filePath, line)
	} else if mode == components.TextInputGeneralComment {
		return *m, submitGeneralComment(m.provider, owner, repo, m.currentPR.Number, body)
	}

	m.textInput.Hide()
	m.isLoading = false
	m.statusMsg = "Unknown comment mode"
	return *m, nil
}

// handleSidebarSelection handles when a sidebar item is selected
func (m *Model) handleSidebarSelection(itemID string) tea.Cmd {
	m.isLoading = true

	switch itemID {
	case "my_prs":
		m.currentViewMode = ViewModeMyPRs
		m.workspaceRepoFilter = nil
		m.setWorkspaceTabByKind(models.WorkspaceKindMyPRs)
		m.loadingMessage = "Loading your PRs across all repositories..."
		m.applyLayout(m.width, m.height)
		opts := providers.UserPROptions{
			Involvement: "authored",
			State:       models.PRStateOpen,
			PerPage:     50,
			Page:        1,
		}
		return tea.Batch(m.spinner.Tick, fetchUserPRs(m.provider, opts))

	case "review_requests":
		m.currentViewMode = ViewModeReviewRequests
		m.workspaceRepoFilter = nil
		m.setWorkspaceTabByKind(models.WorkspaceKindToReview)
		m.loadingMessage = "Loading PRs that need your review..."
		m.applyLayout(m.width, m.height)
		opts := providers.UserPROptions{
			Involvement: "review_requested",
			State:       models.PRStateOpen,
			PerPage:     50,
			Page:        1,
		}
		return tea.Batch(m.spinner.Tick, fetchUserPRs(m.provider, opts))

	case "current_repo":
		m.currentViewMode = ViewModeCurrentRepo
		m.workspaceRepoFilter = nil
		m.applyLayout(m.width, m.height)
		owner := m.gitOwner
		repo := m.gitRepo
		if owner == "" || repo == "" {
			m.isLoading = false
			m.statusMsg = "No git repository detected"
			return nil
		}
		m.loadingMessage = fmt.Sprintf("Loading PRs for %s/%s...", owner, repo)
		return tea.Batch(m.spinner.Tick, fetchPRList(m.provider, owner, repo))

	case "workspaces":
		m.currentViewMode = ViewModeWorkspaces
		m.isLoading = false
		m.workspaceManager.Refresh()
		m.statusMsg = "Workspace manager"
		m.applyLayout(m.width, m.height)
		return nil

	case "settings":
		m.currentViewMode = ViewModeSettings
		m.isLoading = false
		m.statusMsg = "Settings view not yet implemented"
		m.applyLayout(m.width, m.height)
		return nil

	default:
		m.isLoading = false
		return nil
	}
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

func fetchUserPRs(provider providers.Provider, opts providers.UserPROptions) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		prs, err := provider.ListUserPullRequests(ctx, opts)
		if err != nil {
			return errMsg{err}
		}
		return userPRsMsg{prs}
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

func approveReview(provider providers.Provider, owner, repo string, number int) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		err := provider.ApproveReview(ctx, owner, repo, number, "")
		return reviewResultMsg{action: "approve", err: err}
	}
}

func requestChanges(provider providers.Provider, owner, repo string, number int) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		err := provider.RequestChanges(ctx, owner, repo, number, "Changes requested via LazyReview")
		return reviewResultMsg{action: "request_changes", err: err}
	}
}

func submitLineComment(provider providers.Provider, owner, repo string, prNumber int, body, path string, line int) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		comment := models.CommentInput{
			Body: body,
			Path: path,
			Line: line,
			Side: models.DiffSideRight, // Comment on the new/right side by default
		}

		err := provider.CreateComment(ctx, owner, repo, prNumber, comment)
		return commentSubmitMsg{body: body, filePath: path, line: line, err: err}
	}
}

func submitGeneralComment(provider providers.Provider, owner, repo string, prNumber int, body string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		comment := models.CommentInput{
			Body: body,
		}

		err := provider.CreateComment(ctx, owner, repo, prNumber, comment)
		return commentSubmitMsg{body: body, filePath: "", line: 0, err: err}
	}
}

const workspaceOrderSettingKey = "workspace_order"

func (m *Model) applyLayout(width, height int) {
	m.width = width
	m.height = height
	m.ready = true

	sidebarWidth := min(40, width/4)
	contentWidth := width - sidebarWidth - 4

	headerHeight := 3
	footerHeight := 3
	panelHeight := height - headerHeight - footerHeight - m.tabsHeight()

	if panelHeight < 5 {
		panelHeight = 5
	}

	// List view components
	m.sidebar.SetSize(sidebarWidth, panelHeight)
	m.content.SetSize(contentWidth, panelHeight)
	m.workspaceManager.SetSize(contentWidth, panelHeight)
	m.repoSelector.SetSize(contentWidth, panelHeight)

	// Detail view components
	fileTreeWidth := min(40, width/4)
	diffWidth := width - fileTreeWidth - 4
	m.fileTree.SetSize(fileTreeWidth, panelHeight)
	m.diffViewer.SetSize(diffWidth, panelHeight)

	// Text input takes a centered portion of the screen
	m.textInput.SetSize(width-20, height-10)

	m.help.SetWidth(width)
}

func (m *Model) tabsVisible() bool {
	if m.viewState != ViewList {
		return false
	}
	if m.currentViewMode == ViewModeWorkspaces || m.currentViewMode == ViewModeRepoSelector || m.currentViewMode == ViewModeSettings {
		return false
	}
	return m.workspaceTabs.Count() > 0
}

func (m *Model) tabsHeight() int {
	if m.tabsVisible() {
		return 1
	}
	return 0
}

func (m *Model) contentWidth() int {
	sidebarWidth := min(40, m.width/4)
	return m.width - sidebarWidth - 4
}

func (m *Model) contentHeight() int {
	headerHeight := 3
	footerHeight := 3
	return m.height - headerHeight - footerHeight - m.tabsHeight()
}

func (m *Model) inWorkspaceView() bool {
	return m.currentViewMode == ViewModeWorkspaces || m.currentViewMode == ViewModeRepoSelector
}

func parseDigitKey(key string) (int, bool) {
	if len(key) != 1 {
		return 0, false
	}
	if key[0] < '1' || key[0] > '9' {
		return 0, false
	}
	return int(key[0]-'1'), true
}

func (m *Model) setWorkspaceTabByKind(kind models.WorkspaceKind) {
	for i, tab := range m.workspaceTabItems {
		if tab.Kind == kind {
			m.workspaceTabs.Select(i)
			m.currentWorkspace = tab
			return
		}
	}
}

func (m *Model) setWorkspaceTabByID(id string) {
	for i, tab := range m.workspaceTabItems {
		if tab.ID == id {
			m.workspaceTabs.Select(i)
			m.currentWorkspace = tab
			return
		}
	}
}

func (m *Model) selectWorkspaceTab(index int) tea.Cmd {
	if index < 0 || index >= len(m.workspaceTabItems) {
		return nil
	}
	tab := m.workspaceTabItems[index]
	m.workspaceTabs.Select(index)
	m.currentWorkspace = tab
	m.workspaceRepoFilter = nil
	m.isLoading = true

	switch tab.Kind {
	case models.WorkspaceKindMyPRs:
		m.currentViewMode = ViewModeMyPRs
		m.loadingMessage = "Loading your PRs across all repositories..."
		opts := providers.UserPROptions{
			Involvement: "authored",
			State:       models.PRStateOpen,
			PerPage:     50,
			Page:        1,
		}
		return tea.Batch(m.spinner.Tick, fetchUserPRs(m.provider, opts))
	case models.WorkspaceKindToReview:
		m.currentViewMode = ViewModeReviewRequests
		m.loadingMessage = "Loading PRs that need your review..."
		opts := providers.UserPROptions{
			Involvement: "review_requested",
			State:       models.PRStateOpen,
			PerPage:     50,
			Page:        1,
		}
		return tea.Batch(m.spinner.Tick, fetchUserPRs(m.provider, opts))
	default:
		m.currentViewMode = ViewModeWorkspace
		if tab.Name != "" {
			m.loadingMessage = fmt.Sprintf("Loading %s PRs...", tab.Name)
		} else {
			m.loadingMessage = "Loading workspace PRs..."
		}
		if m.storage != nil {
			repos, err := m.loadWorkspaceRepos(tab)
			if err != nil {
				m.statusMsg = fmt.Sprintf("Workspace filter error: %s", err.Error())
			} else {
				m.workspaceRepoFilter = repos
				if len(repos) == 0 && tab.Kind != models.WorkspaceKindAll {
					m.statusMsg = fmt.Sprintf("No repositories configured for %s", tab.Name)
				}
			}
		}
		opts := providers.UserPROptions{
			Involvement: "all",
			State:       models.PRStateOpen,
			PerPage:     50,
			Page:        1,
		}
		return tea.Batch(m.spinner.Tick, fetchUserPRs(m.provider, opts))
	}
}

func (m *Model) loadWorkspaceRepos(tab models.WorkspaceTab) ([]storage.RepoRef, error) {
	if m.storage == nil {
		return nil, fmt.Errorf("storage unavailable")
	}
	switch tab.Kind {
	case models.WorkspaceKindRecent:
		return m.storage.GetRecentRepos(200)
	case models.WorkspaceKindFavorites:
		return m.storage.ListFavorites()
	case models.WorkspaceKindCustom:
		workspace, err := m.storage.GetWorkspace(tab.WorkspaceID)
		if err != nil {
			return nil, err
		}
		return workspace.Repos, nil
	}
	return nil, nil
}

func loadWorkspaceTabs(store storage.Storage) tea.Cmd {
	return func() tea.Msg {
		workspaces, err := store.ListWorkspaces()
		if err != nil {
			return workspaceTabsMsg{err: err}
		}
		order := loadWorkspaceOrder(store, workspaces)
		ordered := applyWorkspaceOrder(workspaces, order)
		tabs := []models.WorkspaceTab{
			{ID: "all", Name: "All", Kind: models.WorkspaceKindAll},
			{ID: "recent", Name: "Recent", Kind: models.WorkspaceKindRecent},
			{ID: "favorites", Name: "Favorites", Kind: models.WorkspaceKindFavorites},
			{ID: "my_prs", Name: "My PRs", Kind: models.WorkspaceKindMyPRs},
			{ID: "to_review", Name: "To Review", Kind: models.WorkspaceKindToReview},
		}
		for _, ws := range ordered {
			tabs = append(tabs, models.WorkspaceTab{
				ID:          ws.ID,
				Name:        ws.Name,
				Kind:        models.WorkspaceKindCustom,
				WorkspaceID: ws.ID,
			})
		}
		return workspaceTabsMsg{tabs: tabs}
	}
}

func loadWorkspaceOrder(store storage.Storage, workspaces []storage.Workspace) []string {
	value, err := store.GetSetting(workspaceOrderSettingKey)
	if err != nil || value == "" {
		return defaultWorkspaceOrder(workspaces)
	}
	var order []string
	if err := json.Unmarshal([]byte(value), &order); err != nil {
		return defaultWorkspaceOrder(workspaces)
	}
	seen := make(map[string]bool, len(order))
	filtered := make([]string, 0, len(workspaces))
	for _, id := range order {
		seen[id] = true
		filtered = append(filtered, id)
	}
	for _, ws := range workspaces {
		if !seen[ws.ID] {
			filtered = append(filtered, ws.ID)
		}
	}
	return filtered
}

func applyWorkspaceOrder(workspaces []storage.Workspace, order []string) []storage.Workspace {
	if len(order) == 0 || len(workspaces) == 0 {
		return workspaces
	}
	lookup := make(map[string]storage.Workspace, len(workspaces))
	for _, ws := range workspaces {
		lookup[ws.ID] = ws
	}
	ordered := make([]storage.Workspace, 0, len(workspaces))
	for _, id := range order {
		if ws, ok := lookup[id]; ok {
			ordered = append(ordered, ws)
			delete(lookup, id)
		}
	}
	for _, ws := range workspaces {
		if _, ok := lookup[ws.ID]; ok {
			ordered = append(ordered, ws)
		}
	}
	return ordered
}

func defaultWorkspaceOrder(workspaces []storage.Workspace) []string {
	order := make([]string, 0, len(workspaces))
	for _, ws := range workspaces {
		order = append(order, ws.ID)
	}
	return order
}

func filterPRsByRepos(prs []models.PullRequest, repos []storage.RepoRef) []models.PullRequest {
	if len(repos) == 0 {
		return []models.PullRequest{}
	}
	allowed := make(map[string]struct{}, len(repos))
	for _, repo := range repos {
		key := strings.ToLower(fmt.Sprintf("%s/%s", repo.Owner, repo.Repo))
		allowed[key] = struct{}{}
	}
	filtered := make([]models.PullRequest, 0, len(prs))
	for _, pr := range prs {
		key := strings.ToLower(fmt.Sprintf("%s/%s", pr.Repository.Owner, pr.Repository.Name))
		if _, ok := allowed[key]; ok {
			filtered = append(filtered, pr)
		}
	}
	return filtered
}

// Run starts the TUI application
func Run(cfg *config.Config, provider providers.Provider, authService *auth.Service, owner, repo string, store storage.Storage) error {
	p := tea.NewProgram(
		New(cfg, provider, authService, owner, repo, store),
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)

	if _, err := p.Run(); err != nil {
		return fmt.Errorf("error running program: %w", err)
	}

	return nil
}
