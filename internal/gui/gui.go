package gui

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
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
	"lazyreview/internal/updater"
	"lazyreview/pkg/components"
	"lazyreview/pkg/git"
	"lazyreview/pkg/keyring"
	"lazyreview/pkg/providers"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/viewport"
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
	DetailSidebarTimeline
	DetailSidebarDescription
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

type prReviewsMsg struct {
	reviews []models.Review
	err     error
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
	commentID    string
	optimisticID string
	err          error
}

type aiReviewResultMsg struct {
	response ai.ReviewResponse
	err      error
}

type commentEditResultMsg struct {
	commentID string
	err       error
}

type commentDeleteResultMsg struct {
	commentID string
	err       error
}

type commentResolveResultMsg struct {
	commentID string
	err       error
}

type openEditorResultMsg struct {
	path string
	line int
	err  error
}

type updateCheckMsg struct {
	current string
	latest  string
	err     error
}

type summaryDraftMsg struct {
	summary string
	err     error
}

type providerSwitchResultMsg struct {
	provider providers.Provider
	label    string
	err      error
}

type updateResultMsg struct {
	result updater.UpdateResult
	err    error
}

type commentSubmitMsg struct {
	body         string
	optimisticID string
	filePath     string // empty for general comment
	line         int    // 0 for general comment
	startLine    int
	side         models.DiffSide
	commitID     string
	owner        string
	repo         string
	number       int
	err          error
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

type savedFilter struct {
	Name  string `json:"name"`
	Query string `json:"query"`
}

type timelineJumpTarget struct {
	Path string
	Line int
	Side models.DiffSide
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
	prCommentsCache     *services.Cache[[]models.Comment]
	prReviewsCache      *services.Cache[[]models.Review]

	// Provider and auth
	provider       providers.Provider
	authService    *auth.Service
	aiProvider     ai.Provider
	aiError        error
	aiProviderName string
	aiModel        string

	// Git context
	gitOwner        string
	gitRepo         string
	gitBranchStatus *git.BranchStatus
	gitStatusErr    error

	// Current view mode
	currentViewMode ViewMode
	currentTheme    string
	vimMode         bool
	editorCommand   string
	updateAvailable bool
	updateVersion   string
	accentColor     string
	headerBgColor   string
	footerBgColor   string
	focusedBorder   string
	unfocusedBorder string
	mutedColor      string

	// Detail view sidebar mode
	detailSidebarMode DetailSidebarMode

	// Current PR state
	currentPR              *models.PullRequest
	currentDiff            *models.Diff
	currentFiles           []models.FileChange
	prList                 []models.PullRequest
	comments               []models.Comment
	reviews                []models.Review
	commentsList           components.List
	timelineList           components.List
	descriptionView        viewport.Model
	timelineTargets        map[string]timelineJumpTarget
	reviewDraft            string
	diffSearchQuery        string
	commentPreviewExpanded bool
	savedFilters           []savedFilter
	filterPalette          components.List
	filterPaletteVisible   bool

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
	timelineList := components.NewList("Timeline", []list.Item{}, 30, 20)
	descriptionView := viewport.New(30, 20)
	descriptionView.SetContent("PR Description\n\nNo description available.")
	filterPalette := components.NewList("Saved Filters", []list.Item{}, 50, 20)

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

	// Apply configurable concurrency from config
	if cfg.Performance.MaxConcurrency > 0 {
		aggregator.SetConcurrency(cfg.Performance.MaxConcurrency)
	}

	// Use configurable cache TTL from config (defaults: 120s for PR data, 20s for comments)
	cacheTTL := time.Duration(cfg.Performance.CacheTTL) * time.Second
	if cacheTTL == 0 {
		cacheTTL = 2 * time.Minute
	}
	commentCacheTTL := time.Duration(cfg.Performance.CommentCacheTTL) * time.Second
	if commentCacheTTL == 0 {
		commentCacheTTL = 20 * time.Second
	}

	prListCache := services.NewCache[[]models.PullRequest](cacheTTL)
	prDetailCache := services.NewCache[*models.PullRequest](cacheTTL)
	prFilesCache := services.NewCache[[]models.FileChange](cacheTTL)
	prDiffCache := services.NewCache[*models.Diff](cacheTTL)
	prCommentsCache := services.NewCache[[]models.Comment](commentCacheTTL)
	prReviewsCache := services.NewCache[[]models.Review](commentCacheTTL)
	aiProvider, aiErr := ai.NewProviderFromEnv()
	aiProviderName := strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_PROVIDER"))
	aiModel := strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_MODEL"))
	if aiModel == "" {
		aiModel = "gpt-4o-mini"
	}

	model := Model{
		config:                 cfg,
		provider:               provider,
		authService:            authService,
		aiProvider:             aiProvider,
		aiError:                aiErr,
		aiProviderName:         aiProviderName,
		aiModel:                aiModel,
		storage:                store,
		gitOwner:               owner,
		gitRepo:                repo,
		activePanel:            PanelSidebar,
		mode:                   ModeNormal,
		viewState:              ViewList,
		currentViewMode:        initialViewMode,
		currentTheme:           cfg.UI.Theme,
		vimMode:                cfg.UI.VimMode,
		editorCommand:          strings.TrimSpace(cfg.UI.Editor),
		commentPreviewExpanded: true,
		sidebar:                sidebar,
		content:                content,
		fileTree:               fileTree,
		diffViewer:             diffViewer,
		commentsList:           commentsList,
		timelineList:           timelineList,
		descriptionView:        descriptionView,
		timelineTargets:        map[string]timelineJumpTarget{},
		filterPalette:          filterPalette,
		textInput:              textInput,
		help:                   components.NewHelp(),
		keyMap:                 DefaultKeyMap(cfg.UI.VimMode),
		keySeq:                 NewKeySequence(),
		workspaceManager:       workspaceManager,
		repoSelector:           repoSelector,
		workspaceTabs:          workspaceTabs,
		dashboard:              dashboard,
		aggregator:             aggregator,
		sidebarCounts:          map[string]int{},
		prListCache:            prListCache,
		prDetailCache:          prDetailCache,
		prFilesCache:           prFilesCache,
		prDiffCache:            prDiffCache,
		prCommentsCache:        prCommentsCache,
		prReviewsCache:         prReviewsCache,
		isLoading:              true,
		loadingMessage:         "Loading your pull requests...",
		spinner:                s,
	}
	model.applyTheme(cfg.UI.Theme)
	model.applyVimMode(cfg.UI.VimMode)
	model.loadPersistedUISettings()
	model.loadPersistedAISettings()
	return model
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
	cmds = append(cmds, checkForUpdates())
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
		if m.filterPaletteVisible {
			switch msg.String() {
			case "esc", "q":
				m.filterPaletteVisible = false
				m.statusMsg = "Saved filters closed"
				return m, nil
			case "enter":
				selected := m.filterPalette.SelectedItem()
				item, ok := selected.(components.SimpleItem)
				if !ok {
					m.filterPaletteVisible = false
					return m, nil
				}
				m.filterPaletteVisible = false
				if item.ID() == "saved_filter:clear" {
					m.content.ResetFilter()
					m.statusMsg = "Filter cleared"
					return m, nil
				}
				name := strings.TrimPrefix(item.ID(), "saved_filter:")
				for _, filter := range m.savedFilters {
					if filter.Name == name {
						_ = m.content.SetFilterText(filter.Query)
						m.statusMsg = fmt.Sprintf("Filter applied: %s", filter.Name)
						return m, nil
					}
				}
				return m, nil
			default:
				var cmd tea.Cmd
				m.filterPalette, cmd = m.filterPalette.Update(msg)
				return m, cmd
			}
		}

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

		// Check for "gg" sequence (go to top) in vim mode
		if m.vimMode && m.keySeq.IsSequence("g", "g") {
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

		if m.viewState == ViewDetail && (keyStr == "A" || keyStr == "shift+a" || keyStr == "ctrl+a") {
			return m.handleAIReviewShortcut()
		}

		// Handle single key bindings
		switch {
		case key.Matches(msg, m.keyMap.Quit):
			if m.showHelp {
				m.showHelp = false
				return m, nil
			}
			// In PR detail view, `q` should go back to PR list instead of quitting.
			if m.viewState == ViewDetail {
				m.exitDetailView()
				m.statusMsg = "Back to pull requests"
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
			if m.viewState == ViewList && m.currentViewMode == ViewModeSettings && m.activePanel == PanelContent {
				m.handleSettingsSelection()
				return m, nil
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
					} else if m.detailSidebarMode == DetailSidebarComments {
						if comment := m.selectedComment(); comment != nil {
							if comment.Path != "" {
								m.diffViewer.SetCurrentFileByPath(comment.Path)
							}
							if comment.Path != "" && comment.Line > 0 {
								m.diffViewer.JumpToLine(comment.Path, comment.Line, comment.Side)
							}
						}
					} else if m.detailSidebarMode == DetailSidebarTimeline {
						if target, ok := m.selectedTimelineTarget(); ok {
							if target.Path != "" {
								m.diffViewer.SetCurrentFileByPath(target.Path)
							}
							if target.Path != "" && target.Line > 0 {
								m.diffViewer.JumpToLine(target.Path, target.Line, target.Side)
							}
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
				if m.detailSidebarMode == DetailSidebarFiles {
					m.detailSidebarMode = DetailSidebarComments
					m.statusMsg = "Comments panel"
					if len(m.comments) == 0 {
						return m, m.refreshComments()
					}
				} else if m.detailSidebarMode == DetailSidebarComments {
					m.detailSidebarMode = DetailSidebarTimeline
					m.statusMsg = "Timeline panel"
				} else if m.detailSidebarMode == DetailSidebarTimeline {
					m.detailSidebarMode = DetailSidebarDescription
					m.statusMsg = "Description panel"
				} else {
					m.detailSidebarMode = DetailSidebarFiles
					m.statusMsg = "Files panel"
				}
				if m.activePanel == PanelFiles {
					m.focusDetailSidebar()
				}
				return m, nil
			}

		case key.Matches(msg, m.keyMap.ToggleCommentPreview):
			if m.viewState == ViewDetail && m.detailSidebarMode == DetailSidebarComments {
				m.commentPreviewExpanded = !m.commentPreviewExpanded
				m.statusMsg = "Comments preview toggled"
				m.applyLayout(m.width, m.height)
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
				if strings.TrimSpace(m.reviewDraft) != "" {
					m.textInput.SetValue(m.reviewDraft)
				}
				m.textInput.SetSize(m.width-20, m.height-10)
				return m, nil
			}
			m.statusMsg = "Review Comment: Enter PR view first"
			return m, nil

		case key.Matches(msg, m.keyMap.ReplyComment):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState != ViewDetail || m.currentPR == nil {
				m.statusMsg = "Reply: Open a PR first"
				return m, nil
			}
			commentID := m.selectedCommentID()
			if commentID == "" {
				m.statusMsg = "Reply: Select a comment first"
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

		case key.Matches(msg, m.keyMap.EditComment):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState != ViewDetail || m.currentPR == nil {
				m.statusMsg = "Edit: Open a PR first"
				return m, nil
			}
			commentID := m.selectedCommentID()
			if commentID == "" {
				m.statusMsg = "Edit: Select a comment first"
				return m, nil
			}
			comment := m.findCommentByID(commentID)
			if comment == nil {
				m.statusMsg = "Edit: Comment not found"
				return m, nil
			}
			m.textInput.Show(components.TextInputEditComment, "Edit Comment", commentID)
			m.textInput.SetValue(comment.Body)
			m.textInput.SetSize(m.width-20, m.height-10)
			return m, nil

		case key.Matches(msg, m.keyMap.DeleteComment):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState != ViewDetail || m.currentPR == nil {
				m.statusMsg = "Delete: Open a PR first"
				return m, nil
			}
			commentID := m.selectedCommentID()
			if commentID == "" {
				m.statusMsg = "Delete: Select a comment first"
				return m, nil
			}
			comment := m.findCommentByID(commentID)
			if comment == nil {
				m.statusMsg = "Delete: Comment not found"
				return m, nil
			}
			m.isLoading = true
			m.loadingMessage = "Deleting comment..."
			owner, repo := m.resolvePRRepo()
			return m, submitDeleteComment(m.provider, owner, repo, m.currentPR.Number, commentID, comment.Type)

		case key.Matches(msg, m.keyMap.ResolveComment):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState != ViewDetail || m.currentPR == nil {
				m.statusMsg = "Resolve: Open a PR first"
				return m, nil
			}
			commentID := m.selectedCommentID()
			if commentID == "" {
				m.statusMsg = "Resolve: Select a comment first"
				return m, nil
			}
			m.isLoading = true
			m.loadingMessage = "Resolving thread..."
			owner, repo := m.resolvePRRepo()
			return m, submitResolveComment(m.provider, owner, repo, m.currentPR.Number, commentID)

		case key.Matches(msg, m.keyMap.DraftSummary):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState != ViewDetail || m.currentPR == nil || m.currentDiff == nil {
				m.statusMsg = "Summary: Open a PR diff first"
				return m, nil
			}
			m.isLoading = true
			m.loadingMessage = "Generating review summary draft..."
			return m, m.generateSummaryDraft()

		case key.Matches(msg, m.keyMap.AIReview):
			return m.handleAIReviewShortcut()

		case key.Matches(msg, m.keyMap.Update):
			if m.inWorkspaceView() {
				break
			}
			m.isLoading = true
			m.loadingMessage = "Updating LazyReview..."
			return m, m.runUpdate()

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

		case key.Matches(msg, m.keyMap.OpenEditor):
			if m.inWorkspaceView() {
				break
			}
			if m.viewState != ViewDetail {
				m.statusMsg = "Open in editor: Open a PR first"
				return m, nil
			}
			path := ""
			line := 0
			if m.activePanel == PanelDiff {
				filePath, lineNo, _, _ := m.diffViewer.CurrentLineInfo()
				path = strings.TrimSpace(filePath)
				line = lineNo
			}
			if path == "" {
				path = strings.TrimSpace(m.fileTree.SelectedPath())
			}
			if path == "" {
				m.statusMsg = "Open in editor: Select a file first"
				return m, nil
			}
			return m, openFileInEditor(m.resolveEditorCommand(), path, line)

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

		case key.Matches(msg, m.keyMap.NextMatch):
			if m.viewState == ViewDetail && strings.TrimSpace(m.diffSearchQuery) != "" {
				if m.diffViewer.FindNext(m.diffSearchQuery) {
					m.statusMsg = fmt.Sprintf("Match next: %q", m.diffSearchQuery)
				} else {
					m.statusMsg = fmt.Sprintf("No match for %q", m.diffSearchQuery)
				}
				return m, nil
			}

		case key.Matches(msg, m.keyMap.PrevMatch):
			if m.viewState == ViewDetail && strings.TrimSpace(m.diffSearchQuery) != "" {
				if m.diffViewer.FindPrev(m.diffSearchQuery) {
					m.statusMsg = fmt.Sprintf("Match previous: %q", m.diffSearchQuery)
				} else {
					m.statusMsg = fmt.Sprintf("No match for %q", m.diffSearchQuery)
				}
				return m, nil
			}

		case key.Matches(msg, m.keyMap.Search):
			if m.viewState == ViewDetail {
				m.textInput.Show(components.TextInputDiffSearch, "Diff Search", "")
				m.textInput.SetValue(m.diffSearchQuery)
				m.textInput.SetSize(m.width-20, m.height-10)
				return m, nil
			}
			m.statusMsg = "Search: Type to filter"

		case key.Matches(msg, m.keyMap.SaveFilter):
			if m.viewState == ViewList && m.activePanel == PanelContent {
				query := strings.TrimSpace(m.content.FilterValue())
				if query == "" {
					m.statusMsg = "Save filter: create a list filter first with /"
					return m, nil
				}
				m.textInput.Show(components.TextInputSaveFilterName, "Save Current Filter", query)
				m.textInput.SetValue("")
				m.textInput.SetSize(m.width-20, m.height-10)
				return m, nil
			}

		case key.Matches(msg, m.keyMap.FilterPalette):
			if m.viewState == ViewList && m.activePanel == PanelContent {
				if len(m.savedFilters) == 0 {
					m.statusMsg = "No saved filters yet (press S after filtering)"
					return m, nil
				}
				cmd := m.openSavedFilterPalette()
				return m, cmd
			}
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
		if msg.pr != nil {
			m.statusMsg = fmt.Sprintf("Loaded PR #%d details", msg.pr.Number)
		}
		m.setPRDescriptionContent(msg.pr)
		m.rebuildTimeline()
		return m, nil

	case prFilesMsg:
		m.currentFiles = msg.files
		m.fileTree.SetFiles(msg.files)
		m.updateFileCommentCounts()
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
		if m.currentPR != nil {
			owner, repo := m.resolvePRRepo()
			m.prCommentsCache.Set(m.commentsCacheKey(owner, repo, m.currentPR.Number), msg.comments)
		}
		m.diffViewer.SetComments(msg.comments)
		cmd := m.commentsList.SetItems(buildCommentItems(msg.comments))
		m.updateFileCommentCounts()
		m.rebuildTimeline()
		return m, cmd

	case prReviewsMsg:
		if msg.err != nil {
			m.statusMsg = fmt.Sprintf("Failed to load reviews: %s", msg.err.Error())
			return m, nil
		}
		m.reviews = msg.reviews
		if m.currentPR != nil {
			owner, repo := m.resolvePRRepo()
			m.prReviewsCache.Set(m.reviewsCacheKey(owner, repo, m.currentPR.Number), msg.reviews)
		}
		m.rebuildTimeline()
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
			if m.currentPR != nil {
				owner, repo := m.resolvePRRepo()
				return m, tea.Batch(
					m.fetchPRReviewsCached(owner, repo, m.currentPR.Number),
					m.fetchPRCommentsCached(owner, repo, m.currentPR.Number),
				)
			}
		}
		return m, nil

	case replyResultMsg:
		m.isLoading = false
		m.loadingMessage = ""
		m.textInput.Hide()
		if msg.err != nil {
			m.removeCommentByID(msg.optimisticID)
			m.lastError = msg.err
			m.statusMsg = fmt.Sprintf("Reply failed: %s", msg.err.Error())
			return m, nil
		}
		m.invalidateCommentsCache()
		m.statusMsg = "Reply posted"
		return m, m.refreshComments()

	case commentEditResultMsg:
		m.isLoading = false
		m.loadingMessage = ""
		m.textInput.Hide()
		if msg.err != nil {
			m.lastError = msg.err
			m.statusMsg = fmt.Sprintf("Edit failed: %s", msg.err.Error())
			return m, nil
		}
		m.invalidateCommentsCache()
		m.statusMsg = "Comment updated"
		return m, m.refreshComments()

	case commentDeleteResultMsg:
		m.isLoading = false
		m.loadingMessage = ""
		if msg.err != nil {
			m.lastError = msg.err
			m.statusMsg = fmt.Sprintf("Delete failed: %s", msg.err.Error())
			return m, nil
		}
		m.invalidateCommentsCache()
		m.statusMsg = "Comment deleted"
		return m, m.refreshComments()

	case commentResolveResultMsg:
		m.isLoading = false
		m.loadingMessage = ""
		if msg.err != nil {
			m.lastError = msg.err
			if errors.Is(msg.err, providers.ErrUnsupported) {
				m.statusMsg = "Resolve not supported by this provider"
				return m, nil
			}
			m.statusMsg = fmt.Sprintf("Resolve failed: %s", msg.err.Error())
			return m, nil
		}
		m.invalidateCommentsCache()
		m.statusMsg = "Thread resolved"
		return m, m.refreshComments()

	case openEditorResultMsg:
		if msg.err != nil {
			m.lastError = msg.err
			m.statusMsg = fmt.Sprintf("Open in editor failed: %s", msg.err.Error())
			return m, nil
		}
		if msg.line > 0 {
			m.statusMsg = fmt.Sprintf("Opened %s:%d in editor", msg.path, msg.line)
		} else {
			m.statusMsg = fmt.Sprintf("Opened %s in editor", msg.path)
		}
		return m, nil

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
			m.isLoading = true
			m.loadingMessage = "Submitting AI approval..."
			return m, approveReview(m.provider, owner, repo, m.currentPR.Number, comment)
		case ai.DecisionRequestChanges:
			m.isLoading = true
			m.loadingMessage = "Submitting AI change request..."
			return m, requestChanges(m.provider, owner, repo, m.currentPR.Number, comment)
		default:
			m.isLoading = true
			m.loadingMessage = "Submitting AI review comment..."
			return m, submitReviewComment(m.provider, owner, repo, m.currentPR.Number, comment)
		}

	case updateResultMsg:
		m.isLoading = false
		m.loadingMessage = ""
		if msg.err != nil {
			m.lastError = msg.err
			m.statusMsg = fmt.Sprintf("Update failed: %s", msg.err.Error())
			return m, nil
		}
		if msg.result.Updated {
			m.statusMsg = fmt.Sprintf("Updated to %s. Restart LazyReview.", msg.result.Version)
		} else {
			m.statusMsg = "Update complete. Restart LazyReview."
		}
		return m, nil

	case updateCheckMsg:
		if msg.err != nil {
			return m, nil
		}
		current := strings.TrimSpace(msg.current)
		latest := strings.TrimSpace(msg.latest)
		if latest == "" || current == "" || current == "(devel)" {
			return m, nil
		}
		if current != latest {
			m.updateAvailable = true
			m.updateVersion = latest
			m.refreshSidebarItems()
		}
		return m, nil

	case summaryDraftMsg:
		m.isLoading = false
		m.loadingMessage = ""
		if msg.err != nil {
			m.lastError = msg.err
			m.statusMsg = fmt.Sprintf("Summary failed: %s", msg.err.Error())
			return m, nil
		}
		m.reviewDraft = msg.summary
		m.statusMsg = "Review summary draft ready (press v to edit/post)"
		return m, nil

	case commentSubmitMsg:
		m.isLoading = false
		m.loadingMessage = ""
		m.textInput.Hide()
		if msg.err != nil {
			m.removeCommentByID(msg.optimisticID)
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
			m.invalidateCommentsCache()
			if msg.filePath != "" && msg.line > 0 {
				m.statusMsg = fmt.Sprintf("Comment added to %s:%d", msg.filePath, msg.line)
			} else {
				m.statusMsg = "Comment added to PR"
			}
			return m, m.refreshComments()
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
				} else if m.detailSidebarMode == DetailSidebarTimeline {
					m.timelineList, cmd = m.timelineList.Update(msg)
				} else if m.detailSidebarMode == DetailSidebarDescription {
					m.descriptionView, cmd = m.descriptionView.Update(msg)
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
	accent := m.accentColor
	if accent == "" {
		accent = "170"
	}
	headerBg := m.headerBgColor
	if headerBg == "" {
		headerBg = "235"
	}
	footerBg := m.footerBgColor
	if footerBg == "" {
		footerBg = "235"
	}
	focusedBorder := m.focusedBorder
	if focusedBorder == "" {
		focusedBorder = "170"
	}
	unfocusedBorder := m.unfocusedBorder
	if unfocusedBorder == "" {
		unfocusedBorder = "240"
	}
	muted := m.mutedColor
	if muted == "" {
		muted = "240"
	}

	headerStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color(accent)).
		Background(lipgloss.Color(headerBg)).
		Padding(0, 1).
		Width(m.width)

	footerStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color(muted)).
		Background(lipgloss.Color(footerBg)).
		Padding(0, 1).
		Width(m.width)

	focusedStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color(focusedBorder))

	unfocusedStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color(unfocusedBorder))

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
			if m.commentPreviewExpanded {
				preview := m.renderCommentPreview()
				sidebarContent = lipgloss.JoinVertical(
					lipgloss.Left,
					m.commentsList.View(),
					lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Render(strings.Repeat("─", max(10, m.width/4))),
					preview,
				)
			} else {
				sidebarContent = m.commentsList.View()
			}
		} else if m.detailSidebarMode == DetailSidebarTimeline {
			sidebarContent = m.timelineList.View()
		} else if m.detailSidebarMode == DetailSidebarDescription {
			sidebarContent = m.descriptionView.View()
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
		footer = footerStyle.Render("j/k:navigate  h/l:panels  /:search  n/N:next/prev match  V:select range  a:approve  r:request changes  v:review comment  s:draft summary  c:line comment  C:PR comment  y:reply  e:edit  x:delete  z:resolve  i:preview  enter:jump  O:open editor  t:files/comments/timeline/description  A:ai review  shift+c:checkout  d:toggle view  esc:back  ?:help")
	} else {
		footer = footerStyle.Render("j/k:navigate  h/l:panels  /:filter  S:save filter  F:saved filters  enter:view PR  m:my PRs  R:review requests  ?:help  q:quit")
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

	if m.filterPaletteVisible {
		palette := m.filterPalette.View()
		return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, palette)
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
		m.timelineList.Blur()
	} else if m.detailSidebarMode == DetailSidebarDescription {
		m.fileTree.Blur()
		m.commentsList.Blur()
		m.timelineList.Blur()
	} else if m.detailSidebarMode == DetailSidebarTimeline {
		m.timelineList.Focus()
		m.fileTree.Blur()
		m.commentsList.Blur()
	} else {
		m.fileTree.Focus()
		m.commentsList.Blur()
		m.timelineList.Blur()
	}
}

