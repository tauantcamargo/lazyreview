package components

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// VirtualList is a high-performance list component that only renders visible items
type VirtualList struct {
	items         []list.Item // All items
	filteredItems []list.Item // Filtered items (used when filter is active)
	cursor        int         // Current cursor position
	width         int         // Component width
	height        int         // Component height
	buffer        int         // Number of items to render above/below viewport
	keyMap        ListKeyMap  // Keybindings
	title         string      // List title
	focused       bool        // Focus state
	filtering     bool        // Filter mode active
	filterQuery   string      // Current filter query
	itemHeight    int         // Height of each item (in lines)
	showHelp      bool        // Show help text
	showStatusBar bool        // Show status bar
	styles        VirtualListStyles
}

// VirtualListStyles holds styling for the virtual list
type VirtualListStyles struct {
	Title         lipgloss.Style
	SelectedTitle lipgloss.Style
	SelectedDesc  lipgloss.Style
	NormalTitle   lipgloss.Style
	NormalDesc    lipgloss.Style
	FilterPrompt  lipgloss.Style
	FilterCursor  lipgloss.Style
	StatusBar     lipgloss.Style
	HelpStyle     lipgloss.Style
	Cursor        lipgloss.Style
}

// DefaultVirtualListStyles returns default styling
func DefaultVirtualListStyles() VirtualListStyles {
	return VirtualListStyles{
		Title: lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("170")).
			Padding(0, 1),
		SelectedTitle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("170")).
			Background(lipgloss.Color("237")).
			Bold(true),
		SelectedDesc: lipgloss.NewStyle().
			Foreground(lipgloss.Color("240")).
			Background(lipgloss.Color("237")),
		NormalTitle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("252")),
		NormalDesc: lipgloss.NewStyle().
			Foreground(lipgloss.Color("240")),
		FilterPrompt: lipgloss.NewStyle().
			Foreground(lipgloss.Color("170")),
		FilterCursor: lipgloss.NewStyle().
			Foreground(lipgloss.Color("170")),
		StatusBar: lipgloss.NewStyle().
			Foreground(lipgloss.Color("240")),
		HelpStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("240")),
		Cursor: lipgloss.NewStyle().
			Foreground(lipgloss.Color("170")),
	}
}

// NewVirtualList creates a new virtual list component
func NewVirtualList(title string, items []list.Item, width, height int) VirtualList {
	return VirtualList{
		items:         items,
		filteredItems: items,
		cursor:        0,
		width:         width,
		height:        height,
		buffer:        5,
		keyMap:        DefaultListKeyMap(true),
		title:         title,
		focused:       true,
		itemHeight:    3, // Default: title + description + padding
		showHelp:      true,
		showStatusBar: true,
		styles:        DefaultVirtualListStyles(),
	}
}

// Init implements tea.Model
func (v VirtualList) Init() tea.Cmd {
	return nil
}

// Update implements tea.Model
func (v VirtualList) Update(msg tea.Msg) (VirtualList, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		v.width = msg.Width
		v.height = msg.Height
		return v, nil

	case tea.KeyMsg:
		if v.filtering {
			return v.handleFilterKey(msg)
		}
		return v.handleNormalKey(msg)
	}

	return v, nil
}

// handleNormalKey handles key events in normal mode
func (v VirtualList) handleNormalKey(msg tea.KeyMsg) (VirtualList, tea.Cmd) {
	switch msg.Type {
	case tea.KeyCtrlU:
		v.moveCursor(-v.pageSize())
	case tea.KeyCtrlD:
		v.moveCursor(v.pageSize())
	default:
		switch {
		case key.Matches(msg, v.keyMap.Up):
			v.moveCursor(-1)
		case key.Matches(msg, v.keyMap.Down):
			v.moveCursor(1)
		case key.Matches(msg, v.keyMap.Top):
			v.cursor = 0
		case key.Matches(msg, v.keyMap.Bottom):
			v.cursor = v.maxCursor()
		case key.Matches(msg, v.keyMap.PageUp):
			v.moveCursor(-v.pageSize())
		case key.Matches(msg, v.keyMap.PageDown):
			v.moveCursor(v.pageSize())
		case key.Matches(msg, v.keyMap.Filter):
			v.filtering = true
			v.filterQuery = ""
		}
	}

	return v, nil
}

