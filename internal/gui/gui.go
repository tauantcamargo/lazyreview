package gui

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"lazyreview/internal/ai"
	"lazyreview/internal/auth"
	"lazyreview/internal/config"
	"lazyreview/internal/gui/views"
	"lazyreview/internal/models"
	"lazyreview/internal/queue"
	"lazyreview/internal/services"
	"lazyreview/internal/storage"
	"lazyreview/pkg/components"
	"lazyreview/pkg/git"
	"lazyreview/pkg/providers"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/google/uuid"
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

// DetailSidebarMode represents the left panel mode in detail view.
type DetailSidebarMode int

const (
	DetailSidebarFiles DetailSidebarMode = iota
	DetailSidebarComments
)

// ViewMode represents the current sidebar view mode
type ViewMode string

const (
	ViewModeCurrentRepo    ViewMode = "current_repo"
	ViewModeMyPRs          ViewMode = "my_prs"
	ViewModeReviewRequests ViewMode = "review_requests"
	ViewModeAssignedToMe   ViewMode = "assigned_to_me"
	ViewModeSettings       ViewMode = "settings"
	ViewModeWorkspaces     ViewMode = "workspaces"
	ViewModeRepoSelector   ViewMode = "repo_selector"
	ViewModeWorkspace      ViewMode = "workspace"
	ViewModeDashboard      ViewMode = "dashboard"
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

type prCommentsMsg struct {
	comments []models.Comment
	err      error
}

type errMsg struct {
	err error
}

type providerReadyMsg struct {
	provider providers.Provider
}

type reviewResultMsg struct {
	action string // "approve", "request_changes", "comment"
	owner  string
	repo   string
	number int
	body   string
	err    error
}

type replyResultMsg struct {
	commentID string
	err       error
}

type aiReviewResultMsg struct {
	response ai.ReviewResponse
	err      error
}

type commentSubmitMsg struct {
	body      string
	filePath  string // empty for general comment
	line      int    // 0 for general comment
	startLine int
	side      models.DiffSide
	commitID  string
	owner     string
	repo      string
	number    int
	err       error
}

type workspaceTabsMsg struct {
	tabs []models.WorkspaceTab
	err  error
}

type currentUserMsg struct {
	user *models.User
	err  error
}

type dashboardDataMsg struct {
	result services.AggregationResult
	err    error
}

type queueSyncMsg struct {
	processed int
	failed    int
	err       error
}

type gitStatusMsg struct {
	status *git.BranchStatus
	err    error
}

type checkoutResultMsg struct {
	branch string
	err    error
}

type queuedCommentPayload struct {
	Body      string `json:"body"`
	FilePath  string `json:"file_path,omitempty"`
	Line      int    `json:"line,omitempty"`
	StartLine int    `json:"start_line,omitempty"`
	Side      string `json:"side,omitempty"`
	CommitID  string `json:"commit_id,omitempty"`
}

type queuedReviewPayload struct {
	Body string `json:"body"`
}

const queueSyncInterval = time.Minute

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
	storage             storage.Storage
	workspaceManager    views.WorkspaceManager
	repoSelector        views.RepoSelector
	workspaceTabs       components.Tabs
	workspaceTabItems   []models.WorkspaceTab
	currentWorkspace    models.WorkspaceTab
	workspaceRepoFilter []storage.RepoRef
	dashboard           views.Dashboard
	aggregator          *services.Aggregator
	currentUserLogin    string
	sidebarCounts       map[string]int
	prListCache         *services.Cache[[]models.PullRequest]
	prDetailCache       *services.Cache[*models.PullRequest]
	prFilesCache        *services.Cache[[]models.FileChange]
	prDiffCache         *services.Cache[*models.Diff]

	// Provider and auth
	provider    providers.Provider
	authService *auth.Service
	aiProvider  ai.Provider
	aiError     error

	// Git context
	gitOwner        string
	gitRepo         string
	gitBranchStatus *git.BranchStatus
	gitStatusErr    error

	// Current view mode
	currentViewMode ViewMode

	// Detail view sidebar mode
	detailSidebarMode DetailSidebarMode

	// Current PR state
	currentPR    *models.PullRequest
	currentDiff  *models.Diff
	currentFiles []models.FileChange
	prList       []models.PullRequest
	comments     []models.Comment
	commentsList components.List

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
		components.NewSimpleItem("dashboard", "Dashboard", "Grouped PR overview"),
		components.NewSimpleItem("my_prs", "My PRs", "PRs you authored (all repos)"),
		components.NewSimpleItem("review_requests", "Review Requests", "PRs needing your review"),
		components.NewSimpleItem("assigned_to_me", "Assigned to Me", "PRs assigned to you"),
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

	// Create comments list (for PR detail view)
	commentsList := components.NewList("Comments", []list.Item{}, 30, 20)

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
	dashboard := views.NewDashboard(50, 20)
	aggregator := services.NewAggregator(provider)
	prListCache := services.NewCache[[]models.PullRequest](2 * time.Minute)
	prDetailCache := services.NewCache[*models.PullRequest](2 * time.Minute)
	prFilesCache := services.NewCache[[]models.FileChange](2 * time.Minute)
	prDiffCache := services.NewCache[*models.Diff](2 * time.Minute)
	aiProvider, aiErr := ai.NewProviderFromEnv()

	return Model{
		config:           cfg,
		provider:         provider,
		authService:      authService,
		aiProvider:       aiProvider,
		aiError:          aiErr,
		storage:          store,
		gitOwner:         owner,
		gitRepo:          repo,
		activePanel:      PanelSidebar,
		mode:             ModeNormal,
		viewState:        ViewList,
		currentViewMode:  initialViewMode,
		sidebar:          sidebar,
		content:          content,
		fileTree:         fileTree,
		diffViewer:       diffViewer,
		commentsList:     commentsList,
		textInput:        textInput,
		help:             components.NewHelp(),
		keyMap:           DefaultKeyMap(),
		keySeq:           NewKeySequence(),
		workspaceManager: workspaceManager,
		repoSelector:     repoSelector,
		workspaceTabs:    workspaceTabs,
		dashboard:        dashboard,
		aggregator:       aggregator,
		sidebarCounts:    map[string]int{},
		prListCache:      prListCache,
		prDetailCache:    prDetailCache,
		prFilesCache:     prFilesCache,
		prDiffCache:      prDiffCache,
		isLoading:        true,
		loadingMessage:   "Loading your pull requests...",
		spinner:          s,
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
		cmds = append(cmds, m.queueSyncCmd())
	}
	if m.gitOwner != "" && m.gitRepo != "" {
		cmds = append(cmds, m.fetchGitStatus())
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

		if m.viewState == ViewList {
			switch keyStr {
			case "m":
				return m, m.switchSidebarView("my_prs")
			case "R":
				return m, m.switchSidebarView("review_requests")
			}
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
					m.focusDetailSidebar()
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
			if m.viewState == ViewList && m.currentViewMode == ViewModeDashboard && m.activePanel == PanelContent {
				return m.enterDetailViewFromDashboard()
			}
			if (m.currentViewMode == ViewModeWorkspaces || m.currentViewMode == ViewModeRepoSelector) && m.activePanel == PanelContent {
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
					if m.detailSidebarMode == DetailSidebarFiles {
						if selectedPath := m.fileTree.SelectedPath(); selectedPath != "" {
							m.diffViewer.SetCurrentFileByPath(selectedPath)
						}
					}
					m.activePanel = PanelDiff
					m.diffViewer.Focus()
					m.blurDetailSidebar()
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

		case key.Matches(msg, m.keyMap.ToggleComments):
			if m.viewState == ViewDetail {
				if m.detailSidebarMode == DetailSidebarComments {
					m.detailSidebarMode = DetailSidebarFiles
					m.statusMsg = "Files panel"
				} else {
					m.detailSidebarMode = DetailSidebarComments
					m.statusMsg = "Comments panel"
					if len(m.comments) == 0 {
						return m, m.refreshComments()
					}
				}
				if m.activePanel == PanelFiles {
					m.focusDetailSidebar()
				}
				return m, nil
			}

		// Action keys
		case key.Matches(msg, m.keyMap.Approve):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState == ViewDetail && m.currentPR != nil {
				m.textInput.Show(components.TextInputApprove, "Approve PR", "")
				m.textInput.SetSize(m.width-20, m.height-10)
				return m, nil
			} else {
				m.statusMsg = "Approve: Select a PR first"
			}
			return m, nil

		case key.Matches(msg, m.keyMap.RequestChanges):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState == ViewDetail && m.currentPR != nil {
				m.textInput.Show(components.TextInputRequestChanges, "Request Changes", "")
				m.textInput.SetSize(m.width-20, m.height-10)
				return m, nil
			} else {
				m.statusMsg = "Request Changes: Select a PR first"
			}
			return m, nil

		case key.Matches(msg, m.keyMap.Comment):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState == ViewDetail && m.currentPR != nil {
				if m.activePanel != PanelDiff {
					if m.detailSidebarMode == DetailSidebarFiles {
						if selectedPath := m.fileTree.SelectedPath(); selectedPath != "" {
							m.diffViewer.SetCurrentFileByPath(selectedPath)
						}
					}
					m.activePanel = PanelDiff
					m.diffViewer.Focus()
					m.blurDetailSidebar()
				}
				if !m.diffViewer.EnsureCursorOnCodeLine() {
					m.statusMsg = "Comment: Position cursor on a code line first"
					return m, nil
				}
				// Line comment - get current line from diff viewer
				filePath, lineNo, side, isCode := m.diffViewer.CurrentLineInfo()
				if isCode && lineNo > 0 {
					context := fmt.Sprintf("%s:%d:%s", filePath, lineNo, side)
					m.textInput.Show(components.TextInputLineComment, "Comment on line", context)
					m.textInput.SetSize(m.width-20, m.height-10)
					return m, nil
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

		case key.Matches(msg, m.keyMap.ReviewComment):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState == ViewDetail && m.currentPR != nil {
				m.textInput.Show(components.TextInputReviewComment, "Review Comment", "")
				m.textInput.SetSize(m.width-20, m.height-10)
				return m, nil
			}
			m.statusMsg = "Review Comment: Enter PR view first"
			return m, nil

		case key.Matches(msg, m.keyMap.ReplyComment):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState != ViewDetail || m.detailSidebarMode != DetailSidebarComments || m.currentPR == nil {
				m.statusMsg = "Reply: Open comments panel in PR view"
				return m, nil
			}
			selected := m.commentsList.SelectedItem()
			if selected == nil {
				m.statusMsg = "Reply: Select a comment first"
				return m, nil
			}
			item, ok := selected.(components.SimpleItem)
			if !ok {
				m.statusMsg = "Reply: Invalid comment selection"
				return m, nil
			}
			commentID := item.ID()
			if commentID == "" {
				m.statusMsg = "Reply: Missing comment ID"
				return m, nil
			}
			if comment := m.findCommentByID(commentID); comment != nil {
				if comment.Type == models.CommentTypeGeneral {
					m.statusMsg = "Reply: Provider does not support replies to general comments"
					return m, nil
				}
			}
			m.textInput.Show(components.TextInputReplyComment, "Reply to Comment", commentID)
			m.textInput.SetSize(m.width-20, m.height-10)
			return m, nil

		case key.Matches(msg, m.keyMap.AIReview):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState != ViewDetail || m.currentDiff == nil || m.currentPR == nil {
				m.statusMsg = "AI Review: Open a PR diff first"
				return m, nil
			}
			if m.aiProvider == nil {
				if m.aiError != nil {
					m.statusMsg = fmt.Sprintf("AI Review unavailable: %s", m.aiError.Error())
				} else {
					m.statusMsg = "AI Review unavailable: provider not configured"
				}
				return m, nil
			}
			m.isLoading = true
			m.loadingMessage = "Running AI review..."
			return m, m.startAIReview()

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

		case key.Matches(msg, m.keyMap.Checkout):
			if m.inWorkspaceView() {
				break
			}
			if m.currentPR == nil {
				m.statusMsg = "Checkout: Select a PR first"
				return m, nil
			}
			if strings.TrimSpace(m.currentPR.SourceBranch) == "" {
				m.statusMsg = "Checkout: PR source branch unavailable"
				return m, nil
			}
			m.isLoading = true
			m.loadingMessage = fmt.Sprintf("Checking out %s...", m.currentPR.SourceBranch)
			owner, repo := m.resolvePRRepo()
			return m, checkoutPRBranch(m.currentPR, owner, repo)

		case key.Matches(msg, m.keyMap.Refresh):
			if m.inWorkspaceView() {
				break
			}
			if m.currentViewMode == ViewModeDashboard {
				m.isLoading = true
				m.loadingMessage = "Refreshing dashboard..."
				return m, m.fetchDashboard()
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
				return m, tea.Batch(m.fetchPRListCached(owner, repo), m.fetchGitStatus())
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

		switch m.currentViewMode {
		case ViewModeMyPRs:
			m.sidebarCounts["my_prs"] = len(prs)
		case ViewModeReviewRequests:
			m.sidebarCounts["review_requests"] = len(prs)
		case ViewModeAssignedToMe:
			m.sidebarCounts["assigned_to_me"] = len(prs)
		}
		m.refreshSidebarItems()

		if len(prs) == 0 {
			var emptyMsg string
			switch m.currentViewMode {
			case ViewModeMyPRs:
				emptyMsg = "You have no open PRs across all repositories"
			case ViewModeReviewRequests:
				emptyMsg = "No PRs currently requesting your review"
			case ViewModeAssignedToMe:
				emptyMsg = "No PRs currently assigned to you"
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

	case prCommentsMsg:
		if msg.err != nil {
			m.statusMsg = fmt.Sprintf("Failed to load comments: %s", msg.err.Error())
			return m, nil
		}
		m.comments = msg.comments
		cmd := m.commentsList.SetItems(buildCommentItems(msg.comments))
		return m, cmd

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
		m.textInput.Hide()
		if msg.err != nil {
			if providers.IsNetworkError(msg.err) {
				if err := m.enqueueReviewAction(msg); err != nil {
					m.lastError = err
					m.statusMsg = fmt.Sprintf("Review failed and could not be queued: %s", err.Error())
				} else {
					m.lastError = nil
					m.statusMsg = "Offline: review action queued for retry"
				}
			} else {
				m.lastError = msg.err
				m.statusMsg = fmt.Sprintf("Review action failed: %s", msg.err.Error())
			}
		} else {
			switch msg.action {
			case "approve":
				m.statusMsg = "PR approved successfully!"
			case "request_changes":
				m.statusMsg = "Changes requested successfully!"
			case "comment":
				m.statusMsg = "Review comment submitted!"
			default:
				m.statusMsg = "Review action completed"
			}
		}
		return m, nil

	case replyResultMsg:
		m.isLoading = false
		m.loadingMessage = ""
		m.textInput.Hide()
		if msg.err != nil {
			m.lastError = msg.err
			m.statusMsg = fmt.Sprintf("Reply failed: %s", msg.err.Error())
			return m, nil
		}
		m.statusMsg = "Reply posted"
		return m, m.refreshComments()

	case aiReviewResultMsg:
		m.isLoading = false
		m.loadingMessage = ""
		if msg.err != nil {
			m.lastError = msg.err
			m.statusMsg = fmt.Sprintf("AI review failed: %s", msg.err.Error())
			return m, nil
		}
		comment := strings.TrimSpace(msg.response.Comment)
		if comment == "" {
			comment = "AI review via LazyReview"
		}
		owner, repo := m.resolvePRRepo()
		switch msg.response.Decision {
		case ai.DecisionApprove:
			m.statusMsg = "AI recommends approval. Submitting..."
			return m, approveReview(m.provider, owner, repo, m.currentPR.Number, comment)
		case ai.DecisionRequestChanges:
			m.statusMsg = "AI recommends changes. Submitting..."
			return m, requestChanges(m.provider, owner, repo, m.currentPR.Number, comment)
		default:
			m.statusMsg = "AI review comment submitted"
			return m, submitReviewComment(m.provider, owner, repo, m.currentPR.Number, comment)
		}

	case commentSubmitMsg:
		m.isLoading = false
		m.loadingMessage = ""
		m.textInput.Hide()
		if msg.err != nil {
			if providers.IsNetworkError(msg.err) {
				if err := m.enqueueCommentAction(msg); err != nil {
					m.lastError = err
					m.statusMsg = fmt.Sprintf("Comment failed and could not be queued: %s", err.Error())
				} else {
					m.lastError = nil
					m.statusMsg = "Offline: comment queued for retry"
				}
			} else {
				m.lastError = msg.err
				m.statusMsg = fmt.Sprintf("Comment failed: %s", msg.err.Error())
			}
		} else {
			if msg.filePath != "" && msg.line > 0 {
				m.statusMsg = fmt.Sprintf("Comment added to %s:%d", msg.filePath, msg.line)
			} else {
				m.statusMsg = "Comment added to PR"
			}
		}
		return m, nil

	case queueSyncMsg:
		if msg.err != nil {
			m.lastError = msg.err
			m.statusMsg = fmt.Sprintf("Offline queue sync failed: %s", msg.err.Error())
		} else if msg.processed > 0 || msg.failed > 0 {
			m.statusMsg = fmt.Sprintf("Offline queue synced: %d processed, %d failed", msg.processed, msg.failed)
		}
		cmds = append(cmds, m.queueSyncCmd())
		return m, tea.Batch(cmds...)

	case gitStatusMsg:
		m.gitBranchStatus = msg.status
		m.gitStatusErr = msg.err
		return m, nil

	case checkoutResultMsg:
		m.isLoading = false
		m.loadingMessage = ""
		if msg.err != nil {
			m.lastError = msg.err
			m.statusMsg = fmt.Sprintf("Checkout failed: %s", msg.err.Error())
			return m, nil
		}
		m.statusMsg = fmt.Sprintf("Checked out %s", msg.branch)
		cmds = append(cmds, m.fetchGitStatus())
		return m, tea.Batch(cmds...)

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

	case currentUserMsg:
		if msg.err != nil {
			m.statusMsg = fmt.Sprintf("Failed to load user: %s", msg.err.Error())
			return m, nil
		}
		if msg.user != nil {
			m.currentUserLogin = msg.user.Login
		}
		if m.currentViewMode == ViewModeDashboard {
			return m, m.fetchDashboard()
		}
		return m, nil

	case dashboardDataMsg:
		m.isLoading = false
		if msg.err != nil {
			m.statusMsg = fmt.Sprintf("Dashboard error: %s", msg.err.Error())
			return m, nil
		}
		m.dashboard.SetData(msg.result.NeedsReview, msg.result.MyPRs, msg.result.All)
		m.statusMsg = fmt.Sprintf("Dashboard loaded (%d review, %d yours, %d all)", len(msg.result.NeedsReview), len(msg.result.MyPRs), len(msg.result.All))
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
				case ViewModeDashboard:
					m.dashboard, cmd = m.dashboard.Update(msg)
				default:
					m.content, cmd = m.content.Update(msg)
				}
				cmds = append(cmds, cmd)
			}
		} else {
			// Detail view
			if m.activePanel == PanelFiles {
				if m.detailSidebarMode == DetailSidebarComments {
					m.commentsList, cmd = m.commentsList.Update(msg)
				} else {
					m.fileTree, cmd = m.fileTree.Update(msg)
				}
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
		case ViewModeAssignedToMe:
			headerText = fmt.Sprintf("LazyReview - Assigned to Me (%d)", len(m.prList))
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
		case ViewModeDashboard:
			headerText = "LazyReview - Dashboard"
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
	if gitStatus := formatGitStatus(m.gitBranchStatus); gitStatus != "" {
		headerText = fmt.Sprintf("%s | %s", headerText, gitStatus)
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
		case ViewModeDashboard:
			rawContent = m.dashboard.View()
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
		sidebarContent := m.fileTree.View()
		if m.detailSidebarMode == DetailSidebarComments {
			sidebarContent = m.commentsList.View()
		}
		if m.activePanel == PanelFiles {
			fileTreeView = focusedStyle.Render(sidebarContent)
		} else {
			fileTreeView = unfocusedStyle.Render(sidebarContent)
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
		case ViewModeDashboard:
			status = m.dashboard.Status()
		}
	}
	if m.showHelp {
		footer = m.help.View()
	} else if status != "" {
		footer = footerStyle.Render(status)
	} else if m.currentViewMode == ViewModeDashboard {
		footer = footerStyle.Render("tab:section  enter:view PR  /:filter  r:refresh  1-9:workspaces  ?:help")
	} else if m.currentViewMode == ViewModeWorkspaces {
		footer = footerStyle.Render("n:new  e:edit  d:delete  a:add repo  x:remove repo  J/K:reorder  tab:switch panel  esc:back  ?:help")
	} else if m.currentViewMode == ViewModeRepoSelector {
		footer = footerStyle.Render("enter:add repo  a:add repo  tab:switch panel  /:filter  r:refresh  esc:back  ?:help")
	} else if m.viewState == ViewDetail {
		footer = footerStyle.Render("j/k:navigate  h/l:panels  n/N:next/prev file  V:select range  a:approve  r:request changes  v:review comment  c:line comment  C:PR comment  y:reply  t:comments  A:ai review  shift+c:checkout  d:toggle view  esc:back  ?:help")
	} else {
		footer = footerStyle.Render("j/k:navigate  h/l:panels  enter:view PR  m:my PRs  R:review requests  ?:help  q:quit")
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

	if m.showHelp {
		helpView := m.renderHelpOverlay()
		return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, helpView)
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
			m.blurDetailSidebar()
		} else {
			m.activePanel = PanelFiles
			m.focusDetailSidebar()
			m.diffViewer.Blur()
		}
	}
}

func (m *Model) focusDetailSidebar() {
	if m.detailSidebarMode == DetailSidebarComments {
		m.commentsList.Focus()
		m.fileTree.Blur()
	} else {
		m.fileTree.Focus()
		m.commentsList.Blur()
	}
}

func (m *Model) blurDetailSidebar() {
	m.fileTree.Blur()
	m.commentsList.Blur()
}

func (m *Model) renderHelpOverlay() string {
	title := "LazyReview Help"
	if m.viewState == ViewDetail {
		title = "LazyReview Help - PR Detail"
	}
	if m.currentViewMode == ViewModeWorkspaces {
		title = "LazyReview Help - Workspaces"
	} else if m.currentViewMode == ViewModeRepoSelector {
		title = "LazyReview Help - Repo Selector"
	} else if m.currentViewMode == ViewModeDashboard {
		title = "LazyReview Help - Dashboard"
	}

	lines := []string{title, strings.Repeat("─", len(title)), ""}
	lines = append(lines, "Global")
	lines = append(lines, "  ?: toggle help")
	lines = append(lines, "  q/esc: back or quit")
	lines = append(lines, "  tab / shift+tab: switch panels")
	lines = append(lines, "  g / G: top / bottom")
	lines = append(lines, "")

	if m.viewState == ViewDetail {
		lines = append(lines, "Detail View")
		lines = append(lines, "  j/k: move cursor")
		lines = append(lines, "  h/l: switch panels")
		lines = append(lines, "  n/N: next/prev file")
		lines = append(lines, "  { / }: prev/next hunk")
		lines = append(lines, "  b/pgup, f/pgdn: page up/down")
		lines = append(lines, "  ctrl+u / ctrl+d: half page up/down")
		lines = append(lines, "  d: toggle unified/split")
		lines = append(lines, "  V: select range for multi-line comment")
		lines = append(lines, "")

		lines = append(lines, "Review Actions")
		lines = append(lines, "  c: line or range comment")
		lines = append(lines, "  C: general PR comment")
		lines = append(lines, "  v: review comment")
		lines = append(lines, "  a: approve")
		lines = append(lines, "  r: request changes")
		lines = append(lines, "  A: AI review (current file)")
		lines = append(lines, "  shift+c: checkout PR branch")
		lines = append(lines, "")

		lines = append(lines, "Comments Panel")
		lines = append(lines, "  t: toggle comments panel")
		lines = append(lines, "  y: reply to selected comment")
	} else if m.currentViewMode == ViewModeWorkspaces {
		lines = append(lines, "Workspace Manager")
		lines = append(lines, "  n: new workspace")
		lines = append(lines, "  e: edit workspace")
		lines = append(lines, "  d: delete workspace")
		lines = append(lines, "  a/enter: add repos")
		lines = append(lines, "  x: remove repo")
		lines = append(lines, "  J/K: reorder")
		lines = append(lines, "  tab: switch panel")
		lines = append(lines, "  r: refresh")
	} else if m.currentViewMode == ViewModeRepoSelector {
		lines = append(lines, "Repo Selector")
		lines = append(lines, "  enter/a: add selected repo")
		lines = append(lines, "  tab: switch panel")
		lines = append(lines, "  /: filter")
		lines = append(lines, "  r: refresh")
	} else if m.currentViewMode == ViewModeDashboard {
		lines = append(lines, "Dashboard")
		lines = append(lines, "  tab: switch section")
		lines = append(lines, "  enter: view PR")
		lines = append(lines, "  /: filter")
		lines = append(lines, "  r: refresh")
	} else {
		lines = append(lines, "PR List")
		lines = append(lines, "  j/k: move selection")
		lines = append(lines, "  enter: view PR")
		lines = append(lines, "  m: My PRs")
		lines = append(lines, "  R: Review requests")
		lines = append(lines, "  /: filter")
		lines = append(lines, "  n/N: next/prev filter match")
		lines = append(lines, "  esc: clear filter")
		lines = append(lines, "  r: refresh")
		lines = append(lines, "  1-9: switch workspace tab")
	}

	content := strings.Join(lines, "\n")
	boxWidth := min(96, m.width-4)
	if boxWidth < 40 {
		boxWidth = m.width - 2
	}
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("170")).
		Padding(1, 2).
		Width(boxWidth)
	return boxStyle.Render(content)
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
	return m.enterDetailViewFromPR(*selectedPR)
}

func (m *Model) enterDetailViewFromDashboard() (tea.Model, tea.Cmd) {
	selectedPR := m.dashboard.SelectedPR()
	if selectedPR == nil {
		m.statusMsg = "No PR selected"
		return *m, nil
	}
	return *m, m.enterDetailViewFromPR(*selectedPR)
}

func (m *Model) enterDetailViewFromPR(selectedPR models.PullRequest) tea.Cmd {
	prNumber := selectedPR.Number

	// Change view state
	m.viewState = ViewDetail
	m.activePanel = PanelFiles
	m.detailSidebarMode = DetailSidebarFiles
	m.focusDetailSidebar()
	m.isLoading = true
	m.loadingMessage = fmt.Sprintf("Loading PR #%d...", prNumber)
	m.applyLayout(m.width, m.height)

	// Use owner/repo from the selected PR (for cross-repo views)
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
		m.fetchPRDetailCached(owner, repo, prNumber),
		m.fetchPRFilesCached(owner, repo, prNumber),
		m.fetchPRDiffCached(owner, repo, prNumber),
		fetchPRComments(m.provider, owner, repo, prNumber),
	)
}

func (m *Model) exitDetailView() {
	m.viewState = ViewList
	m.activePanel = PanelContent
	m.currentPR = nil
	m.currentDiff = nil
	m.currentFiles = nil
	m.comments = nil
	m.commentsList.SetItems(nil)
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
	if strings.TrimSpace(body) == "" && m.textInput.Mode() != components.TextInputApprove {
		m.statusMsg = "Comment cannot be empty"
		return *m, nil
	}

	if m.currentPR == nil {
		m.statusMsg = "No PR selected"
		m.textInput.Hide()
		return *m, nil
	}

	owner, repo := m.resolvePRRepo()

	mode := m.textInput.Mode()
	m.isLoading = true
	switch mode {
	case components.TextInputApprove:
		m.loadingMessage = "Submitting approval..."
	case components.TextInputRequestChanges:
		m.loadingMessage = "Submitting change request..."
	case components.TextInputReviewComment:
		m.loadingMessage = "Submitting review comment..."
	default:
		m.loadingMessage = "Submitting comment..."
	}
	if mode == components.TextInputLineComment {
		// Parse file path and line from context
		context := m.textInput.Context()
		// Context format is "filepath:line:side" (side optional)
		lastColon := strings.LastIndex(context, ":")
		if lastColon == -1 {
			m.statusMsg = "Invalid line context format"
			m.textInput.Hide()
			m.isLoading = false
			return *m, nil
		}

		sideValue := ""
		fileAndLine := context
		if lastColon != -1 {
			sideValue = context[lastColon+1:]
			fileAndLine = context[:lastColon]
		}

		lineColon := strings.LastIndex(fileAndLine, ":")
		if lineColon == -1 {
			m.statusMsg = "Invalid line context format"
			m.textInput.Hide()
			m.isLoading = false
			return *m, nil
		}

		filePath := fileAndLine[:lineColon]
		var line int
		_, err := fmt.Sscanf(fileAndLine[lineColon+1:], "%d", &line)
		if err != nil {
			m.statusMsg = fmt.Sprintf("Failed to parse line number: %s", err.Error())
			m.textInput.Hide()
			m.isLoading = false
			return *m, nil
		}

		side := models.DiffSide(strings.ToUpper(strings.TrimSpace(sideValue)))
		if side != models.DiffSideLeft && side != models.DiffSideRight {
			side = models.DiffSideRight
		}

		startLine := 0
		if selPath, start, end, selectedSide, isCode, ok := m.diffViewer.SelectedRange(); ok && isCode {
			if selPath != "" {
				filePath = selPath
			}
			if selectedSide != "" {
				side = selectedSide
			}
			if start < end {
				startLine = start
				line = end
			}
		}

		commitID := ""
		if m.currentPR != nil {
			commitID = m.currentPR.HeadSHA
		}

		m.diffViewer.ClearSelection()
		return *m, submitLineComment(m.provider, owner, repo, m.currentPR.Number, body, filePath, line, startLine, side, commitID)
	} else if mode == components.TextInputGeneralComment {
		return *m, submitGeneralComment(m.provider, owner, repo, m.currentPR.Number, body)
	} else if mode == components.TextInputReviewComment {
		return *m, submitReviewComment(m.provider, owner, repo, m.currentPR.Number, body)
	} else if mode == components.TextInputReplyComment {
		commentID := strings.TrimSpace(m.textInput.Context())
		if commentID == "" {
			m.statusMsg = "Reply: Missing comment ID"
			m.textInput.Hide()
			m.isLoading = false
			return *m, nil
		}
		return *m, submitReplyComment(m.provider, owner, repo, m.currentPR.Number, commentID, body)
	} else if mode == components.TextInputApprove {
		comment := strings.TrimSpace(body)
		if comment == "" {
			comment = "Approved via LazyReview"
		}
		return *m, approveReview(m.provider, owner, repo, m.currentPR.Number, comment)
	} else if mode == components.TextInputRequestChanges {
		comment := strings.TrimSpace(body)
		if comment == "" {
			comment = "Changes requested via LazyReview"
		}
		return *m, requestChanges(m.provider, owner, repo, m.currentPR.Number, comment)
	}

	m.textInput.Hide()
	m.isLoading = false
	m.statusMsg = "Unknown comment mode"
	return *m, nil
}

func (m Model) fetchGitStatus() tea.Cmd {
	if !git.IsInGitRepo() {
		return nil
	}
	return func() tea.Msg {
		status, err := git.GetBranchStatus()
		return gitStatusMsg{status: status, err: err}
	}
}

func (m *Model) refreshComments() tea.Cmd {
	if m.currentPR == nil || m.provider == nil {
		return nil
	}
	owner, repo := m.resolvePRRepo()
	return fetchPRComments(m.provider, owner, repo, m.currentPR.Number)
}

func (m *Model) startAIReview() tea.Cmd {
	req, err := m.buildAIReviewRequest()
	if err != nil {
		return func() tea.Msg {
			return aiReviewResultMsg{err: err}
		}
	}
	provider := m.aiProvider
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		resp, err := provider.Review(ctx, req)
		return aiReviewResultMsg{response: resp, err: err}
	}
}

func (m *Model) buildAIReviewRequest() (ai.ReviewRequest, error) {
	if m.currentDiff == nil || len(m.currentDiff.Files) == 0 {
		return ai.ReviewRequest{}, fmt.Errorf("diff not loaded")
	}

	selectedPath := ""
	if m.detailSidebarMode == DetailSidebarFiles && m.activePanel == PanelFiles {
		selectedPath = m.fileTree.SelectedPath()
	}
	if selectedPath == "" {
		selectedPath = m.diffViewer.CurrentFilePath()
	}

	file, err := findFileDiff(m.currentDiff, selectedPath, m.diffViewer.CurrentFile())
	if err != nil {
		return ai.ReviewRequest{}, err
	}

	diffText := buildDiffForFile(*file)
	if strings.TrimSpace(diffText) == "" {
		return ai.ReviewRequest{}, fmt.Errorf("no diff content available")
	}

	path := file.Path
	if path == "" {
		path = file.OldPath
	}
	return ai.ReviewRequest{FilePath: path, Diff: diffText}, nil
}

func (m *Model) resolvePRRepo() (string, string) {
	owner := ""
	repo := ""
	if m.currentPR != nil {
		owner = m.currentPR.Repository.Owner
		repo = m.currentPR.Repository.Name
	}
	if owner == "" {
		owner = m.gitOwner
	}
	if repo == "" {
		repo = m.gitRepo
	}
	if owner == "" || repo == "" {
		owner = "golang"
		repo = "go"
	}
	return owner, repo
}

func resolveRemoteForRepo(ctx *git.GitContext, owner, repo string) *git.Remote {
	if ctx == nil {
		return nil
	}
	if owner != "" && repo != "" {
		for i := range ctx.Remotes {
			remote := &ctx.Remotes[i]
			if strings.EqualFold(remote.Owner, owner) && strings.EqualFold(remote.Repo, repo) {
				return remote
			}
		}
	}
	return ctx.GetPrimaryRemote()
}

func (m Model) queueSyncCmd() tea.Cmd {
	if m.storage == nil || m.provider == nil {
		return nil
	}
	return tea.Tick(queueSyncInterval, func(time.Time) tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		processed, failed, err := queue.ProcessQueue(ctx, m.storage, m.provider, 25)
		return queueSyncMsg{processed: processed, failed: failed, err: err}
	})
}

func (m *Model) enqueueQueueAction(action storage.QueueAction) error {
	if m.storage == nil {
		return fmt.Errorf("offline queue unavailable")
	}
	if m.provider == nil {
		return fmt.Errorf("provider unavailable")
	}
	if action.ID == "" {
		action.ID = uuid.NewString()
	}
	if action.ProviderType == "" {
		action.ProviderType = string(m.provider.Type())
	}
	if action.Host == "" {
		action.Host = m.provider.Host()
	}
	return m.storage.EnqueueAction(action)
}

func (m *Model) enqueueCommentAction(msg commentSubmitMsg) error {
	payload, err := json.Marshal(queuedCommentPayload{
		Body:      msg.body,
		FilePath:  msg.filePath,
		Line:      msg.line,
		StartLine: msg.startLine,
		Side:      string(msg.side),
		CommitID:  msg.commitID,
	})
	if err != nil {
		return fmt.Errorf("failed to encode comment payload: %w", err)
	}
	action := storage.QueueAction{
		Type:     storage.QueueActionComment,
		Owner:    msg.owner,
		Repo:     msg.repo,
		PRNumber: msg.number,
		Payload:  string(payload),
	}
	return m.enqueueQueueAction(action)
}

func (m *Model) enqueueReviewAction(msg reviewResultMsg) error {
	actionType := storage.QueueActionReviewComment
	switch msg.action {
	case "approve":
		actionType = storage.QueueActionApprove
	case "request_changes":
		actionType = storage.QueueActionRequestChanges
	case "comment":
		actionType = storage.QueueActionReviewComment
	default:
		return fmt.Errorf("unsupported review action: %s", msg.action)
	}
	payload, err := json.Marshal(queuedReviewPayload{Body: msg.body})
	if err != nil {
		return fmt.Errorf("failed to encode review payload: %w", err)
	}
	action := storage.QueueAction{
		Type:     actionType,
		Owner:    msg.owner,
		Repo:     msg.repo,
		PRNumber: msg.number,
		Payload:  string(payload),
	}
	return m.enqueueQueueAction(action)
}

func formatGitStatus(status *git.BranchStatus) string {
	if status == nil || status.Branch == "" {
		return ""
	}
	state := "clean"
	if status.Dirty {
		state = "dirty"
	}
	if status.Ahead > 0 || status.Behind > 0 {
		return fmt.Sprintf("branch %s (%s ↑%d ↓%d)", status.Branch, state, status.Ahead, status.Behind)
	}
	return fmt.Sprintf("branch %s (%s)", status.Branch, state)
}

func buildCommentItems(comments []models.Comment) []list.Item {
	items := make([]list.Item, 0, len(comments))
	for _, comment := range comments {
		author := comment.Author.Login
		if author == "" {
			author = "unknown"
		}
		snippet := summarizeText(comment.Body, 60)
		title := fmt.Sprintf("@%s: %s", author, snippet)
		desc := "General comment"
		if comment.Path != "" && comment.Line > 0 {
			desc = fmt.Sprintf("%s:%d", comment.Path, comment.Line)
		} else if comment.Type == models.CommentTypeInline {
			desc = "Inline comment"
		}
		items = append(items, components.NewSimpleItem(comment.ID, title, desc))
	}
	return items
}

func summarizeText(text string, max int) string {
	trimmed := strings.TrimSpace(strings.ReplaceAll(text, "\n", " "))
	if max <= 0 || len(trimmed) <= max {
		return trimmed
	}
	if max < 3 {
		return trimmed[:max]
	}
	return trimmed[:max-3] + "..."
}

func (m *Model) findCommentByID(id string) *models.Comment {
	for i := range m.comments {
		if m.comments[i].ID == id {
			return &m.comments[i]
		}
	}
	return nil
}

func findFileDiff(diff *models.Diff, path string, fallbackIndex int) (*models.FileDiff, error) {
	if diff == nil || len(diff.Files) == 0 {
		return nil, fmt.Errorf("no files in diff")
	}
	if path != "" {
		for i := range diff.Files {
			file := &diff.Files[i]
			if file.Path == path || file.OldPath == path {
				return file, nil
			}
		}
	}
	if fallbackIndex >= 0 && fallbackIndex < len(diff.Files) {
		return &diff.Files[fallbackIndex], nil
	}
	return &diff.Files[0], nil
}

func buildDiffForFile(file models.FileDiff) string {
	if strings.TrimSpace(file.Patch) != "" {
		return file.Patch
	}
	var b strings.Builder
	if file.OldPath != "" || file.Path != "" {
		b.WriteString(fmt.Sprintf("--- %s\n", file.OldPath))
		b.WriteString(fmt.Sprintf("+++ %s\n", file.Path))
	}
	for _, hunk := range file.Hunks {
		if hunk.Header != "" {
			b.WriteString(hunk.Header)
			b.WriteString("\n")
		}
		for _, line := range hunk.Lines {
			b.WriteString(line.Type.Prefix())
			b.WriteString(line.Content)
			b.WriteString("\n")
		}
	}
	return b.String()
}

// handleSidebarSelection handles when a sidebar item is selected
func (m *Model) handleSidebarSelection(itemID string) tea.Cmd {
	m.isLoading = true

	switch itemID {
	case "dashboard":
		m.currentViewMode = ViewModeDashboard
		m.isLoading = true
		m.loadingMessage = "Loading dashboard..."
		m.applyLayout(m.width, m.height)
		return m.fetchDashboard()

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
		return tea.Batch(m.spinner.Tick, m.fetchUserPRsCached(opts))

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
		return tea.Batch(m.spinner.Tick, m.fetchUserPRsCached(opts))

	case "assigned_to_me":
		m.currentViewMode = ViewModeAssignedToMe
		m.workspaceRepoFilter = nil
		m.loadingMessage = "Loading PRs assigned to you..."
		m.applyLayout(m.width, m.height)
		opts := providers.UserPROptions{
			Involvement: "assigned",
			State:       models.PRStateOpen,
			PerPage:     50,
			Page:        1,
		}
		return tea.Batch(m.spinner.Tick, m.fetchUserPRsCached(opts))

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
		return tea.Batch(m.spinner.Tick, m.fetchPRListCached(owner, repo))

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

func fetchCurrentUser(provider providers.Provider) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		user, err := provider.GetCurrentUser(ctx)
		return currentUserMsg{user: user, err: err}
	}
}

func fetchDashboardData(aggregator *services.Aggregator, repos []storage.RepoRef, currentUser string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if aggregator == nil {
			return dashboardDataMsg{err: fmt.Errorf("aggregator not available")}
		}
		result, err := aggregator.FetchDashboard(ctx, repos, currentUser)
		return dashboardDataMsg{result: result, err: err}
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

func fetchPRComments(provider providers.Provider, owner, repo string, number int) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		comments, err := provider.ListComments(ctx, owner, repo, number)
		return prCommentsMsg{comments: comments, err: err}
	}
}

func approveReview(provider providers.Provider, owner, repo string, number int, body string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		err := provider.ApproveReview(ctx, owner, repo, number, body)
		return reviewResultMsg{action: "approve", owner: owner, repo: repo, number: number, body: body, err: err}
	}
}

