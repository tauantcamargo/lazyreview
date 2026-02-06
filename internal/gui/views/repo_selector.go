package views

import (
	"context"
	"fmt"
	"strings"
	"time"

	"lazyreview/internal/models"
	"lazyreview/internal/storage"
	"lazyreview/pkg/components"
	"lazyreview/pkg/providers"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type repoSelectorPanel int

const (
	repoSelectorPanelOrgs repoSelectorPanel = iota
	repoSelectorPanelRepos
)

// RepoSelectorCloseMsg signals returning to workspace manager.
type RepoSelectorCloseMsg struct{}

// RepoSelector loads orgs and repositories for adding to a workspace.
type RepoSelector struct {
	provider    providers.Provider
	storage     storage.Storage
	workspaceID string

	orgList         components.List
	repoList        components.List
	activePane      repoSelectorPanel
	status          string
	width           int
	height          int
	focusedBorder   string
	unfocusedBorder string
	accent          string
	muted           string
	selectedBg      string
	titleBg         string
}

// orgListMsg is emitted after loading orgs.
type orgListMsg struct {
	orgs []providers.Organization
	err  error
}

// repoListMsg is emitted after loading repos.
type repoListMsg struct {
	repos  []models.Repository
	source string
	err    error
}

// NewRepoSelector creates a new repo selector.
func NewRepoSelector(provider providers.Provider, store storage.Storage, workspaceID string, width, height int) RepoSelector {
	orgList := components.NewList("Organizations", []list.Item{}, width/2, height)
	repoList := components.NewList("Repositories", []list.Item{}, width/2, height)

	return RepoSelector{
		provider:    provider,
		storage:     store,
		workspaceID: workspaceID,
		orgList:     orgList,
		repoList:    repoList,
		activePane:  repoSelectorPanelOrgs,
		width:       width,
		height:      height,
	}
}

// SetThemeColors updates repo selector styling.
func (r *RepoSelector) SetThemeColors(focused, unfocused, accent, muted, selectedBg, titleBg string) {
	r.focusedBorder = focused
	r.unfocusedBorder = unfocused
	r.accent = accent
	r.muted = muted
	r.selectedBg = selectedBg
	r.titleBg = titleBg
	r.orgList.SetThemeColors(accent, muted, selectedBg, titleBg)
	r.repoList.SetThemeColors(accent, muted, selectedBg, titleBg)
}

// SetSize sets the view size.
func (r *RepoSelector) SetSize(width, height int) {
	r.width = width
	r.height = height
	leftWidth := max(30, (width/2)-2)
	r.orgList.SetSize(leftWidth, height)
	r.repoList.SetSize(width-leftWidth-2, height)
}

// Status returns status message.
func (r RepoSelector) Status() string {
	return r.status
}

// Load initializes organizations.
func (r RepoSelector) Load() tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		orgs, err := r.provider.ListOrganizations(ctx)
		return orgListMsg{orgs: orgs, err: err}
	}
}

// Update handles messages.
func (r RepoSelector) Update(msg tea.Msg) (RepoSelector, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			return r, func() tea.Msg { return RepoSelectorCloseMsg{} }
		case "tab":
			r.togglePane()
			return r, nil
		case "enter":
			if r.activePane == repoSelectorPanelOrgs {
				return r, r.loadSelectedOrg()
			}
			return r, r.addSelectedRepo()
		case "a":
			return r, r.addSelectedRepo()
		case "r", "R":
			r.status = "Reloading organizations..."
			return r, r.Load()
		}
	case orgListMsg:
		if msg.err != nil {
			r.status = fmt.Sprintf("Failed to load orgs: %s", msg.err.Error())
			return r, nil
		}
		r.setOrganizations(msg.orgs)
		r.status = fmt.Sprintf("Loaded %d organizations", len(msg.orgs))
		return r, nil
	case repoListMsg:
		if msg.err != nil {
			r.status = fmt.Sprintf("Failed to load repos: %s", msg.err.Error())
			return r, nil
		}
		r.setRepositories(msg.repos)
		if msg.source != "" {
			r.status = fmt.Sprintf("Loaded %d repos from %s", len(msg.repos), msg.source)
		} else {
			r.status = fmt.Sprintf("Loaded %d repos", len(msg.repos))
		}
		return r, nil
	}

	var cmd tea.Cmd
	if r.activePane == repoSelectorPanelOrgs {
		r.orgList, cmd = r.orgList.Update(msg)
	} else {
		r.repoList, cmd = r.repoList.Update(msg)
	}
	return r, cmd
}

func (r *RepoSelector) togglePane() {
	if r.activePane == repoSelectorPanelOrgs {
		r.activePane = repoSelectorPanelRepos
	} else {
		r.activePane = repoSelectorPanelOrgs
	}
}

