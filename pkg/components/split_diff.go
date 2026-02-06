package components

import (
	"fmt"
	"strings"

	"lazyreview/internal/models"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

const (
	minSplitRatio = 0.2
	maxSplitRatio = 0.8
)

// SplitDiffKeyMap defines keybindings for the split diff viewer
type SplitDiffKeyMap struct {
	Up            key.Binding
	Down          key.Binding
	Left          key.Binding
	Right         key.Binding
	PageUp        key.Binding
	PageDown      key.Binding
	HalfUp        key.Binding
	HalfDown      key.Binding
	Top           key.Binding
	Bottom        key.Binding
	NextFile      key.Binding
	PrevFile      key.Binding
	NextHunk      key.Binding
	PrevHunk      key.Binding
	IncreaseSplit key.Binding
	DecreaseSplit key.Binding
	ScrollLeft    key.Binding
	ScrollRight   key.Binding
}

// DefaultSplitDiffKeyMap returns default keybindings for split diff view.
func DefaultSplitDiffKeyMap(vimMode bool) SplitDiffKeyMap {
	if !vimMode {
		return SplitDiffKeyMap{
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
				key.WithHelp("←", "scroll left"),
			),
			Right: key.NewBinding(
				key.WithKeys("right"),
				key.WithHelp("→", "scroll right"),
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
				key.WithHelp("ctrl+u", "half up"),
			),
			HalfDown: key.NewBinding(
				key.WithKeys("ctrl+d"),
				key.WithHelp("ctrl+d", "half down"),
			),
			Top: key.NewBinding(
				key.WithKeys("home"),
				key.WithHelp("home", "top"),
			),
			Bottom: key.NewBinding(
				key.WithKeys("end"),
				key.WithHelp("end", "bottom"),
			),
			NextFile: key.NewBinding(
				key.WithKeys("n", "]"),
				key.WithHelp("n/]", "next file"),
			),
			PrevFile: key.NewBinding(
				key.WithKeys("N", "["),
				key.WithHelp("N/[", "prev file"),
			),
			NextHunk: key.NewBinding(
				key.WithKeys("}"),
				key.WithHelp("}", "next hunk"),
			),
			PrevHunk: key.NewBinding(
				key.WithKeys("{"),
				key.WithHelp("{", "prev hunk"),
			),
			IncreaseSplit: key.NewBinding(
				key.WithKeys(">"),
				key.WithHelp(">", "increase left pane"),
			),
			DecreaseSplit: key.NewBinding(
				key.WithKeys("<"),
				key.WithHelp("<", "decrease left pane"),
			),
			ScrollLeft: key.NewBinding(
				key.WithKeys("shift+left"),
				key.WithHelp("shift+←", "scroll left"),
			),
			ScrollRight: key.NewBinding(
				key.WithKeys("shift+right"),
				key.WithHelp("shift+→", "scroll right"),
			),
		}
	}
	return SplitDiffKeyMap{
		Up: key.NewBinding(
			key.WithKeys("k", "up"),
			key.WithHelp("k/↑", "up"),
		),
		Down: key.NewBinding(
			key.WithKeys("j", "down"),
			key.WithHelp("j/↓", "down"),
		),
		Left: key.NewBinding(
			key.WithKeys("h"),
			key.WithHelp("h", "scroll left"),
		),
		Right: key.NewBinding(
			key.WithKeys("l"),
			key.WithHelp("l", "scroll right"),
		),
		PageUp: key.NewBinding(
			key.WithKeys("b", "pgup"),
			key.WithHelp("b", "page up"),
		),
		PageDown: key.NewBinding(
			key.WithKeys("f", "pgdown"),
			key.WithHelp("f", "page down"),
		),
		HalfUp: key.NewBinding(
			key.WithKeys("ctrl+u"),
			key.WithHelp("ctrl+u", "half up"),
		),
		HalfDown: key.NewBinding(
			key.WithKeys("ctrl+d"),
			key.WithHelp("ctrl+d", "half down"),
		),
		Top: key.NewBinding(
			key.WithKeys("g"),
			key.WithHelp("g", "top"),
		),
		Bottom: key.NewBinding(
			key.WithKeys("G"),
			key.WithHelp("G", "bottom"),
		),
		NextFile: key.NewBinding(
			key.WithKeys("n", "]"),
			key.WithHelp("n/]", "next file"),
		),
		PrevFile: key.NewBinding(
			key.WithKeys("N", "["),
			key.WithHelp("N/[", "prev file"),
		),
		NextHunk: key.NewBinding(
			key.WithKeys("}"),
			key.WithHelp("}", "next hunk"),
		),
		PrevHunk: key.NewBinding(
			key.WithKeys("{"),
			key.WithHelp("{", "prev hunk"),
		),
		IncreaseSplit: key.NewBinding(
			key.WithKeys(">"),
			key.WithHelp(">", "increase left pane"),
		),
		DecreaseSplit: key.NewBinding(
			key.WithKeys("<"),
			key.WithHelp("<", "decrease left pane"),
		),
		ScrollLeft: key.NewBinding(
			key.WithKeys("H"),
			key.WithHelp("H", "scroll left"),
		),
		ScrollRight: key.NewBinding(
			key.WithKeys("L"),
			key.WithHelp("L", "scroll right"),
		),
	}
}