func requestChanges(provider providers.Provider, owner, repo string, number int, body string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		err := provider.RequestChanges(ctx, owner, repo, number, body)
		return reviewResultMsg{action: "request_changes", owner: owner, repo: repo, number: number, body: body, err: err}
	}
}

func submitLineComment(provider providers.Provider, owner, repo string, prNumber int, body, path string, line int, startLine int, side models.DiffSide, commitID string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		comment := models.CommentInput{
			Body:      body,
			Path:      path,
			Line:      line,
			StartLine: startLine,
			Side:      side,
			CommitID:  commitID,
		}

		err := provider.CreateComment(ctx, owner, repo, prNumber, comment)
		return commentSubmitMsg{
			body:      body,
			filePath:  path,
			line:      line,
			startLine: startLine,
			side:      side,
			commitID:  commitID,
			owner:     owner,
			repo:      repo,
			number:    prNumber,
			err:       err,
		}
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
		return commentSubmitMsg{
			body:   body,
			owner:  owner,
			repo:   repo,
			number: prNumber,
			err:    err,
		}
	}
}

func submitReviewComment(provider providers.Provider, owner, repo string, prNumber int, body string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		review := models.ReviewInput{
			Event: models.ReviewEventComment,
			Body:  body,
		}

		err := provider.CreateReview(ctx, owner, repo, prNumber, review)
		return reviewResultMsg{action: "comment", owner: owner, repo: repo, number: prNumber, body: body, err: err}
	}
}

