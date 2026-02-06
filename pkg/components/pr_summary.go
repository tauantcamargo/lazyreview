package components

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// PRSummary represents an AI-generated PR summary.
type PRSummary struct {
	Purpose        string
	KeyChanges     []string
	RiskAssessment RiskLevel
	RiskDetails    string
	IsLoading      bool
	IsEmpty        bool
	Error          string
}

// RiskLevel represents the risk assessment level.
type RiskLevel int

const (
	RiskLow RiskLevel = iota
	RiskMedium
	RiskHigh
)

// String returns the emoji representation of the risk level.
func (r RiskLevel) String() string {
	switch r {
	case RiskLow:
		return "🟢 Low"
	case RiskMedium:
		return "🟡 Medium"
	case RiskHigh:
		return "🔴 High"
	default:
		return "⚪ Unknown"
	}
}

// RiskColor returns the color for the risk level.
func (r RiskLevel) RiskColor() lipgloss.AdaptiveColor {
	switch r {
	case RiskLow:
		return lipgloss.AdaptiveColor{Light: "#22c55e", Dark: "#22c55e"}
	case RiskMedium:
		return lipgloss.AdaptiveColor{Light: "#eab308", Dark: "#eab308"}
	case RiskHigh:
		return lipgloss.AdaptiveColor{Light: "#ef4444", Dark: "#ef4444"}
	default:
		return lipgloss.AdaptiveColor{Light: "#6b7280", Dark: "#6b7280"}
	}
}

// PRSummaryStyles holds styling for the PR summary component.
type PRSummaryStyles struct {
	Container     lipgloss.Style
	Title         lipgloss.Style
	SectionHeader lipgloss.Style
	ListItem      lipgloss.Style
	RiskBadge     lipgloss.Style
	LoadingText   lipgloss.Style
	ErrorText     lipgloss.Style
	EmptyText     lipgloss.Style
}

// DefaultPRSummaryStyles returns default styles for the PR summary.
func DefaultPRSummaryStyles() PRSummaryStyles {
	return PRSummaryStyles{
		Container: lipgloss.NewStyle().
			Padding(1, 2).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.AdaptiveColor{Light: "#d1d5db", Dark: "#374151"}),
		Title: lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.AdaptiveColor{Light: "#1f2937", Dark: "#f9fafb"}).
			MarginBottom(1),
		SectionHeader: lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.AdaptiveColor{Light: "#4b5563", Dark: "#d1d5db"}).
			MarginTop(1).
			MarginBottom(0),
		ListItem: lipgloss.NewStyle().
			Foreground(lipgloss.AdaptiveColor{Light: "#374151", Dark: "#e5e7eb"}).
			PaddingLeft(2),
		RiskBadge: lipgloss.NewStyle().
			Bold(true).
			Padding(0, 1).
			MarginTop(1),
		LoadingText: lipgloss.NewStyle().
			Foreground(lipgloss.AdaptiveColor{Light: "#6b7280", Dark: "#9ca3af"}).
			Italic(true),
		ErrorText: lipgloss.NewStyle().
			Foreground(lipgloss.AdaptiveColor{Light: "#dc2626", Dark: "#f87171"}),
		EmptyText: lipgloss.NewStyle().
			Foreground(lipgloss.AdaptiveColor{Light: "#9ca3af", Dark: "#6b7280"}).
			Italic(true),
	}
}