// linePair represents a pair of lines from old and new versions
type linePair struct {
	left  *models.DiffLine // Old/deleted line
	right *models.DiffLine // New/added line
}

// SplitDiffViewer is a component for viewing diffs in split (side-by-side) mode
type SplitDiffViewer struct {
	leftViewport  viewport.Model
	rightViewport viewport.Model
	diff          *models.Diff
	files         []models.FileDiff
	currentFile   int
	cursor        int
	keyMap        SplitDiffKeyMap
	width         int
	height        int
	splitRatio    float64 // Ratio of left pane width (0.0-1.0)
	highlighter   *Highlighter
	linePairs     []linePair
	hunkPositions []int // Line offsets where each hunk starts
	filePositions []int // Line offsets where each file starts

	// Horizontal scrolling
	horizontalOffset int

	// Styles
	addedStyle   lipgloss.Style
	deletedStyle lipgloss.Style
	contextStyle lipgloss.Style
	hunkStyle    lipgloss.Style
	lineNoStyle  lipgloss.Style
	fileStyle    lipgloss.Style
	cursorStyle  lipgloss.Style
	borderStyle  lipgloss.Style
}

// NewSplitDiffViewer creates a new split diff viewer
func NewSplitDiffViewer(width, height int) SplitDiffViewer {
	splitRatio := 0.5
	leftWidth := int(float64(width-3) * splitRatio) // -3 for separator and padding
	rightWidth := width - leftWidth - 3

	leftVP := viewport.New(leftWidth, height)
	rightVP := viewport.New(rightWidth, height)

	return SplitDiffViewer{
		leftViewport:     leftVP,
		rightViewport:    rightVP,
		keyMap:           DefaultSplitDiffKeyMap(true),
		width:            width,
		height:           height,
		splitRatio:       splitRatio,
		highlighter:      NewHighlighter(),
		horizontalOffset: 0,
		addedStyle:       lipgloss.NewStyle().Foreground(lipgloss.Color("42")),
		deletedStyle:     lipgloss.NewStyle().Foreground(lipgloss.Color("196")),
		contextStyle:     lipgloss.NewStyle().Foreground(lipgloss.Color("252")),
		hunkStyle:        lipgloss.NewStyle().Foreground(lipgloss.Color("39")),
		lineNoStyle:      lipgloss.NewStyle().Foreground(lipgloss.Color("240")),
		fileStyle:        lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("170")),
		cursorStyle:      lipgloss.NewStyle().Background(lipgloss.Color("236")),
		borderStyle:      lipgloss.NewStyle().Foreground(lipgloss.Color("240")),
	}
}

// SetVimMode toggles vim-style navigation keys.
func (s *SplitDiffViewer) SetVimMode(enabled bool) {
	s.keyMap = DefaultSplitDiffKeyMap(enabled)
}

// SetDiff sets the diff to display
func (s *SplitDiffViewer) SetDiff(diff *models.Diff) {
	s.diff = diff
	if diff != nil {
		s.files = diff.Files
	} else {
		s.files = nil
	}
	s.currentFile = 0
	s.cursor = 0
	s.horizontalOffset = 0
	s.render()
}

