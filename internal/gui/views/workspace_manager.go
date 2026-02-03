package views

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"lazyreview/internal/storage"
	"lazyreview/pkg/components"

	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

const workspaceOrderSettingKey = "workspace_order"

type workspacePanel int

type workspaceManagerMode int

const (
	workspacePanelList workspacePanel = iota
	workspacePanelRepos
)

const (
	workspaceModeList workspaceManagerMode = iota
	workspaceModeCreate
	workspaceModeEdit
	workspaceModeDeleteConfirm
)

// OpenRepoSelectorMsg is emitted when the user wants to add repos to a workspace.
type OpenRepoSelectorMsg struct {
	WorkspaceID string
}

// WorkspacesChangedMsg is emitted after workspace CRUD/reorder updates.
type WorkspacesChangedMsg struct{}

// WorkspaceManager manages workspace CRUD and repo membership.
type WorkspaceManager struct {
	storage    storage.Storage
	workspaces []storage.Workspace
	order      []string

	workspaceList components.List
	repoList      components.List
	activePanel   workspacePanel
	mode          workspaceManagerMode
	form          workspaceForm
	status        string
	width         int
	height        int
}

type workspaceForm struct {
	name      textinput.Model
	desc      textinput.Model
	focus     int
	visible   bool
	editingID string
}

func newWorkspaceForm() workspaceForm {
	name := textinput.New()
	name.Placeholder = "Workspace name"
	name.Prompt = "Name: "
	name.CharLimit = 64

	desc := textinput.New()
	desc.Placeholder = "Optional description"
	desc.Prompt = "Description: "
	desc.CharLimit = 120

	return workspaceForm{
		name:    name,
		desc:    desc,
		focus:   0,
		visible: false,
	}
}

func (f *workspaceForm) show(name, desc, id string) {
	f.visible = true
	f.editingID = id
	f.name.SetValue(name)
	f.desc.SetValue(desc)
	f.focus = 0
	f.name.Focus()
	f.desc.Blur()
}

func (f *workspaceForm) hide() {
	f.visible = false
	f.editingID = ""
	f.name.Blur()
	f.desc.Blur()
	f.name.SetValue("")
	f.desc.SetValue("")
}

func (f *workspaceForm) nextField() {
	f.focus = (f.focus + 1) % 2
	if f.focus == 0 {
		f.name.Focus()
		f.desc.Blur()
	} else {
		f.desc.Focus()
		f.name.Blur()
	}
}

func (f *workspaceForm) prevField() {
	if f.focus == 0 {
		f.focus = 1
	} else {
		f.focus = 0
	}
	if f.focus == 0 {
		f.name.Focus()
		f.desc.Blur()
	} else {
		f.desc.Focus()
		f.name.Blur()
	}
}

// NewWorkspaceManager creates the view.
func NewWorkspaceManager(store storage.Storage, width, height int) WorkspaceManager {
	workspaceList := components.NewList("Workspaces", []list.Item{}, width/2, height)
	repoList := components.NewList("Repositories", []list.Item{}, width/2, height)

	wm := WorkspaceManager{
		storage:        store,
		workspaceList:  workspaceList,
		repoList:       repoList,
		activePanel:   workspacePanelList,
		mode:          workspaceModeList,
		form:          newWorkspaceForm(),
		width:         width,
		height:        height,
	}

	wm.refresh()
	return wm
}

// Refresh reloads workspaces from storage.
func (w *WorkspaceManager) Refresh() {
	w.refresh()
}

// SetSize sets the view size.
func (w *WorkspaceManager) SetSize(width, height int) {
	w.width = width
	w.height = height
	listWidth := max(30, (width/2)-2)
	w.workspaceList.SetSize(listWidth, height)
	w.repoList.SetSize(width-listWidth-2, height)
}

// Status returns the last status message.
func (w WorkspaceManager) Status() string {
	return w.status
}

