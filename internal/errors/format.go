package errors

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// FormatTUI returns the error formatted beautifully for TUI display with box rendering.
func (e *ActionableError) FormatTUI() string {
	return e.FormatTUIWithTheme("196", "81", "240")
}

// FormatTUIWithTheme formats the error with custom theme colors (ANSI 256 color codes).
func (e *ActionableError) FormatTUIWithTheme(errorColor, accentColor, mutedColor string) string {
	var content strings.Builder

	// Get registry entry for additional details
	var entry *RegistryEntry
	if e.Code != "" {
		entry = GetRegistryEntry(e.Code)
	}

	// Error code and title
	if e.Code != "" {
		title := string(e.Code)
		if entry != nil {
			title = fmt.Sprintf("%s - %s", e.Code, entry.Title)
		}

		titleStyle := lipgloss.NewStyle().
			Foreground(lipgloss.Color(errorColor)).
			Bold(true)

		content.WriteString(titleStyle.Render(title))
		content.WriteString("\n\n")
	}

	// Error message
	messageStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("252"))

	content.WriteString(messageStyle.Render(e.Message))

	// Underlying error details
	if e.Err != nil {
		content.WriteString("\n\n")

		detailsLabel := lipgloss.NewStyle().
			Foreground(lipgloss.Color(mutedColor)).
			Render("Details:")

		content.WriteString(detailsLabel)
		content.WriteString(" ")
		content.WriteString(e.Err.Error())
	}

	// Description from registry
	if entry != nil && entry.Description != "" {
		content.WriteString("\n\n")

		descStyle := lipgloss.NewStyle().
			Foreground(lipgloss.Color(mutedColor)).
			Italic(true)

		content.WriteString(descStyle.Render(entry.Description))
	}

	// Suggestions (context-aware)
	suggestions := e.GetContextualSuggestions()
	if len(suggestions) > 0 {
		content.WriteString("\n\n")

		headerStyle := lipgloss.NewStyle().
			Foreground(lipgloss.Color(accentColor)).
			Bold(true)

		content.WriteString(headerStyle.Render("How to fix:"))
		content.WriteString("\n")

		for i, suggestion := range suggestions {
			suggestionStyle := lipgloss.NewStyle().
				Foreground(lipgloss.Color("252")).
				PaddingLeft(2)

			line := fmt.Sprintf("%d. %s", i+1, suggestion)
			content.WriteString(suggestionStyle.Render(line))
			content.WriteString("\n")
		}
	}

	// Help URL
	helpURL := e.HelpURL
	if helpURL == "" && entry != nil {
		helpURL = entry.HelpURL
	}

	if helpURL != "" {
		content.WriteString("\n")

		helpStyle := lipgloss.NewStyle().
			Foreground(lipgloss.Color(accentColor))

		label := lipgloss.NewStyle().
			Foreground(lipgloss.Color(mutedColor)).
			Render("For more help:")

		content.WriteString(label)
		content.WriteString(" ")
		content.WriteString(helpStyle.Render(helpURL))
	}

	// Render in a box
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color(errorColor)).
		Padding(1, 2).
		Width(80)

	return boxStyle.Render(content.String())
}

// FormatCompact returns a compact single-line error format (for status bars).
func (e *ActionableError) FormatCompact() string {
	var sb strings.Builder

	if e.Code != "" {
		sb.WriteString("[")
		sb.WriteString(string(e.Code))
		sb.WriteString("] ")
	}

	sb.WriteString(e.Message)

	if e.Err != nil {
		sb.WriteString(": ")
		sb.WriteString(e.Err.Error())
	}

	return sb.String()
}

// FormatMarkdown returns the error formatted in markdown (for documentation/logs).
func (e *ActionableError) FormatMarkdown() string {
	var sb strings.Builder

	// Get registry entry
	var entry *RegistryEntry
	if e.Code != "" {
		entry = GetRegistryEntry(e.Code)
	}

	// Title
	if e.Code != "" {
		title := string(e.Code)
		if entry != nil {
			title = fmt.Sprintf("%s - %s", e.Code, entry.Title)
		}
		sb.WriteString("## ")
		sb.WriteString(title)
		sb.WriteString("\n\n")
	}

	// Error message
	sb.WriteString("**Error:** ")
	sb.WriteString(e.Message)
	sb.WriteString("\n\n")

	// Details
	if e.Err != nil {
		sb.WriteString("**Details:** ")
		sb.WriteString(e.Err.Error())
		sb.WriteString("\n\n")
	}

	// Description
	if entry != nil && entry.Description != "" {
		sb.WriteString("*")
		sb.WriteString(entry.Description)
		sb.WriteString("*\n\n")
	}

	// Suggestions
	suggestions := e.GetContextualSuggestions()
	if len(suggestions) > 0 {
		sb.WriteString("### How to fix\n\n")
		for i, suggestion := range suggestions {
			sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, suggestion))
		}
		sb.WriteString("\n")
	}

	// Help URL
	helpURL := e.HelpURL
	if helpURL == "" && entry != nil {
		helpURL = entry.HelpURL
	}

	if helpURL != "" {
		sb.WriteString("For more help: ")
		sb.WriteString(helpURL)
		sb.WriteString("\n")
	}

	return sb.String()
}