// pairLines creates pairs of old/new lines for side-by-side display
func (s *SplitDiffViewer) pairLines(lines []models.DiffLine) []linePair {
	var pairs []linePair
	var pendingDeletes []models.DiffLine
	var pendingAdds []models.DiffLine

	for i := 0; i < len(lines); i++ {
		line := lines[i]

		switch line.Type {
		case models.DiffLineContext:
			// Flush any pending changes first
			s.flushPendingChanges(&pairs, &pendingDeletes, &pendingAdds)

			// Context lines appear on both sides
			pairs = append(pairs, linePair{left: &line, right: &line})

		case models.DiffLineDeleted:
			// Collect deletes
			pendingDeletes = append(pendingDeletes, line)

		case models.DiffLineAdded:
			// Collect adds
			pendingAdds = append(pendingAdds, line)
		}
	}

	// Flush any remaining changes
	s.flushPendingChanges(&pairs, &pendingDeletes, &pendingAdds)

	return pairs
}

// flushPendingChanges pairs pending deletes and adds, handling mismatches
func (s *SplitDiffViewer) flushPendingChanges(pairs *[]linePair, deletes *[]models.DiffLine, adds *[]models.DiffLine) {
	// Pair as many as possible
	maxPairs := len(*deletes)
	if len(*adds) > maxPairs {
		maxPairs = len(*adds)
	}

	for i := 0; i < maxPairs; i++ {
		var left, right *models.DiffLine

		if i < len(*deletes) {
			del := (*deletes)[i]
			left = &del
		}

		if i < len(*adds) {
			add := (*adds)[i]
			right = &add
		}

		*pairs = append(*pairs, linePair{left: left, right: right})
	}

	// Clear the slices
	*deletes = nil
	*adds = nil
}

// render generates the split view content
func (s *SplitDiffViewer) render() {
	if s.diff == nil || len(s.files) == 0 {
		s.leftViewport.SetContent("No diff to display")
		s.rightViewport.SetContent("")
		s.linePairs = nil
		s.hunkPositions = nil
		s.filePositions = nil
		return
	}

	var leftContent, rightContent strings.Builder
	var allPairs []linePair
	var hunkPositions []int
	var filePositions []int
	currentLine := 0

	for fileIdx, file := range s.files {
		filePositions = append(filePositions, currentLine)

		// File header (full width on both sides)
		header := s.renderFileHeader(file, fileIdx == s.currentFile)
		leftContent.WriteString(header)
		leftContent.WriteString("\n")
		rightContent.WriteString(header)
		rightContent.WriteString("\n")
		allPairs = append(allPairs, linePair{}) // Empty pair for header
		currentLine++

		filename := file.Path
		if filename == "" {
			filename = file.OldPath
		}

		// Render hunks
		for _, hunk := range file.Hunks {
			hunkPositions = append(hunkPositions, currentLine)

			// Hunk header on both sides
			hunkHeader := s.hunkStyle.Render(hunk.Header)
			leftContent.WriteString(hunkHeader)
			leftContent.WriteString("\n")
			rightContent.WriteString(hunkHeader)
			rightContent.WriteString("\n")
			allPairs = append(allPairs, linePair{}) // Empty pair for hunk header
			currentLine++

			// Pair and render lines
			pairs := s.pairLines(hunk.Lines)
			for _, pair := range pairs {
				leftLine := s.renderSideLine(pair.left, filename, true)
				rightLine := s.renderSideLine(pair.right, filename, false)

				leftContent.WriteString(leftLine)
				leftContent.WriteString("\n")
				rightContent.WriteString(rightLine)
				rightContent.WriteString("\n")

				allPairs = append(allPairs, pair)
				currentLine++
			}
		}

		// Empty line between files
		leftContent.WriteString("\n")
		rightContent.WriteString("\n")
		allPairs = append(allPairs, linePair{})
		currentLine++
	}

	s.linePairs = allPairs
	s.hunkPositions = hunkPositions
	s.filePositions = filePositions
	s.leftViewport.SetContent(leftContent.String())
	s.rightViewport.SetContent(rightContent.String())

	// Ensure synchronized scroll
	s.syncScroll()
}