// handleFilterKey handles key events in filter mode
func (v VirtualList) handleFilterKey(msg tea.KeyMsg) (VirtualList, tea.Cmd) {
	switch msg.Type {
	case tea.KeyEsc:
		v.filtering = false
		v.filterQuery = ""
		v.applyFilter()
	case tea.KeyEnter:
		v.filtering = false
		v.applyFilter()
	case tea.KeyBackspace:
		if len(v.filterQuery) > 0 {
			v.filterQuery = v.filterQuery[:len(v.filterQuery)-1]
			v.applyFilter()
		}
	case tea.KeyRunes:
		v.filterQuery += string(msg.Runes)
		v.applyFilter()
	}

	return v, nil
}

// moveCursor moves the cursor by delta, clamping to valid range
func (v *VirtualList) moveCursor(delta int) {
	v.cursor += delta
	if v.cursor < 0 {
		v.cursor = 0
	}
	if v.cursor > v.maxCursor() {
		v.cursor = v.maxCursor()
	}
}

// maxCursor returns the maximum valid cursor position
func (v *VirtualList) maxCursor() int {
	itemCount := len(v.filteredItems)
	if itemCount == 0 {
		return 0
	}
	return itemCount - 1
}

// pageSize returns the number of items in a page (half viewport height)
func (v *VirtualList) pageSize() int {
	visibleItems := v.visibleItemCount()
	if visibleItems <= 0 {
		return 1
	}
	return visibleItems / 2
}

// visibleItemCount returns how many items can fit in the viewport
func (v *VirtualList) visibleItemCount() int {
	availableHeight := v.height
	if v.showStatusBar {
		availableHeight -= 2 // Status bar + padding
	}
	if v.showHelp {
		availableHeight -= 1 // Help line
	}
	if v.title != "" {
		availableHeight -= 2 // Title + padding
	}

	if availableHeight <= 0 {
		return 0
	}

	return availableHeight / v.itemHeight
}

// calculateViewport calculates the start and end indices for rendering
// Returns (start, end) where both are inclusive
func (v *VirtualList) calculateViewport() (int, int) {
	itemCount := len(v.filteredItems)
	if itemCount == 0 {
		return 0, -1
	}

	visibleItems := v.visibleItemCount()
	if visibleItems <= 0 {
		return 0, -1
	}

	// If all items fit in viewport, render everything (no buffer needed)
	if itemCount <= visibleItems {
		return 0, itemCount - 1
	}

	// Calculate visible range (inclusive)
	// For cursor in middle: show half before, half after
	// For cursor near edges: adjust to always show visibleItems count
	halfVisible := visibleItems / 2
	start := v.cursor - halfVisible
	end := v.cursor + halfVisible + (visibleItems % 2) - 1 // -1 because inclusive

	// Adjust if we're near the start
	if start < 0 {
		start = 0
		end = visibleItems - 1 // -1 for inclusive
	}

	// Adjust if we're near the end
	if end >= itemCount {
		end = itemCount - 1
		start = itemCount - visibleItems
	}

	// Ensure start is not negative after adjustment
	if start < 0 {
		start = 0
	}

	// Add buffer
	bufferStart := start - v.buffer
	bufferEnd := end + v.buffer

	if bufferStart < 0 {
		bufferStart = 0
	}
	if bufferEnd >= itemCount {
		bufferEnd = itemCount - 1
	}

	return bufferStart, bufferEnd
}

// applyFilter applies the current filter query to items
func (v *VirtualList) applyFilter() {
	if v.filterQuery == "" {
		v.filteredItems = v.items
		return
	}

	query := strings.ToLower(v.filterQuery)
	filtered := make([]list.Item, 0)

	for _, item := range v.items {
		filterValue := strings.ToLower(item.FilterValue())
		if strings.Contains(filterValue, query) {
			filtered = append(filtered, item)
		}
	}

	v.filteredItems = filtered

	// Reset cursor if it's out of bounds
	if v.cursor >= len(v.filteredItems) {
		v.cursor = len(v.filteredItems) - 1
	}
	if v.cursor < 0 {
		v.cursor = 0
	}
}