func submitReplyComment(provider providers.Provider, owner, repo string, prNumber int, commentID, body string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		err := provider.ReplyToComment(ctx, owner, repo, prNumber, commentID, body)
		return replyResultMsg{commentID: commentID, err: err}
	}
}

func checkoutPRBranch(pr *models.PullRequest, owner, repo string) tea.Cmd {
	return func() tea.Msg {
		if pr == nil {
			return checkoutResultMsg{err: fmt.Errorf("no PR selected")}
		}
		ctx, err := git.DetectGitContext()
		if err != nil {
			return checkoutResultMsg{err: err}
		}
		if !ctx.IsGitRepo {
			return checkoutResultMsg{err: fmt.Errorf("not in a git repository")}
		}

		remote := resolveRemoteForRepo(ctx, owner, repo)
		if remote == nil {
			return checkoutResultMsg{err: fmt.Errorf("no git remote found")}
		}
		if owner != "" && repo != "" {
			if !strings.EqualFold(remote.Owner, owner) || !strings.EqualFold(remote.Repo, repo) {
				return checkoutResultMsg{err: fmt.Errorf("git remote %s does not match PR repo %s/%s", remote.Name, owner, repo)}
			}
		}

		branch := strings.TrimSpace(pr.SourceBranch)
		if branch == "" {
			return checkoutResultMsg{err: fmt.Errorf("PR source branch unavailable")}
		}
		if err := git.CheckoutBranch(ctx.RootPath, remote.Name, branch, branch); err != nil {
			return checkoutResultMsg{err: err}
		}
		return checkoutResultMsg{branch: branch}
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
	m.dashboard.SetSize(contentWidth, panelHeight)

	// Detail view components
	fileTreeWidth := min(40, width/4)
	diffWidth := width - fileTreeWidth - 4
	m.fileTree.SetSize(fileTreeWidth, panelHeight)
	m.commentsList.SetSize(fileTreeWidth, panelHeight)
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

func (m *Model) fetchUserPRsCached(opts providers.UserPROptions) tea.Cmd {
	key := fmt.Sprintf("user_prs:%s:%s:%d:%d:%s", opts.Involvement, opts.State, opts.PerPage, opts.Page, m.provider.Host())
	if cached, ok := m.prListCache.Get(key); ok {
		return tea.Batch(
			func() tea.Msg { return userPRsMsg{prs: cached} },
			m.fetchUserPRsWithCache(opts, key),
		)
	}
	return m.fetchUserPRsWithCache(opts, key)
}

func (m *Model) fetchUserPRsWithCache(opts providers.UserPROptions, key string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		prs, err := m.provider.ListUserPullRequests(ctx, opts)
		if err != nil {
			return errMsg{err}
		}
		m.prListCache.Set(key, prs)
		return userPRsMsg{prs}
	}
}

func (m *Model) fetchPRListCached(owner, repo string) tea.Cmd {
	opts := providers.DefaultListOptions()
	key := fmt.Sprintf("pr_list:%s/%s:%s:%s:%d:%d:%s", owner, repo, opts.State, opts.Sort, opts.PerPage, opts.Page, m.provider.Host())
	if cached, ok := m.prListCache.Get(key); ok {
		return tea.Batch(
			func() tea.Msg { return prListMsg{prs: cached} },
			m.fetchPRListWithCache(owner, repo, opts, key),
		)
	}
	return m.fetchPRListWithCache(owner, repo, opts, key)
}

func (m *Model) fetchPRListWithCache(owner, repo string, opts providers.ListOptions, key string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		prs, err := m.provider.ListPullRequests(ctx, owner, repo, opts)
		if err != nil {
			return errMsg{err}
		}
		m.prListCache.Set(key, prs)
		return prListMsg{prs}
	}
}

