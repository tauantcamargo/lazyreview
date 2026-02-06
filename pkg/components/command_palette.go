package components

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/sahilm/fuzzy"
)

// CommandAction represents a single action available in the command palette
type CommandAction struct {
	ID          string   // Unique identifier
	Name        string   // Display name (e.g., "Approve PR")
	Description string   // Help text
	Key         string   // Keybinding (e.g., "a" or "ctrl+a")
	Category    string   // Category (e.g., "Review", "Navigation", "Git")
	Aliases     []string // Alternative names for fuzzy matching
	Context     []string // Contexts where this command is available (empty = always)
	Handler     func() tea.Msg
}

// CommandPalette provides a fuzzy-searchable command launcher
type CommandPalette struct {
	visible       bool
	textInput     textinput.Model
	commands      []CommandAction
	filtered      []CommandAction
	recentIDs     []string // Most recently executed command IDs
	maxRecent     int
	selected      int
	width         int
	height        int
	currentCtx    []string // Current active contexts
	lastExecution time.Time

	// Styles
	containerStyle lipgloss.Style
	titleStyle     lipgloss.Style
	selectedStyle  lipgloss.Style
	normalStyle    lipgloss.Style
	categoryStyle  lipgloss.Style
	keyStyle       lipgloss.Style
	helpStyle      lipgloss.Style
}

// CommandPaletteKeyMap defines keybindings for the command palette
type CommandPaletteKeyMap struct {
	Up     key.Binding
	Down   key.Binding
	Select key.Binding
	Cancel key.Binding
}

// DefaultCommandPaletteKeyMap returns default keybindings
func DefaultCommandPaletteKeyMap() CommandPaletteKeyMap {
	return CommandPaletteKeyMap{
		Up: key.NewBinding(
			key.WithKeys("up", "ctrl+k"),
			key.WithHelp("↑/ctrl+k", "up"),
		),
		Down: key.NewBinding(
			key.WithKeys("down", "ctrl+j"),
			key.WithHelp("↓/ctrl+j", "down"),
		),
		Select: key.NewBinding(
			key.WithKeys("enter"),
			key.WithHelp("enter", "select"),
		),
		Cancel: key.NewBinding(
			key.WithKeys("esc"),
			key.WithHelp("esc", "close"),
		),
	}
}

// NewCommandPalette creates a new command palette
func NewCommandPalette(commands []CommandAction) CommandPalette {
	ti := textinput.New()
	ti.Placeholder = "Type to search commands..."
	ti.CharLimit = 100
	ti.Focus()

	return CommandPalette{
		visible:   false,
		textInput: ti,
		commands:  commands,
		filtered:  make([]CommandAction, 0),
		recentIDs: make([]string, 0),
		maxRecent: 5,
		selected:  0,
		containerStyle: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("170")).
			Padding(1, 2),
		titleStyle: lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("170")),
		selectedStyle: lipgloss.NewStyle().
			Background(lipgloss.Color("237")).
			Foreground(lipgloss.Color("252")).
			Bold(true),
		normalStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("252")),
		categoryStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("240")).
			Italic(true),
		keyStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("75")).
			Bold(true),
		helpStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("240")),
	}
}

// SetThemeColors updates command palette styling
func (cp *CommandPalette) SetThemeColors(accent, muted, selectedBg, border string) {
	if accent == "" {
		accent = "170"
	}
	if muted == "" {
		muted = "240"
	}
	if selectedBg == "" {
		selectedBg = "237"
	}
	if border == "" {
		border = accent
	}

	cp.containerStyle = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color(border)).
		Padding(1, 2)
	cp.titleStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(accent))
	cp.selectedStyle = lipgloss.NewStyle().
		Background(lipgloss.Color(selectedBg)).
		Foreground(lipgloss.Color("252")).
		Bold(true)
	cp.normalStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("252"))
	cp.categoryStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(muted)).Italic(true)
	cp.keyStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(accent)).Bold(true)
	cp.helpStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(muted))
}

// Show displays the command palette
func (cp *CommandPalette) Show(context []string) {
	cp.visible = true
	cp.currentCtx = context
	cp.textInput.Reset()
	cp.textInput.Focus()
	cp.selected = 0
	cp.updateFiltered()
}

// Hide hides the command palette
func (cp *CommandPalette) Hide() {
	cp.visible = false
	cp.textInput.Blur()
	cp.textInput.Reset()
}

