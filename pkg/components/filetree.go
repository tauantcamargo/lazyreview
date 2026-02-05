package components

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"lazyreview/internal/models"

	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// FileTreeKeyMap defines keybindings for the file tree
type FileTreeKeyMap struct {
	Up     key.Binding
	Down   key.Binding
	Select key.Binding
	Toggle key.Binding
}

// DefaultFileTreeKeyMap returns keybindings for file tree navigation.
func DefaultFileTreeKeyMap(vimMode bool) FileTreeKeyMap {
	if !vimMode {
		return FileTreeKeyMap{
			Up: key.NewBinding(
				key.WithKeys("up"),
				key.WithHelp("↑", "up"),
			),
			Down: key.NewBinding(
				key.WithKeys("down"),
				key.WithHelp("↓", "down"),
			),
			Select: key.NewBinding(
				key.WithKeys("enter"),
				key.WithHelp("enter", "view file"),
			),
			Toggle: key.NewBinding(
				key.WithKeys("space"),
				key.WithHelp("space", "toggle folder"),
			),
		}
	}
	return FileTreeKeyMap{
		Up: key.NewBinding(
			key.WithKeys("k", "up"),
			key.WithHelp("k/↑", "up"),
		),
		Down: key.NewBinding(
			key.WithKeys("j", "down"),
			key.WithHelp("j/↓", "down"),
		),
		Select: key.NewBinding(
			key.WithKeys("enter", "l"),
			key.WithHelp("enter/l", "view file"),
		),
		Toggle: key.NewBinding(
			key.WithKeys("space"),
			key.WithHelp("space", "toggle folder"),
		),
	}
}

// FileTreeItem represents an item in the file tree
type FileTreeItem struct {
	Name      string
	Path      string
	IsDir     bool
	Expanded  bool
	Status    models.FileStatus
	Additions int
	Deletions int
	Depth     int
	Children  []*FileTreeItem
}

// FileTree is a component for displaying changed files
type FileTree struct {
	items         []*FileTreeItem
	flatItems     []*FileTreeItem
	selected      int
	keyMap        FileTreeKeyMap
	width         int
	height        int
	focused       bool
	offset        int
	commentCounts map[string]int

	// Search
	searchMode  bool
	searchQuery string

	// Styles
	selectedStyle lipgloss.Style
	addedStyle    lipgloss.Style
	deletedStyle  lipgloss.Style
	modifiedStyle lipgloss.Style
	renamedStyle  lipgloss.Style
	dirStyle      lipgloss.Style
	commentStyle  lipgloss.Style
	searchStyle   lipgloss.Style
	matchStyle    lipgloss.Style
}

// NewFileTree creates a new file tree
func NewFileTree(width, height int) FileTree {
	return FileTree{
		keyMap:        DefaultFileTreeKeyMap(true),
		width:         width,
		height:        height,
		focused:       true,
		commentCounts: map[string]int{},
		selectedStyle: lipgloss.NewStyle().Background(lipgloss.Color("237")).Bold(true),
		addedStyle:    lipgloss.NewStyle().Foreground(lipgloss.Color("42")),
		deletedStyle:  lipgloss.NewStyle().Foreground(lipgloss.Color("196")),
		modifiedStyle: lipgloss.NewStyle().Foreground(lipgloss.Color("214")),
		renamedStyle:  lipgloss.NewStyle().Foreground(lipgloss.Color("39")),
		dirStyle:      lipgloss.NewStyle().Foreground(lipgloss.Color("75")).Bold(true),
		commentStyle:  lipgloss.NewStyle().Foreground(lipgloss.Color("205")).Bold(true),
		searchStyle:   lipgloss.NewStyle().Background(lipgloss.Color("235")).Foreground(lipgloss.Color("252")),
		matchStyle:    lipgloss.NewStyle().Background(lipgloss.Color("58")).Bold(true),
	}
}

// SetVimMode toggles vim-style navigation keys.
func (f *FileTree) SetVimMode(enabled bool) {
	f.keyMap = DefaultFileTreeKeyMap(enabled)
}

// SetFiles sets the files to display
func (f *FileTree) SetFiles(files []models.FileChange) {
	f.items = f.buildTree(files)
	f.flatItems = f.flatten(f.items)
	f.selected = 0
	f.offset = 0
}

