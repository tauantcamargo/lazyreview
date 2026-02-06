package components

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// SkeletonStyles holds styling for skeleton components
type SkeletonStyles struct {
	Loading lipgloss.Style
	Stale   lipgloss.Style
	Error   lipgloss.Style
}

// DefaultSkeletonStyles returns default skeleton styles
func DefaultSkeletonStyles() SkeletonStyles {
	return SkeletonStyles{
		Loading: lipgloss.NewStyle().
			Foreground(lipgloss.Color("240")).
			Background(lipgloss.Color("235")),
		Stale: lipgloss.NewStyle().
			Foreground(lipgloss.Color("220")).
			Background(lipgloss.Color("235")),
		Error: lipgloss.NewStyle().
			Foreground(lipgloss.Color("196")).
			Background(lipgloss.Color("235")),
	}
}

// Skeleton is a placeholder UI component for loading states
type Skeleton struct {
	width   int
	height  int
	styles  SkeletonStyles
	state   LoadState
	message string
}

// NewSkeleton creates a new skeleton component
func NewSkeleton(width, height int, state LoadState) Skeleton {
	return Skeleton{
		width:  width,
		height: height,
		styles: DefaultSkeletonStyles(),
		state:  state,
	}
}

// WithMessage sets a custom message for the skeleton
func (s Skeleton) WithMessage(message string) Skeleton {
	s.message = message
	return s
}

// WithStyles sets custom styles for the skeleton
func (s Skeleton) WithStyles(styles SkeletonStyles) Skeleton {
	s.styles = styles
	return s
}

// View renders the skeleton
func (s Skeleton) View() string {
	switch s.state {
	case StateLoading:
		return s.renderLoading()
	case StateStale:
		return s.renderStale()
	case StateError:
		return s.renderError()
	default:
		return s.renderEmpty()
	}
}

// renderLoading renders a loading skeleton
func (s Skeleton) renderLoading() string {
	var b strings.Builder

	message := s.message
	if message == "" {
		message = "Loading..."
	}

	// Animated loading indicator
	indicator := s.styles.Loading.Render("▓▓▓░░░")
	b.WriteString(indicator)
	b.WriteString(" ")
	b.WriteString(s.styles.Loading.Render(message))
	b.WriteString("\n")

	// Render skeleton lines
	for i := 1; i < s.height; i++ {
		b.WriteString(s.renderSkeletonLine(s.width - 2))
		if i < s.height-1 {
			b.WriteString("\n")
		}
	}

	return b.String()
}

// renderStale renders a stale data indicator
func (s Skeleton) renderStale() string {
	message := s.message
	if message == "" {
		message = "⟳ Refreshing..."
	}

	indicator := s.styles.Stale.Render("⚠")
	return indicator + " " + s.styles.Stale.Render(message)
}

// renderError renders an error state
func (s Skeleton) renderError() string {
	message := s.message
	if message == "" {
		message = "Failed to load"
	}

	indicator := s.styles.Error.Render("✗")
	return indicator + " " + s.styles.Error.Render(message)
}

// renderEmpty renders an empty state
func (s Skeleton) renderEmpty() string {
	return s.styles.Loading.Render("No data")
}

// renderSkeletonLine renders a single skeleton line
func (s Skeleton) renderSkeletonLine(width int) string {
	if width <= 0 {
		return ""
	}

	// Create varied skeleton line patterns
	pattern := strings.Repeat("▓", width/3) +
		strings.Repeat("░", width/6) +
		strings.Repeat("▓", width/4) +
		strings.Repeat("░", width-width/3-width/6-width/4)

	return s.styles.Loading.Render(pattern)
}

// SkeletonListItem renders a skeleton for a list item
type SkeletonListItem struct {
	width  int
	styles SkeletonStyles
	state  LoadState
}

// NewSkeletonListItem creates a new skeleton list item
func NewSkeletonListItem(width int, state LoadState) SkeletonListItem {
	return SkeletonListItem{
		width:  width,
		styles: DefaultSkeletonStyles(),
		state:  state,
	}
}

// View renders the skeleton list item
func (s SkeletonListItem) View() string {
	switch s.state {
	case StateLoading:
		return s.renderLoadingItem()
	case StateStale:
		return s.renderStaleItem()
	case StateError:
		return s.renderErrorItem()
	default:
		return ""
	}
}

// renderLoadingItem renders a loading list item
func (s SkeletonListItem) renderLoadingItem() string {
	var b strings.Builder

	// Title line
	titleWidth := s.width * 2 / 3
	title := strings.Repeat("▓", titleWidth) + strings.Repeat("░", s.width-titleWidth)
	b.WriteString(s.styles.Loading.Render(title))
	b.WriteString("\n")

	// Description line
	descWidth := s.width / 2
	desc := "  " + strings.Repeat("░", descWidth)
	b.WriteString(s.styles.Loading.Render(desc))

	return b.String()
}

// renderStaleItem renders a stale list item indicator
func (s SkeletonListItem) renderStaleItem() string {
	indicator := s.styles.Stale.Render("⟳")
	return indicator + " " + s.styles.Stale.Render("Refreshing...")
}