// IsVisible returns whether the palette is visible
func (cp *CommandPalette) IsVisible() bool {
	return cp.visible
}

// SetSize sets the palette dimensions
func (cp *CommandPalette) SetSize(width, height int) {
	cp.width = width
	cp.height = height
	cp.textInput.Width = width - 10
}

// SetCommands updates the available commands
func (cp *CommandPalette) SetCommands(commands []CommandAction) {
	cp.commands = commands
	if cp.visible {
		cp.updateFiltered()
	}
}

// SetContext updates the current context
func (cp *CommandPalette) SetContext(context []string) {
	cp.currentCtx = context
}

// GetRecentCommands returns the IDs of recently executed commands
func (cp *CommandPalette) GetRecentCommands() []string {
	return cp.recentIDs
}

// SetRecentCommands sets the recent command IDs (for persistence)
func (cp *CommandPalette) SetRecentCommands(ids []string) {
	if len(ids) > cp.maxRecent {
		ids = ids[:cp.maxRecent]
	}
	cp.recentIDs = ids
}

// Update implements tea.Model
func (cp CommandPalette) Update(msg tea.Msg) (CommandPalette, tea.Cmd) {
	if !cp.visible {
		return cp, nil
	}

	keyMap := DefaultCommandPaletteKeyMap()

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, keyMap.Cancel):
			cp.Hide()
			return cp, nil

		case key.Matches(msg, keyMap.Up):
			if cp.selected > 0 {
				cp.selected--
			}
			return cp, nil

		case key.Matches(msg, keyMap.Down):
			if cp.selected < len(cp.filtered)-1 {
				cp.selected++
			}
			return cp, nil

		case key.Matches(msg, keyMap.Select):
			if len(cp.filtered) > 0 && cp.selected < len(cp.filtered) {
				cmd := cp.filtered[cp.selected]
				cp.recordExecution(cmd.ID)
				cp.Hide()
				if cmd.Handler != nil {
					return cp, func() tea.Msg { return cmd.Handler() }
				}
			}
			return cp, nil
		}
	}

	// Update text input
	var cmd tea.Cmd
	cp.textInput, cmd = cp.textInput.Update(msg)
	cp.updateFiltered()

	return cp, cmd
}

// View implements tea.Model
func (cp CommandPalette) View() string {
	if !cp.visible {
		return ""
	}

	var b strings.Builder

	// Title
	b.WriteString(cp.titleStyle.Render("Command Palette"))
	b.WriteString("\n\n")

	// Search input
	b.WriteString(cp.textInput.View())
	b.WriteString("\n\n")

	// Results
	maxResults := cp.height - 12
	if maxResults < 5 {
		maxResults = 5
	}

	if len(cp.filtered) == 0 {
		b.WriteString(cp.helpStyle.Render("No commands found"))
	} else {
		// Show up to maxResults commands
		start := 0
		end := len(cp.filtered)
		if end > maxResults {
			end = maxResults
		}

		// Adjust window to keep selection visible
		if cp.selected >= end {
			start = cp.selected - maxResults + 1
			end = cp.selected + 1
		}

		for i := start; i < end && i < len(cp.filtered); i++ {
			cmd := cp.filtered[i]
			style := cp.normalStyle
			if i == cp.selected {
				style = cp.selectedStyle
			}

			// Format: [Category] Name [key] - Description
			var line strings.Builder

			// Category prefix
			if cmd.Category != "" {
				line.WriteString(cp.categoryStyle.Render("[" + cmd.Category + "] "))
			}

			// Name
			line.WriteString(cmd.Name)

			// Key binding
			if cmd.Key != "" {
				line.WriteString(" ")
				line.WriteString(cp.keyStyle.Render("[" + cmd.Key + "]"))
			}

			// Recent indicator
			if cp.isRecent(cmd.ID) {
				line.WriteString(cp.helpStyle.Render(" ⭐"))
			}

			// Description
			if cmd.Description != "" {
				line.WriteString(cp.helpStyle.Render(" - " + cmd.Description))
			}

			b.WriteString(style.Render(line.String()))
			b.WriteString("\n")
		}

		// Show scroll indicator
		if len(cp.filtered) > maxResults {
			b.WriteString("\n")
			b.WriteString(cp.helpStyle.Render(
				fmt.Sprintf("Showing %d-%d of %d", start+1, end, len(cp.filtered)),
			))
		}
	}

	// Help footer
	b.WriteString("\n\n")
	b.WriteString(cp.helpStyle.Render("↑/↓: Navigate • Enter: Execute • Esc: Close"))

	return cp.containerStyle.Render(b.String())
}

