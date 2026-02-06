package components

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// BreadcrumbSegment represents a single segment in the breadcrumb trail
type BreadcrumbSegment struct {
	Label     string
	IsCurrent bool
	Clickable bool
	Level     int // 0-based depth level
}

// Breadcrumb manages the navigation breadcrumb trail
type Breadcrumb struct {
	segments   []BreadcrumbSegment
	maxWidth   int
	separator  string
	currentIdx int
	styles     BreadcrumbStyles
}

// BreadcrumbStyles defines styling for breadcrumb components
type BreadcrumbStyles struct {
	CurrentSegment   lipgloss.Style
	ClickableSegment lipgloss.Style
	Separator        lipgloss.Style
	Container        lipgloss.Style
	Truncated        lipgloss.Style
}

// DefaultBreadcrumbStyles returns default styling for breadcrumbs
func DefaultBreadcrumbStyles(accentColor, mutedColor string) BreadcrumbStyles {
	if accentColor == "" {
		accentColor = "170"
	}
	if mutedColor == "" {
		mutedColor = "240"
	}

	return BreadcrumbStyles{
		CurrentSegment: lipgloss.NewStyle().
			Foreground(lipgloss.Color(accentColor)).
			Bold(true),
		ClickableSegment: lipgloss.NewStyle().
			Foreground(lipgloss.Color("15")),
		Separator: lipgloss.NewStyle().
			Foreground(lipgloss.Color(mutedColor)),
		Container: lipgloss.NewStyle().
			Padding(0, 1),
		Truncated: lipgloss.NewStyle().
			Foreground(lipgloss.Color(mutedColor)),
	}
}

// NewBreadcrumb creates a new breadcrumb component
func NewBreadcrumb(maxWidth int, styles BreadcrumbStyles) *Breadcrumb {
	return &Breadcrumb{
		segments:   []BreadcrumbSegment{},
		maxWidth:   maxWidth,
		separator:  " > ",
		currentIdx: -1,
		styles:     styles,
	}
}

// SetSegments replaces all segments with new ones
func (b *Breadcrumb) SetSegments(segments []BreadcrumbSegment) {
	b.segments = segments

	// Find current segment index
	b.currentIdx = -1
	for i, seg := range segments {
		if seg.IsCurrent {
			b.currentIdx = i
			break
		}
	}
}

// AddSegment appends a new segment to the trail
func (b *Breadcrumb) AddSegment(label string, isCurrent, clickable bool) {
	// Mark previous current as non-current
	for i := range b.segments {
		b.segments[i].IsCurrent = false
	}

	level := len(b.segments)
	segment := BreadcrumbSegment{
		Label:     label,
		IsCurrent: isCurrent,
		Clickable: clickable,
		Level:     level,
	}

	b.segments = append(b.segments, segment)

	if isCurrent {
		b.currentIdx = level
	}
}

// PopSegment removes the last segment from the trail
func (b *Breadcrumb) PopSegment() {
	if len(b.segments) == 0 {
		return
	}

	b.segments = b.segments[:len(b.segments)-1]

	// Update current index
	if len(b.segments) > 0 {
		b.currentIdx = len(b.segments) - 1
		b.segments[b.currentIdx].IsCurrent = true
	} else {
		b.currentIdx = -1
	}
}

// GetLevel returns the level (index) that should be navigated to when going up
func (b *Breadcrumb) GetLevel() int {
	if b.currentIdx <= 0 {
		return -1 // Cannot go up
	}
	return b.currentIdx - 1
}

// GetSegments returns all segments
func (b *Breadcrumb) GetSegments() []BreadcrumbSegment {
	return b.segments
}

// SetMaxWidth updates the maximum width for rendering
func (b *Breadcrumb) SetMaxWidth(width int) {
	b.maxWidth = width
}