func (m *Model) blurDetailSidebar() {
	m.fileTree.Blur()
	m.commentsList.Blur()
	m.timelineList.Blur()
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
		lines = append(lines, "  /: search in diff")
		lines = append(lines, "  n/N: next/prev search match (or next/prev file when search is empty)")
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
		lines = append(lines, "  s: generate review summary draft")
		lines = append(lines, "  a: approve")
		lines = append(lines, "  r: request changes")
		lines = append(lines, "  A: AI review (current file)")
		lines = append(lines, "  U: update LazyReview")
		lines = append(lines, "  shift+c: checkout PR branch")
		lines = append(lines, "")

		lines = append(lines, "Sidebar Panels")
		lines = append(lines, "  t: cycle files/comments/timeline/description")
		lines = append(lines, "  y: reply to selected comment")
		lines = append(lines, "  e: edit selected comment")
		lines = append(lines, "  x: delete selected comment")
		lines = append(lines, "  z: resolve selected thread")
		lines = append(lines, "  i: toggle full comment preview pane")
		lines = append(lines, "  enter: jump to comment line in diff")
		lines = append(lines, "  O: open selected file in editor")
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
		lines = append(lines, "  S: save current filter")
		lines = append(lines, "  F: quick switch saved filters")
		lines = append(lines, "  n/N: next/prev filter match")
		lines = append(lines, "  esc: clear filter")
		lines = append(lines, "  r: refresh")
		lines = append(lines, "  1-9: switch workspace tab")
		lines = append(lines, "  U: update LazyReview")
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
	m.comments = nil
	m.reviews = nil
	m.reviewDraft = ""
	m.diffViewer.SetComments(nil)
	m.commentsList.SetItems(nil)
	m.timelineList.SetItems(nil)
	m.descriptionView.SetContent("PR Description\n\nLoading...")
	m.descriptionView.GotoTop()
	m.timelineTargets = map[string]timelineJumpTarget{}
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
		m.fetchPRCommentsCached(owner, repo, prNumber),
		m.fetchPRReviewsCached(owner, repo, prNumber),
	)
}