// Update handles messages.
func (w WorkspaceManager) Update(msg tea.Msg) (WorkspaceManager, tea.Cmd) {
	if w.form.visible {
		return w.updateForm(msg)
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "tab":
			w.togglePanel()
			return w, nil
		case "esc":
			if w.mode == workspaceModeDeleteConfirm {
				w.mode = workspaceModeList
				w.status = "Delete canceled"
				return w, nil
			}
		case "n":
			if w.mode == workspaceModeDeleteConfirm {
				w.mode = workspaceModeList
				w.status = "Delete canceled"
				return w, nil
			}
			if w.mode == workspaceModeList {
				w.mode = workspaceModeCreate
				w.form.show("", "", "")
				return w, nil
			}
		case "e":
			if w.mode == workspaceModeList && w.activePanel == workspacePanelList {
				ws := w.selectedWorkspace()
				if ws == nil {
					w.status = "No workspace selected"
					return w, nil
				}
				w.mode = workspaceModeEdit
				w.form.show(ws.Name, ws.Description, ws.ID)
				return w, nil
			}
		case "d":
			if w.activePanel == workspacePanelList && w.mode == workspaceModeList {
				if w.selectedWorkspace() == nil {
					w.status = "No workspace selected"
					return w, nil
				}
				w.mode = workspaceModeDeleteConfirm
				w.status = "Confirm delete? Press y to delete, n to cancel"
				return w, nil
			}
		case "y":
			if w.mode == workspaceModeDeleteConfirm {
				return w.deleteSelectedWorkspace()
			}
		case "a", "enter":
			if w.activePanel == workspacePanelList && w.mode == workspaceModeList {
				ws := w.selectedWorkspace()
				if ws == nil {
					w.status = "Select a workspace first"
					return w, nil
				}
				return w, func() tea.Msg {
					return OpenRepoSelectorMsg{WorkspaceID: ws.ID}
				}
			}
		case "x":
			if w.activePanel == workspacePanelRepos && w.mode == workspaceModeList {
				return w.removeSelectedRepo()
			}
		case "K":
			if w.activePanel == workspacePanelList && w.mode == workspaceModeList {
				return w.moveWorkspace(-1)
			}
		case "J":
			if w.activePanel == workspacePanelList && w.mode == workspaceModeList {
				return w.moveWorkspace(1)
			}
		case "r", "R":
			w.refresh()
			w.status = "Workspaces refreshed"
			return w, nil
		}
	}

	var cmd tea.Cmd
	if w.activePanel == workspacePanelList {
		w.workspaceList, cmd = w.workspaceList.Update(msg)
	} else {
		w.repoList, cmd = w.repoList.Update(msg)
	}
	w.syncRepoList()
	return w, cmd
}

func (w WorkspaceManager) updateForm(msg tea.Msg) (WorkspaceManager, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			w.form.hide()
			w.mode = workspaceModeList
			w.status = "Workspace edit canceled"
			return w, nil
		case "ctrl+s":
			return w.submitForm()
		case "tab":
			w.form.nextField()
			return w, nil
		case "shift+tab":
			w.form.prevField()
			return w, nil
		}
	}

	var cmd tea.Cmd
	if w.form.focus == 0 {
		w.form.name, cmd = w.form.name.Update(msg)
	} else {
		w.form.desc, cmd = w.form.desc.Update(msg)
	}
	return w, cmd
}