// View implements tea.Model
func (v VirtualList) View() string {
	if len(v.filteredItems) == 0 {
		return v.renderEmpty()
	}

	var b strings.Builder

	// Render title
	if v.title != "" {
		b.WriteString(v.styles.Title.Render(v.title))
		b.WriteString("\n")
	}

	// Render filter prompt if filtering
	if v.filtering {
		prompt := v.styles.FilterPrompt.Render("/ ")
		query := v.filterQuery
		cursor := v.styles.FilterCursor.Render("█")
		b.WriteString(prompt + query + cursor)
		b.WriteString("\n")
	}

	// Calculate viewport
	start, end := v.calculateViewport()

	// Render visible items only
	for i := start; i <= end && i < len(v.filteredItems); i++ {
		b.WriteString(v.renderItem(i))
	}

	// Render status bar
	if v.showStatusBar {
		b.WriteString("\n")
		b.WriteString(v.renderStatusBar())
	}

	// Render help
	if v.showHelp && !v.filtering {
		b.WriteString("\n")
		b.WriteString(v.renderHelp())
	}

	return b.String()
}

// renderItem renders a single item
func (v *VirtualList) renderItem(index int) string {
	if index < 0 || index >= len(v.filteredItems) {
		return ""
	}

	item := v.filteredItems[index]
	isSelected := index == v.cursor

	var b strings.Builder

	// Render cursor
	if isSelected {
		b.WriteString(v.styles.Cursor.Render("> "))
	} else {
		b.WriteString("  ")
	}

	// Try to get title and description from common interfaces
	title := ""
	description := ""

	// Try type assertion to ListItem (our custom interface)
	if listItem, ok := item.(ListItem); ok {
		// Use the FilterValue as title for now, subclasses can override
		title = item.FilterValue()

		// Try to get title/description from concrete types
		switch v := listItem.(type) {
		case SimpleItem:
			title = v.Title()
			description = v.Description()
		case PRListItem:
			title = v.Title()
			description = v.Description()
		}
	} else {
		// Fall back to FilterValue
		title = item.FilterValue()
	}

	// Render title
	if isSelected {
		b.WriteString(v.styles.SelectedTitle.Render(title))
	} else {
		b.WriteString(v.styles.NormalTitle.Render(title))
	}
	b.WriteString("\n")

	// Render description if available
	if description != "" {
		b.WriteString("  ") // Indent description
		if isSelected {
			b.WriteString(v.styles.SelectedDesc.Render(description))
		} else {
			b.WriteString(v.styles.NormalDesc.Render(description))
		}
		b.WriteString("\n")
	}

	return b.String()
}

// renderEmpty renders the empty state
func (v *VirtualList) renderEmpty() string {
	var b strings.Builder

	if v.title != "" {
		b.WriteString(v.styles.Title.Render(v.title))
		b.WriteString("\n\n")
	}

	emptyMsg := "No items"
	if v.filtering && v.filterQuery != "" {
		emptyMsg = "No matches found"
	}

	b.WriteString(v.styles.StatusBar.Render(emptyMsg))
	return b.String()
}

// renderStatusBar renders the status bar
func (v *VirtualList) renderStatusBar() string {
	if len(v.filteredItems) == 0 {
		return v.styles.StatusBar.Render("0/0")
	}

	current := v.cursor + 1
	total := len(v.filteredItems)
	return v.styles.StatusBar.Render(fmt.Sprintf("%d/%d", current, total))
}

// renderHelp renders help text
func (v *VirtualList) renderHelp() string {
	return v.styles.HelpStyle.Render("g/G top/bottom • ↑/↓ navigate • / filter • ? help")
}

// API methods for compatibility with existing List interface

// SetItems sets the list items
func (v *VirtualList) SetItems(items []list.Item) tea.Cmd {
	v.items = items
	v.filteredItems = items
	v.cursor = 0
	return nil
}

