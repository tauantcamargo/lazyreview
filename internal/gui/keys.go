package gui

import (
	"time"

	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
)

// KeyMap defines all keybindings for the application
type KeyMap struct {
	// Navigation
	Up       key.Binding
	Down     key.Binding
	Left     key.Binding
	Right    key.Binding
	Top      key.Binding
	Bottom   key.Binding
	PageUp   key.Binding
	PageDown key.Binding
	HalfUp   key.Binding
	HalfDown key.Binding

	// Selection
	Select    key.Binding
	Back      key.Binding
	Cancel    key.Binding
	NextPanel key.Binding
	PrevPanel key.Binding

	// Actions
	Approve              key.Binding
	RequestChanges       key.Binding
	Comment              key.Binding
	GeneralComment       key.Binding
	ReviewComment        key.Binding
	ToggleComments       key.Binding
	ReplyComment         key.Binding
	EditComment          key.Binding
	DeleteComment        key.Binding
	ResolveComment       key.Binding
	ToggleCommentPreview key.Binding
	DraftSummary         key.Binding
	AIReview             key.Binding
	Update               key.Binding
	OpenBrowser          key.Binding
	OpenEditor           key.Binding
	Checkout             key.Binding
	Refresh              key.Binding
	Merge                key.Binding

	// Search
	Search        key.Binding
	NextMatch     key.Binding
	PrevMatch     key.Binding
	ClearSearch   key.Binding
	SaveFilter    key.Binding
	FilterPalette key.Binding

	// Global
	Help key.Binding
	Quit key.Binding
}