func (m *Model) fetchPRDetailCached(owner, repo string, number int) tea.Cmd {
	key := fmt.Sprintf("pr_detail:%s/%s:%d:%s", owner, repo, number, m.provider.Host())
	if cached, ok := m.prDetailCache.Get(key); ok {
		return tea.Batch(
			func() tea.Msg { return prDetailMsg{pr: cached} },
			m.fetchPRDetailWithCache(owner, repo, number, key),
		)
	}
	return m.fetchPRDetailWithCache(owner, repo, number, key)
}

func (m *Model) fetchPRDetailWithCache(owner, repo string, number int, key string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		pr, err := m.provider.GetPullRequest(ctx, owner, repo, number)
		if err != nil {
			return errMsg{err}
		}
		m.prDetailCache.Set(key, pr)
		return prDetailMsg{pr}
	}
}

func (m *Model) fetchPRFilesCached(owner, repo string, number int) tea.Cmd {
	key := fmt.Sprintf("pr_files:%s/%s:%d:%s", owner, repo, number, m.provider.Host())
	if cached, ok := m.prFilesCache.Get(key); ok {
		return tea.Batch(
			func() tea.Msg { return prFilesMsg{files: cached} },
			m.fetchPRFilesWithCache(owner, repo, number, key),
		)
	}
	return m.fetchPRFilesWithCache(owner, repo, number, key)
}