// renderErrorItem renders an error list item
func (s SkeletonListItem) renderErrorItem() string {
	indicator := s.styles.Error.Render("✗")
	return indicator + " " + s.styles.Error.Render("Failed to load")
}

// SkeletonDiff renders a skeleton for diff viewer
type SkeletonDiff struct {
	width  int
	height int
	styles SkeletonStyles
}

// NewSkeletonDiff creates a new skeleton diff
func NewSkeletonDiff(width, height int) SkeletonDiff {
	return SkeletonDiff{
		width:  width,
		height: height,
		styles: DefaultSkeletonStyles(),
	}
}

// View renders the skeleton diff
func (s SkeletonDiff) View() string {
	var b strings.Builder

	// Header
	header := s.styles.Loading.Render(strings.Repeat("▓", s.width))
	b.WriteString(header)
	b.WriteString("\n")

	// Diff lines with varied patterns
	for i := 1; i < s.height; i++ {
		line := s.renderDiffLine(i)
		b.WriteString(line)
		if i < s.height-1 {
			b.WriteString("\n")
		}
	}

	return b.String()
}

// renderDiffLine renders a single diff skeleton line
func (s SkeletonDiff) renderDiffLine(lineNum int) string {
	// Vary the pattern based on line number
	switch lineNum % 4 {
	case 0:
		// Addition line
		return s.styles.Loading.Render("+ " + strings.Repeat("▓", s.width-2))
	case 1:
		// Deletion line
		return s.styles.Loading.Render("- " + strings.Repeat("░", s.width-2))
	case 2:
		// Context line
		return s.styles.Loading.Render("  " + strings.Repeat("░", s.width-2))
	default:
		// Context line
		return s.styles.Loading.Render("  " + strings.Repeat("▓", s.width/2) + strings.Repeat("░", s.width-s.width/2-2))
	}
}

// SkeletonFileTree renders a skeleton for file tree
type SkeletonFileTree struct {
	width  int
	height int
	styles SkeletonStyles
}

// NewSkeletonFileTree creates a new skeleton file tree
func NewSkeletonFileTree(width, height int) SkeletonFileTree {
	return SkeletonFileTree{
		width:  width,
		height: height,
		styles: DefaultSkeletonStyles(),
	}
}

// View renders the skeleton file tree
func (s SkeletonFileTree) View() string {
	var b strings.Builder

	// Header
	b.WriteString(s.styles.Loading.Render("Files"))
	b.WriteString("\n")

	// File entries with indentation
	for i := 1; i < s.height && i < 10; i++ {
		indent := (i % 3) * 2 // Vary indentation
		line := strings.Repeat(" ", indent) + "└─ " + strings.Repeat("▓", s.width-indent-3)
		b.WriteString(s.styles.Loading.Render(line))
		if i < s.height-1 {
			b.WriteString("\n")
		}
	}

	return b.String()
}

// LoadingIndicator is a simple animated loading indicator
type LoadingIndicator struct {
	frames []string
	frame  int
	style  lipgloss.Style
}

// NewLoadingIndicator creates a new loading indicator
func NewLoadingIndicator() LoadingIndicator {
	return LoadingIndicator{
		frames: []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"},
		frame:  0,
		style: lipgloss.NewStyle().
			Foreground(lipgloss.Color("170")),
	}
}

// WithFrames sets custom animation frames
func (li LoadingIndicator) WithFrames(frames []string) LoadingIndicator {
	li.frames = frames
	return li
}

// WithStyle sets custom style
func (li LoadingIndicator) WithStyle(style lipgloss.Style) LoadingIndicator {
	li.style = style
	return li
}

// Next advances to the next frame
func (li *LoadingIndicator) Next() {
	li.frame = (li.frame + 1) % len(li.frames)
}

// View renders the current frame
func (li LoadingIndicator) View() string {
	return li.style.Render(li.frames[li.frame])
}

// StaleIndicator renders an indicator for stale data
type StaleIndicator struct {
	style lipgloss.Style
}

// NewStaleIndicator creates a new stale indicator
func NewStaleIndicator() StaleIndicator {
	return StaleIndicator{
		style: lipgloss.NewStyle().
			Foreground(lipgloss.Color("220")).
			Bold(true),
	}
}

// View renders the stale indicator
func (si StaleIndicator) View() string {
	return si.style.Render("⟳")
}

// ErrorIndicator renders an indicator for errors
type ErrorIndicator struct {
	style   lipgloss.Style
	message string
}

// NewErrorIndicator creates a new error indicator
func NewErrorIndicator(message string) ErrorIndicator {
	return ErrorIndicator{
		message: message,
		style: lipgloss.NewStyle().
			Foreground(lipgloss.Color("196")).
			Bold(true),
	}
}

// View renders the error indicator
func (ei ErrorIndicator) View() string {
	indicator := ei.style.Render("✗")
	if ei.message != "" {
		return indicator + " " + ei.style.Render(ei.message)
	}
	return indicator
}
