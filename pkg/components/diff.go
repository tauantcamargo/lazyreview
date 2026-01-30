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

// DiffKeyMap defines keybindings for the diff viewer
type DiffKeyMap struct {
	Up         key.Binding
	Down       key.Binding
	PageUp     key.Binding
	PageDown   key.Binding
	HalfUp     key.Binding
	HalfDown   key.Binding
	Top        key.Binding
	Bottom     key.Binding
	NextFile   key.Binding
	PrevFile   key.Binding
	NextHunk   key.Binding
	PrevHunk   key.Binding
	ToggleView key.Binding
	Comment    key.Binding
}

// DefaultDiffKeyMap returns default keybindings
func DefaultDiffKeyMap() DiffKeyMap {
	return DiffKeyMap{
		Up: key.NewBinding(
			key.WithKeys("k", "up"),
			key.WithHelp("k/↑", "up"),
		),
		Down: key.NewBinding(
			key.WithKeys("j", "down"),
			key.WithHelp("j/↓", "down"),
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
		ToggleView: key.NewBinding(
			key.WithKeys("d"),
			key.WithHelp("d", "toggle unified/split"),
		),
		Comment: key.NewBinding(
			key.WithKeys("c"),
			key.WithHelp("c", "comment on line"),
		),
	}
}

// DiffViewer is a component for viewing diffs
type DiffViewer struct {
	viewport      viewport.Model
	diff          *models.Diff
	files         []models.FileDiff
	currentFile   int
	currentLine   int
	keyMap        DiffKeyMap
	width         int
	height        int
	focused       bool
	splitView     bool
	hunkPositions []int // Line offsets where each hunk starts
	currentHunk   int   // Current hunk index
	highlighter   *Highlighter
	lineMapping   []lineInfo // Maps viewport line to file/line info

	// Styles
	addedStyle   lipgloss.Style
	deletedStyle lipgloss.Style
	contextStyle lipgloss.Style
	hunkStyle    lipgloss.Style
	lineNoStyle  lipgloss.Style
	fileStyle    lipgloss.Style
}

// lineInfo stores information about a line in the viewport
type lineInfo struct {
	filePath string
	lineNo   int
	isCode   bool // false for headers, true for actual code lines
}

// NewDiffViewer creates a new diff viewer
func NewDiffViewer(width, height int) DiffViewer {
	vp := viewport.New(width, height)
	vp.SetContent("")

	return DiffViewer{
		viewport:     vp,
		keyMap:       DefaultDiffKeyMap(),
		width:        width,
		height:       height,
		focused:      true,
		splitView:    false,
		highlighter:  NewHighlighter(),
		addedStyle:   lipgloss.NewStyle().Foreground(lipgloss.Color("42")),  // Green
		deletedStyle: lipgloss.NewStyle().Foreground(lipgloss.Color("196")), // Red
		contextStyle: lipgloss.NewStyle().Foreground(lipgloss.Color("252")), // Light gray
		hunkStyle:    lipgloss.NewStyle().Foreground(lipgloss.Color("39")),  // Blue
		lineNoStyle:  lipgloss.NewStyle().Foreground(lipgloss.Color("240")), // Dark gray
		fileStyle:    lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("170")),
	}
}

// SetDiff sets the diff to display
func (d *DiffViewer) SetDiff(diff *models.Diff) {
	d.diff = diff
	if diff != nil {
		d.files = diff.Files
	} else {
		d.files = nil
	}
	d.currentFile = 0
	d.currentLine = 0
	d.render()
}

// Init implements tea.Model
func (d DiffViewer) Init() tea.Cmd {
	return nil
}

// Update implements tea.Model
func (d DiffViewer) Update(msg tea.Msg) (DiffViewer, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, d.keyMap.NextFile):
			d.nextFile()
			return d, nil
		case key.Matches(msg, d.keyMap.PrevFile):
			d.prevFile()
			return d, nil
		case key.Matches(msg, d.keyMap.NextHunk):
			d.nextHunk()
			return d, nil
		case key.Matches(msg, d.keyMap.PrevHunk):
			d.prevHunk()
			return d, nil
		case key.Matches(msg, d.keyMap.ToggleView):
			d.splitView = !d.splitView
			d.render()
			return d, nil
		case key.Matches(msg, d.keyMap.Top):
			d.viewport.GotoTop()
			return d, nil
		case key.Matches(msg, d.keyMap.Bottom):
			d.viewport.GotoBottom()
			return d, nil
		}

	case tea.WindowSizeMsg:
		d.width = msg.Width
		d.height = msg.Height
		d.viewport.Width = msg.Width
		d.viewport.Height = msg.Height
		d.render()
		return d, nil
	}

	d.viewport, cmd = d.viewport.Update(msg)
	return d, cmd
}