func (m *Model) fetchPRFilesWithCache(owner, repo string, number int, key string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		files, err := m.provider.GetPullRequestFiles(ctx, owner, repo, number)
		if err != nil {
			return errMsg{err}
		}
		m.prFilesCache.Set(key, files)
		return prFilesMsg{files}
	}
}

func (m *Model) fetchPRDiffCached(owner, repo string, number int) tea.Cmd {
	key := fmt.Sprintf("pr_diff:%s/%s:%d:%s", owner, repo, number, m.provider.Host())
	if cached, ok := m.prDiffCache.Get(key); ok {
		return tea.Batch(
			func() tea.Msg { return prDiffMsg{diff: cached} },
			m.fetchPRDiffWithCache(owner, repo, number, key),
		)
	}
	return m.fetchPRDiffWithCache(owner, repo, number, key)
}

func (m *Model) fetchPRDiffWithCache(owner, repo string, number int, key string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		diff, err := m.provider.GetPullRequestDiff(ctx, owner, repo, number)
		if err != nil {
			return errMsg{err}
		}
		m.prDiffCache.Set(key, diff)
		return prDiffMsg{diff}
	}
}

func (m *Model) switchSidebarView(itemID string) tea.Cmd {
	if itemID == "" {
		return nil
	}
	for i, item := range m.sidebar.Items() {
		if simple, ok := item.(components.SimpleItem); ok && simple.ID() == itemID {
			m.sidebar.Select(i)
			return m.handleSidebarSelection(itemID)
		}
	}
	return m.handleSidebarSelection(itemID)
}