func (m *Model) exitDetailView() {
	m.viewState = ViewList
	m.activePanel = PanelContent
	m.currentPR = nil
	m.currentDiff = nil
	m.currentFiles = nil
	m.comments = nil
	m.reviews = nil
	m.reviewDraft = ""
	m.diffViewer.SetComments(nil)
	m.commentsList.SetItems(nil)
	m.timelineList.SetItems(nil)
	m.descriptionView.SetContent("PR Description\n\nNo description available.")
	m.descriptionView.GotoTop()
	m.timelineTargets = map[string]timelineJumpTarget{}
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
	mode := m.textInput.Mode()
	if mode == components.TextInputDiffSearch {
		m.diffSearchQuery = strings.TrimSpace(body)
		m.textInput.Hide()
		m.isLoading = false
		if m.diffSearchQuery == "" {
			m.statusMsg = "Diff search cleared"
			return *m, nil
		}
		if m.diffViewer.FindNext(m.diffSearchQuery) {
			m.statusMsg = fmt.Sprintf("Found: %q", m.diffSearchQuery)
		} else {
			m.statusMsg = fmt.Sprintf("No match for %q", m.diffSearchQuery)
		}
		return *m, nil
	}
	if mode == components.TextInputSaveFilterName {
		name := strings.TrimSpace(body)
		if name == "" {
			m.statusMsg = "Save filter: name cannot be empty"
			return *m, nil
		}
		query := strings.TrimSpace(m.textInput.Context())
		if query == "" {
			query = strings.TrimSpace(m.content.FilterValue())
		}
		if query == "" {
			m.statusMsg = "Save filter: empty query"
			m.textInput.Hide()
			return *m, nil
		}
		m.upsertSavedFilter(savedFilter{Name: name, Query: query})
		if err := m.persistSavedFilters(); err != nil {
			m.statusMsg = fmt.Sprintf("Saved locally, but failed to persist filters: %s", err.Error())
		} else {
			m.statusMsg = fmt.Sprintf("Saved filter %q", name)
		}
		m.textInput.Hide()
		return *m, nil
	}

	if strings.TrimSpace(body) == "" &&
		m.textInput.Mode() != components.TextInputApprove &&
		m.textInput.Mode() != components.TextInputEditorCommand {
		m.statusMsg = "Comment cannot be empty"
		return *m, nil
	}

	if m.currentPR == nil {
		m.statusMsg = "No PR selected"
		m.textInput.Hide()
		return *m, nil
	}

	owner, repo := m.resolvePRRepo()

	m.isLoading = true
	switch mode {
	case components.TextInputApprove:
		m.loadingMessage = "Submitting approval..."
	case components.TextInputRequestChanges:
		m.loadingMessage = "Submitting change request..."
	case components.TextInputReviewComment:
		m.loadingMessage = "Submitting review comment..."
	case components.TextInputEditComment:
		m.loadingMessage = "Updating comment..."
	case components.TextInputProviderToken, components.TextInputAIKey:
		m.loadingMessage = "Saving settings..."
	case components.TextInputEditorCommand:
		m.loadingMessage = "Saving editor..."
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

		optimisticID := m.addOptimisticComment(models.Comment{
			Type: models.CommentTypeInline,
			Body: body,
			Path: filePath,
			Line: line,
			Side: side,
		})
		m.diffViewer.ClearSelection()
		return *m, submitLineComment(m.provider, owner, repo, m.currentPR.Number, body, optimisticID, filePath, line, startLine, side, commitID)
	} else if mode == components.TextInputGeneralComment {
		optimisticID := m.addOptimisticComment(models.Comment{
			Type: models.CommentTypeGeneral,
			Body: body,
		})
		return *m, submitGeneralComment(m.provider, owner, repo, m.currentPR.Number, body, optimisticID)
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
		optimisticID := m.addOptimisticReply(commentID, body)
		return *m, submitReplyComment(m.provider, owner, repo, m.currentPR.Number, commentID, optimisticID, body)
	} else if mode == components.TextInputEditComment {
		commentID := strings.TrimSpace(m.textInput.Context())
		if commentID == "" {
			m.statusMsg = "Edit: Missing comment ID"
			m.textInput.Hide()
			m.isLoading = false
			return *m, nil
		}
		comment := m.findCommentByID(commentID)
		if comment == nil {
			m.statusMsg = "Edit: Comment not found"
			m.textInput.Hide()
			m.isLoading = false
			return *m, nil
		}
		return *m, submitEditComment(m.provider, owner, repo, m.currentPR.Number, commentID, comment.Type, body)
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
	} else if mode == components.TextInputProviderToken {
		ctxValue := strings.TrimSpace(m.textInput.Context())
		parts := strings.Split(ctxValue, "|")
		if len(parts) != 2 {
			m.statusMsg = "Provider setup: invalid context"
			m.textInput.Hide()
			m.isLoading = false
			return *m, nil
		}
		providerType := config.ProviderType(parts[0])
		host := parts[1]
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if _, err := m.authService.Login(ctx, providerType, host, strings.TrimSpace(body)); err != nil {
			m.statusMsg = fmt.Sprintf("Provider setup failed: %s", err.Error())
			m.textInput.Hide()
			m.isLoading = false
			return *m, nil
		}
		m.textInput.Hide()
		m.isLoading = false
		m.statusMsg = fmt.Sprintf("Connected %s (%s)", providerType, host)
		m.content.SetItems(m.buildSettingsItems())
		return *m, nil
	} else if mode == components.TextInputAIKey {
		if err := m.setAIKey(body); err != nil {
			m.statusMsg = fmt.Sprintf("Failed to save AI key: %s", err.Error())
			m.textInput.Hide()
			m.isLoading = false
			return *m, nil
		}
		m.textInput.Hide()
		m.isLoading = false
		m.statusMsg = "AI API key saved"
		m.content.SetItems(m.buildSettingsItems())
		return *m, nil
	} else if mode == components.TextInputEditorCommand {
		m.editorCommand = strings.TrimSpace(body)
		if m.storage != nil {
			_ = m.storage.SetSetting("ui.editor", m.editorCommand)
		}
		m.textInput.Hide()
		m.isLoading = false
		if m.editorCommand == "" {
			m.statusMsg = "Editor set to auto fallback"
		} else {
			m.statusMsg = fmt.Sprintf("Editor set to %s", m.editorCommand)
		}
		m.content.SetItems(m.buildSettingsItems())
		return *m, nil
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
	return tea.Batch(
		m.fetchPRCommentsCached(owner, repo, m.currentPR.Number),
		m.fetchPRReviewsCached(owner, repo, m.currentPR.Number),
	)
}

func (m *Model) setPRDescriptionContent(pr *models.PullRequest) {
	if pr == nil {
		m.descriptionView.SetContent("PR Description\n\nNo description available.")
		m.descriptionView.GotoTop()
		return
	}
	body := strings.TrimSpace(pr.Body)
	if body == "" {
		body = "_No description provided._"
	}
	var b strings.Builder
	b.WriteString("PR Description\n\n")
	b.WriteString(fmt.Sprintf("#%d %s\n", pr.Number, strings.TrimSpace(pr.Title)))
	b.WriteString(fmt.Sprintf("Author: @%s\n", sanitizeInlineText(pr.Author.Login)))
	b.WriteString(fmt.Sprintf("Branches: %s -> %s\n\n", strings.TrimSpace(pr.SourceBranch), strings.TrimSpace(pr.TargetBranch)))
	b.WriteString(body)
	m.descriptionView.SetContent(b.String())
	m.descriptionView.GotoTop()
}

func (m *Model) handleAIReviewShortcut() (tea.Model, tea.Cmd) {
	if m.inWorkspaceView() {
		return *m, nil
	}
	if m.viewState != ViewDetail || m.currentDiff == nil || m.currentPR == nil {
		m.statusMsg = "AI Review: Open a PR diff first"
		return *m, nil
	}
	if m.aiProvider == nil {
		if m.aiError != nil {
			errText := strings.ToLower(strings.TrimSpace(m.aiError.Error()))
			if strings.Contains(errText, "api key") || strings.Contains(errText, "not configured") {
				m.textInput.Show(components.TextInputAIKey, "Set AI API Key", "")
				m.textInput.SetSize(m.width-20, m.height-10)
				m.statusMsg = "AI key required: paste key and press Ctrl+S"
				return *m, nil
			}
			m.statusMsg = fmt.Sprintf("AI Review unavailable: %s", m.aiError.Error())
			return *m, nil
		}
		m.statusMsg = "AI Review unavailable: configure AI in Settings"
		return *m, nil
	}
	m.isLoading = true
	m.loadingMessage = "Running AI review..."
	return *m, m.startAIReview()
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
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		resp, err := provider.Review(ctx, req)
		return aiReviewResultMsg{response: resp, err: err}
	}
}

