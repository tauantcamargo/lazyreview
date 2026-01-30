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
	Up        key.Binding
	Down      key.Binding
	PageUp    key.Binding
	PageDown  key.Binding
	HalfUp    key.Binding
	HalfDown  key.Binding
	Top       key.Binding
	Bottom    key.Binding
	NextFile  key.Binding
	PrevFile  key.Binding
	NextHunk  key.Binding
	PrevHunk  key.Binding
	ToggleView key.Binding
	Comment   key.Binding
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

	// Styles
	addedStyle   lipgloss.Style
	deletedStyle lipgloss.Style
	contextStyle lipgloss.Style
	hunkStyle    lipgloss.Style
	lineNoStyle  lipgloss.Style
	fileStyle    lipgloss.Style
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
		return
	}

	var content strings.Builder
	var hunkPositions []int
	currentLine := 0

	for i, file := range d.files {
		// File header
		header := d.renderFileHeader(file, i == d.currentFile)
		content.WriteString(header)
		content.WriteString("\n")
		currentLine++

		// Determine filename for syntax highlighting
		filename := file.Path
		if filename == "" {
			filename = file.OldPath
		}

		// Render hunks
		for _, hunk := range file.Hunks {
			hunkPositions = append(hunkPositions, currentLine)
			hunkContent := d.renderHunk(hunk, filename)
			content.WriteString(hunkContent)
			currentLine += strings.Count(hunkContent, "\n")
		}

		// If no hunks but has patch, render raw patch
		if len(file.Hunks) == 0 && file.Patch != "" {
			patchContent := d.renderPatch(file.Patch)
			content.WriteString(patchContent)
			currentLine += strings.Count(patchContent, "\n")
		}

		content.WriteString("\n")
		currentLine++
	}

	d.hunkPositions = hunkPositions
	d.viewport.SetContent(content.String())
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

// renderHunk renders a diff hunk
func (d *DiffViewer) renderHunk(hunk models.Hunk, filename string) string {
	var content strings.Builder

	// Hunk header
	header := d.hunkStyle.Render(hunk.Header)
	content.WriteString(header)
	content.WriteString("\n")

	// Lines
	for _, line := range hunk.Lines {
		content.WriteString(d.renderLine(line, filename))
		content.WriteString("\n")
	}

	return content.String()
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