func (w *WorkspaceManager) submitForm() (WorkspaceManager, tea.Cmd) {
	name := strings.TrimSpace(w.form.name.Value())
	desc := strings.TrimSpace(w.form.desc.Value())
	if name == "" {
		w.status = "Workspace name is required"
		return *w, nil
	}

	if w.mode == workspaceModeCreate {
		now := time.Now().UTC()
		workspace := storage.Workspace{
			ID:          fmt.Sprintf("ws_%d", now.UnixNano()),
			Name:        name,
			Description: desc,
			Repos:       []storage.RepoRef{},
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if err := w.storage.CreateWorkspace(workspace); err != nil {
			w.status = fmt.Sprintf("Failed to create workspace: %s", err.Error())
			return *w, nil
		}
		w.order = append(w.order, workspace.ID)
		w.persistOrder()
		w.status = "Workspace created"
		w.form.hide()
		w.mode = workspaceModeList
		w.refreshWithSelection(workspace.ID)
		return *w, func() tea.Msg { return WorkspacesChangedMsg{} }
	} else if w.mode == workspaceModeEdit {
		ws := w.selectedWorkspace()
		if ws == nil {
			w.status = "No workspace selected"
			return *w, nil
		}
		ws.Name = name
		ws.Description = desc
		ws.UpdatedAt = time.Now().UTC()
		if err := w.storage.UpdateWorkspace(*ws); err != nil {
			w.status = fmt.Sprintf("Failed to update workspace: %s", err.Error())
			return *w, nil
		}
		w.status = "Workspace updated"
		w.form.hide()
		w.mode = workspaceModeList
		w.refreshWithSelection(ws.ID)
		return *w, func() tea.Msg { return WorkspacesChangedMsg{} }
	}

	w.form.hide()
	w.mode = workspaceModeList
	w.refresh()
	return *w, nil
}

func (w *WorkspaceManager) deleteSelectedWorkspace() (WorkspaceManager, tea.Cmd) {
	ws := w.selectedWorkspace()
	if ws == nil {
		w.status = "No workspace selected"
		w.mode = workspaceModeList
		return *w, nil
	}
	if err := w.storage.DeleteWorkspace(ws.ID); err != nil {
		w.status = fmt.Sprintf("Failed to delete workspace: %s", err.Error())
		w.mode = workspaceModeList
		return *w, nil
	}
	w.order = removeString(w.order, ws.ID)
	w.persistOrder()
	w.status = "Workspace deleted"
	w.mode = workspaceModeList
	w.refresh()
	return *w, func() tea.Msg { return WorkspacesChangedMsg{} }
}

func (w *WorkspaceManager) removeSelectedRepo() (WorkspaceManager, tea.Cmd) {
	ws := w.selectedWorkspace()
	if ws == nil {
		w.status = "No workspace selected"
		return *w, nil
	}
	item := w.repoList.SelectedItem()
	if item == nil {
		w.status = "No repo selected"
		return *w, nil
	}
	selected, ok := item.(repoListItem)
	if !ok {
		w.status = "Invalid repo selection"
		return *w, nil
	}

	if err := w.storage.RemoveRepoFromWorkspace(ws.ID, selected.repo); err != nil {
		w.status = fmt.Sprintf("Failed to remove repo: %s", err.Error())
		return *w, nil
	}
	w.status = "Repo removed from workspace"
	w.refresh()
	return *w, func() tea.Msg { return WorkspacesChangedMsg{} }
}

func (w *WorkspaceManager) moveWorkspace(delta int) (WorkspaceManager, tea.Cmd) {
	if len(w.order) == 0 {
		return *w, nil
	}
	index := w.workspaceList.SelectedIndex()
	if index < 0 || index >= len(w.order) {
		return *w, nil
	}
	newIndex := index + delta
	if newIndex < 0 || newIndex >= len(w.order) {
		return *w, nil
	}
	w.order[index], w.order[newIndex] = w.order[newIndex], w.order[index]
	w.persistOrder()
	w.refreshWithSelection(w.order[newIndex])
	w.status = "Workspace order updated"
	return *w, func() tea.Msg { return WorkspacesChangedMsg{} }
}

func (w *WorkspaceManager) togglePanel() {
	if w.activePanel == workspacePanelList {
		w.activePanel = workspacePanelRepos
	} else {
		w.activePanel = workspacePanelList
	}
}

func (w *WorkspaceManager) refresh() {
	w.refreshWithSelection("")
}

func (w *WorkspaceManager) refreshWithSelection(selectedID string) {
	if w.storage == nil {
		w.status = "Storage not available"
		return
	}
	workspaces, err := w.storage.ListWorkspaces()
	if err != nil {
		w.status = fmt.Sprintf("Failed to load workspaces: %s", err.Error())
		return
	}
	w.workspaces = workspaces
	w.order = loadWorkspaceOrder(w.storage, w.workspaces)
	w.applyWorkspaceOrder()
	w.refreshList(selectedID)
	w.syncRepoList()
}

func (w *WorkspaceManager) applyWorkspaceOrder() {
	if len(w.order) == 0 || len(w.workspaces) == 0 {
		return
	}
	ordered := make([]storage.Workspace, 0, len(w.workspaces))
	lookup := make(map[string]storage.Workspace, len(w.workspaces))
	for _, ws := range w.workspaces {
		lookup[ws.ID] = ws
	}
	for _, id := range w.order {
		if ws, ok := lookup[id]; ok {
			ordered = append(ordered, ws)
			delete(lookup, id)
		}
	}
	for _, ws := range w.workspaces {
		if _, ok := lookup[ws.ID]; ok {
			ordered = append(ordered, ws)
		}
	}
	w.workspaces = ordered
}

func (w *WorkspaceManager) refreshList(selectedID string) {
	items := make([]list.Item, 0, len(w.workspaces))
	for _, ws := range w.workspaces {
		description := ws.Description
		if description == "" {
			description = fmt.Sprintf("%d repos", len(ws.Repos))
		} else {
			description = fmt.Sprintf("%s • %d repos", description, len(ws.Repos))
		}
		items = append(items, components.NewSimpleItem(ws.ID, ws.Name, description))
	}
	if len(items) == 0 {
		items = []list.Item{components.NewSimpleItem("empty", "No workspaces yet", "Press n to create one")}
	}
	w.workspaceList.SetItems(items)

	if selectedID != "" {
		for i, item := range items {
			if simple, ok := item.(components.SimpleItem); ok && simple.ID() == selectedID {
				w.workspaceList.Select(i)
				break
			}
		}
	}
}

func (w *WorkspaceManager) syncRepoList() {
	ws := w.selectedWorkspace()
	if ws == nil {
		w.repoList.SetItems([]list.Item{components.NewSimpleItem("empty", "No workspace selected", "Select a workspace to view repos")})
		return
	}
	if len(ws.Repos) == 0 {
		w.repoList.SetItems([]list.Item{components.NewSimpleItem("empty", "No repos in workspace", "Press a to add repositories")})
		return
	}
	items := make([]list.Item, 0, len(ws.Repos))
	for _, repo := range ws.Repos {
		title := fmt.Sprintf("%s/%s", repo.Owner, repo.Repo)
		desc := fmt.Sprintf("%s • %s", repo.ProviderType, repo.Host)
		items = append(items, repoListItem{repo: repo, title: title, description: desc})
	}
	w.repoList.SetItems(items)
}

func (w *WorkspaceManager) selectedWorkspace() *storage.Workspace {
	item := w.workspaceList.SelectedItem()
	if item == nil {
		return nil
	}
	simple, ok := item.(components.SimpleItem)
	if !ok {
		return nil
	}
	if simple.ID() == "empty" {
		return nil
	}
	for i := range w.workspaces {
		if w.workspaces[i].ID == simple.ID() {
			return &w.workspaces[i]
		}
	}
	return nil
}

func (w *WorkspaceManager) persistOrder() {
	if w.storage == nil {
		return
	}
	data, err := json.Marshal(w.order)
	if err != nil {
		return
	}
	_ = w.storage.SetSetting(workspaceOrderSettingKey, string(data))
}

// View renders the workspace manager.
func (w WorkspaceManager) View() string {
	listWidth := max(30, (w.width/2)-2)
	leftStyle := lipgloss.NewStyle()
	rightStyle := lipgloss.NewStyle()
	if w.activePanel == workspacePanelList {
		leftStyle = leftStyle.Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("170"))
		rightStyle = rightStyle.Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("240"))
	} else {
		leftStyle = leftStyle.Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("240"))
		rightStyle = rightStyle.Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("170"))
	}

	left := leftStyle.Width(listWidth + 2).Render(w.workspaceList.View())
	right := rightStyle.Width(w.width-listWidth-2).Render(w.repoList.View())
	main := lipgloss.JoinHorizontal(lipgloss.Top, left, right)

	if w.form.visible {
		return lipgloss.Place(w.width, w.height, lipgloss.Center, lipgloss.Center, w.formView())
	}
	return main
}

func (w WorkspaceManager) formView() string {
	box := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("170")).
		Padding(1, 2)

	footer := "Ctrl+S: Save • Esc: Cancel"
	if w.mode == workspaceModeCreate {
		footer = "Ctrl+S: Create • Esc: Cancel"
	}

	content := fmt.Sprintf("%s\n%s\n\n%s",
		w.form.name.View(),
		w.form.desc.View(),
		footer,
	)
	return box.Render(content)
}

type repoListItem struct {
	repo        storage.RepoRef
	title       string
	description string
}

func (r repoListItem) Title() string       { return r.title }
func (r repoListItem) Description() string { return r.description }
func (r repoListItem) FilterValue() string { return r.title }

func loadWorkspaceOrder(store storage.Storage, workspaces []storage.Workspace) []string {
	if store == nil {
		return nil
	}
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

func defaultWorkspaceOrder(workspaces []storage.Workspace) []string {
	order := make([]string, 0, len(workspaces))
	for _, ws := range workspaces {
		order = append(order, ws.ID)
	}
	return order
}

func removeString(items []string, target string) []string {
	out := make([]string, 0, len(items))
	for _, item := range items {
		if item != target {
			out = append(out, item)
		}
	}
	return out
}