func (m *Model) refreshSidebarItems() {
	items := []list.Item{
		components.NewSimpleItem("dashboard", "Dashboard", "Grouped PR overview"),
		components.NewSimpleItem("my_prs", m.sidebarLabel("My PRs", "my_prs"), "PRs you authored (all repos)"),
		components.NewSimpleItem("review_requests", m.sidebarLabel("Review Requests", "review_requests"), "PRs needing your review"),
		components.NewSimpleItem("assigned_to_me", m.sidebarLabel("Assigned to Me", "assigned_to_me"), "PRs assigned to you"),
		components.NewSimpleItem("current_repo", "Current Repo", "PRs in detected repo"),
		components.NewSimpleItem("workspaces", "Workspaces", "Create and manage repo groups"),
		components.NewSimpleItem("settings", "Settings", "Configure LazyReview"),
	}
	selectedID := ""
	if selectedItem := m.sidebar.SelectedItem(); selectedItem != nil {
		if simple, ok := selectedItem.(components.SimpleItem); ok {
			selectedID = simple.ID()
		}
	}
	m.sidebar.SetItems(items)
	if selectedID != "" {
		for i, item := range items {
			if simple, ok := item.(components.SimpleItem); ok && simple.ID() == selectedID {
				m.sidebar.Select(i)
				break
			}
		}
	}
}

