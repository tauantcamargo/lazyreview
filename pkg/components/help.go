package components

import (
	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// HelpKeyMap defines keybindings shown in the help view
type HelpKeyMap struct {
	Up                   key.Binding
	Down                 key.Binding
	Left                 key.Binding
	Right                key.Binding
	Select               key.Binding
	Back                 key.Binding
	Approve              key.Binding
	RequestChanges       key.Binding
	Comment              key.Binding
	ReviewComment        key.Binding
	Checkout             key.Binding
	OpenEditor           key.Binding
	ToggleComments       key.Binding
	ReplyComment         key.Binding
	EditComment          key.Binding
	DeleteComment        key.Binding
	ResolveComment       key.Binding
	ToggleCommentPreview key.Binding
	DraftSummary         key.Binding
	AIReview             key.Binding
	Update               key.Binding
	Help                 key.Binding
	Quit                 key.Binding
}

// ShortHelp returns a short help view
func (k HelpKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Up, k.Down, k.Select, k.Help, k.Quit}
}

// FullHelp returns the full help view
func (k HelpKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Up, k.Down, k.Left, k.Right},
		{k.Select, k.Back},
		{k.Approve, k.RequestChanges, k.Comment, k.ReviewComment, k.Checkout, k.OpenEditor},
		{k.ToggleComments, k.ToggleCommentPreview, k.ReplyComment, k.EditComment, k.DeleteComment, k.ResolveComment},
		{k.DraftSummary, k.AIReview, k.Update},
		{k.Help, k.Quit},
	}
}

// DefaultHelpKeyMap returns the default keybindings for help
func DefaultHelpKeyMap() HelpKeyMap {
	return HelpKeyMap{
		Up: key.NewBinding(
			key.WithKeys("k", "up"),
			key.WithHelp("k/↑", "up"),
		),
		Down: key.NewBinding(
			key.WithKeys("j", "down"),
			key.WithHelp("j/↓", "down"),
		),
		Left: key.NewBinding(
			key.WithKeys("h", "left"),
			key.WithHelp("h/←", "left"),
		),
		Right: key.NewBinding(
			key.WithKeys("l", "right"),
			key.WithHelp("l/→", "right"),
		),
		Select: key.NewBinding(
			key.WithKeys("enter"),
			key.WithHelp("enter", "select"),
		),
		Back: key.NewBinding(
			key.WithKeys("esc", "q"),
			key.WithHelp("esc/q", "back"),
		),
		Approve: key.NewBinding(
			key.WithKeys("a"),
			key.WithHelp("a", "approve"),
		),
		RequestChanges: key.NewBinding(
			key.WithKeys("r"),
			key.WithHelp("r", "request changes"),
		),
		Comment: key.NewBinding(
			key.WithKeys("c"),
			key.WithHelp("c", "comment"),
		),
		ReviewComment: key.NewBinding(
			key.WithKeys("v"),
			key.WithHelp("v", "review comment"),
		),
		Checkout: key.NewBinding(
			key.WithKeys("shift+c"),
			key.WithHelp("shift+c", "checkout"),
		),
		OpenEditor: key.NewBinding(
			key.WithKeys("O"),
			key.WithHelp("O", "open editor"),
		),
		ToggleComments: key.NewBinding(
			key.WithKeys("t"),
			key.WithHelp("t", "toggle comments"),
		),
		ReplyComment: key.NewBinding(
			key.WithKeys("y"),
			key.WithHelp("y", "reply"),
		),
		EditComment: key.NewBinding(
			key.WithKeys("e"),
			key.WithHelp("e", "edit comment"),
		),
		DeleteComment: key.NewBinding(
			key.WithKeys("x"),
			key.WithHelp("x", "delete comment"),
		),
		ResolveComment: key.NewBinding(
			key.WithKeys("z"),
			key.WithHelp("z", "resolve thread"),
		),
		ToggleCommentPreview: key.NewBinding(
			key.WithKeys("i"),
			key.WithHelp("i", "toggle preview"),
		),
		DraftSummary: key.NewBinding(
			key.WithKeys("s"),
			key.WithHelp("s", "draft summary"),
		),
		AIReview: key.NewBinding(
			key.WithKeys("A"),
			key.WithHelp("A", "ai review"),
		),
		Update: key.NewBinding(
			key.WithKeys("U"),
			key.WithHelp("U", "update"),
		),
		Help: key.NewBinding(
			key.WithKeys("?"),
			key.WithHelp("?", "help"),
		),
		Quit: key.NewBinding(
			key.WithKeys("ctrl+c"),
			key.WithHelp("ctrl+c", "quit"),
		),
	}
}

// Help is a help component
type Help struct {
	help    help.Model
	keyMap  HelpKeyMap
	showAll bool
	width   int
}

// NewHelp creates a new help component
func NewHelp() Help {
	h := help.New()
	h.Styles.ShortKey = lipgloss.NewStyle().Foreground(lipgloss.Color("170"))
	h.Styles.ShortDesc = lipgloss.NewStyle().Foreground(lipgloss.Color("240"))
	h.Styles.FullKey = lipgloss.NewStyle().Foreground(lipgloss.Color("170"))
	h.Styles.FullDesc = lipgloss.NewStyle().Foreground(lipgloss.Color("240"))

	return Help{
		help:   h,
		keyMap: DefaultHelpKeyMap(),
	}
}

// SetThemeColors updates help styling.
func (h *Help) SetThemeColors(accent, muted string) {
	if accent == "" {
		accent = "170"
	}
	if muted == "" {
		muted = "240"
	}
	h.help.Styles.ShortKey = lipgloss.NewStyle().Foreground(lipgloss.Color(accent))
	h.help.Styles.ShortDesc = lipgloss.NewStyle().Foreground(lipgloss.Color(muted))
	h.help.Styles.FullKey = lipgloss.NewStyle().Foreground(lipgloss.Color(accent))
	h.help.Styles.FullDesc = lipgloss.NewStyle().Foreground(lipgloss.Color(muted))
}

// Init implements tea.Model
func (h Help) Init() tea.Cmd {
	return nil
}

// Update implements tea.Model
func (h Help) Update(msg tea.Msg) (Help, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if key.Matches(msg, h.keyMap.Help) {
			h.showAll = !h.showAll
		}
	case tea.WindowSizeMsg:
		h.width = msg.Width
		h.help.Width = msg.Width
	}
	return h, nil
}

// View implements tea.Model
func (h Help) View() string {
	if h.showAll {
		return h.help.FullHelpView(h.keyMap.FullHelp())
	}
	return h.help.ShortHelpView(h.keyMap.ShortHelp())
}

// SetWidth sets the help width
func (h *Help) SetWidth(width int) {
	h.width = width
	h.help.Width = width
}

// Toggle toggles between short and full help
func (h *Help) Toggle() {
	h.showAll = !h.showAll
}

// ShowFull shows the full help
func (h *Help) ShowFull() {
	h.showAll = true
}

// ShowShort shows the short help
func (h *Help) ShowShort() {
	h.showAll = false
}