// Render returns the breadcrumb trail as a string
func (b *Breadcrumb) Render() string {
	if len(b.segments) == 0 {
		return ""
	}

	// Build full breadcrumb string first
	parts := make([]string, 0, len(b.segments)*2-1)

	for i, seg := range b.segments {
		if i > 0 {
			parts = append(parts, b.styles.Separator.Render(b.separator))
		}

		var rendered string
		if seg.IsCurrent {
			rendered = b.styles.CurrentSegment.Render(seg.Label)
		} else if seg.Clickable {
			rendered = b.styles.ClickableSegment.Render(seg.Label)
		} else {
			rendered = b.styles.ClickableSegment.Render(seg.Label)
		}

		parts = append(parts, rendered)
	}

	fullBreadcrumb := strings.Join(parts, "")

	// Calculate actual width (accounting for ANSI codes)
	actualWidth := lipgloss.Width(fullBreadcrumb)

	// If it fits, return as-is
	if actualWidth <= b.maxWidth {
		return b.styles.Container.Render(fullBreadcrumb)
	}

	// Abbreviate middle segments if too long
	return b.styles.Container.Render(b.abbreviate())
}

// abbreviate shortens the breadcrumb trail to fit within maxWidth
func (b *Breadcrumb) abbreviate() string {
	if len(b.segments) <= 2 {
		// If 2 or fewer segments, just truncate labels if needed
		rendered := b.renderSegments(b.segments)
		if lipgloss.Width(rendered) > b.maxWidth {
			return b.truncateSegments(b.segments)
		}
		return rendered
	}

	// Strategy: Keep first, current, and last segments visible
	// Replace middle segments with "..."

	kept := []BreadcrumbSegment{}

	// Always keep first segment
	kept = append(kept, b.segments[0])

	// Determine if we need ellipsis
	needsEllipsis := false

	// If current is not adjacent to first or last, we need ellipsis
	if b.currentIdx > 1 && b.currentIdx < len(b.segments)-1 {
		needsEllipsis = true
	} else if len(b.segments) > 3 && (b.currentIdx == 0 || b.currentIdx == len(b.segments)-1) {
		// Current is first or last, but we have more than 3 segments
		needsEllipsis = true
	}

	if needsEllipsis {
		// Add ellipsis
		kept = append(kept, BreadcrumbSegment{
			Label:     "...",
			IsCurrent: false,
			Clickable: false,
			Level:     -1,
		})
	}

	// Keep current segment if not first or last
	if b.currentIdx > 0 && b.currentIdx < len(b.segments)-1 {
		kept = append(kept, b.segments[b.currentIdx])
	} else if !needsEllipsis && len(b.segments) == 3 {
		// Three segments total, show middle one
		kept = append(kept, b.segments[1])
	}

	// Always keep last segment if different from first
	lastIdx := len(b.segments) - 1
	if lastIdx > 0 {
		kept = append(kept, b.segments[lastIdx])
	}

	rendered := b.renderSegments(kept)
	actualWidth := lipgloss.Width(rendered)

	// If still too long, truncate segment labels
	if actualWidth > b.maxWidth {
		return b.truncateSegments(kept)
	}

	return rendered
}

// renderSegments renders a subset of segments
func (b *Breadcrumb) renderSegments(segments []BreadcrumbSegment) string {
	parts := make([]string, 0, len(segments)*2-1)

	for i, seg := range segments {
		if i > 0 {
			parts = append(parts, b.styles.Separator.Render(b.separator))
		}

		var rendered string
		if seg.Level == -1 {
			// Ellipsis
			rendered = b.styles.Truncated.Render(seg.Label)
		} else if seg.IsCurrent {
			rendered = b.styles.CurrentSegment.Render(seg.Label)
		} else {
			rendered = b.styles.ClickableSegment.Render(seg.Label)
		}

		parts = append(parts, rendered)
	}

	return strings.Join(parts, "")
}