// renderFileHeader renders a file header
func (s *SplitDiffViewer) renderFileHeader(file models.FileDiff, selected bool) string {
	icon := "M"
	switch file.Status {
	case models.FileStatusAdded:
		icon = "A"
	case models.FileStatusDeleted:
		icon = "D"
	case models.FileStatusRenamed:
		icon = "R"
	}

	stats := fmt.Sprintf("+%d -%d", file.Additions, file.Deletions)
	header := fmt.Sprintf("%s %s  %s", icon, file.Path, stats)

	if file.OldPath != "" && file.OldPath != file.Path {
		header = fmt.Sprintf("%s %s → %s  %s", icon, file.OldPath, file.Path, stats)
	}

	style := s.fileStyle
	if selected {
		style = style.Background(lipgloss.Color("237"))
	}

	return style.Render(header)
}

// renderSideLine renders a single line for left or right pane
func (s *SplitDiffViewer) renderSideLine(line *models.DiffLine, filename string, isLeft bool) string {
	if line == nil {
		// Empty placeholder for unpaired line
		return s.contextStyle.Render(strings.Repeat(" ", s.getLineWidth(isLeft)))
	}

	// Line number
	lineNo := ""
	if isLeft && line.OldLineNo > 0 {
		lineNo = s.lineNoStyle.Render(fmt.Sprintf("%4d │ ", line.OldLineNo))
	} else if !isLeft && line.NewLineNo > 0 {
		lineNo = s.lineNoStyle.Render(fmt.Sprintf("%4d │ ", line.NewLineNo))
	} else {
		lineNo = s.lineNoStyle.Render("     │ ")
	}

	// Line prefix
	var prefixStyle lipgloss.Style
	prefix := " "

	switch line.Type {
	case models.DiffLineAdded:
		prefixStyle = s.addedStyle
		prefix = "+"
	case models.DiffLineDeleted:
		prefixStyle = s.deletedStyle
		prefix = "-"
	case models.DiffLineContext:
		prefixStyle = s.contextStyle
		prefix = " "
	default:
		prefixStyle = s.contextStyle
	}

	// Apply syntax highlighting
	content := line.Content
	if s.horizontalOffset > 0 && len(content) > s.horizontalOffset {
		content = content[s.horizontalOffset:]
	} else if s.horizontalOffset > 0 {
		content = ""
	}

	highlightedContent := s.highlighter.HighlightLine(content, filename)

	// Truncate to viewport width
	maxWidth := s.getLineWidth(isLeft) - len(lineNo) - 2
	if lipgloss.Width(highlightedContent) > maxWidth {
		highlightedContent = truncateString(highlightedContent, maxWidth)
	}

	return lineNo + prefixStyle.Render(prefix) + " " + highlightedContent
}

// getLineWidth returns the available width for a line in the given pane
func (s *SplitDiffViewer) getLineWidth(isLeft bool) int {
	if isLeft {
		return s.leftViewport.Width
	}
	return s.rightViewport.Width
}

// truncateString truncates a string to a maximum width (accounting for ANSI codes)
func truncateString(s string, maxWidth int) string {
	if lipgloss.Width(s) <= maxWidth {
		return s
	}

	// Simple truncation - could be improved to handle ANSI codes better
	runes := []rune(s)
	if len(runes) > maxWidth {
		return string(runes[:maxWidth-3]) + "..."
	}
	return s
}

// syncScroll ensures left and right viewports have the same scroll offset
func (s *SplitDiffViewer) syncScroll() {
	s.rightViewport.YOffset = s.leftViewport.YOffset
}

// Init implements tea.Model
func (s SplitDiffViewer) Init() tea.Cmd {
	return nil
}