// SelectedItem returns the currently selected item
func (v *VirtualList) SelectedItem() list.Item {
	if v.cursor < 0 || v.cursor >= len(v.filteredItems) {
		return nil
	}
	return v.filteredItems[v.cursor]
}

// SelectedIndex returns the currently selected index
func (v *VirtualList) SelectedIndex() int {
	return v.cursor
}

// Select sets the selected index
func (v *VirtualList) Select(index int) {
	if index < 0 {
		v.cursor = 0
	} else if index >= len(v.filteredItems) {
		v.cursor = v.maxCursor()
	} else {
		v.cursor = index
	}
}

// SetSize sets the list dimensions
func (v *VirtualList) SetSize(width, height int) {
	v.width = width
	v.height = height
}

// Focus sets the focus state
func (v *VirtualList) Focus() {
	v.focused = true
}

// Blur removes focus
func (v *VirtualList) Blur() {
	v.focused = false
}

// IsFocused returns whether the list is focused
func (v *VirtualList) IsFocused() bool {
	return v.focused
}

// Title returns the list title
func (v *VirtualList) Title() string {
	return v.title
}

// SetTitle sets the list title
func (v *VirtualList) SetTitle(title string) {
	v.title = title
}

// ItemCount returns the number of items
func (v *VirtualList) ItemCount() int {
	return len(v.filteredItems)
}

// IsFiltering returns whether the list is in filter mode
func (v *VirtualList) IsFiltering() bool {
	return v.filtering
}

// Width returns the list width
func (v *VirtualList) Width() int {
	return v.width
}

// Height returns the list height
func (v *VirtualList) Height() int {
	return v.height
}

// Items returns all list items
func (v *VirtualList) Items() []list.Item {
	return v.filteredItems
}

// SetFilterText applies a filter query to the list
func (v *VirtualList) SetFilterText(query string) tea.Cmd {
	v.filterQuery = query
	v.applyFilter()
	return nil
}

// ResetFilter clears the active filter query
func (v *VirtualList) ResetFilter() {
	v.filterQuery = ""
	v.filtering = false
	v.applyFilter()
}

// FilterValue returns the current filter query
func (v *VirtualList) FilterValue() string {
	return v.filterQuery
}

// SetVimMode toggles vim-style navigation keys
func (v *VirtualList) SetVimMode(enabled bool) {
	v.keyMap = DefaultListKeyMap(enabled)
}

// SetThemeColors updates list styling
func (v *VirtualList) SetThemeColors(accent, muted, selectedBg, titleBg string) {
	if accent == "" {
		accent = "170"
	}
	if muted == "" {
		muted = "240"
	}
	if selectedBg == "" {
		selectedBg = "237"
	}
	if titleBg == "" {
		titleBg = "235"
	}

	v.styles.SelectedTitle = v.styles.SelectedTitle.Copy().
		Foreground(lipgloss.Color(accent)).
		Background(lipgloss.Color(selectedBg))
	v.styles.SelectedDesc = v.styles.SelectedDesc.Copy().
		Foreground(lipgloss.Color(muted)).
		Background(lipgloss.Color(selectedBg))
	v.styles.NormalTitle = v.styles.NormalTitle.Copy().
		Foreground(lipgloss.Color("252"))
	v.styles.NormalDesc = v.styles.NormalDesc.Copy().
		Foreground(lipgloss.Color(muted))
	v.styles.Title = v.styles.Title.Copy().
		Foreground(lipgloss.Color(accent)).
		Background(lipgloss.Color(titleBg))
	v.styles.FilterPrompt = v.styles.FilterPrompt.Copy().
		Foreground(lipgloss.Color(accent))
	v.styles.FilterCursor = v.styles.FilterCursor.Copy().
		Foreground(lipgloss.Color(accent))
	v.styles.StatusBar = v.styles.StatusBar.Copy().
		Foreground(lipgloss.Color(muted))
	v.styles.HelpStyle = v.styles.HelpStyle.Copy().
		Foreground(lipgloss.Color(muted))
	v.styles.Cursor = v.styles.Cursor.Copy().
		Foreground(lipgloss.Color(accent))
}