// SetCommentCounts sets the number of comments per file path.
func (f *FileTree) SetCommentCounts(counts map[string]int) {
	if counts == nil {
		f.commentCounts = map[string]int{}
		return
	}
	f.commentCounts = counts
}

// buildTree builds a tree structure from flat file list
func (f *FileTree) buildTree(files []models.FileChange) []*FileTreeItem {
	// Sort files by path
	sort.Slice(files, func(i, j int) bool {
		return files[i].Filename < files[j].Filename
	})

	root := make(map[string]*FileTreeItem)
	var items []*FileTreeItem

	for _, file := range files {
		parts := strings.Split(file.Filename, "/")

		// For simple flat display, just add files directly
		item := &FileTreeItem{
			Name:      filepath.Base(file.Filename),
			Path:      file.Filename,
			IsDir:     false,
			Status:    file.Status,
			Additions: file.Additions,
			Deletions: file.Deletions,
			Depth:     len(parts) - 1,
		}

		// Add directory prefix if nested
		if len(parts) > 1 {
			dir := filepath.Dir(file.Filename)
			if _, exists := root[dir]; !exists {
				dirItem := &FileTreeItem{
					Name:     dir,
					Path:     dir,
					IsDir:    true,
					Expanded: true,
					Depth:    0,
				}
				root[dir] = dirItem
				items = append(items, dirItem)
			}
		}

		items = append(items, item)
	}

	return items
}

// flatten flattens the tree for display
func (f *FileTree) flatten(items []*FileTreeItem) []*FileTreeItem {
	var flat []*FileTreeItem
	for _, item := range items {
		flat = append(flat, item)
		if item.IsDir && item.Expanded {
			flat = append(flat, f.flatten(item.Children)...)
		}
	}
	return flat
}

// Init implements tea.Model
func (f FileTree) Init() tea.Cmd {
	return nil
}

// Update implements tea.Model
func (f FileTree) Update(msg tea.Msg) (FileTree, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		// Handle search mode
		if f.searchMode {
			switch msg.Type {
			case tea.KeyEsc:
				f.searchMode = false
				f.searchQuery = ""
				return f, nil
			case tea.KeyEnter:
				// Jump to first match and exit search
				f.jumpToMatch()
				f.searchMode = false
				f.searchQuery = ""
				return f, nil
			case tea.KeyBackspace:
				if len(f.searchQuery) > 0 {
					f.searchQuery = f.searchQuery[:len(f.searchQuery)-1]
					f.jumpToMatch()
				}
				return f, nil
			default:
				if msg.Type == tea.KeyRunes {
					f.searchQuery += string(msg.Runes)
					f.jumpToMatch()
				}
				return f, nil
			}
		}

		// Normal mode keybindings
		switch {
		case msg.String() == "/":
			f.searchMode = true
			f.searchQuery = ""
			return f, nil
		case key.Matches(msg, f.keyMap.Up):
			if f.selected > 0 {
				f.selected--
				f.ensureVisible()
			}
		case key.Matches(msg, f.keyMap.Down):
			if f.selected < len(f.flatItems)-1 {
				f.selected++
				f.ensureVisible()
			}
		case key.Matches(msg, f.keyMap.Toggle):
			if f.selected < len(f.flatItems) {
				item := f.flatItems[f.selected]
				if item.IsDir {
					item.Expanded = !item.Expanded
					f.flatItems = f.flatten(f.items)
				}
			}
		}

	case tea.WindowSizeMsg:
		f.width = msg.Width
		f.height = msg.Height
	}

	return f, nil
}

// jumpToMatch jumps to the first file matching the search query
func (f *FileTree) jumpToMatch() {
	if f.searchQuery == "" {
		return
	}
	query := strings.ToLower(f.searchQuery)
	for i, item := range f.flatItems {
		if !item.IsDir && strings.Contains(strings.ToLower(item.Name), query) {
			f.selected = i
			f.ensureVisible()
			return
		}
	}
}

// matchesSearch checks if an item matches the current search query
func (f *FileTree) matchesSearch(item *FileTreeItem) bool {
	if f.searchQuery == "" {
		return false
	}
	return strings.Contains(strings.ToLower(item.Name), strings.ToLower(f.searchQuery))
}