// View implements tea.Model
func (d DiffViewer) View() string {
	if d.diff == nil || len(d.files) == 0 {
		return "No diff to display"
	}
	return d.viewport.View()
}

// render renders the diff content
func (d *DiffViewer) render() {
	if d.diff == nil || len(d.files) == 0 {
		d.viewport.SetContent("No diff to display")
		d.hunkPositions = nil
		d.lineMapping = nil
		return
	}

	if d.splitView {
		d.renderSplitView()
	} else {
		d.renderUnifiedView()
	}
}

// renderUnifiedView renders the diff in unified view
func (d *DiffViewer) renderUnifiedView() {
	var content strings.Builder
	var hunkPositions []int
	var lineMapping []lineInfo
	currentLine := 0

	for i, file := range d.files {
		// File header
		header := d.renderFileHeader(file, i == d.currentFile)
		content.WriteString(header)
		content.WriteString("\n")
		lineMapping = append(lineMapping, lineInfo{filePath: file.Path, lineNo: 0, isCode: false})
		currentLine++

		// Determine filename for syntax highlighting
		filename := file.Path
		if filename == "" {
			filename = file.OldPath
		}

		// Render hunks
		for _, hunk := range file.Hunks {
			hunkPositions = append(hunkPositions, currentLine)
			hunkContent, hunkLineMapping := d.renderHunk(hunk, filename)
			content.WriteString(hunkContent)
			lineMapping = append(lineMapping, hunkLineMapping...)
			currentLine += len(hunkLineMapping)
		}

		// If no hunks but has patch, render raw patch
		if len(file.Hunks) == 0 && file.Patch != "" {
			patchContent := d.renderPatch(file.Patch)
			content.WriteString(patchContent)
			patchLines := strings.Count(patchContent, "\n")
			for j := 0; j < patchLines; j++ {
				lineMapping = append(lineMapping, lineInfo{filePath: file.Path, lineNo: 0, isCode: false})
			}
			currentLine += patchLines
		}

		content.WriteString("\n")
		lineMapping = append(lineMapping, lineInfo{filePath: file.Path, lineNo: 0, isCode: false})
		currentLine++
	}

	d.hunkPositions = hunkPositions
	d.lineMapping = lineMapping
	d.viewport.SetContent(content.String())
}

// renderSplitView renders the diff in split view (side-by-side)
func (d *DiffViewer) renderSplitView() {
	var content strings.Builder
	var hunkPositions []int
	var lineMapping []lineInfo
	currentLine := 0

	// Calculate half width for each side
	halfWidth := (d.width - 5) / 2 // -5 for border and separator

	for i, file := range d.files {
		// File header spans full width
		header := d.renderFileHeader(file, i == d.currentFile)
		content.WriteString(header)
		content.WriteString("\n")
		lineMapping = append(lineMapping, lineInfo{filePath: file.Path, lineNo: 0, isCode: false})
		currentLine++

		filename := file.Path
		if filename == "" {
			filename = file.OldPath
		}

		// Render hunks in split view
		for _, hunk := range file.Hunks {
			hunkPositions = append(hunkPositions, currentLine)

			// Hunk header
			header := d.hunkStyle.Render(hunk.Header)
			content.WriteString(header)
			content.WriteString("\n")
			lineMapping = append(lineMapping, lineInfo{filePath: file.Path, lineNo: 0, isCode: false})
			currentLine++

			// Split lines into old (left) and new (right)
			oldLines := []models.DiffLine{}
			newLines := []models.DiffLine{}

			for _, line := range hunk.Lines {
				switch line.Type {
				case models.DiffLineDeleted:
					oldLines = append(oldLines, line)
				case models.DiffLineAdded:
					newLines = append(newLines, line)
				case models.DiffLineContext:
					// Context lines appear on both sides
					oldLines = append(oldLines, line)
					newLines = append(newLines, line)
				}
			}

			// Render side by side
			maxLines := len(oldLines)
			if len(newLines) > maxLines {
				maxLines = len(newLines)
			}

			for j := 0; j < maxLines; j++ {
				var leftLine, rightLine string
				var leftLineNo, rightLineNo int

				if j < len(oldLines) {
					leftLine = d.renderSplitLine(oldLines[j], filename, halfWidth, true)
					leftLineNo = oldLines[j].OldLineNo
				} else {
					leftLine = strings.Repeat(" ", halfWidth)
				}

				if j < len(newLines) {
					rightLine = d.renderSplitLine(newLines[j], filename, halfWidth, false)
					rightLineNo = newLines[j].NewLineNo
				} else {
					rightLine = strings.Repeat(" ", halfWidth)
				}

				// Use the new line number for mapping (right side)
				lineNo := rightLineNo
				if lineNo == 0 {
					lineNo = leftLineNo
				}

				content.WriteString(leftLine + " │ " + rightLine)
				content.WriteString("\n")
				lineMapping = append(lineMapping, lineInfo{filePath: file.Path, lineNo: lineNo, isCode: true})
				currentLine++
			}
		}

		content.WriteString("\n")
		lineMapping = append(lineMapping, lineInfo{filePath: file.Path, lineNo: 0, isCode: false})
		currentLine++
	}

	d.hunkPositions = hunkPositions
	d.lineMapping = lineMapping
	d.viewport.SetContent(content.String())
}