func (m *Model) generateSummaryDraft() tea.Cmd {
	if m.currentPR == nil || m.currentDiff == nil {
		return nil
	}
	diff := m.currentDiff
	files := m.currentFiles
	useAI := m.aiProvider != nil
	title := m.currentPR.Title
	manual := buildManualSummary(m.currentPR, diff, files)
	diffInput := fmt.Sprintf(
		"Summarize this PR in concise bullet points (scope, key changes, risks):\n\nTitle: %s\n\n%s",
		title,
		buildDiffExcerpt(diff),
	)
	return func() tea.Msg {
		if useAI {
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			req := ai.ReviewRequest{
				FilePath: "PR_SUMMARY",
				Diff:     diffInput,
			}
			resp, err := m.aiProvider.Review(ctx, req)
			if err == nil {
				summary := strings.TrimSpace(resp.Comment)
				if summary != "" {
					return summaryDraftMsg{summary: summary}
				}
			}
		}
		return summaryDraftMsg{summary: manual}
	}
}

func (m *Model) runUpdate() tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		result, err := updater.Update(ctx)
		return updateResultMsg{result: result, err: err}
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
		appendCommentItem(&items, comment, 0)
	}
	return items
}

func appendCommentItem(items *[]list.Item, comment models.Comment, depth int) {
	author := sanitizeInlineText(comment.Author.Login)
	if author == "" {
		author = "unknown"
	}
	snippet := summarizeText(comment.Body, 60)
	title := fmt.Sprintf("@%s: %s", author, snippet)
	if depth > 0 {
		title = fmt.Sprintf("%s↳ %s", strings.Repeat("  ", depth-1), title)
	}
	desc := "General comment"
	if comment.Path != "" && comment.Line > 0 {
		desc = fmt.Sprintf("%s:%d", comment.Path, comment.Line)
	} else if comment.Type == models.CommentTypeInline {
		desc = "Inline comment"
	}
	if depth == 0 && len(comment.Replies) > 0 {
		desc = fmt.Sprintf("%s • %d repl", desc, len(comment.Replies))
	}
	*items = append(*items, components.NewSimpleItem(comment.ID, title, desc))
	for _, reply := range comment.Replies {
		appendCommentItem(items, reply, depth+1)
	}
}

func summarizeText(text string, max int) string {
	trimmed := strings.TrimSpace(strings.ReplaceAll(sanitizeInlineText(text), "\n", " "))
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
		if found := findCommentInThread(&m.comments[i], id); found != nil {
			return found
		}
	}
	return nil
}

func (m *Model) selectedCommentID() string {
	if m.activePanel == PanelDiff {
		return strings.TrimSpace(m.diffViewer.CurrentCommentID())
	}
	if m.detailSidebarMode != DetailSidebarComments {
		return ""
	}
	selected := m.commentsList.SelectedItem()
	if selected == nil {
		return ""
	}
	item, ok := selected.(components.SimpleItem)
	if !ok {
		return ""
	}
	return strings.TrimSpace(item.ID())
}

func (m *Model) selectedComment() *models.Comment {
	id := m.selectedCommentID()
	if id == "" {
		return nil
	}
	return m.findCommentByID(id)
}

func (m *Model) selectedTimelineTarget() (timelineJumpTarget, bool) {
	if m.detailSidebarMode != DetailSidebarTimeline {
		return timelineJumpTarget{}, false
	}
	selected := m.timelineList.SelectedItem()
	if selected == nil {
		return timelineJumpTarget{}, false
	}
	item, ok := selected.(components.SimpleItem)
	if !ok {
		return timelineJumpTarget{}, false
	}
	target, found := m.timelineTargets[item.ID()]
	return target, found
}

func (m *Model) rebuildTimeline() {
	items, targets := buildTimelineItems(m.currentPR, m.reviews, m.comments)
	m.timelineTargets = targets
	_ = m.timelineList.SetItems(items)
}

func findCommentInThread(comment *models.Comment, id string) *models.Comment {
	if comment == nil || id == "" {
		return nil
	}
	if comment.ID == id {
		return comment
	}
	for i := range comment.Replies {
		if found := findCommentInThread(&comment.Replies[i], id); found != nil {
			return found
		}
	}
	return nil
}