// DefaultKeyMap returns keybindings for navigation/actions.
func DefaultKeyMap(vimMode bool) KeyMap {
	if !vimMode {
		return KeyMap{
			Up: key.NewBinding(
				key.WithKeys("up"),
				key.WithHelp("↑", "up"),
			),
			Down: key.NewBinding(
				key.WithKeys("down"),
				key.WithHelp("↓", "down"),
			),
			Left: key.NewBinding(
				key.WithKeys("left"),
				key.WithHelp("←", "left/back"),
			),
			Right: key.NewBinding(
				key.WithKeys("right"),
				key.WithHelp("→", "right/enter"),
			),
			Top: key.NewBinding(
				key.WithKeys("home"),
				key.WithHelp("home", "top"),
			),
			Bottom: key.NewBinding(
				key.WithKeys("end"),
				key.WithHelp("end", "bottom"),
			),
			PageUp: key.NewBinding(
				key.WithKeys("pgup"),
				key.WithHelp("pgup", "page up"),
			),
			PageDown: key.NewBinding(
				key.WithKeys("pgdown"),
				key.WithHelp("pgdn", "page down"),
			),
			HalfUp: key.NewBinding(
				key.WithKeys("ctrl+u"),
				key.WithHelp("ctrl+u", "half page up"),
			),
			HalfDown: key.NewBinding(
				key.WithKeys("ctrl+d"),
				key.WithHelp("ctrl+d", "half page down"),
			),
			Select:               key.NewBinding(key.WithKeys("enter"), key.WithHelp("enter", "select")),
			Back:                 key.NewBinding(key.WithKeys("esc", "backspace"), key.WithHelp("esc", "back")),
			Cancel:               key.NewBinding(key.WithKeys("esc"), key.WithHelp("esc", "cancel")),
			NextPanel:            key.NewBinding(key.WithKeys("tab"), key.WithHelp("tab", "next panel")),
			PrevPanel:            key.NewBinding(key.WithKeys("shift+tab"), key.WithHelp("shift+tab", "prev panel")),
			Approve:              key.NewBinding(key.WithKeys("a"), key.WithHelp("a", "approve")),
			RequestChanges:       key.NewBinding(key.WithKeys("r"), key.WithHelp("r", "request changes")),
			Comment:              key.NewBinding(key.WithKeys("c"), key.WithHelp("c", "comment on line")),
			GeneralComment:       key.NewBinding(key.WithKeys("C"), key.WithHelp("C", "general comment")),
			ReviewComment:        key.NewBinding(key.WithKeys("v"), key.WithHelp("v", "review comment")),
			ToggleComments:       key.NewBinding(key.WithKeys("t"), key.WithHelp("t", "toggle comments")),
			ReplyComment:         key.NewBinding(key.WithKeys("y"), key.WithHelp("y", "reply")),
			EditComment:          key.NewBinding(key.WithKeys("e"), key.WithHelp("e", "edit comment")),
			DeleteComment:        key.NewBinding(key.WithKeys("x"), key.WithHelp("x", "delete comment")),
			ResolveComment:       key.NewBinding(key.WithKeys("z"), key.WithHelp("z", "resolve thread")),
			ToggleCommentPreview: key.NewBinding(key.WithKeys("i"), key.WithHelp("i", "toggle comment preview")),
			DraftSummary:         key.NewBinding(key.WithKeys("s"), key.WithHelp("s", "draft summary")),
			AIReview:             key.NewBinding(key.WithKeys("A", "ctrl+a"), key.WithHelp("A/ctrl+a", "ai review")),
			Update:               key.NewBinding(key.WithKeys("U"), key.WithHelp("U", "update")),
			OpenBrowser:          key.NewBinding(key.WithKeys("o"), key.WithHelp("o", "open in browser")),
			OpenEditor:           key.NewBinding(key.WithKeys("O"), key.WithHelp("O", "open in editor")),
			Checkout:             key.NewBinding(key.WithKeys("shift+c"), key.WithHelp("shift+c", "checkout branch")),
			Refresh:              key.NewBinding(key.WithKeys("R"), key.WithHelp("R", "refresh")),
			Merge:                key.NewBinding(key.WithKeys("m"), key.WithHelp("m", "merge")),
			Search:               key.NewBinding(key.WithKeys("/"), key.WithHelp("/", "search")),
			NextMatch:            key.NewBinding(key.WithKeys("n"), key.WithHelp("n", "next match")),
			PrevMatch:            key.NewBinding(key.WithKeys("N"), key.WithHelp("N", "prev match")),
			ClearSearch:          key.NewBinding(key.WithKeys("esc"), key.WithHelp("esc", "clear search")),
			SaveFilter:           key.NewBinding(key.WithKeys("S"), key.WithHelp("S", "save filter")),
			FilterPalette:        key.NewBinding(key.WithKeys("F"), key.WithHelp("F", "saved filters")),
			Help:                 key.NewBinding(key.WithKeys("?"), key.WithHelp("?", "help")),
			Quit:                 key.NewBinding(key.WithKeys("q", "ctrl+c"), key.WithHelp("q", "quit")),
		}
	}
	return KeyMap{
		// Navigation
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
			key.WithHelp("h/←", "left/back"),
		),
		Right: key.NewBinding(
			key.WithKeys("l", "right"),
			key.WithHelp("l/→", "right/enter"),
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
			key.WithKeys("pgup", "b"),
			key.WithHelp("b/pgup", "page up"),
		),
		PageDown: key.NewBinding(
			key.WithKeys("pgdown", "f"),
			key.WithHelp("f/pgdn", "page down"),
		),
		HalfUp: key.NewBinding(
			key.WithKeys("ctrl+u"),
			key.WithHelp("ctrl+u", "half page up"),
		),
		HalfDown: key.NewBinding(
			key.WithKeys("ctrl+d"),
			key.WithHelp("ctrl+d", "half page down"),
		),

		// Selection
		Select: key.NewBinding(
			key.WithKeys("enter"),
			key.WithHelp("enter", "select"),
		),
		Back: key.NewBinding(
			key.WithKeys("esc", "backspace"),
			key.WithHelp("esc", "back"),
		),
		Cancel: key.NewBinding(
			key.WithKeys("esc"),
			key.WithHelp("esc", "cancel"),
		),
		NextPanel: key.NewBinding(
			key.WithKeys("tab"),
			key.WithHelp("tab", "next panel"),
		),
		PrevPanel: key.NewBinding(
			key.WithKeys("shift+tab"),
			key.WithHelp("shift+tab", "prev panel"),
		),

		// Actions
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
			key.WithHelp("c", "comment on line"),
		),
		GeneralComment: key.NewBinding(
			key.WithKeys("C"),
			key.WithHelp("C", "general comment"),
		),
		ReviewComment: key.NewBinding(
			key.WithKeys("v"),
			key.WithHelp("v", "review comment"),
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
			key.WithHelp("i", "toggle comment preview"),
		),
		DraftSummary: key.NewBinding(
			key.WithKeys("s"),
			key.WithHelp("s", "draft summary"),
		),
		AIReview: key.NewBinding(
			key.WithKeys("A", "ctrl+a"),
			key.WithHelp("A/ctrl+a", "ai review"),
		),
		Update: key.NewBinding(
			key.WithKeys("U"),
			key.WithHelp("U", "update"),
		),
		OpenBrowser: key.NewBinding(
			key.WithKeys("o"),
			key.WithHelp("o", "open in browser"),
		),
		OpenEditor: key.NewBinding(
			key.WithKeys("O"),
			key.WithHelp("O", "open in editor"),
		),
		Checkout: key.NewBinding(
			key.WithKeys("shift+c"),
			key.WithHelp("shift+c", "checkout branch"),
		),
		Refresh: key.NewBinding(
			key.WithKeys("R"),
			key.WithHelp("R", "refresh"),
		),
		Merge: key.NewBinding(
			key.WithKeys("m"),
			key.WithHelp("m", "merge"),
		),

		// Search
		Search: key.NewBinding(
			key.WithKeys("/"),
			key.WithHelp("/", "search"),
		),
		NextMatch: key.NewBinding(
			key.WithKeys("n"),
			key.WithHelp("n", "next match"),
		),
		PrevMatch: key.NewBinding(
			key.WithKeys("N"),
			key.WithHelp("N", "prev match"),
		),
		ClearSearch: key.NewBinding(
			key.WithKeys("esc"),
			key.WithHelp("esc", "clear search"),
		),
		SaveFilter: key.NewBinding(
			key.WithKeys("S"),
			key.WithHelp("S", "save filter"),
		),
		FilterPalette: key.NewBinding(
			key.WithKeys("F"),
			key.WithHelp("F", "saved filters"),
		),

		// Global
		Help: key.NewBinding(
			key.WithKeys("?"),
			key.WithHelp("?", "help"),
		),
		Quit: key.NewBinding(
			key.WithKeys("q", "ctrl+c"),
			key.WithHelp("q", "quit"),
		),
	}
}