func (r RepoSelector) loadSelectedOrg() tea.Cmd {
	item := r.orgList.SelectedItem()
	if item == nil {
		r.status = "Select an organization"
		return nil
	}
	selected, ok := item.(orgListItem)
	if !ok {
		r.status = "Invalid organization"
		return nil
	}

	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if selected.orgID == "user" {
			repos, err := r.provider.ListUserRepos(ctx, providers.DefaultListReposOptions())
			return repoListMsg{repos: repos, source: "your repos", err: err}
		}
		repos, err := r.provider.ListOrganizationRepos(ctx, selected.orgID, providers.DefaultListReposOptions())
		return repoListMsg{repos: repos, source: selected.name, err: err}
	}
}

func (r RepoSelector) addSelectedRepo() tea.Cmd {
	item := r.repoList.SelectedItem()
	if item == nil {
		r.status = "Select a repository"
		return nil
	}
	selected, ok := item.(repoItem)
	if !ok {
		r.status = "Invalid repository"
		return nil
	}
	if r.storage == nil {
		r.status = "Storage not available"
		return nil
	}

	repoRef := storage.RepoRef{
		ProviderType: string(r.provider.Type()),
		Host:         r.provider.Host(),
		Owner:        selected.repo.Owner,
		Repo:         selected.repo.Name,
	}
	if err := r.storage.AddRepoToWorkspace(r.workspaceID, repoRef); err != nil {
		r.status = fmt.Sprintf("Failed to add repo: %s", err.Error())
		return nil
	}
	r.status = fmt.Sprintf("Added %s", selected.repo.FullName)
	return nil
}

func (r *RepoSelector) setOrganizations(orgs []providers.Organization) {
	items := make([]list.Item, 0, len(orgs)+1)
	items = append(items, orgListItem{orgID: "user", name: "Your Repos", description: "Repositories you can access"})
	for _, org := range orgs {
		desc := org.Description
		if strings.TrimSpace(desc) == "" {
			desc = fmt.Sprintf("%d repos", org.RepoCount)
		}
		name := org.Name
		if strings.TrimSpace(name) == "" {
			name = org.Login
		}
		items = append(items, orgListItem{orgID: org.Login, name: name, description: desc})
	}
	if len(items) == 0 {
		items = []list.Item{components.NewSimpleItem("empty", "No organizations found", "")}
	}
	r.orgList.SetItems(items)
}

func (r *RepoSelector) setRepositories(repos []models.Repository) {
	items := make([]list.Item, 0, len(repos))
	for _, repo := range repos {
		title := repo.FullName
		if title == "" {
			title = fmt.Sprintf("%s/%s", repo.Owner, repo.Name)
		}
		desc := repo.Description
		if strings.TrimSpace(desc) == "" {
			desc = "No description"
		}
		items = append(items, repoItem{repo: repo, title: title, description: desc})
	}
	if len(items) == 0 {
		items = []list.Item{components.NewSimpleItem("empty", "No repositories found", "")}
	}
	r.repoList.SetItems(items)
}

// View renders the repo selector.
func (r RepoSelector) View() string {
	leftWidth := max(30, (r.width/2)-2)
	leftStyle := lipgloss.NewStyle()
	rightStyle := lipgloss.NewStyle()
	focusedBorder := "170"
	unfocusedBorder := "240"
	if r.focusedBorder != "" {
		focusedBorder = r.focusedBorder
	}
	if r.unfocusedBorder != "" {
		unfocusedBorder = r.unfocusedBorder
	}
	if r.activePane == repoSelectorPanelOrgs {
		leftStyle = leftStyle.Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color(focusedBorder))
		rightStyle = rightStyle.Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color(unfocusedBorder))
	} else {
		leftStyle = leftStyle.Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color(unfocusedBorder))
		rightStyle = rightStyle.Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color(focusedBorder))
	}

	left := leftStyle.Width(leftWidth + 2).Render(r.orgList.View())
	right := rightStyle.Width(r.width - leftWidth - 2).Render(r.repoList.View())
	return lipgloss.JoinHorizontal(lipgloss.Top, left, right)
}

type orgListItem struct {
	orgID       string
	name        string
	description string
}

func (o orgListItem) Title() string       { return o.name }
func (o orgListItem) Description() string { return o.description }
func (o orgListItem) FilterValue() string { return o.name }

type repoItem struct {
	repo        models.Repository
	title       string
	description string
}

func (r repoItem) Title() string       { return r.title }
func (r repoItem) Description() string { return r.description }
func (r repoItem) FilterValue() string { return r.title }