// Render renders the PR summary component.
func (s *PRSummary) Render(width int, styles PRSummaryStyles) string {
	if s.IsLoading {
		return styles.Container.Width(width - 4).Render(
			styles.LoadingText.Render("⏳ Generating AI summary..."),
		)
	}

	if s.Error != "" {
		return styles.Container.Width(width - 4).Render(
			styles.ErrorText.Render(fmt.Sprintf("Error: %s", s.Error)),
		)
	}

	if s.IsEmpty {
		return styles.Container.Width(width - 4).Render(
			styles.EmptyText.Render("No summary available. Press 'S' to generate."),
		)
	}

	var content strings.Builder

	// Title
	content.WriteString(styles.Title.Render("📋 PR Summary"))
	content.WriteString("\n\n")

	// Purpose
	if s.Purpose != "" {
		content.WriteString(styles.SectionHeader.Render("## Purpose"))
		content.WriteString("\n")
		content.WriteString(styles.ListItem.Render(s.Purpose))
		content.WriteString("\n")
	}

	// Key Changes
	if len(s.KeyChanges) > 0 {
		content.WriteString(styles.SectionHeader.Render("## Key Changes"))
		content.WriteString("\n")
		for _, change := range s.KeyChanges {
			content.WriteString(styles.ListItem.Render("• " + change))
			content.WriteString("\n")
		}
	}

	// Risk Assessment
	content.WriteString(styles.SectionHeader.Render("## Risk Assessment"))
	content.WriteString("\n")
	riskStyle := styles.RiskBadge.Copy().
		Foreground(s.RiskAssessment.RiskColor())
	content.WriteString(riskStyle.Render(s.RiskAssessment.String()))
	if s.RiskDetails != "" {
		content.WriteString("\n")
		content.WriteString(styles.ListItem.Render(s.RiskDetails))
	}

	return styles.Container.Width(width - 4).Render(content.String())
}

// ParseSummaryResponse parses an AI-generated summary response into structured data.
func ParseSummaryResponse(response string) *PRSummary {
	summary := &PRSummary{
		KeyChanges: make([]string, 0),
		IsEmpty:    false,
	}

	lines := strings.Split(response, "\n")
	currentSection := ""

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Detect sections
		if strings.HasPrefix(line, "## Purpose") || strings.HasPrefix(line, "**Purpose") {
			currentSection = "purpose"
			continue
		}
		if strings.HasPrefix(line, "## Key Changes") || strings.HasPrefix(line, "**Key Changes") {
			currentSection = "changes"
			continue
		}
		if strings.HasPrefix(line, "## Risk Assessment") || strings.HasPrefix(line, "**Risk Assessment") {
			currentSection = "risk"
			continue
		}

		// Parse content based on section
		switch currentSection {
		case "purpose":
			if summary.Purpose == "" {
				summary.Purpose = line
			} else {
				summary.Purpose += " " + line
			}
		case "changes":
			// Remove markdown list markers
			line = strings.TrimPrefix(line, "- ")
			line = strings.TrimPrefix(line, "* ")
			line = strings.TrimPrefix(line, "• ")
			if line != "" {
				summary.KeyChanges = append(summary.KeyChanges, line)
			}
		case "risk":
			// Parse risk level from emoji or text
			isRiskLevel := false
			if strings.Contains(line, "🟢") || (strings.HasPrefix(line, "Low") && !strings.Contains(line, " ")) {
				summary.RiskAssessment = RiskLow
				isRiskLevel = true
			} else if strings.Contains(line, "🟡") || (strings.HasPrefix(line, "Medium") && !strings.Contains(line, " ")) {
				summary.RiskAssessment = RiskMedium
				isRiskLevel = true
			} else if strings.Contains(line, "🔴") || (strings.HasPrefix(line, "High") && !strings.Contains(line, " ")) {
				summary.RiskAssessment = RiskHigh
				isRiskLevel = true
			}

			// Extract risk details (text after the level)
			if !isRiskLevel {
				if summary.RiskDetails == "" {
					summary.RiskDetails = line
				} else {
					summary.RiskDetails += " " + line
				}
			}
		}
	}

	return summary
}

// NewPRSummary creates a new empty PR summary.
func NewPRSummary() *PRSummary {
	return &PRSummary{
		KeyChanges:     make([]string, 0),
		IsEmpty:        true,
		RiskAssessment: RiskLow,
	}
}

// NewLoadingPRSummary creates a new loading PR summary.
func NewLoadingPRSummary() *PRSummary {
	return &PRSummary{
		KeyChanges: make([]string, 0),
		IsLoading:  true,
	}
}

// NewErrorPRSummary creates a new error PR summary.
func NewErrorPRSummary(err string) *PRSummary {
	return &PRSummary{
		KeyChanges: make([]string, 0),
		Error:      err,
	}
}