// renderSplitLine renders a single line for split view
func (d *DiffViewer) renderSplitLine(line models.DiffLine, filename string, width int, isLeft bool) string {
	lineNo := ""
	if isLeft && line.OldLineNo > 0 {
		lineNo = d.lineNoStyle.Render(fmt.Sprintf("%4d │ ", line.OldLineNo))
	} else if !isLeft && line.NewLineNo > 0 {
		lineNo = d.lineNoStyle.Render(fmt.Sprintf("%4d │ ", line.NewLineNo))
	} else {
		lineNo = d.lineNoStyle.Render("     │ ")
	}

	var contentStyle lipgloss.Style
	switch line.Type {
	case models.DiffLineAdded:
		contentStyle = d.addedStyle
	case models.DiffLineDeleted:
		contentStyle = d.deletedStyle
	case models.DiffLineContext:
		contentStyle = d.contextStyle
	default:
		contentStyle = d.contextStyle
	}

	// Apply syntax highlighting
	highlightedContent := d.highlighter.HighlightLine(line.Content, filename)

	// Truncate or pad to width
	content := lineNo + highlightedContent
	contentLen := lipgloss.Width(content)
	if contentLen > width {
		content = content[:width]
	} else if contentLen < width {
		content = content + strings.Repeat(" ", width-contentLen)
	}

	return contentStyle.Render(content)
}

// renderFileHeader renders a file header
func (d *DiffViewer) renderFileHeader(file models.FileDiff, selected bool) string {
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

	style := d.fileStyle
	if selected {
		style = style.Background(lipgloss.Color("237"))
	}

	return style.Render(header)
}

// renderHunk renders a diff hunk and returns content and line mapping
func (d *DiffViewer) renderHunk(hunk models.Hunk, filename string) (string, []lineInfo) {
	var content strings.Builder
	var lineMapping []lineInfo

	// Hunk header
	header := d.hunkStyle.Render(hunk.Header)
	content.WriteString(header)
	content.WriteString("\n")
	lineMapping = append(lineMapping, lineInfo{filePath: filename, lineNo: 0, isCode: false})

	// Lines
	for _, line := range hunk.Lines {
		content.WriteString(d.renderLine(line, filename))
		content.WriteString("\n")

		// Use new line number for mapping, fallback to old if new is not available
		lineNo := line.NewLineNo
		if lineNo == 0 {
			lineNo = line.OldLineNo
		}
		lineMapping = append(lineMapping, lineInfo{
			filePath: filename,
			lineNo:   lineNo,
			isCode:   true,
		})
	}

	return content.String(), lineMapping
}

// renderLine renders a single diff line with syntax highlighting
func (d *DiffViewer) renderLine(line models.DiffLine, filename string) string {
	lineNo := ""
	if line.OldLineNo > 0 || line.NewLineNo > 0 {
		old := "   "
		new := "   "
		if line.OldLineNo > 0 {
			old = fmt.Sprintf("%3d", line.OldLineNo)
		}
		if line.NewLineNo > 0 {
			new = fmt.Sprintf("%3d", line.NewLineNo)
		}
		lineNo = d.lineNoStyle.Render(fmt.Sprintf("%s %s │ ", old, new))
	}

	var prefixStyle lipgloss.Style
	prefix := " "

	switch line.Type {
	case models.DiffLineAdded:
		prefixStyle = d.addedStyle
		prefix = "+"
	case models.DiffLineDeleted:
		prefixStyle = d.deletedStyle
		prefix = "-"
	case models.DiffLineContext:
		prefixStyle = d.contextStyle
		prefix = " "
	default:
		prefixStyle = d.contextStyle
	}

	// Apply syntax highlighting to the content
	highlightedContent := d.highlighter.HighlightLine(line.Content, filename)

	// For added/deleted lines, we need to apply a background or adjust the highlighting
	// to maintain visibility of the diff type
	styledContent := highlightedContent
	switch line.Type {
	case models.DiffLineAdded:
		// Keep syntax highlighting but ensure added lines are distinguishable
		// We'll add a subtle background or keep the prefix highly visible
		styledContent = highlightedContent
	case models.DiffLineDeleted:
		// Keep syntax highlighting but ensure deleted lines are distinguishable
		styledContent = highlightedContent
	case models.DiffLineContext:
		// Context lines get full syntax highlighting
		styledContent = highlightedContent
	}

	return lineNo + prefixStyle.Render(prefix) + " " + styledContent
}