// truncateSegments shortens individual segment labels to fit
func (b *Breadcrumb) truncateSegments(segments []BreadcrumbSegment) string {
	// Calculate available space per segment
	separatorSpace := len(b.separator) * (len(segments) - 1)
	availableSpace := b.maxWidth - separatorSpace

	if availableSpace <= 0 {
		return b.styles.Truncated.Render("...")
	}

	maxLabelLength := availableSpace / len(segments)
	if maxLabelLength < 3 {
		maxLabelLength = 3 // Minimum to show "..."
	}

	parts := make([]string, 0, len(segments)*2-1)

	for i, seg := range segments {
		if i > 0 {
			parts = append(parts, b.styles.Separator.Render(b.separator))
		}

		label := seg.Label
		if len(label) > maxLabelLength {
			label = label[:maxLabelLength-3] + "..."
		}

		var rendered string
		if seg.Level == -1 {
			// Ellipsis
			rendered = b.styles.Truncated.Render(label)
		} else if seg.IsCurrent {
			rendered = b.styles.CurrentSegment.Render(label)
		} else {
			rendered = b.styles.ClickableSegment.Render(label)
		}

		parts = append(parts, rendered)
	}

	return strings.Join(parts, "")
}

// Clear removes all segments
func (b *Breadcrumb) Clear() {
	b.segments = nil
	b.currentIdx = -1
}

// Depth returns the current depth of the breadcrumb trail
func (b *Breadcrumb) Depth() int {
	return len(b.segments)
}

// CurrentLevel returns the index of the current segment
func (b *Breadcrumb) CurrentLevel() int {
	return b.currentIdx
}

// Helper function to build breadcrumb path from navigation state
func BuildBreadcrumbPath(viewMode string, repoOwner, repoName string, prNumber int, prTitle string, detailMode string, fileName string) []BreadcrumbSegment {
	segments := []BreadcrumbSegment{}

	// Level 0: View mode (always present)
	viewLabel := formatViewMode(viewMode)
	segments = append(segments, BreadcrumbSegment{
		Label:     viewLabel,
		IsCurrent: prNumber == 0 && fileName == "",
		Clickable: true,
		Level:     0,
	})

	// Level 1: Repository (if applicable)
	if repoOwner != "" && repoName != "" {
		repoLabel := fmt.Sprintf("%s/%s", repoOwner, repoName)
		segments = append(segments, BreadcrumbSegment{
			Label:     repoLabel,
			IsCurrent: prNumber == 0 && fileName == "",
			Clickable: true,
			Level:     1,
		})
	}

	// Level 2: PR (if viewing a PR)
	if prNumber > 0 {
		prLabel := fmt.Sprintf("PR #%d", prNumber)
		if prTitle != "" && len(prTitle) > 30 {
			prLabel = fmt.Sprintf("PR #%d: %s...", prNumber, prTitle[:27])
		} else if prTitle != "" {
			prLabel = fmt.Sprintf("PR #%d: %s", prNumber, prTitle)
		}

		segments = append(segments, BreadcrumbSegment{
			Label:     prLabel,
			IsCurrent: fileName == "" && detailMode == "",
			Clickable: true,
			Level:     len(segments),
		})
	}

	// Level 3: Detail mode (Files/Comments/Timeline) if in detail view
	if detailMode != "" {
		segments = append(segments, BreadcrumbSegment{
			Label:     detailMode,
			IsCurrent: fileName == "",
			Clickable: true,
			Level:     len(segments),
		})
	}

	// Level 4: File name (if viewing a specific file)
	if fileName != "" {
		// Shorten file path if too long
		displayName := fileName
		if len(displayName) > 40 {
			parts := strings.Split(displayName, "/")
			if len(parts) > 2 {
				displayName = ".../" + strings.Join(parts[len(parts)-2:], "/")
			}
		}

		segments = append(segments, BreadcrumbSegment{
			Label:     displayName,
			IsCurrent: true,
			Clickable: false,
			Level:     len(segments),
		})
	}

	return segments
}

// formatViewMode converts internal view mode to display label
func formatViewMode(mode string) string {
	switch mode {
	case "my_prs":
		return "My PRs"
	case "review_requests":
		return "Review Requests"
	case "assigned_to_me":
		return "Assigned to Me"
	case "current_repo":
		return "Current Repo"
	case "workspaces":
		return "Workspaces"
	case "workspace":
		return "Workspace"
	case "dashboard":
		return "Dashboard"
	case "repo_selector":
		return "Repos"
	default:
		return "LazyReview"
	}
}