// Update implements tea.Model
func (s SplitDiffViewer) Update(msg tea.Msg) (SplitDiffViewer, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, s.keyMap.Up):
			s.ScrollUp(1)
			return s, nil
		case key.Matches(msg, s.keyMap.Down):
			s.ScrollDown(1)
			return s, nil
		case key.Matches(msg, s.keyMap.PageUp):
			s.ScrollUp(s.height)
			return s, nil
		case key.Matches(msg, s.keyMap.PageDown):
			s.ScrollDown(s.height)
			return s, nil
		case key.Matches(msg, s.keyMap.HalfUp):
			s.ScrollUp(s.height / 2)
			return s, nil
		case key.Matches(msg, s.keyMap.HalfDown):
			s.ScrollDown(s.height / 2)
			return s, nil
		case key.Matches(msg, s.keyMap.Top):
			s.ScrollToTop()
			return s, nil
		case key.Matches(msg, s.keyMap.Bottom):
			s.ScrollToBottom()
			return s, nil
		case key.Matches(msg, s.keyMap.NextFile):
			s.NextFile()
			return s, nil
		case key.Matches(msg, s.keyMap.PrevFile):
			s.PrevFile()
			return s, nil
		case key.Matches(msg, s.keyMap.NextHunk):
			s.NextHunk()
			return s, nil
		case key.Matches(msg, s.keyMap.PrevHunk):
			s.PrevHunk()
			return s, nil
		case key.Matches(msg, s.keyMap.IncreaseSplit):
			s.AdjustSplitRatio(0.05)
			return s, nil
		case key.Matches(msg, s.keyMap.DecreaseSplit):
			s.AdjustSplitRatio(-0.05)
			return s, nil
		case key.Matches(msg, s.keyMap.Left), key.Matches(msg, s.keyMap.ScrollLeft):
			s.HorizontalScroll(-4)
			return s, nil
		case key.Matches(msg, s.keyMap.Right), key.Matches(msg, s.keyMap.ScrollRight):
			s.HorizontalScroll(4)
			return s, nil
		}

	case tea.WindowSizeMsg:
		s.width = msg.Width
		s.height = msg.Height
		s.resizeViewports()
		return s, nil
	}

	s.leftViewport, cmd = s.leftViewport.Update(msg)
	s.syncScroll()
	return s, cmd
}

// View implements tea.Model
func (s SplitDiffViewer) View() string {
	if s.diff == nil || len(s.files) == 0 {
		return "No diff to display"
	}

	// Render side by side with separator
	leftView := s.leftViewport.View()
	rightView := s.rightViewport.View()

	// Split into lines
	leftLines := strings.Split(leftView, "\n")
	rightLines := strings.Split(rightView, "\n")

	// Ensure equal line counts
	maxLines := len(leftLines)
	if len(rightLines) > maxLines {
		maxLines = len(rightLines)
	}

	// Pad shorter side
	for len(leftLines) < maxLines {
		leftLines = append(leftLines, strings.Repeat(" ", s.leftViewport.Width))
	}
	for len(rightLines) < maxLines {
		rightLines = append(rightLines, strings.Repeat(" ", s.rightViewport.Width))
	}

	// Combine with separator
	var combined strings.Builder
	separator := s.borderStyle.Render(" │ ")

	for i := 0; i < maxLines && i < s.height; i++ {
		line := leftLines[i] + separator + rightLines[i]

		// Apply cursor highlight
		if i+s.leftViewport.YOffset == s.cursor {
			line = s.cursorStyle.Render(line)
		}

		combined.WriteString(line)
		if i < maxLines-1 {
			combined.WriteString("\n")
		}
	}

	return combined.String()
}

// ScrollUp scrolls the view up by n lines
func (s *SplitDiffViewer) ScrollUp(n int) {
	if s.cursor > 0 {
		s.cursor -= n
		if s.cursor < 0 {
			s.cursor = 0
		}
	}

	newOffset := s.leftViewport.YOffset - n
	if newOffset < 0 {
		newOffset = 0
	}
	s.leftViewport.YOffset = newOffset
	s.syncScroll()
}

// ScrollDown scrolls the view down by n lines
func (s *SplitDiffViewer) ScrollDown(n int) {
	maxLine := len(s.linePairs) - 1
	if s.cursor < maxLine {
		s.cursor += n
		if s.cursor > maxLine {
			s.cursor = maxLine
		}
	}

	maxOffset := len(s.linePairs) - s.height
	if maxOffset < 0 {
		maxOffset = 0
	}

	newOffset := s.leftViewport.YOffset + n
	if newOffset > maxOffset {
		newOffset = maxOffset
	}
	s.leftViewport.YOffset = newOffset
	s.syncScroll()
}

