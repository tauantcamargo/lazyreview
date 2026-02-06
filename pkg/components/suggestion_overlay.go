package components

import (
	"fmt"
	"strings"

	"lazyreview/internal/models"

	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// SuggestionOverlayKeyMap defines keybindings for suggestion navigation
type SuggestionOverlayKeyMap struct {
	NextSuggestion key.Binding
	PrevSuggestion key.Binding
	Expand         key.Binding
	Dismiss        key.Binding
	Accept         key.Binding
	Help           key.Binding
}

// DefaultSuggestionOverlayKeyMap returns default keybindings for AI suggestions
func DefaultSuggestionOverlayKeyMap() SuggestionOverlayKeyMap {
	return SuggestionOverlayKeyMap{
		NextSuggestion: key.NewBinding(
			key.WithKeys("n"),
			key.WithHelp("n", "next suggestion"),
		),
		PrevSuggestion: key.NewBinding(
			key.WithKeys("N"),
			key.WithHelp("N", "prev suggestion"),
		),
		Expand: key.NewBinding(
			key.WithKeys("enter", "e"),
			key.WithHelp("enter/e", "expand/collapse"),
		),
		Dismiss: key.NewBinding(
			key.WithKeys("d"),
			key.WithHelp("d", "dismiss"),
		),
		Accept: key.NewBinding(
			key.WithKeys("a"),
			key.WithHelp("a", "accept"),
		),
		Help: key.NewBinding(
			key.WithKeys("?"),
			key.WithHelp("?", "toggle help"),
		),
	}
}

// SuggestionOverlay manages the display and interaction with AI suggestions in the diff view
type SuggestionOverlay struct {
	manager  *AISuggestionManager
	keyMap   SuggestionOverlayKeyMap
	width    int
	showHelp bool

	// Current navigation state
	currentSuggestionIndex int // Index in flattened list of all suggestions
	allSuggestions         []AISuggestion

	// Styles
	boxStyle            lipgloss.Style
	titleStyle          lipgloss.Style
	descriptionStyle    lipgloss.Style
	codeStyle           lipgloss.Style
	severityHighStyle   lipgloss.Style
	severityMediumStyle lipgloss.Style
	severityLowStyle    lipgloss.Style
	categoryBugStyle    lipgloss.Style
	categorySecStyle    lipgloss.Style
	categoryPerfStyle   lipgloss.Style
	categoryStyleStyle  lipgloss.Style
	helpStyle           lipgloss.Style
	dismissedStyle      lipgloss.Style
	acceptedStyle       lipgloss.Style
}

// NewSuggestionOverlay creates a new suggestion overlay
func NewSuggestionOverlay(manager *AISuggestionManager, width int) *SuggestionOverlay {
	return &SuggestionOverlay{
		manager:                manager,
		keyMap:                 DefaultSuggestionOverlayKeyMap(),
		width:                  width,
		showHelp:               false,
		currentSuggestionIndex: -1,

		// Styles
		boxStyle: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("240")).
			Padding(0, 1).
			MarginLeft(2),
		titleStyle: lipgloss.NewStyle().
			Bold(true),
		descriptionStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("252")),
		codeStyle: lipgloss.NewStyle().
			Background(lipgloss.Color("235")).
			Foreground(lipgloss.Color("42")).
			Padding(0, 1),
		severityHighStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("196")).
			Bold(true),
		severityMediumStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("220")).
			Bold(true),
		severityLowStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("39")).
			Bold(true),
		categoryBugStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("196")),
		categorySecStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("196")).
			Bold(true),
		categoryPerfStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("220")),
		categoryStyleStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("39")),
		helpStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("240")).
			Italic(true),
		dismissedStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("240")).
			Strikethrough(true),
		acceptedStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("42")),
	}
}

// Update handles keyboard input for suggestion navigation
func (o *SuggestionOverlay) Update(msg tea.Msg) (*SuggestionOverlay, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, o.keyMap.NextSuggestion):
			o.NextSuggestion()
			return o, nil
		case key.Matches(msg, o.keyMap.PrevSuggestion):
			o.PrevSuggestion()
			return o, nil
		case key.Matches(msg, o.keyMap.Expand):
			o.ToggleCurrentSuggestion()
			return o, nil
		case key.Matches(msg, o.keyMap.Dismiss):
			o.DismissCurrentSuggestion()
			return o, nil
		case key.Matches(msg, o.keyMap.Accept):
			o.AcceptCurrentSuggestion()
			return o, nil
		case key.Matches(msg, o.keyMap.Help):
			o.showHelp = !o.showHelp
			return o, nil
		}
	}

	return o, nil
}

