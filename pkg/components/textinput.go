package components

import (
	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/textarea"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// TextInputMode represents the mode of the text input
type TextInputMode int

const (
	TextInputHidden         TextInputMode = iota
	TextInputLineComment                  // Comment on specific line
	TextInputGeneralComment               // General PR comment
	TextInputReviewComment                // Review summary comment
	TextInputApprove                      // Approve with optional summary
	TextInputRequestChanges               // Request changes with optional summary
	TextInputReplyComment                 // Reply to an existing comment
	TextInputEditComment                  // Edit an existing comment
	TextInputProviderToken                // Provider auth token input
	TextInputAIKey                        // AI API key input
	TextInputEditorCommand                // Preferred editor command
	TextInputDiffSearch                   // Search query for diff
	TextInputSaveFilterName               // Saved filter name input
)

// TextInput is a component for capturing multi-line text input
type TextInput struct {
	textarea textarea.Model
	mode     TextInputMode
	title    string
	context  string // e.g., "src/main.go:42"
	width    int
	height   int
	visible  bool

	// Styles
	containerStyle lipgloss.Style
	titleStyle     lipgloss.Style
	contextStyle   lipgloss.Style
}

// TextInputKeyMap defines keybindings for text input
type TextInputKeyMap struct {
	Submit key.Binding
	Cancel key.Binding
}

// DefaultTextInputKeyMap returns default keybindings
func DefaultTextInputKeyMap() TextInputKeyMap {
	return TextInputKeyMap{
		Submit: key.NewBinding(
			key.WithKeys("ctrl+s"),
			key.WithHelp("ctrl+s", "submit"),
		),
		Cancel: key.NewBinding(
			key.WithKeys("esc"),
			key.WithHelp("esc", "cancel"),
		),
	}
}

// NewTextInput creates a new text input component
func NewTextInput() TextInput {
	ta := textarea.New()
	ta.Placeholder = "Enter your comment... (Ctrl+S to submit, Esc to cancel)"
	ta.ShowLineNumbers = false
	ta.Prompt = ""
	ta.CharLimit = 10000
	ta.SetHeight(5)
	ta.Focus()

	return TextInput{
		textarea:       ta,
		mode:           TextInputHidden,
		visible:        false,
		containerStyle: lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("170")).Padding(1),
		titleStyle:     lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("170")),
		contextStyle:   lipgloss.NewStyle().Foreground(lipgloss.Color("240")),
	}
}

// Show displays the text input with the given mode and context
func (t *TextInput) Show(mode TextInputMode, title, context string) {
	t.mode = mode
	t.title = title
	t.context = context
	t.visible = true
	t.textarea.Placeholder = t.placeholderForMode(mode)
	t.textarea.Reset()
	t.textarea.Focus()
}

// Hide hides the text input
func (t *TextInput) Hide() {
	t.visible = false
	t.mode = TextInputHidden
	t.textarea.Blur()
	t.textarea.Reset()
}

// IsVisible returns true if the text input is visible
func (t *TextInput) IsVisible() bool {
	return t.visible
}

// Value returns the current text input value
func (t *TextInput) Value() string {
	return t.textarea.Value()
}

// SetValue pre-fills the text input.
func (t *TextInput) SetValue(value string) {
	t.textarea.SetValue(value)
}

// Mode returns the current mode
func (t *TextInput) Mode() TextInputMode {
	return t.mode
}

// Context returns the current context
func (t *TextInput) Context() string {
	return t.context
}

// SetSize sets the text input size
func (t *TextInput) SetSize(width, height int) {
	t.width = width
	t.height = height
	// Reserve space for border, title, context
	contentWidth := width - 6
	contentHeight := height - 8
	if contentWidth < 20 {
		contentWidth = 20
	}
	if contentHeight < 3 {
		contentHeight = 3
	}
	t.textarea.SetWidth(contentWidth)
	t.textarea.SetHeight(contentHeight)
}

// Update implements tea.Model
func (t TextInput) Update(msg tea.Msg) (TextInput, tea.Cmd) {
	if !t.visible {
		return t, nil
	}
	if keyMsg, ok := msg.(tea.KeyMsg); ok && keyMsg.String() == "tab" {
		t.textarea.InsertRune('\t')
		return t, nil
	}

	var cmd tea.Cmd
	t.textarea, cmd = t.textarea.Update(msg)
	return t, cmd
}

// View implements tea.Model
func (t TextInput) View() string {
	if !t.visible {
		return ""
	}

	// Build the view
	var content string

	// Title
	if t.title != "" {
		content += t.titleStyle.Render(t.title) + "\n"
	}

	// Context (file:line for line comments)
	if t.context != "" {
		content += t.contextStyle.Render(t.context) + "\n"
	}

	// Textarea
	content += t.textarea.View() + "\n"

	// Help text
	helpText := t.contextStyle.Render("Ctrl+S: Submit • Esc: Cancel")
	content += helpText

	// Wrap in container
	return t.containerStyle.Render(content)
}

// Focus focuses the text input
func (t *TextInput) Focus() {
	t.textarea.Focus()
}

// Blur unfocuses the text input
func (t *TextInput) Blur() {
	t.textarea.Blur()
}

func (t *TextInput) placeholderForMode(mode TextInputMode) string {
	switch mode {
	case TextInputReviewComment:
		return "Add a review comment... (Ctrl+S to submit, Esc to cancel)"
	case TextInputApprove:
		return "Optional approval summary... (Ctrl+S to submit, Esc to cancel)"
	case TextInputRequestChanges:
		return "Describe the requested changes... (Ctrl+S to submit, Esc to cancel)"
	case TextInputReplyComment:
		return "Reply to the comment... (Ctrl+S to submit, Esc to cancel)"
	case TextInputEditComment:
		return "Edit the comment... (Ctrl+S to submit, Esc to cancel)"
	case TextInputProviderToken:
		return "Paste provider token... (Ctrl+S to save, Esc to cancel)"
	case TextInputAIKey:
		return "Paste AI API key... (Ctrl+S to save, Esc to cancel)"
	case TextInputEditorCommand:
		return "Enter editor command (e.g., nvim, code --wait)... (Ctrl+S save)"
	case TextInputDiffSearch:
		return "Search diff content... (Ctrl+S to jump, Esc to cancel)"
	case TextInputSaveFilterName:
		return "Filter name... (Ctrl+S save, Esc cancel)"
	default:
		return "Enter Markdown comment... (Tab indents, Ctrl+S submit, Esc cancel)"
	}
}