// ScrollToTop scrolls to the top of the diff
func (s *SplitDiffViewer) ScrollToTop() {
	s.cursor = 0
	s.leftViewport.YOffset = 0
	s.syncScroll()
}

// ScrollToBottom scrolls to the bottom of the diff
func (s *SplitDiffViewer) ScrollToBottom() {
	maxLine := len(s.linePairs) - 1
	if maxLine < 0 {
		maxLine = 0
	}
	s.cursor = maxLine

	maxOffset := len(s.linePairs) - s.height
	if maxOffset < 0 {
		maxOffset = 0
	}
	s.leftViewport.YOffset = maxOffset
	s.syncScroll()
}

// NextFile moves to the next file
func (s *SplitDiffViewer) NextFile() {
	if s.currentFile < len(s.files)-1 {
		s.currentFile++
		if s.currentFile < len(s.filePositions) {
			s.cursor = s.filePositions[s.currentFile]
			s.leftViewport.YOffset = s.cursor
			s.syncScroll()
		}
		s.render()
	}
}

// PrevFile moves to the previous file
func (s *SplitDiffViewer) PrevFile() {
	if s.currentFile > 0 {
		s.currentFile--
		if s.currentFile < len(s.filePositions) {
			s.cursor = s.filePositions[s.currentFile]
			s.leftViewport.YOffset = s.cursor
			s.syncScroll()
		}
		s.render()
	}
}

// NextHunk moves to the next hunk
func (s *SplitDiffViewer) NextHunk() {
	if len(s.hunkPositions) == 0 {
		return
	}

	// Find next hunk after cursor
	for _, pos := range s.hunkPositions {
		if pos > s.cursor {
			s.cursor = pos
			s.leftViewport.YOffset = pos
			s.syncScroll()
			return
		}
	}

	// Wrap to first hunk
	s.cursor = s.hunkPositions[0]
	s.leftViewport.YOffset = s.cursor
	s.syncScroll()
}

// PrevHunk moves to the previous hunk
func (s *SplitDiffViewer) PrevHunk() {
	if len(s.hunkPositions) == 0 {
		return
	}

	// Find previous hunk before cursor
	for i := len(s.hunkPositions) - 1; i >= 0; i-- {
		if s.hunkPositions[i] < s.cursor {
			s.cursor = s.hunkPositions[i]
			s.leftViewport.YOffset = s.cursor
			s.syncScroll()
			return
		}
	}

	// Wrap to last hunk
	s.cursor = s.hunkPositions[len(s.hunkPositions)-1]
	s.leftViewport.YOffset = s.cursor
	s.syncScroll()
}

// AdjustSplitRatio adjusts the split ratio by delta
func (s *SplitDiffViewer) AdjustSplitRatio(delta float64) {
	s.splitRatio += delta

	// Clamp to valid range
	if s.splitRatio < minSplitRatio {
		s.splitRatio = minSplitRatio
	}
	if s.splitRatio > maxSplitRatio {
		s.splitRatio = maxSplitRatio
	}

	s.resizeViewports()
	s.render()
}

// HorizontalScroll scrolls horizontally by offset (positive = right, negative = left)
func (s *SplitDiffViewer) HorizontalScroll(offset int) {
	s.horizontalOffset += offset
	if s.horizontalOffset < 0 {
		s.horizontalOffset = 0
	}
	s.render()
}

// resizeViewports updates viewport sizes based on current width and split ratio
func (s *SplitDiffViewer) resizeViewports() {
	leftWidth := int(float64(s.width-3) * s.splitRatio)
	rightWidth := s.width - leftWidth - 3

	if leftWidth < 10 {
		leftWidth = 10
	}
	if rightWidth < 10 {
		rightWidth = 10
	}

	s.leftViewport.Width = leftWidth
	s.leftViewport.Height = s.height
	s.rightViewport.Width = rightWidth
	s.rightViewport.Height = s.height
}

// SetSize sets the viewer size
func (s *SplitDiffViewer) SetSize(width, height int) {
	s.width = width
	s.height = height
	s.resizeViewports()
	s.render()
}

// CurrentFile returns the current file index
func (s *SplitDiffViewer) CurrentFile() int {
	return s.currentFile
}

// FileCount returns the number of files
func (s *SplitDiffViewer) FileCount() int {
	return len(s.files)
}