// View implements tea.Model
func (f FileTree) View() string {
	if len(f.flatItems) == 0 {
		return "No files"
	}

	var content strings.Builder

	// Calculate visible range - leave extra room for search bar
	visibleHeight := f.height - 2 // Leave room for header
	if f.searchMode {
		visibleHeight -= 2 // Extra room for search bar
	}
	start := f.offset
	end := start + visibleHeight
	if end > len(f.flatItems) {
		end = len(f.flatItems)
	}

	// Header
	content.WriteString(lipgloss.NewStyle().Bold(true).Render(
		fmt.Sprintf("Files (%d)", len(f.flatItems)),
	))
	content.WriteString("\n")

	// Search bar
	if f.searchMode {
		searchBar := f.searchStyle.Render(fmt.Sprintf("🔍 /%s_", f.searchQuery))
		content.WriteString(searchBar)
		content.WriteString("\n")
	}
	content.WriteString("\n")

	// Items
	for i := start; i < end; i++ {
		item := f.flatItems[i]
		isMatch := f.matchesSearch(item)
		line := f.renderItem(item, i == f.selected, isMatch)
		content.WriteString(line)
		content.WriteString("\n")
	}

	return content.String()
}

// renderItem renders a single item
func (f *FileTree) renderItem(item *FileTreeItem, selected bool, isMatch bool) string {
	// Indent
	indent := strings.Repeat("  ", item.Depth)

	// Icon and name
	var icon string
	var style lipgloss.Style

	if item.IsDir {
		if item.Expanded {
			icon = "▼ "
		} else {
			icon = "▶ "
		}
		style = f.dirStyle
	} else {
		switch item.Status {
		case models.FileStatusAdded:
			icon = "A "
			style = f.addedStyle
		case models.FileStatusDeleted:
			icon = "D "
			style = f.deletedStyle
		case models.FileStatusModified:
			icon = "M "
			style = f.modifiedStyle
		case models.FileStatusRenamed:
			icon = "R "
			style = f.renamedStyle
		default:
			icon = "  "
			style = lipgloss.NewStyle()
		}
	}

	// Stats
	stats := ""
	if !item.IsDir && (item.Additions > 0 || item.Deletions > 0) {
		stats = fmt.Sprintf(" +%d -%d", item.Additions, item.Deletions)
	}

	commentBadge := ""
	if !item.IsDir && f.commentCounts != nil {
		if count := f.commentCounts[item.Path]; count > 0 {
			commentBadge = f.commentStyle.Render(fmt.Sprintf("  c%d", count))
		}
	}

	line := indent + icon + item.Name + stats + commentBadge

	// Apply styling: match > selected > normal
	if isMatch && !selected {
		line = f.matchStyle.Render(line)
	} else if selected {
		line = f.selectedStyle.Render(line)
	} else {
		line = style.Render(line)
	}

	// Truncate if too long
	if len(line) > f.width {
		line = line[:f.width-3] + "..."
	}

	return line
}

// ensureVisible ensures the selected item is visible
func (f *FileTree) ensureVisible() {
	visibleHeight := f.height - 2
	if f.selected < f.offset {
		f.offset = f.selected
	} else if f.selected >= f.offset+visibleHeight {
		f.offset = f.selected - visibleHeight + 1
	}
}

// SetSize sets the component size
func (f *FileTree) SetSize(width, height int) {
	f.width = width
	f.height = height
}

// Focus focuses the component
func (f *FileTree) Focus() {
	f.focused = true
}

// Blur unfocuses the component
func (f *FileTree) Blur() {
	f.focused = false
}

// SelectedItem returns the selected item
func (f *FileTree) SelectedItem() *FileTreeItem {
	if f.selected < len(f.flatItems) {
		return f.flatItems[f.selected]
	}
	return nil
}

// SelectedPath returns the selected file path
func (f *FileTree) SelectedPath() string {
	if item := f.SelectedItem(); item != nil && !item.IsDir {
		return item.Path
	}
	return ""
}

// SetThemeColors applies file tree colors at runtime.
func (f *FileTree) SetThemeColors(selectedBg, added, deleted, modified, renamed, dir, comment string) {
	f.selectedStyle = lipgloss.NewStyle().Background(lipgloss.Color(selectedBg)).Bold(true)
	f.addedStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(added))
	f.deletedStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(deleted))
	f.modifiedStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(modified))
	f.renamedStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(renamed))
	f.dirStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(dir)).Bold(true)
	f.commentStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(comment)).Bold(true)
}