func sanitizeInlineText(s string) string {
	if s == "" {
		return ""
	}
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if r == '\n' || r == '\r' || r == '\t' {
			b.WriteRune(' ')
			continue
		}
		if r < 32 || r == 127 {
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

type timelineEvent struct {
	ID     string
	At     time.Time
	Title  string
	Detail string
	Jump   *timelineJumpTarget
}

func buildTimelineItems(pr *models.PullRequest, reviews []models.Review, comments []models.Comment) ([]list.Item, map[string]timelineJumpTarget) {
	if pr == nil {
		return []list.Item{}, map[string]timelineJumpTarget{}
	}

	events := make([]timelineEvent, 0, 64)
	targets := map[string]timelineJumpTarget{}

	openTime := pr.CreatedAt
	if openTime.IsZero() {
		openTime = pr.UpdatedAt
	}
	events = append(events, timelineEvent{
		ID:     fmt.Sprintf("pr-open-%d", pr.Number),
		At:     openTime,
		Title:  fmt.Sprintf("PR opened by @%s", sanitizeInlineText(pr.Author.Login)),
		Detail: fmt.Sprintf("%d files • +%d -%d", pr.ChangedFiles, pr.Additions, pr.Deletions),
	})
	if pr.CommitCount > 0 {
		commitTime := pr.UpdatedAt
		if commitTime.IsZero() {
			commitTime = openTime
		}
		events = append(events, timelineEvent{
			ID:     fmt.Sprintf("pr-commits-%d", pr.Number),
			At:     commitTime,
			Title:  fmt.Sprintf("%d commits in this PR", pr.CommitCount),
			Detail: fmt.Sprintf("%s → %s", pr.SourceBranch, pr.TargetBranch),
		})
	}

	for _, review := range reviews {
		at := review.SubmittedAt
		if at.IsZero() {
			continue
		}
		state := strings.ReplaceAll(string(review.State), "_", " ")
		state = strings.TrimSpace(state)
		if state == "" {
			state = "reviewed"
		}
		events = append(events, timelineEvent{
			ID:     "review-" + review.ID,
			At:     at,
			Title:  fmt.Sprintf("@%s %s", sanitizeInlineText(review.Author.Login), state),
			Detail: summarizeText(review.Body, 72),
		})
	}

	var addCommentEvents func(comment models.Comment)
	addCommentEvents = func(comment models.Comment) {
		at := comment.UpdatedAt
		if at.IsZero() {
			at = comment.CreatedAt
		}
		if at.IsZero() {
			at = time.Now()
		}

		location := "general comment"
		if comment.Path != "" && comment.Line > 0 {
			location = fmt.Sprintf("%s:%d", comment.Path, comment.Line)
		}
		id := "comment-" + comment.ID
		events = append(events, timelineEvent{
			ID:     id,
			At:     at,
			Title:  fmt.Sprintf("@%s commented", sanitizeInlineText(comment.Author.Login)),
			Detail: fmt.Sprintf("%s • %s", location, summarizeText(comment.Body, 72)),
			Jump: &timelineJumpTarget{
				Path: comment.Path,
				Line: comment.Line,
				Side: comment.Side,
			},
		})
		if comment.Path != "" && comment.Line > 0 {
			targets[id] = timelineJumpTarget{
				Path: comment.Path,
				Line: comment.Line,
				Side: comment.Side,
			}
		}
		for _, reply := range comment.Replies {
			replyAt := reply.UpdatedAt
			if replyAt.IsZero() {
				replyAt = reply.CreatedAt
			}
			if replyAt.IsZero() {
				replyAt = at
			}
			replyID := "comment-" + reply.ID
			events = append(events, timelineEvent{
				ID:     replyID,
				At:     replyAt,
				Title:  fmt.Sprintf("@%s replied", sanitizeInlineText(reply.Author.Login)),
				Detail: fmt.Sprintf("%s • %s", location, summarizeText(reply.Body, 72)),
				Jump: &timelineJumpTarget{
					Path: comment.Path,
					Line: comment.Line,
					Side: comment.Side,
				},
			})
			if comment.Path != "" && comment.Line > 0 {
				targets[replyID] = timelineJumpTarget{
					Path: comment.Path,
					Line: comment.Line,
					Side: comment.Side,
				}
			}
		}
	}
	for _, comment := range comments {
		addCommentEvents(comment)
	}

	sort.SliceStable(events, func(i, j int) bool {
		if events[i].At.Equal(events[j].At) {
			return events[i].Title < events[j].Title
		}
		return events[i].At.After(events[j].At)
	})
	if len(events) > 200 {
		events = events[:200]
	}

	items := make([]list.Item, 0, len(events))
	for _, event := range events {
		desc := event.Detail
		if !event.At.IsZero() {
			desc = fmt.Sprintf("%s • %s", event.At.Local().Format("Jan 2 15:04"), event.Detail)
		}
		items = append(items, components.NewSimpleItem(event.ID, event.Title, desc))
	}
	return items, targets
}

func sanitizeSavedFilters(filters []savedFilter) []savedFilter {
	out := make([]savedFilter, 0, len(filters))
	seen := map[string]struct{}{}
	for _, filter := range filters {
		name := strings.TrimSpace(filter.Name)
		query := strings.TrimSpace(filter.Query)
		if name == "" || query == "" {
			continue
		}
		key := strings.ToLower(name)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, savedFilter{Name: name, Query: query})
	}
	return out
}

func (m *Model) upsertSavedFilter(filter savedFilter) {
	filter.Name = strings.TrimSpace(filter.Name)
	filter.Query = strings.TrimSpace(filter.Query)
	for i := range m.savedFilters {
		if strings.EqualFold(m.savedFilters[i].Name, filter.Name) {
			m.savedFilters[i].Query = filter.Query
			return
		}
	}
	m.savedFilters = append(m.savedFilters, filter)
}

func (m *Model) persistSavedFilters() error {
	if m.storage == nil {
		return nil
	}
	m.savedFilters = sanitizeSavedFilters(m.savedFilters)
	raw, err := json.Marshal(m.savedFilters)
	if err != nil {
		return err
	}
	return m.storage.SetSetting("ui.saved_filters", string(raw))
}

func (m *Model) openSavedFilterPalette() tea.Cmd {
	items := make([]list.Item, 0, len(m.savedFilters)+1)
	items = append(items, components.NewSimpleItem("saved_filter:clear", "Clear filter", "Show all pull requests"))
	for _, filter := range m.savedFilters {
		items = append(items, components.NewSimpleItem(
			"saved_filter:"+filter.Name,
			filter.Name,
			summarizeText(filter.Query, 90),
		))
	}
	m.filterPaletteVisible = true
	m.filterPalette.SetTitle("Saved Filters")
	m.filterPalette.Select(0)
	return m.filterPalette.SetItems(items)
}

func (m *Model) addOptimisticComment(comment models.Comment) string {
	id := fmt.Sprintf("local-%d", time.Now().UnixNano())
	author := strings.TrimSpace(m.currentUserLogin)
	if author == "" {
		author = "you"
	}
	comment.ID = id
	comment.Author = models.User{Login: author}
	comment.CreatedAt = time.Now()
	comment.UpdatedAt = comment.CreatedAt

	m.comments = append([]models.Comment{comment}, m.comments...)
	m.refreshCommentUI()
	return id
}

func (m *Model) addOptimisticReply(parentID, body string) string {
	parent := m.findCommentByID(parentID)
	if parent == nil {
		return ""
	}
	id := fmt.Sprintf("local-%d", time.Now().UnixNano())
	author := strings.TrimSpace(m.currentUserLogin)
	if author == "" {
		author = "you"
	}
	reply := models.Comment{
		ID:        id,
		Type:      models.CommentTypeInline,
		Body:      body,
		Author:    models.User{Login: author},
		InReplyTo: parentID,
		Path:      parent.Path,
		Line:      parent.Line,
		Side:      parent.Side,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	parent.Replies = append(parent.Replies, reply)
	m.refreshCommentUI()
	return id
}

func (m *Model) removeCommentByID(id string) {
	if strings.TrimSpace(id) == "" {
		return
	}
	next := m.comments[:0]
	for i := range m.comments {
		if m.comments[i].ID == id {
			continue
		}
		m.comments[i].Replies = removeReplyByID(m.comments[i].Replies, id)
		next = append(next, m.comments[i])
	}
	m.comments = next
	m.refreshCommentUI()
}

func removeReplyByID(replies []models.Comment, id string) []models.Comment {
	next := replies[:0]
	for i := range replies {
		if replies[i].ID == id {
			continue
		}
		replies[i].Replies = removeReplyByID(replies[i].Replies, id)
		next = append(next, replies[i])
	}
	return next
}

func (m *Model) refreshCommentUI() {
	m.commentsList.SetItems(buildCommentItems(m.comments))
	m.updateFileCommentCounts()
	m.diffViewer.SetComments(m.comments)
	m.rebuildTimeline()
}

func (m *Model) invalidateCommentsCache() {
	if m.currentPR == nil {
		return
	}
	owner, repo := m.resolvePRRepo()
	m.prCommentsCache.Delete(m.commentsCacheKey(owner, repo, m.currentPR.Number))
}

func (m *Model) updateFileCommentCounts() {
	if m.currentFiles == nil {
		return
	}
	counts := map[string]int{}
	for _, comment := range m.comments {
		applyCommentCount(counts, comment)
		for _, reply := range comment.Replies {
			applyCommentCount(counts, reply)
		}
	}
	m.fileTree.SetCommentCounts(counts)
}

func applyCommentCount(counts map[string]int, comment models.Comment) {
	if comment.Path == "" {
		return
	}
	counts[comment.Path]++
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
		m.statusMsg = "Settings"
		m.content.SetItems(m.buildSettingsItems())
		m.activePanel = PanelContent
		m.content.Focus()
		m.sidebar.Blur()
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

func checkForUpdates() tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
		defer cancel()
		latest, err := updater.LatestVersion(ctx)
		return updateCheckMsg{
			current: updater.CurrentVersion(),
			latest:  latest,
			err:     err,
		}
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

func fetchPRReviews(provider providers.Provider, owner, repo string, number int) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		reviews, err := provider.ListReviews(ctx, owner, repo, number)
		return prReviewsMsg{reviews: reviews, err: err}
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

func submitLineComment(provider providers.Provider, owner, repo string, prNumber int, body, optimisticID, path string, line int, startLine int, side models.DiffSide, commitID string) tea.Cmd {
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
			body:         body,
			optimisticID: optimisticID,
			filePath:     path,
			line:         line,
			startLine:    startLine,
			side:         side,
			commitID:     commitID,
			owner:        owner,
			repo:         repo,
			number:       prNumber,
			err:          err,
		}
	}
}

func submitGeneralComment(provider providers.Provider, owner, repo string, prNumber int, body, optimisticID string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		comment := models.CommentInput{
			Body: body,
		}

		err := provider.CreateComment(ctx, owner, repo, prNumber, comment)
		return commentSubmitMsg{
			body:         body,
			optimisticID: optimisticID,
			owner:        owner,
			repo:         repo,
			number:       prNumber,
			err:          err,
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

func submitReplyComment(provider providers.Provider, owner, repo string, prNumber int, commentID, optimisticID, body string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		err := provider.ReplyToComment(ctx, owner, repo, prNumber, commentID, body)
		return replyResultMsg{commentID: commentID, optimisticID: optimisticID, err: err}
	}
}

func submitEditComment(provider providers.Provider, owner, repo string, prNumber int, commentID string, commentType models.CommentType, body string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		err := provider.EditComment(ctx, owner, repo, prNumber, commentID, commentType, body)
		return commentEditResultMsg{commentID: commentID, err: err}
	}
}

func submitDeleteComment(provider providers.Provider, owner, repo string, prNumber int, commentID string, commentType models.CommentType) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		err := provider.DeleteComment(ctx, owner, repo, prNumber, commentID, commentType)
		return commentDeleteResultMsg{commentID: commentID, err: err}
	}
}

