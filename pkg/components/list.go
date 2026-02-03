package components

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// ListItem represents an item in a list
type ListItem interface {
	list.Item
	ID() string
}

// SimpleItem is a basic list item implementation
type SimpleItem struct {
	id          string
	title       string
	description string
}

func NewSimpleItem(id, title, description string) SimpleItem {
	return SimpleItem{
		id:          id,
		title:       title,
		description: description,
	}
}

func (i SimpleItem) ID() string          { return i.id }
func (i SimpleItem) Title() string       { return i.title }
func (i SimpleItem) Description() string { return i.description }
func (i SimpleItem) FilterValue() string { return i.title }

// ListKeyMap defines the keybindings for the list
type ListKeyMap struct {
	Up       key.Binding
	Down     key.Binding
	Top      key.Binding
	Bottom   key.Binding
	PageUp   key.Binding
	PageDown key.Binding
	Select   key.Binding
	Back     key.Binding
	Filter   key.Binding
	Quit     key.Binding
}

// DefaultListKeyMap returns the default keybindings
func DefaultListKeyMap() ListKeyMap {
	return ListKeyMap{
		Up: key.NewBinding(
			key.WithKeys("k", "up"),
			key.WithHelp("k/↑", "up"),
		),
		Down: key.NewBinding(
			key.WithKeys("j", "down"),
			key.WithHelp("j/↓", "down"),
		),
		Top: key.NewBinding(
			key.WithKeys("g"),
			key.WithHelp("g", "top"),
		),
		Bottom: key.NewBinding(
			key.WithKeys("G"),
			key.WithHelp("G", "bottom"),
		),
		PageUp: key.NewBinding(
			key.WithKeys("ctrl+u", "pgup"),
			key.WithHelp("ctrl+u", "page up"),
		),
		PageDown: key.NewBinding(
			key.WithKeys("ctrl+d", "pgdown"),
			key.WithHelp("ctrl+d", "page down"),
		),
		Select: key.NewBinding(
			key.WithKeys("enter", "l"),
			key.WithHelp("enter/l", "select"),
		),
		Back: key.NewBinding(
			key.WithKeys("esc", "h", "q"),
			key.WithHelp("esc/h/q", "back"),
		),
		Filter: key.NewBinding(
			key.WithKeys("/"),
			key.WithHelp("/", "filter"),
		),
		Quit: key.NewBinding(
			key.WithKeys("ctrl+c"),
			key.WithHelp("ctrl+c", "quit"),
		),
	}
}

// List is a wrapper around bubbles list with vim keybindings
type List struct {
	list     list.Model
	keyMap   ListKeyMap
	title    string
	focused  bool
	selected int
}

// NewList creates a new list component
func NewList(title string, items []list.Item, width, height int) List {
	delegate := list.NewDefaultDelegate()

	// Style the delegate
	delegate.Styles.SelectedTitle = delegate.Styles.SelectedTitle.
		Foreground(lipgloss.Color("170")).
		BorderForeground(lipgloss.Color("170"))
	delegate.Styles.SelectedDesc = delegate.Styles.SelectedDesc.
		Foreground(lipgloss.Color("240")).
		BorderForeground(lipgloss.Color("170"))

	l := list.New(items, delegate, width, height)
	l.Title = title
	l.SetShowStatusBar(true)
	l.SetFilteringEnabled(true)
	l.SetShowHelp(true)

	// Style the list
	l.Styles.Title = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("170")).
		Padding(0, 1)

	return List{
		list:    l,
		keyMap:  DefaultListKeyMap(),
		title:   title,
		focused: true,
	}
}

// Init implements tea.Model
func (l List) Init() tea.Cmd {
	return nil
}

// Update implements tea.Model
func (l List) Update(msg tea.Msg) (List, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		// Handle vim-style navigation when not filtering
		if !l.list.SettingFilter() {
			switch {
			case key.Matches(msg, l.keyMap.Top):
				l.list.Select(0)
				return l, nil
			case key.Matches(msg, l.keyMap.Bottom):
				l.list.Select(len(l.list.Items()) - 1)
				return l, nil
			}
		}

	case tea.WindowSizeMsg:
		l.list.SetSize(msg.Width, msg.Height)
	}

	l.list, cmd = l.list.Update(msg)
	return l, cmd
}

// View implements tea.Model
func (l List) View() string {
	return l.list.View()
}

// SetItems sets the list items
func (l *List) SetItems(items []list.Item) tea.Cmd {
	return l.list.SetItems(items)
}

// SelectedItem returns the currently selected item
func (l *List) SelectedItem() list.Item {
	return l.list.SelectedItem()
}

// SelectedIndex returns the currently selected index
func (l *List) SelectedIndex() int {
	return l.list.Index()
}

// Select sets the selected index.
func (l *List) Select(index int) {
	l.list.Select(index)
}

// SetSize sets the list dimensions
func (l *List) SetSize(width, height int) {
	l.list.SetSize(width, height)
}

// Focus sets the focus state
func (l *List) Focus() {
	l.focused = true
}

// Blur removes focus
func (l *List) Blur() {
	l.focused = false
}

// IsFocused returns whether the list is focused
func (l *List) IsFocused() bool {
	return l.focused
}

// Title returns the list title
func (l *List) Title() string {
	return l.title
}

// SetTitle sets the list title
func (l *List) SetTitle(title string) {
	l.title = title
	l.list.Title = title
}

// ItemCount returns the number of items
func (l *List) ItemCount() int {
	return len(l.list.Items())
}

// IsFiltering returns whether the list is in filter mode
func (l *List) IsFiltering() bool {
	return l.list.SettingFilter()
}

// Width returns the list width
func (l *List) Width() int {
	return l.list.Width()
}

// Height returns the list height
func (l *List) Height() int {
	return l.list.Height()
}

// PRListItem represents a PR in a list
type PRListItem struct {
	id      string
	number  int
	title   string
	author  string
	status  string
	isDraft bool
	updated string
}

// NewPRListItem creates a new PR list item
func NewPRListItem(id string, number int, title, author, status string, isDraft bool, updated string) PRListItem {
	return PRListItem{
		id:      id,
		number:  number,
		title:   title,
		author:  author,
		status:  status,
		isDraft: isDraft,
		updated: updated,
	}
}

func (i PRListItem) ID() string { return i.id }

func (i PRListItem) Title() string {
	prefix := ""
	if i.isDraft {
		prefix = "[Draft] "
	}
	return fmt.Sprintf("#%d %s%s", i.number, prefix, i.title)
}

func (i PRListItem) Description() string {
	var parts []string
	parts = append(parts, fmt.Sprintf("by %s", i.author))
	if i.status != "" {
		parts = append(parts, i.status)
	}
	parts = append(parts, i.updated)
	return strings.Join(parts, " • ")
}

func (i PRListItem) FilterValue() string {
	return fmt.Sprintf("#%d %s %s", i.number, i.title, i.author)
}