// RebuildSuggestionList rebuilds the flattened list of all suggestions
func (o *SuggestionOverlay) RebuildSuggestionList() {
	o.allSuggestions = nil
	allSugs := o.manager.GetAllSuggestions()

	// Flatten suggestions in deterministic order
	// Sort by file, line, then severity
	for _, suggestions := range allSugs {
		for _, s := range suggestions {
			if !s.Dismissed {
				o.allSuggestions = append(o.allSuggestions, s)
			}
		}
	}
}

// NextSuggestion navigates to the next AI suggestion
func (o *SuggestionOverlay) NextSuggestion() {
	o.RebuildSuggestionList()
	if len(o.allSuggestions) == 0 {
		o.currentSuggestionIndex = -1
		return
	}

	o.currentSuggestionIndex++
	if o.currentSuggestionIndex >= len(o.allSuggestions) {
		o.currentSuggestionIndex = 0 // Wrap around
	}
}

// PrevSuggestion navigates to the previous AI suggestion
func (o *SuggestionOverlay) PrevSuggestion() {
	o.RebuildSuggestionList()
	if len(o.allSuggestions) == 0 {
		o.currentSuggestionIndex = -1
		return
	}

	o.currentSuggestionIndex--
	if o.currentSuggestionIndex < 0 {
		o.currentSuggestionIndex = len(o.allSuggestions) - 1 // Wrap around
	}
}

// CurrentSuggestion returns the currently selected suggestion, if any
func (o *SuggestionOverlay) CurrentSuggestion() *AISuggestion {
	if o.currentSuggestionIndex < 0 || o.currentSuggestionIndex >= len(o.allSuggestions) {
		return nil
	}
	return &o.allSuggestions[o.currentSuggestionIndex]
}

// ToggleCurrentSuggestion expands or collapses the current suggestion
func (o *SuggestionOverlay) ToggleCurrentSuggestion() {
	current := o.CurrentSuggestion()
	if current != nil {
		o.manager.ToggleExpanded(current.ID)
	}
}

// DismissCurrentSuggestion dismisses the current suggestion
func (o *SuggestionOverlay) DismissCurrentSuggestion() {
	current := o.CurrentSuggestion()
	if current != nil {
		o.manager.DismissSuggestion(current.ID)
		o.RebuildSuggestionList()
		// Move to next suggestion after dismissing
		if o.currentSuggestionIndex >= len(o.allSuggestions) && len(o.allSuggestions) > 0 {
			o.currentSuggestionIndex = len(o.allSuggestions) - 1
		}
	}
}

// AcceptCurrentSuggestion accepts the current suggestion
func (o *SuggestionOverlay) AcceptCurrentSuggestion() {
	current := o.CurrentSuggestion()
	if current != nil {
		o.manager.AcceptSuggestion(current.ID)
		// Move to next suggestion after accepting
		o.NextSuggestion()
	}
}

// RenderInlineSuggestion renders a suggestion inline in the diff
func (o *SuggestionOverlay) RenderInlineSuggestion(filePath string, lineNo int, side models.DiffSide) string {
	suggestions := o.manager.GetSuggestions(filePath, lineNo, side)
	if len(suggestions) == 0 {
		return ""
	}

	var result strings.Builder

	for _, s := range suggestions {
		if s.Dismissed {
			continue
		}

		result.WriteString(o.renderSingleSuggestion(s))
		result.WriteString("\n")
	}

	return result.String()
}