func submitResolveComment(provider providers.Provider, owner, repo string, prNumber int, commentID string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		err := provider.ResolveComment(ctx, owner, repo, prNumber, commentID)
		return commentResolveResultMsg{commentID: commentID, err: err}
	}
}

func openFileInEditor(editorCmd, path string, line int) tea.Cmd {
	return func() tea.Msg {
		cleanPath := filepath.Clean(strings.TrimSpace(path))
		if cleanPath == "" {
			return openEditorResultMsg{err: fmt.Errorf("empty file path")}
		}
		if _, err := os.Stat(cleanPath); err != nil {
			return openEditorResultMsg{path: cleanPath, line: line, err: err}
		}

		editor := strings.TrimSpace(editorCmd)
		if editor == "" {
			editor = "vim"
		}

		parts := strings.Fields(editor)
		if len(parts) == 0 {
			parts = []string{"vim"}
		}
		bin := parts[0]
		args := append([]string{}, parts[1:]...)
		args = append(args, editorLineArgs(bin, cleanPath, line)...)

		cmd := exec.Command(bin, args...)
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Start(); err != nil {
			return openEditorResultMsg{path: cleanPath, line: line, err: err}
		}
		return openEditorResultMsg{path: cleanPath, line: line, err: nil}
	}
}

func (m *Model) resolveEditorCommand() string {
	if strings.TrimSpace(m.editorCommand) != "" {
		return strings.TrimSpace(m.editorCommand)
	}
	if gitEditor := detectGitEditor(); gitEditor != "" {
		return gitEditor
	}
	if editor := strings.TrimSpace(os.Getenv("EDITOR")); editor != "" {
		return editor
	}
	if visual := strings.TrimSpace(os.Getenv("VISUAL")); visual != "" {
		return visual
	}
	return "vim"
}