func (m *Model) sidebarLabel(label, key string) string {
	count := m.sidebarCounts[key]
	if count <= 0 {
		return label
	}
	return fmt.Sprintf("%s (%d)", label, count)
}

func (m *Model) fetchDashboard() tea.Cmd {
	if m.currentUserLogin == "" {
		return fetchCurrentUser(m.provider)
	}
	repos := m.resolveDashboardRepos()
	return fetchDashboardData(m.aggregator, repos, m.currentUserLogin)
}

func (m *Model) resolveDashboardRepos() []storage.RepoRef {
	if m.storage == nil {
		if m.gitOwner != "" && m.gitRepo != "" {
			return []storage.RepoRef{{
				ProviderType: string(m.provider.Type()),
				Host:         m.provider.Host(),
				Owner:        m.gitOwner,
				Repo:         m.gitRepo,
			}}
		}
		return nil
	}

	switch m.currentWorkspace.Kind {
	case models.WorkspaceKindRecent:
		repos, _ := m.storage.GetRecentRepos(200)
		return repos
	case models.WorkspaceKindFavorites:
		repos, _ := m.storage.ListFavorites()
		return repos
	case models.WorkspaceKindCustom:
		workspace, err := m.storage.GetWorkspace(m.currentWorkspace.WorkspaceID)
		if err != nil {
			return nil
		}
		return workspace.Repos
	default:
		return m.collectAllRepos()
	}
}