// renderPatch renders a raw patch string
func (d *DiffViewer) renderPatch(patch string) string {
	var content strings.Builder

	lines := strings.Split(patch, "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}

		var style lipgloss.Style
		switch {
		case strings.HasPrefix(line, "+"):
			style = d.addedStyle
		case strings.HasPrefix(line, "-"):
			style = d.deletedStyle
		case strings.HasPrefix(line, "@@"):
			style = d.hunkStyle
		default:
			style = d.contextStyle
		}

		content.WriteString(style.Render(line))
		content.WriteString("\n")
	}

	return content.String()
}

// nextFile moves to the next file
func (d *DiffViewer) nextFile() {
	if d.currentFile < len(d.files)-1 {
		d.currentFile++
		d.render()
	}
}

// prevFile moves to the previous file
func (d *DiffViewer) prevFile() {
	if d.currentFile > 0 {
		d.currentFile--
		d.render()
	}
}

// nextHunk moves to the next hunk
func (d *DiffViewer) nextHunk() {
	if len(d.hunkPositions) == 0 {
		return
	}

	currentOffset := d.viewport.YOffset

	// Find the next hunk position after current offset
	for i, pos := range d.hunkPositions {
		if pos > currentOffset {
			d.currentHunk = i
			d.viewport.SetYOffset(pos)
			return
		}
	}

	// If no hunk found after current position, go to last hunk
	if len(d.hunkPositions) > 0 {
		d.currentHunk = len(d.hunkPositions) - 1
		d.viewport.SetYOffset(d.hunkPositions[d.currentHunk])
	}
}

// prevHunk moves to the previous hunk
func (d *DiffViewer) prevHunk() {
	if len(d.hunkPositions) == 0 {
		return
	}

	currentOffset := d.viewport.YOffset

	// Find the previous hunk position before current offset
	for i := len(d.hunkPositions) - 1; i >= 0; i-- {
		if d.hunkPositions[i] < currentOffset {
			d.currentHunk = i
			d.viewport.SetYOffset(d.hunkPositions[i])
			return
		}
	}

	// If no hunk found before current position, go to first hunk
	if len(d.hunkPositions) > 0 {
		d.currentHunk = 0
		d.viewport.SetYOffset(d.hunkPositions[d.currentHunk])
	}
}

// SetSize sets the viewer size
func (d *DiffViewer) SetSize(width, height int) {
	d.width = width
	d.height = height
	d.viewport.Width = width
	d.viewport.Height = height
	d.render()
}

// Focus focuses the viewer
func (d *DiffViewer) Focus() {
	d.focused = true
}

// Blur unfocuses the viewer
func (d *DiffViewer) Blur() {
	d.focused = false
}

// CurrentFile returns the current file index
func (d *DiffViewer) CurrentFile() int {
	return d.currentFile
}

// CurrentFilePath returns the current file path
func (d *DiffViewer) CurrentFilePath() string {
	if d.currentFile < len(d.files) {
		return d.files[d.currentFile].Path
	}
	return ""
}

// FileCount returns the number of files
func (d *DiffViewer) FileCount() int {
	return len(d.files)
}

// CurrentLineInfo returns information about the current line in the viewport
func (d *DiffViewer) CurrentLineInfo() (filePath string, lineNo int, isCode bool) {
	// Get current viewport offset + first visible line
	currentOffset := d.viewport.YOffset

	if currentOffset < 0 || currentOffset >= len(d.lineMapping) {
		return "", 0, false
	}

	info := d.lineMapping[currentOffset]
	return info.filePath, info.lineNo, info.isCode
}

// GetLineInfoAt returns information about a specific line in the viewport
func (d *DiffViewer) GetLineInfoAt(offset int) (filePath string, lineNo int, isCode bool) {
	if offset < 0 || offset >= len(d.lineMapping) {
		return "", 0, false
	}

	info := d.lineMapping[offset]
	return info.filePath, info.lineNo, info.isCode
}