func detectGitEditor() string {
	cmd := exec.Command("git", "config", "--get", "core.editor")
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func editorLineArgs(bin, path string, line int) []string {
	if line <= 0 {
		return []string{path}
	}
	lower := strings.ToLower(filepath.Base(bin))
	switch lower {
	case "code", "code-insiders", "cursor", "windsurf":
		return []string{"-g", fmt.Sprintf("%s:%d", path, line)}
	case "zed":
		return []string{fmt.Sprintf("%s:%d", path, line)}
	default:
		return []string{fmt.Sprintf("+%d", line), path}
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
	commentsHeight := panelHeight
	if m.commentPreviewExpanded {
		commentsHeight = max(8, panelHeight/2)
	}
	m.commentsList.SetSize(fileTreeWidth, commentsHeight)
	m.timelineList.SetSize(fileTreeWidth, panelHeight)
	m.descriptionView.Width = fileTreeWidth
	m.descriptionView.Height = panelHeight
	m.diffViewer.SetSize(diffWidth, panelHeight)
	m.filterPalette.SetSize(min(width-20, 80), min(height-10, 28))

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

func (m *Model) commentsCacheKey(owner, repo string, number int) string {
	return fmt.Sprintf("pr_comments:%s/%s:%d:%s", owner, repo, number, m.provider.Host())
}

func (m *Model) reviewsCacheKey(owner, repo string, number int) string {
	return fmt.Sprintf("pr_reviews:%s/%s:%d:%s", owner, repo, number, m.provider.Host())
}

func (m *Model) fetchPRCommentsCached(owner, repo string, number int) tea.Cmd {
	key := m.commentsCacheKey(owner, repo, number)
	if cached, ok := m.prCommentsCache.Get(key); ok {
		return tea.Batch(
			func() tea.Msg { return prCommentsMsg{comments: cached, err: nil} },
			fetchPRComments(m.provider, owner, repo, number),
		)
	}
	return fetchPRComments(m.provider, owner, repo, number)
}

func (m *Model) fetchPRReviewsCached(owner, repo string, number int) tea.Cmd {
	key := m.reviewsCacheKey(owner, repo, number)
	if cached, ok := m.prReviewsCache.Get(key); ok {
		return tea.Batch(
			func() tea.Msg { return prReviewsMsg{reviews: cached, err: nil} },
			fetchPRReviews(m.provider, owner, repo, number),
		)
	}
	return fetchPRReviews(m.provider, owner, repo, number)
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
	settingsLabel := "Settings"
	if m.updateAvailable {
		if m.updateVersion != "" {
			settingsLabel = fmt.Sprintf("Settings (update %s)", m.updateVersion)
		} else {
			settingsLabel = "Settings (update)"
		}
	}
	items := []list.Item{
		components.NewSimpleItem("dashboard", "Dashboard", "Grouped PR overview"),
		components.NewSimpleItem("my_prs", m.sidebarLabel("My PRs", "my_prs"), "PRs you authored (all repos)"),
		components.NewSimpleItem("review_requests", m.sidebarLabel("Review Requests", "review_requests"), "PRs needing your review"),
		components.NewSimpleItem("assigned_to_me", m.sidebarLabel("Assigned to Me", "assigned_to_me"), "PRs assigned to you"),
		components.NewSimpleItem("current_repo", "Current Repo", "PRs in detected repo"),
		components.NewSimpleItem("workspaces", "Workspaces", "Create and manage repo groups"),
		components.NewSimpleItem("settings", settingsLabel, "Configure LazyReview"),
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

func (m *Model) buildSettingsItems() []list.Item {
	items := make([]list.Item, 0, 32)

	items = append(items, components.NewSimpleItem("section:providers", "Providers", "Authenticate and switch active provider"))
	for _, providerCfg := range m.configuredProviderOptions() {
		status := "Not connected"
		if m.isProviderAuthenticated(providerCfg.Type, providerCfg.GetHost()) {
			status = "Connected"
		}
		title := fmt.Sprintf("Connect %s (%s)", providerCfg.Type, providerCfg.GetHost())
		items = append(items, components.NewSimpleItem(
			fmt.Sprintf("provider:login:%s:%s", providerCfg.Type, providerCfg.GetHost()),
			title,
			status,
		))
	}
	for _, providerCfg := range m.authenticatedProviderOptions() {
		label := fmt.Sprintf("Use %s (%s)", providerCfg.Type, providerCfg.GetHost())
		desc := "Switch active provider"
		if strings.EqualFold(string(providerCfg.Type), string(m.provider.Type())) &&
			strings.EqualFold(providerCfg.GetHost(), m.provider.Host()) {
			desc = "Current provider"
		}
		items = append(items, components.NewSimpleItem(
			fmt.Sprintf("provider:switch:%s:%s", providerCfg.Type, providerCfg.GetHost()),
			label,
			desc,
		))
	}

	items = append(items, components.NewSimpleItem("section:ai", "AI Review", "Choose provider and token"))
	for _, name := range []string{"openai", "anthropic", "gemini", "copilot", "none"} {
		desc := "Select AI provider"
		if strings.EqualFold(name, m.aiProviderName) {
			desc = "Current AI provider"
		}
		items = append(items, components.NewSimpleItem(
			"ai:provider:"+name,
			"AI Provider: "+themeDisplayName(name),
			desc,
		))
	}
	keyStatus := "Not set"
	if m.hasAIKey() {
		keyStatus = "Configured"
	}
	items = append(items, components.NewSimpleItem("ai:key:set", "Set AI API key", keyStatus))
	items = append(items, components.NewSimpleItem("ai:key:clear", "Clear AI API key", "Remove stored key"))

	items = append(items, components.NewSimpleItem("section:theme", "Themes", "Visual presets"))
	navDesc := "Current: arrows only"
	if m.vimMode {
		navDesc = "Current: vim + arrows"
	}
	items = append(items, components.NewSimpleItem("nav:vim_toggle", "Navigation Mode", navDesc))
	editorDesc := "Auto (git config -> $EDITOR -> vim)"
	if strings.TrimSpace(m.editorCommand) != "" {
		editorDesc = "Current: " + strings.TrimSpace(m.editorCommand)
	}
	items = append(items, components.NewSimpleItem("section:editor", "Editor", editorDesc))
	for _, editor := range []string{"auto", "nvim", "vim", "code --wait", "cursor --wait", "hx", "nano"} {
		desc := "Set preferred editor"
		if strings.TrimSpace(editor) == "" && strings.TrimSpace(m.editorCommand) == "" {
			desc = "Current editor"
		}
		if editor == "auto" && strings.TrimSpace(m.editorCommand) == "" {
			desc = "Current editor"
		}
		if editor != "auto" && strings.TrimSpace(editor) == strings.TrimSpace(m.editorCommand) {
			desc = "Current editor"
		}
		items = append(items, components.NewSimpleItem("editor:set:"+editor, "Editor: "+editor, desc))
	}
	items = append(items, components.NewSimpleItem("editor:set:custom", "Editor: custom...", "Enter a custom editor command"))
	for _, name := range availableThemes() {
		label := themeDisplayName(name)
		if name == "auto" {
			label = "Auto"
		}
		desc := "Theme preset"
		if strings.EqualFold(name, m.currentTheme) {
			desc = "Current theme"
		}
		items = append(items, components.NewSimpleItem("theme:"+name, "Theme: "+label, desc))
	}
	return items
}

func themeDisplayName(name string) string {
	if name == "" {
		return ""
	}
	return strings.ToUpper(name[:1]) + name[1:]
}

func (m *Model) handleSettingsSelection() {
	if m.currentViewMode != ViewModeSettings {
		return
	}
	selected := m.content.SelectedItem()
	if selected == nil {
		return
	}
	item, ok := selected.(components.SimpleItem)
	if !ok {
		return
	}
	id := item.ID()
	if strings.HasPrefix(id, "section:") {
		return
	}
	if strings.HasPrefix(id, "theme:") {
		theme := strings.TrimPrefix(id, "theme:")
		m.applyTheme(theme)
		m.content.SetItems(m.buildSettingsItems())
		m.statusMsg = fmt.Sprintf("Theme switched to %s", theme)
		return
	}
	if id == "nav:vim_toggle" {
		m.applyVimMode(!m.vimMode)
		if m.vimMode {
			m.statusMsg = "Navigation mode: vim + arrows"
		} else {
			m.statusMsg = "Navigation mode: arrows only"
		}
		m.content.SetItems(m.buildSettingsItems())
		return
	}
	if strings.HasPrefix(id, "editor:set:") {
		value := strings.TrimPrefix(id, "editor:set:")
		if value == "custom" {
			m.textInput.Show(components.TextInputEditorCommand, "Set Editor Command", strings.TrimSpace(m.editorCommand))
			m.textInput.SetValue(strings.TrimSpace(m.editorCommand))
			m.textInput.SetSize(m.width-20, m.height-10)
			return
		}
		if value == "auto" {
			m.editorCommand = ""
			if m.storage != nil {
				_ = m.storage.SetSetting("ui.editor", "")
			}
			m.statusMsg = "Editor set to auto fallback"
		} else {
			m.editorCommand = strings.TrimSpace(value)
			if m.storage != nil {
				_ = m.storage.SetSetting("ui.editor", m.editorCommand)
			}
			m.statusMsg = fmt.Sprintf("Editor set to %s", m.editorCommand)
		}
		m.content.SetItems(m.buildSettingsItems())
		return
	}
	if strings.HasPrefix(id, "provider:login:") {
		parts := strings.Split(id, ":")
		if len(parts) >= 4 {
			context := fmt.Sprintf("%s|%s", parts[2], parts[3])
			m.textInput.Show(components.TextInputProviderToken, "Connect Provider Token", context)
			m.textInput.SetSize(m.width-20, m.height-10)
		}
		return
	}
	if strings.HasPrefix(id, "provider:switch:") {
		parts := strings.Split(id, ":")
		if len(parts) >= 4 {
			if err := m.switchProvider(config.ProviderType(parts[2]), parts[3]); err != nil {
				m.statusMsg = fmt.Sprintf("Failed to switch provider: %s", err.Error())
			} else {
				m.statusMsg = fmt.Sprintf("Switched provider to %s (%s)", parts[2], parts[3])
			}
			m.content.SetItems(m.buildSettingsItems())
		}
		return
	}
	if strings.HasPrefix(id, "ai:provider:") {
		name := strings.TrimPrefix(id, "ai:provider:")
		if err := m.setAIProvider(name); err != nil {
			m.statusMsg = fmt.Sprintf("AI provider setup: %s", err.Error())
		} else {
			m.statusMsg = fmt.Sprintf("AI provider set to %s", name)
		}
		m.content.SetItems(m.buildSettingsItems())
		return
	}
	if id == "ai:key:set" {
		m.textInput.Show(components.TextInputAIKey, "Set AI API Key", "")
		m.textInput.SetSize(m.width-20, m.height-10)
		return
	}
	if id == "ai:key:clear" {
		if err := m.clearAIKey(); err != nil {
			m.statusMsg = fmt.Sprintf("Failed to clear AI key: %s", err.Error())
		} else {
			m.statusMsg = "AI API key cleared"
		}
		m.content.SetItems(m.buildSettingsItems())
		return
	}
}

func (m *Model) applyTheme(themeName string) {
	theme := resolveTheme(themeName)
	m.currentTheme = theme.Name
	m.accentColor = theme.Accent
	m.headerBgColor = theme.HeaderBg
	m.footerBgColor = theme.FooterBg
	m.focusedBorder = theme.BorderFocused
	m.unfocusedBorder = theme.BorderUnfocused
	m.mutedColor = theme.Muted
	m.spinner.Style = lipgloss.NewStyle().Foreground(lipgloss.Color(theme.Accent))
	if m.config != nil {
		m.config.UI.Theme = theme.Name
	}
	m.fileTree.SetThemeColors(
		theme.TreeSelectedBg,
		theme.TreeAdded,
		theme.TreeDeleted,
		theme.TreeModified,
		theme.TreeRenamed,
		theme.TreeDir,
		theme.TreeComment,
	)
	m.diffViewer.SetThemeColors(
		theme.Added,
		theme.Deleted,
		theme.Context,
		theme.Hunk,
		theme.LineNo,
		theme.File,
		theme.CursorBg,
		theme.SelectionBg,
	)
}

func (m *Model) applyVimMode(enabled bool) {
	m.vimMode = enabled
	m.keyMap = DefaultKeyMap(enabled)
	m.sidebar.SetVimMode(enabled)
	m.content.SetVimMode(enabled)
	m.commentsList.SetVimMode(enabled)
	m.timelineList.SetVimMode(enabled)
	m.filterPalette.SetVimMode(enabled)
	m.fileTree.SetVimMode(enabled)
	m.diffViewer.SetVimMode(enabled)
	if m.config != nil {
		m.config.UI.VimMode = enabled
	}
	if m.storage != nil {
		value := "false"
		if enabled {
			value = "true"
		}
		_ = m.storage.SetSetting("ui.vim_mode", value)
	}
}

func (m *Model) configuredProviderOptions() []config.ProviderConfig {
	seen := map[string]struct{}{}
	options := make([]config.ProviderConfig, 0, 8)
	add := func(cfg config.ProviderConfig) {
		key := fmt.Sprintf("%s|%s", cfg.Type, cfg.GetHost())
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		options = append(options, cfg)
	}
	for _, cfg := range m.config.Providers {
		add(cfg)
	}
	add(config.ProviderConfig{Name: "github", Type: config.ProviderTypeGitHub, Host: "github.com"})
	add(config.ProviderConfig{Name: "gitlab", Type: config.ProviderTypeGitLab, Host: "gitlab.com"})
	add(config.ProviderConfig{Name: "bitbucket", Type: config.ProviderTypeBitbucket, Host: "bitbucket.org"})
	add(config.ProviderConfig{Name: "azuredevops", Type: config.ProviderTypeAzureDevOps, Host: "dev.azure.com"})
	return options
}

func (m *Model) authenticatedProviderOptions() []config.ProviderConfig {
	if m.authService == nil {
		return nil
	}
	statuses, err := m.authService.GetAllStatus()
	if err != nil {
		return nil
	}
	options := make([]config.ProviderConfig, 0, len(statuses))
	for _, status := range statuses {
		if !status.Authenticated {
			continue
		}
		options = append(options, config.ProviderConfig{
			Name: string(status.ProviderType),
			Type: status.ProviderType,
			Host: status.Host,
		})
	}
	return options
}

func (m *Model) isProviderAuthenticated(providerType config.ProviderType, host string) bool {
	if m.authService == nil {
		return false
	}
	return m.authService.IsAuthenticated(providerType, host)
}

func (m *Model) switchProvider(providerType config.ProviderType, host string) error {
	if m.authService == nil {
		return fmt.Errorf("auth service unavailable")
	}
	cfg := config.ProviderConfig{
		Name: string(providerType),
		Type: providerType,
		Host: host,
	}
	cred, err := m.authService.GetCredential(providerType, cfg.GetHost())
	if err != nil {
		return err
	}
	provider, err := providers.Create(cfg)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := provider.Authenticate(ctx, cred.Token); err != nil {
		return err
	}
	m.provider = provider
	m.aggregator = services.NewAggregator(provider)
	m.repoSelector = views.NewRepoSelector(provider, m.storage, "", m.contentWidth(), m.contentHeight())
	m.prListCache.Clear()
	m.prDetailCache.Clear()
	m.prFilesCache.Clear()
	m.prDiffCache.Clear()
	m.prCommentsCache.Clear()
	m.prReviewsCache.Clear()
	return nil
}

func (m *Model) aiKeyStore() (*keyring.Store, error) {
	return keyring.NewDefaultStore()
}

func (m *Model) aiKeyStorageKey() string {
	return "ai:api_key"
}

func (m *Model) aiProviderKeyStorageKey() string {
	name := strings.TrimSpace(m.aiProviderName)
	if name == "" || name == "none" {
		name = "openai"
	}
	return fmt.Sprintf("ai:%s:token", name)
}

func (m *Model) aiProviderNameStorageKey() string {
	return "ai:provider"
}

func (m *Model) aiKeyFallbackStorageKey() string {
	return "ai.api_key"
}

const aiKeyringOpTimeout = 3 * time.Second

func aiKeyringGetWithTimeout(store *keyring.Store, key string) (string, error) {
	type result struct {
		value string
		err   error
	}
	ch := make(chan result, 1)
	go func() {
		value, err := store.Get(key)
		ch <- result{value: value, err: err}
	}()
	select {
	case res := <-ch:
		return res.value, res.err
	case <-time.After(aiKeyringOpTimeout):
		return "", fmt.Errorf("keyring get timeout")
	}
}

func aiKeyringSetWithTimeout(store *keyring.Store, key, value string) error {
	ch := make(chan error, 1)
	go func() {
		ch <- store.Set(key, value)
	}()
	select {
	case err := <-ch:
		return err
	case <-time.After(aiKeyringOpTimeout):
		return fmt.Errorf("keyring set timeout")
	}
}

func aiKeyringDeleteWithTimeout(store *keyring.Store, key string) error {
	ch := make(chan error, 1)
	go func() {
		ch <- store.Delete(key)
	}()
	select {
	case err := <-ch:
		return err
	case <-time.After(aiKeyringOpTimeout):
		return fmt.Errorf("keyring delete timeout")
	}
}

func (m *Model) hasAIKey() bool {
	store, err := m.aiKeyStore()
	if err != nil {
		if m.storage != nil {
			if v, storageErr := m.storage.GetSetting(m.aiKeyFallbackStorageKey()); storageErr == nil && strings.TrimSpace(v) != "" {
				return true
			}
		}
		return strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_API_KEY")) != ""
	}
	if _, err = aiKeyringGetWithTimeout(store, m.aiKeyStorageKey()); err == nil {
		return true
	}
	if _, err = aiKeyringGetWithTimeout(store, m.aiProviderKeyStorageKey()); err == nil {
		return true
	}
	if m.storage != nil {
		if v, storageErr := m.storage.GetSetting(m.aiKeyFallbackStorageKey()); storageErr == nil && strings.TrimSpace(v) != "" {
			return true
		}
	}
	return strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_API_KEY")) != ""
}

func (m *Model) setAIProvider(name string) error {
	name = strings.ToLower(strings.TrimSpace(name))
	if name == "" {
		name = "none"
	}
	if m.storage != nil {
		_ = m.storage.SetSetting("ai.provider", name)
	}
	if store, err := m.aiKeyStore(); err == nil {
		_ = store.Set(m.aiProviderNameStorageKey(), name)
	}
	m.aiProviderName = name
	return m.reloadAIProvider()
}

func (m *Model) setAIKey(value string) error {
	if strings.TrimSpace(m.aiProviderName) == "" || strings.TrimSpace(m.aiProviderName) == "none" {
		m.aiProviderName = "openai"
		if m.storage != nil {
			_ = m.storage.SetSetting("ai.provider", "openai")
		}
	}
	clean := strings.TrimSpace(value)
	if clean == "" {
		return fmt.Errorf("AI API key cannot be empty")
	}
	store, err := m.aiKeyStore()
	if err == nil {
		if err := aiKeyringSetWithTimeout(store, m.aiKeyStorageKey(), clean); err == nil {
			_ = aiKeyringSetWithTimeout(store, m.aiProviderKeyStorageKey(), clean)
			_ = aiKeyringSetWithTimeout(store, m.aiProviderNameStorageKey(), m.aiProviderName)
			if m.storage != nil {
				_ = m.storage.SetSetting(m.aiKeyFallbackStorageKey(), clean)
			}
			return m.reloadAIProvider()
		}
	}
	if m.storage == nil {
		if err != nil {
			return err
		}
		return fmt.Errorf("unable to save AI API key")
	}
	if storageErr := m.storage.SetSetting(m.aiKeyFallbackStorageKey(), clean); storageErr != nil {
		if err != nil {
			return fmt.Errorf("failed to save AI key (keyring: %v, fallback: %w)", err, storageErr)
		}
		return storageErr
	}
	return m.reloadAIProvider()
}

func (m *Model) clearAIKey() error {
	store, err := m.aiKeyStore()
	if err == nil {
		if err := aiKeyringDeleteWithTimeout(store, m.aiKeyStorageKey()); err != nil && err != keyring.ErrNotFound {
			return err
		}
		if err := aiKeyringDeleteWithTimeout(store, m.aiProviderKeyStorageKey()); err != nil && err != keyring.ErrNotFound {
			return err
		}
		if err := aiKeyringDeleteWithTimeout(store, m.aiProviderNameStorageKey()); err != nil && err != keyring.ErrNotFound {
			return err
		}
	}
	if m.storage != nil {
		_ = m.storage.SetSetting(m.aiKeyFallbackStorageKey(), "")
	}
	return m.reloadAIProvider()
}

func (m *Model) reloadAIProvider() error {
	if envProvider := strings.ToLower(strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_PROVIDER"))); envProvider != "" {
		m.aiProviderName = envProvider
	}
	if m.aiProviderName == "" || m.aiProviderName == "none" {
		if store, err := m.aiKeyStore(); err == nil {
			if providerName, providerErr := aiKeyringGetWithTimeout(store, m.aiProviderNameStorageKey()); providerErr == nil && strings.TrimSpace(providerName) != "" && strings.TrimSpace(providerName) != "none" {
				m.aiProviderName = strings.TrimSpace(providerName)
			}
		}
		if (m.aiProviderName == "" || m.aiProviderName == "none") && strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_API_KEY")) != "" {
			m.aiProviderName = "openai"
		}
	}
	if m.aiProviderName == "" || m.aiProviderName == "none" {
		m.aiProvider = nil
		m.aiError = fmt.Errorf("AI provider disabled")
		return nil
	}
	apiKey := strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_API_KEY"))
	if apiKey == "" {
		store, err := m.aiKeyStore()
		if err == nil {
			key, keyErr := aiKeyringGetWithTimeout(store, m.aiProviderKeyStorageKey())
			if keyErr == nil {
				apiKey = strings.TrimSpace(key)
			} else if !errors.Is(keyErr, keyring.ErrNotFound) {
				m.aiError = fmt.Errorf("failed to read AI key from keyring: %w", keyErr)
			}
			if apiKey == "" {
				key, keyErr = aiKeyringGetWithTimeout(store, m.aiKeyStorageKey())
				if keyErr == nil {
					apiKey = strings.TrimSpace(key)
				} else if !errors.Is(keyErr, keyring.ErrNotFound) {
					m.aiError = fmt.Errorf("failed to read AI key from keyring: %w", keyErr)
				}
			}
		} else {
			m.aiError = fmt.Errorf("failed to access AI keyring: %w", err)
		}
	}
	if apiKey == "" && m.storage != nil {
		if v, err := m.storage.GetSetting(m.aiKeyFallbackStorageKey()); err == nil {
			apiKey = strings.TrimSpace(v)
		}
	}
	if apiKey == "" {
		m.aiProvider = nil
		if m.aiError == nil {
			m.aiError = fmt.Errorf("AI API key not configured")
		}
		return m.aiError
	}
	provider, err := ai.NewProviderFromConfig(m.aiProviderName, apiKey, m.aiModel, "")
	if err != nil {
		m.aiProvider = nil
		m.aiError = err
		return err
	}
	m.aiProvider = provider
	m.aiError = nil
	return nil
}

func (m *Model) loadPersistedAISettings() {
	envProvider := strings.ToLower(strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_PROVIDER")))
	if envProvider != "" {
		m.aiProviderName = envProvider
	}
	if m.storage != nil {
		if envProvider == "" {
			if provider, err := m.storage.GetSetting("ai.provider"); err == nil && strings.TrimSpace(provider) != "" {
				m.aiProviderName = strings.TrimSpace(provider)
			}
		}
		if model, err := m.storage.GetSetting("ai.model"); err == nil && strings.TrimSpace(model) != "" {
			m.aiModel = strings.TrimSpace(model)
		}
	}
	if strings.TrimSpace(m.aiProviderName) == "" {
		if store, err := m.aiKeyStore(); err == nil {
			if provider, providerErr := aiKeyringGetWithTimeout(store, m.aiProviderNameStorageKey()); providerErr == nil && strings.TrimSpace(provider) != "" {
				m.aiProviderName = strings.TrimSpace(provider)
			} else if _, keyErr := aiKeyringGetWithTimeout(store, m.aiKeyStorageKey()); keyErr == nil {
				m.aiProviderName = "openai"
			}
		}
	}
	if strings.TrimSpace(m.aiProviderName) == "" && m.storage != nil {
		if key, err := m.storage.GetSetting(m.aiKeyFallbackStorageKey()); err == nil && strings.TrimSpace(key) != "" {
			m.aiProviderName = "openai"
		}
	}
	if strings.TrimSpace(m.aiProviderName) == "" && strings.TrimSpace(os.Getenv("LAZYREVIEW_AI_API_KEY")) != "" {
		m.aiProviderName = "openai"
	}
	if strings.TrimSpace(m.aiProviderName) == "" {
		m.aiProviderName = "none"
	}
	_ = m.reloadAIProvider()
}

func (m *Model) loadPersistedUISettings() {
	if m.storage == nil {
		return
	}
	if rawFilters, err := m.storage.GetSetting("ui.saved_filters"); err == nil && strings.TrimSpace(rawFilters) != "" {
		var filters []savedFilter
		if err := json.Unmarshal([]byte(rawFilters), &filters); err == nil {
			m.savedFilters = sanitizeSavedFilters(filters)
		}
	}
	if editor, err := m.storage.GetSetting("ui.editor"); err == nil {
		m.editorCommand = strings.TrimSpace(editor)
	}
	v, err := m.storage.GetSetting("ui.vim_mode")
	if err != nil {
		return
	}
	normalized := strings.ToLower(strings.TrimSpace(v))
	switch normalized {
	case "true", "1", "yes", "on":
		m.applyVimMode(true)
	case "false", "0", "no", "off":
		m.applyVimMode(false)
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

func buildManualSummary(pr *models.PullRequest, diff *models.Diff, files []models.FileChange) string {
	if pr == nil || diff == nil {
		return ""
	}
	var b strings.Builder
	b.WriteString("## Summary\n")
	b.WriteString(fmt.Sprintf("- %s\n", strings.TrimSpace(pr.Title)))
	b.WriteString(fmt.Sprintf("- Files changed: %d\n", len(diff.Files)))
	b.WriteString(fmt.Sprintf("- Diff stats: +%d / -%d\n", diff.Additions, diff.Deletions))
	if len(files) > 0 {
		b.WriteString("- Key files:\n")
		limit := 5
		if len(files) < limit {
			limit = len(files)
		}
		for i := 0; i < limit; i++ {
			f := files[i]
			b.WriteString(fmt.Sprintf("  - `%s` (+%d/-%d)\n", f.Filename, f.Additions, f.Deletions))
		}
	}
	b.WriteString("\n## Review Notes\n- [ ] Confirm edge cases and error handling\n- [ ] Validate tests cover changed paths\n")
	return b.String()
}

func buildDiffExcerpt(diff *models.Diff) string {
	if diff == nil {
		return ""
	}
	var b strings.Builder
	maxFiles := 8
	if len(diff.Files) < maxFiles {
		maxFiles = len(diff.Files)
	}
	for i := 0; i < maxFiles; i++ {
		file := diff.Files[i]
		b.WriteString(fmt.Sprintf("File: %s (+%d/-%d)\n", file.Path, file.Additions, file.Deletions))
		patch := strings.TrimSpace(file.Patch)
		if patch == "" {
			continue
		}
		lines := strings.Split(patch, "\n")
		limit := 30
		if len(lines) < limit {
			limit = len(lines)
		}
		for j := 0; j < limit; j++ {
			b.WriteString(lines[j])
			b.WriteByte('\n')
		}
		b.WriteByte('\n')
	}
	return b.String()
}

func (m *Model) renderCommentPreview() string {
	comment := m.selectedComment()
	if comment == nil {
		return lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Render("Comment Preview\nSelect a comment to view full thread")
	}
	var b strings.Builder
	b.WriteString("Comment Preview\n")
	b.WriteString(formatCommentBlock(*comment, 0))
	if len(comment.Replies) > 0 {
		b.WriteString("\nReplies:\n")
		for _, reply := range comment.Replies {
			b.WriteString(formatCommentBlock(reply, 1))
		}
	}
	return b.String()
}

func formatCommentBlock(comment models.Comment, depth int) string {
	indent := strings.Repeat("  ", depth)
	author := strings.TrimSpace(comment.Author.Login)
	if author == "" {
		author = "unknown"
	}
	location := "General"
	if comment.Path != "" && comment.Line > 0 {
		location = fmt.Sprintf("%s:%d", comment.Path, comment.Line)
	}
	body := strings.TrimSpace(comment.Body)
	if body == "" {
		body = "(empty)"
	}
	return fmt.Sprintf("%s@%s (%s)\n%s%s\n", indent, author, location, indent, body)
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