// KeySequence tracks multi-key sequences like "gg"
type KeySequence struct {
	keys     []string
	lastKey  string
	lastTime time.Time
	timeout  time.Duration
}

// NewKeySequence creates a new key sequence tracker
func NewKeySequence() *KeySequence {
	return &KeySequence{
		keys:    make([]string, 0, 2),
		timeout: 500 * time.Millisecond,
	}
}

// Add adds a key to the sequence and returns the current sequence
func (ks *KeySequence) Add(key string) []string {
	now := time.Now()

	// Reset if timeout expired
	if now.Sub(ks.lastTime) > ks.timeout {
		ks.keys = ks.keys[:0]
	}

	ks.keys = append(ks.keys, key)
	ks.lastKey = key
	ks.lastTime = now

	// Keep only last 2 keys
	if len(ks.keys) > 2 {
		ks.keys = ks.keys[len(ks.keys)-2:]
	}

	return ks.keys
}

// Reset clears the key sequence
func (ks *KeySequence) Reset() {
	ks.keys = ks.keys[:0]
	ks.lastKey = ""
}

// IsSequence checks if the current sequence matches
func (ks *KeySequence) IsSequence(seq ...string) bool {
	if len(ks.keys) != len(seq) {
		return false
	}
	for i, k := range seq {
		if ks.keys[i] != k {
			return false
		}
	}
	return true
}

// keyTimeoutMsg is sent when the key sequence timeout expires
type keyTimeoutMsg struct{}

// keySequenceCmd returns a command that sends a timeout message
func keySequenceCmd() tea.Cmd {
	return tea.Tick(500*time.Millisecond, func(t time.Time) tea.Msg {
		return keyTimeoutMsg{}
	})
}