// renderSingleSuggestion renders a single suggestion box
func (o *SuggestionOverlay) renderSingleSuggestion(s AISuggestion) string {
	var content strings.Builder

	// Header: [Category] Title [Severity]
	categoryStyle := o.getCategoryStyle(s.Category)
	severityStyle := o.getSeverityStyle(s.Severity)

	header := fmt.Sprintf("%s [%s] %s",
		categoryStyle.Render(strings.ToUpper(string(s.Category))),
		severityStyle.Render(strings.ToUpper(string(s.Severity))),
		o.titleStyle.Render(s.Title),
	)

	if s.Accepted {
		header = o.acceptedStyle.Render("[ACCEPTED] ") + header
	} else if s.Dismissed {
		header = o.dismissedStyle.Render("[DISMISSED] ") + header
	}

	content.WriteString(header)

	// If expanded, show full description
	if s.Expanded {
		content.WriteString("\n\n")
		content.WriteString(o.descriptionStyle.Render(o.wrapText(s.Description, o.width-8)))

		// If there's suggested code, show it
		if s.SuggestedCode != "" {
			content.WriteString("\n\n")
			content.WriteString(o.titleStyle.Render("Suggested code:"))
			content.WriteString("\n")
			content.WriteString(o.codeStyle.Render(s.SuggestedCode))
		}

		// Show help if enabled
		if o.showHelp {
			content.WriteString("\n\n")
			content.WriteString(o.helpStyle.Render("enter: collapse | d: dismiss | a: accept | n/N: next/prev"))
		}
	} else {
		// Collapsed: just show expand hint
		content.WriteString(o.helpStyle.Render(" (press enter to expand)"))
	}

	// Apply box style
	boxWidth := o.width - 4
	if boxWidth < 20 {
		boxWidth = 20
	}

	return o.boxStyle.Width(boxWidth).Render(content.String())
}

// getCategoryStyle returns the style for a category
func (o *SuggestionOverlay) getCategoryStyle(category SuggestionCategory) lipgloss.Style {
	switch category {
	case SuggestionCategoryBug:
		return o.categoryBugStyle
	case SuggestionCategorySecurity:
		return o.categorySecStyle
	case SuggestionCategoryPerformance:
		return o.categoryPerfStyle
	case SuggestionCategoryStyle:
		return o.categoryStyleStyle
	default:
		return o.categoryStyleStyle
	}
}

// getSeverityStyle returns the style for a severity level
func (o *SuggestionOverlay) getSeverityStyle(severity SuggestionSeverity) lipgloss.Style {
	switch severity {
	case SuggestionSeverityHigh:
		return o.severityHighStyle
	case SuggestionSeverityMedium:
		return o.severityMediumStyle
	case SuggestionSeverityLow:
		return o.severityLowStyle
	default:
		return o.severityLowStyle
	}
}

// wrapText wraps text to a maximum width
func (o *SuggestionOverlay) wrapText(text string, maxWidth int) string {
	if maxWidth <= 0 {
		maxWidth = 60
	}

	lines := strings.Split(text, "\n")
	var wrapped strings.Builder

	for i, line := range lines {
		if i > 0 {
			wrapped.WriteString("\n")
		}

		// Simple word wrapping
		words := strings.Fields(line)
		currentLine := ""

		for _, word := range words {
			testLine := currentLine
			if testLine != "" {
				testLine += " "
			}
			testLine += word

			if len(testLine) > maxWidth {
				if currentLine != "" {
					wrapped.WriteString(currentLine)
					wrapped.WriteString("\n")
				}
				currentLine = word
			} else {
				currentLine = testLine
			}
		}

		if currentLine != "" {
			wrapped.WriteString(currentLine)
		}
	}

	return wrapped.String()
}

// SetWidth updates the overlay width
func (o *SuggestionOverlay) SetWidth(width int) {
	o.width = width
}

// GetCurrentSuggestionLocation returns the file/line info for the current suggestion
func (o *SuggestionOverlay) GetCurrentSuggestionLocation() (filePath string, lineNo int, side models.DiffSide, ok bool) {
	current := o.CurrentSuggestion()
	if current == nil {
		return "", 0, "", false
	}
	return current.FilePath, current.LineNo, current.Side, true
}

// StatusLine returns a status line showing suggestion count and position
func (o *SuggestionOverlay) StatusLine() string {
	o.RebuildSuggestionList()
	total := len(o.allSuggestions)

	if total == 0 {
		return o.helpStyle.Render("No AI suggestions")
	}

	current := o.currentSuggestionIndex + 1
	if o.currentSuggestionIndex < 0 {
		current = 0
	}

	return o.helpStyle.Render(fmt.Sprintf("AI Suggestions: %d/%d", current, total))
}