// updateFiltered filters and sorts commands based on search query and context
func (cp *CommandPalette) updateFiltered() {
	query := strings.TrimSpace(cp.textInput.Value())

	// Filter by context first
	contextFiltered := make([]CommandAction, 0)
	for _, cmd := range cp.commands {
		if cp.isAvailableInContext(cmd) {
			contextFiltered = append(contextFiltered, cmd)
		}
	}

	// If no query, show recent commands first, then all available commands
	if query == "" {
		recent := make([]CommandAction, 0)
		others := make([]CommandAction, 0)

		for _, cmd := range contextFiltered {
			if cp.isRecent(cmd.ID) {
				recent = append(recent, cmd)
			} else {
				others = append(others, cmd)
			}
		}

		// Sort recent by recency
		cp.sortByRecency(recent)

		cp.filtered = append(recent, others...)
		cp.selected = 0
		return
	}

	// Build search strings for each command
	type matchResult struct {
		cmd   CommandAction
		score int
	}

	matches := make([]matchResult, 0)

	for _, cmd := range contextFiltered {
		// Build searchable string: name + aliases + category
		searchStr := strings.ToLower(cmd.Name)
		for _, alias := range cmd.Aliases {
			searchStr += " " + strings.ToLower(alias)
		}
		searchStr += " " + strings.ToLower(cmd.Category)

		// Fuzzy match
		if fuzzyMatches := fuzzy.Find(query, []string{searchStr}); len(fuzzyMatches) > 0 {
			score := fuzzyMatches[0].Score
			// Boost recent commands
			if cp.isRecent(cmd.ID) {
				score += 100
			}
			matches = append(matches, matchResult{cmd: cmd, score: score})
		}
	}

	// Sort by score (descending)
	for i := 0; i < len(matches)-1; i++ {
		for j := i + 1; j < len(matches); j++ {
			if matches[j].score > matches[i].score {
				matches[i], matches[j] = matches[j], matches[i]
			}
		}
	}

	// Extract sorted commands
	cp.filtered = make([]CommandAction, len(matches))
	for i, m := range matches {
		cp.filtered[i] = m.cmd
	}

	// Reset selection
	if cp.selected >= len(cp.filtered) {
		cp.selected = 0
	}
}

// isAvailableInContext checks if a command is available in the current context
func (cp *CommandPalette) isAvailableInContext(cmd CommandAction) bool {
	// Commands with no context restrictions are always available
	if len(cmd.Context) == 0 {
		return true
	}

	// Check if any of the command's contexts match the current context
	for _, cmdCtx := range cmd.Context {
		for _, currentCtx := range cp.currentCtx {
			if cmdCtx == currentCtx {
				return true
			}
		}
	}

	return false
}

// isRecent checks if a command ID is in the recent list
func (cp *CommandPalette) isRecent(id string) bool {
	for _, recentID := range cp.recentIDs {
		if recentID == id {
			return true
		}
	}
	return false
}

// recordExecution adds a command to the recent list
func (cp *CommandPalette) recordExecution(id string) {
	// Remove if already in list
	filtered := make([]string, 0, len(cp.recentIDs))
	for _, rid := range cp.recentIDs {
		if rid != id {
			filtered = append(filtered, rid)
		}
	}

	// Prepend the new ID
	cp.recentIDs = append([]string{id}, filtered...)

	// Trim to max
	if len(cp.recentIDs) > cp.maxRecent {
		cp.recentIDs = cp.recentIDs[:cp.maxRecent]
	}

	cp.lastExecution = time.Now()
}

// sortByRecency sorts commands by their recency (most recent first)
func (cp *CommandPalette) sortByRecency(cmds []CommandAction) {
	recentMap := make(map[string]int)
	for i, id := range cp.recentIDs {
		recentMap[id] = len(cp.recentIDs) - i
	}

	for i := 0; i < len(cmds)-1; i++ {
		for j := i + 1; j < len(cmds); j++ {
			if recentMap[cmds[j].ID] > recentMap[cmds[i].ID] {
				cmds[i], cmds[j] = cmds[j], cmds[i]
			}
		}
	}
}