func (m *Model) collectAllRepos() []storage.RepoRef {
	if m.storage == nil {
		return nil
	}
	repos := []storage.RepoRef{}
	add := func(repo storage.RepoRef, seen map[string]struct{}) {
		key := fmt.Sprintf("%s:%s:%s/%s", repo.ProviderType, repo.Host, repo.Owner, repo.Repo)
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		repos = append(repos, repo)
	}

	seen := map[string]struct{}{}

	if favorites, err := m.storage.ListFavorites(); err == nil {
		for _, repo := range favorites {
			add(repo, seen)
		}
	}
	if recent, err := m.storage.GetRecentRepos(200); err == nil {
		for _, repo := range recent {
			add(repo, seen)
		}
	}
	if workspaces, err := m.storage.ListWorkspaces(); err == nil {
		for _, ws := range workspaces {
			for _, repo := range ws.Repos {
				add(repo, seen)
			}
		}
	}

	if len(repos) == 0 && m.gitOwner != "" && m.gitRepo != "" {
		repos = append(repos, storage.RepoRef{
			ProviderType: string(m.provider.Type()),
			Host:         m.provider.Host(),
			Owner:        m.gitOwner,
			Repo:         m.gitRepo,
		})
	}

	return repos
}

func parseDigitKey(key string) (int, bool) {
	if len(key) != 1 {
		return 0, false
	}
	if key[0] < '1' || key[0] > '9' {
		return 0, false
	}
	return int(key[0] - '1'), true
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
	if m.currentViewMode == ViewModeDashboard {
		m.loadingMessage = "Loading dashboard..."
		return m.fetchDashboard()
	}

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
