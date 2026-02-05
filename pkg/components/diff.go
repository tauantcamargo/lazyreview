package components

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"lazyreview/internal/models"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// DiffKeyMap defines keybindings for the diff viewer
type DiffKeyMap struct {
	Up          key.Binding
	Down        key.Binding
	PageUp      key.Binding
	PageDown    key.Binding
	HalfUp      key.Binding
	HalfDown    key.Binding
	Top         key.Binding
	Bottom      key.Binding
	NextFile    key.Binding
	PrevFile    key.Binding
	NextHunk    key.Binding
	PrevHunk    key.Binding
	NextComment key.Binding
	PrevComment key.Binding
	ToggleView  key.Binding
	Comment     key.Binding
	SelectRange key.Binding
}

// DefaultDiffKeyMap returns keybindings for diff navigation.
func DefaultDiffKeyMap(vimMode bool) DiffKeyMap {
	if !vimMode {
		return DiffKeyMap{
			Up: key.NewBinding(
				key.WithKeys("up"),
				key.WithHelp("↑", "up"),
			),
			Down: key.NewBinding(
				key.WithKeys("down"),
				key.WithHelp("↓", "down"),
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
			NextComment: key.NewBinding(
				key.WithKeys("]c"),
				key.WithHelp("]c", "next comment"),
			),
			PrevComment: key.NewBinding(
				key.WithKeys("[c"),
				key.WithHelp("[c", "prev comment"),
			),
			ToggleView: key.NewBinding(
				key.WithKeys("d"),
				key.WithHelp("d", "toggle unified/split"),
			),
			Comment: key.NewBinding(
				key.WithKeys("c"),
				key.WithHelp("c", "comment on line"),
			),
			SelectRange: key.NewBinding(
				key.WithKeys("V"),
				key.WithHelp("V", "select range"),
			),
		}
	}
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
		NextComment: key.NewBinding(
			key.WithKeys("]c"),
			key.WithHelp("]c", "next comment"),
		),
		PrevComment: key.NewBinding(
			key.WithKeys("[c"),
			key.WithHelp("[c", "prev comment"),
		),
		ToggleView: key.NewBinding(
			key.WithKeys("d"),
			key.WithHelp("d", "toggle unified/split"),
		),
		Comment: key.NewBinding(
			key.WithKeys("c"),
			key.WithHelp("c", "comment on line"),
		),
		SelectRange: key.NewBinding(
			key.WithKeys("V"),
			key.WithHelp("V", "select range"),
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
	cursor        int
	selectionOn   bool
	selectionFrom int
	keyMap        DiffKeyMap
	width         int
	height        int
	focused       bool
	splitView     bool
	hunkPositions []int // Line offsets where each hunk starts
	currentHunk   int   // Current hunk index
	highlighter   *Highlighter
	lineMapping   []lineInfo // Maps viewport line to file/line info
	searchTexts   []string   // Plain text per rendered line for search/jump
	maxLines      int
	filePositions []int // Line offsets where each file starts
	lineComments  map[string][]models.Comment

	// View caching to avoid expensive recomputation on unrelated updates
	contentVersion int
	cachedVersion  int
	cachedView     string
	cachedYOffset  int
	cachedWidth    int
	cachedHeight   int
	renderSeq      int

	// Styles
	addedStyle   lipgloss.Style
	deletedStyle lipgloss.Style
	contextStyle lipgloss.Style
	hunkStyle    lipgloss.Style
	lineNoStyle  lipgloss.Style
	fileStyle    lipgloss.Style
	cursorStyle  lipgloss.Style
	selectStyle  lipgloss.Style
}

// lineInfo stores information about a line in the viewport
type lineInfo struct {
	filePath  string
	lineNo    int
	side      models.DiffSide
	isCode    bool // false for headers, true for actual code lines
	commentID string
	isComment bool
}

type diffRenderMsg struct {
	seq int
}

// NewDiffViewer creates a new diff viewer
func NewDiffViewer(width, height int) DiffViewer {
	vp := viewport.New(width, height)
	vp.SetContent("")

	return DiffViewer{
		viewport:     vp,
		keyMap:       DefaultDiffKeyMap(true),
		width:        width,
		height:       height,
		focused:      true,
		splitView:    false,
		maxLines:     1200,
		lineComments: map[string][]models.Comment{},
		highlighter:  NewHighlighter(),
		addedStyle:   lipgloss.NewStyle().Foreground(lipgloss.Color("42")),  // Green
		deletedStyle: lipgloss.NewStyle().Foreground(lipgloss.Color("196")), // Red
		contextStyle: lipgloss.NewStyle().Foreground(lipgloss.Color("252")), // Light gray
		hunkStyle:    lipgloss.NewStyle().Foreground(lipgloss.Color("39")),  // Blue
		lineNoStyle:  lipgloss.NewStyle().Foreground(lipgloss.Color("240")), // Dark gray
		fileStyle:    lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("170")),
		cursorStyle:  lipgloss.NewStyle().Background(lipgloss.Color("236")),
		selectStyle:  lipgloss.NewStyle().Background(lipgloss.Color("235")),
	}
}

// SetVimMode toggles vim-style navigation keys.
func (d *DiffViewer) SetVimMode(enabled bool) {
	d.keyMap = DefaultDiffKeyMap(enabled)
}

func commentKey(path string, side models.DiffSide, line int) string {
	return fmt.Sprintf("%s|%s|%d", path, side, line)
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
	d.cursor = 0
	d.selectionOn = false
	d.selectionFrom = 0
	d.invalidateCache()
	d.render()
	d.scrollToFile(d.currentFile)
}

// SetComments sets line comment threads grouped by file/line.
func (d *DiffViewer) SetComments(comments []models.Comment) {
	grouped := map[string][]models.Comment{}
	for _, comment := range comments {
		if comment.Path == "" || comment.Line <= 0 {
			continue
		}
		key := commentKey(comment.Path, comment.Side, comment.Line)
		grouped[key] = append(grouped[key], comment)
		for _, reply := range comment.Replies {
			r := reply
			if r.Path == "" {
				r.Path = comment.Path
			}
			if r.Line <= 0 {
				r.Line = comment.Line
			}
			if r.Side == "" {
				r.Side = comment.Side
			}
			replyKey := commentKey(r.Path, r.Side, r.Line)
			grouped[replyKey] = append(grouped[replyKey], r)
		}
	}
	d.lineComments = grouped
	d.render()
}

// SetCurrentFileByPath sets the current file by path and scrolls to it.
func (d *DiffViewer) SetCurrentFileByPath(path string) bool {
	if path == "" {
		return false
	}
	for i, file := range d.files {
		if file.Path == path || file.OldPath == path {
			d.currentFile = i
			if i < len(d.filePositions) {
				d.cursor = d.filePositions[i]
			}
			d.ensureCursorVisible()
			d.render()
			return true
		}
	}
	return false
}

// SelectedRange returns the selected line range if selection is active.
func (d *DiffViewer) SelectedRange() (filePath string, startLine int, endLine int, side models.DiffSide, isCode bool, ok bool) {
	if !d.selectionOn || len(d.lineMapping) == 0 {
		return "", 0, 0, "", false, false
	}
	start := d.selectionFrom
	end := d.cursor
	if start > end {
		start, end = end, start
	}
	if start < 0 || end >= len(d.lineMapping) {
		return "", 0, 0, "", false, false
	}
	startInfo := d.lineMapping[start]
	endInfo := d.lineMapping[end]
	if startInfo.filePath == "" || endInfo.filePath == "" || startInfo.filePath != endInfo.filePath {
		return "", 0, 0, "", false, false
	}
	if startInfo.lineNo == 0 || endInfo.lineNo == 0 {
		return "", 0, 0, "", false, false
	}
	side = startInfo.side
	if side == "" {
		side = endInfo.side
	}
	return startInfo.filePath, startInfo.lineNo, endInfo.lineNo, side, startInfo.isCode && endInfo.isCode, true
}

// ClearSelection clears any active range selection.
func (d *DiffViewer) ClearSelection() {
	d.selectionOn = false
}

// Init implements tea.Model
func (d DiffViewer) Init() tea.Cmd {
	return nil
}

// Update implements tea.Model
func (d DiffViewer) Update(msg tea.Msg) (DiffViewer, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case diffRenderMsg:
		if msg.seq == d.renderSeq {
			d.render()
		}
		return d, nil
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
		case key.Matches(msg, d.keyMap.NextComment):
			d.nextComment()
			return d, nil
		case key.Matches(msg, d.keyMap.PrevComment):
			d.prevComment()
			return d, nil
		case key.Matches(msg, d.keyMap.ToggleView):
			d.splitView = !d.splitView
			d.render()
			return d, nil
		case key.Matches(msg, d.keyMap.Top):
			d.cursor = 0
			d.ensureCursorVisible()
			return d, d.queueRender()
		case key.Matches(msg, d.keyMap.Bottom):
			if len(d.lineMapping) > 0 {
				d.cursor = len(d.lineMapping) - 1
				d.ensureCursorVisible()
			}
			return d, d.queueRender()
		case key.Matches(msg, d.keyMap.Up):
			if d.cursor > 0 {
				d.cursor--
				d.ensureCursorVisible()
			}
			return d, d.queueRender()
		case key.Matches(msg, d.keyMap.Down):
			if d.cursor < len(d.lineMapping)-1 {
				d.cursor++
				d.ensureCursorVisible()
			}
			return d, d.queueRender()
		case key.Matches(msg, d.keyMap.PageUp):
			step := d.viewport.Height
			if step <= 0 {
				step = 1
			}
			d.cursor -= step
			if d.cursor < 0 {
				d.cursor = 0
			}
			d.ensureCursorVisible()
			return d, d.queueRender()
		case key.Matches(msg, d.keyMap.PageDown):
			step := d.viewport.Height
			if step <= 0 {
				step = 1
			}
			d.cursor += step
			if d.cursor >= len(d.lineMapping) {
				d.cursor = len(d.lineMapping) - 1
			}
			d.ensureCursorVisible()
			return d, d.queueRender()
		case key.Matches(msg, d.keyMap.HalfUp):
			step := d.viewport.Height / 2
			if step <= 0 {
				step = 1
			}
			d.cursor -= step
			if d.cursor < 0 {
				d.cursor = 0
			}
			d.ensureCursorVisible()
			return d, d.queueRender()
		case key.Matches(msg, d.keyMap.HalfDown):
			step := d.viewport.Height / 2
			if step <= 0 {
				step = 1
			}
			d.cursor += step
			if d.cursor >= len(d.lineMapping) {
				d.cursor = len(d.lineMapping) - 1
			}
			d.ensureCursorVisible()
			return d, d.queueRender()
		case key.Matches(msg, d.keyMap.SelectRange):
			if !d.selectionOn {
				d.selectionOn = true
				d.selectionFrom = d.cursor
			} else {
				d.selectionOn = false
			}
			return d, d.queueRender()
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

func (d *DiffViewer) queueRender() tea.Cmd {
	d.renderSeq++
	seq := d.renderSeq
	return tea.Tick(16*time.Millisecond, func(time.Time) tea.Msg {
		return diffRenderMsg{seq: seq}
	})
}

// View implements tea.Model
func (d DiffViewer) View() string {
	if d.diff == nil || len(d.files) == 0 {
		return "No diff to display"
	}
	if d.cachedVersion == d.contentVersion &&
		d.cachedYOffset == d.viewport.YOffset &&
		d.cachedWidth == d.viewport.Width &&
		d.cachedHeight == d.viewport.Height {
		return d.cachedView
	}
	view := d.viewport.View()
	d.cachedView = view
	d.cachedVersion = d.contentVersion
	d.cachedYOffset = d.viewport.YOffset
	d.cachedWidth = d.viewport.Width
	d.cachedHeight = d.viewport.Height
	return view
}

// render renders the diff content
func (d *DiffViewer) render() {
	if d.diff == nil || len(d.files) == 0 {
		d.viewport.SetContent("No diff to display")
		d.hunkPositions = nil
		d.lineMapping = nil
		d.searchTexts = nil
		d.bumpContentVersion()
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
	var searchTexts []string
	var filePositions []int
	currentLine := 0
	truncated := false

	for i, file := range d.files {
		if currentLine >= d.maxLines {
			truncated = true
			break
		}
		filePositions = append(filePositions, currentLine)
		// File header
		header := d.renderFileHeader(file, i == d.currentFile)
		if currentLine == d.cursor {
			header = d.cursorStyle.Render(header)
		}
		content.WriteString(header)
		content.WriteString("\n")
		lineMapping = append(lineMapping, lineInfo{filePath: file.Path, lineNo: 0, side: "", isCode: false})
		searchTexts = append(searchTexts, file.Path)
		currentLine++

		// Determine filename for syntax highlighting
		filename := file.Path
		if filename == "" {
			filename = file.OldPath
		}

		// Render hunks
		for _, hunk := range file.Hunks {
			if currentLine >= d.maxLines {
				truncated = true
				break
			}
			hunkPositions = append(hunkPositions, currentLine)
			hunkContent, hunkLineMapping, hunkSearchTexts := d.renderHunk(hunk, filename)
			content.WriteString(d.applyCursorHighlight(hunkContent, currentLine))
			lineMapping = append(lineMapping, hunkLineMapping...)
			searchTexts = append(searchTexts, hunkSearchTexts...)
			currentLine += len(hunkLineMapping)
			if currentLine >= d.maxLines {
				truncated = true
				break
			}
		}

		if truncated {
			break
		}

		// If no hunks but has patch, parse patch into hunks for line mapping
		if len(file.Hunks) == 0 && file.Patch != "" {
			patchHunks := parsePatchToHunks(file.Patch)
			for _, hunk := range patchHunks {
				if currentLine >= d.maxLines {
					truncated = true
					break
				}
				hunkPositions = append(hunkPositions, currentLine)
				hunkContent, hunkLineMapping, hunkSearchTexts := d.renderHunk(hunk, filename)
				content.WriteString(d.applyCursorHighlight(hunkContent, currentLine))
				lineMapping = append(lineMapping, hunkLineMapping...)
				searchTexts = append(searchTexts, hunkSearchTexts...)
				currentLine += len(hunkLineMapping)
			}
		}

		content.WriteString(d.applyCursorHighlight("\n", currentLine))
		lineMapping = append(lineMapping, lineInfo{filePath: file.Path, lineNo: 0, side: "", isCode: false})
		searchTexts = append(searchTexts, "")
		currentLine++
	}

	if truncated {
		notice := d.hunkStyle.Render("Diff truncated for performance. Open in browser for full diff.")
		if currentLine == d.cursor {
			notice = d.cursorStyle.Render(notice)
		}
		content.WriteString(notice)
		content.WriteString("\n")
		lineMapping = append(lineMapping, lineInfo{filePath: "", lineNo: 0, side: "", isCode: false})
		searchTexts = append(searchTexts, "truncated")
		currentLine++
	}

	d.hunkPositions = hunkPositions
	d.filePositions = filePositions
	d.lineMapping = lineMapping
	d.searchTexts = searchTexts
	d.clampCursor()
	d.viewport.SetContent(content.String())
	d.bumpContentVersion()
}

func (d *DiffViewer) renderSplitView() {
	var content strings.Builder
	var hunkPositions []int
	var lineMapping []lineInfo
	var searchTexts []string
	var filePositions []int
	currentLine := 0
	truncated := false

	// Calculate half width for each side
	halfWidth := (d.width - 5) / 2 // -5 for border and separator

	for i, file := range d.files {
		if currentLine >= d.maxLines {
			truncated = true
			break
		}
		filePositions = append(filePositions, currentLine)
		// File header spans full width
		header := d.renderFileHeader(file, i == d.currentFile)
		if currentLine == d.cursor {
			header = d.cursorStyle.Render(header)
		}
		content.WriteString(header)
		content.WriteString("\n")
		lineMapping = append(lineMapping, lineInfo{filePath: file.Path, lineNo: 0, side: "", isCode: false})
		searchTexts = append(searchTexts, file.Path)
		currentLine++

		filename := file.Path
		if filename == "" {
			filename = file.OldPath
		}

		// Render hunks in split view
		hunks := file.Hunks
		if len(hunks) == 0 && file.Patch != "" {
			hunks = parsePatchToHunks(file.Patch)
		}
		for _, hunk := range hunks {
			if currentLine >= d.maxLines {
				truncated = true
				break
			}
			hunkPositions = append(hunkPositions, currentLine)

			// Hunk header
			header := d.hunkStyle.Render(hunk.Header)
			if currentLine == d.cursor {
				header = d.cursorStyle.Render(header)
			}
			content.WriteString(header)
			content.WriteString("\n")
			lineMapping = append(lineMapping, lineInfo{filePath: file.Path, lineNo: 0, side: "", isCode: false})
			searchTexts = append(searchTexts, hunk.Header)
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

				// Prefer right side unless only left exists
				lineNo := rightLineNo
				side := models.DiffSideRight
				if lineNo == 0 {
					lineNo = leftLineNo
					side = models.DiffSideLeft
				}

				line := leftLine + " │ " + rightLine
				if currentLine == d.cursor {
					line = d.cursorStyle.Render(line)
				}
				content.WriteString(line)
				content.WriteString("\n")
				lineMapping = append(lineMapping, lineInfo{filePath: file.Path, lineNo: lineNo, side: side, isCode: true})
				searchTexts = append(searchTexts, strings.TrimSpace(oldLinesText(oldLines, j)+" "+newLinesText(newLines, j)))
				currentLine++
				if currentLine >= d.maxLines {
					truncated = true
					break
				}
			}

			if truncated {
				break
			}
		}

		if truncated {
			break
		}

		if currentLine == d.cursor {
			content.WriteString(d.cursorStyle.Render(""))
		}
		content.WriteString("\n")
		lineMapping = append(lineMapping, lineInfo{filePath: file.Path, lineNo: 0, side: "", isCode: false})
		searchTexts = append(searchTexts, "")
		currentLine++
	}

	if truncated {
		notice := d.hunkStyle.Render("Diff truncated for performance. Open in browser for full diff.")
		if currentLine == d.cursor {
			notice = d.cursorStyle.Render(notice)
		}
		content.WriteString(notice)
		content.WriteString("\n")
		lineMapping = append(lineMapping, lineInfo{filePath: "", lineNo: 0, side: "", isCode: false})
		searchTexts = append(searchTexts, "truncated")
		currentLine++
	}

	d.hunkPositions = hunkPositions
	d.filePositions = filePositions
	d.lineMapping = lineMapping
	d.searchTexts = searchTexts
	d.clampCursor()
	d.viewport.SetContent(content.String())
	d.bumpContentVersion()
}

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

func oldLinesText(lines []models.DiffLine, idx int) string {
	if idx < 0 || idx >= len(lines) {
		return ""
	}
	return lines[idx].Content
}

func newLinesText(lines []models.DiffLine, idx int) string {
	if idx < 0 || idx >= len(lines) {
		return ""
	}
	return lines[idx].Content
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
func (d *DiffViewer) renderHunk(hunk models.Hunk, filename string) (string, []lineInfo, []string) {
	var content strings.Builder
	var lineMapping []lineInfo
	var searchTexts []string

	// Hunk header
	header := d.hunkStyle.Render(hunk.Header)
	content.WriteString(header)
	content.WriteString("\n")
	lineMapping = append(lineMapping, lineInfo{filePath: filename, lineNo: 0, side: "", isCode: false})
	searchTexts = append(searchTexts, hunk.Header)

	// Lines
	for _, line := range hunk.Lines {
		content.WriteString(d.renderLine(line, filename))
		content.WriteString("\n")

		// Use new line number for mapping, fallback to old if new is not available
		lineNo := line.NewLineNo
		side := models.DiffSideRight
		if lineNo == 0 {
			lineNo = line.OldLineNo
			side = models.DiffSideLeft
		}
		lineMapping = append(lineMapping, lineInfo{
			filePath: filename,
			lineNo:   lineNo,
			side:     side,
			isCode:   true,
		})
		searchTexts = append(searchTexts, line.Content)

		comments := d.lineComments[commentKey(filename, side, lineNo)]
		for _, comment := range comments {
			commentLine := d.renderCommentLine(comment)
			content.WriteString(commentLine)
			content.WriteString("\n")
			lineMapping = append(lineMapping, lineInfo{
				filePath:  filename,
				lineNo:    lineNo,
				side:      side,
				isCode:    false,
				commentID: comment.ID,
				isComment: true,
			})
			searchTexts = append(searchTexts, comment.Body)
		}
	}

	return content.String(), lineMapping, searchTexts
}

func (d *DiffViewer) renderCommentLine(comment models.Comment) string {
	author := strings.TrimSpace(comment.Author.Login)
	if author == "" {
		author = "unknown"
	}
	body := strings.TrimSpace(strings.ReplaceAll(comment.Body, "\n", " "))
	if len(body) > 120 {
		body = body[:117] + "..."
	}
	label := fmt.Sprintf("  [@%s] %s", author, body)
	return d.hunkStyle.Copy().Foreground(lipgloss.Color("205")).Render(label)
}

// renderLine renders a single diff line with syntax highlighting
func (d *DiffViewer) renderLine(line models.DiffLine, filename string) string {
	lineNo := ""
	commentIndicator := " " // Default no indicator

	// Check for comments on this line
	if filename != "" && len(d.lineComments) > 0 {
		// Check both sides for comments
		hasComment := false
		if line.OldLineNo > 0 {
			key := commentKey(filename, models.DiffSideLeft, line.OldLineNo)
			if _, ok := d.lineComments[key]; ok {
				hasComment = true
			}
		}
		if line.NewLineNo > 0 {
			key := commentKey(filename, models.DiffSideRight, line.NewLineNo)
			if _, ok := d.lineComments[key]; ok {
				hasComment = true
			}
		}
		if hasComment {
			// Yellow dot indicator for lines with comments
			commentIndicator = lipgloss.NewStyle().Foreground(lipgloss.Color("220")).Render("●")
		}
	}

	if line.OldLineNo > 0 || line.NewLineNo > 0 {
		old := "   "
		new := "   "
		if line.OldLineNo > 0 {
			old = fmt.Sprintf("%3d", line.OldLineNo)
		}
		if line.NewLineNo > 0 {
			new = fmt.Sprintf("%3d", line.NewLineNo)
		}
		lineNo = d.lineNoStyle.Render(fmt.Sprintf("%s %s ", old, new)) + commentIndicator + d.lineNoStyle.Render("│ ")
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

func parsePatchToHunks(patch string) []models.Hunk {
	lines := strings.Split(patch, "\n")
	var hunks []models.Hunk
	var current *models.Hunk
	oldLine := 0
	newLine := 0

	flush := func() {
		if current != nil {
			hunks = append(hunks, *current)
		}
		current = nil
	}

	for _, raw := range lines {
		if strings.HasPrefix(raw, "@@") {
			flush()
			oldStart, oldCount, newStart, newCount, ok := parseHunkHeader(raw)
			if !ok {
				continue
			}
			current = &models.Hunk{
				OldStart: oldStart,
				OldLines: oldCount,
				NewStart: newStart,
				NewLines: newCount,
				Header:   raw,
			}
			oldLine = oldStart
			newLine = newStart
			continue
		}
		if current == nil {
			continue
		}
		if raw == "" {
			continue
		}
		prefix := raw[0]
		content := raw[1:]
		switch prefix {
		case ' ':
			current.Lines = append(current.Lines, models.DiffLine{
				Type:      models.DiffLineContext,
				Content:   content,
				OldLineNo: oldLine,
				NewLineNo: newLine,
			})
			oldLine++
			newLine++
		case '+':
			current.Lines = append(current.Lines, models.DiffLine{
				Type:      models.DiffLineAdded,
				Content:   content,
				NewLineNo: newLine,
			})
			newLine++
		case '-':
			current.Lines = append(current.Lines, models.DiffLine{
				Type:      models.DiffLineDeleted,
				Content:   content,
				OldLineNo: oldLine,
			})
			oldLine++
		default:
			// Ignore metadata lines like \ No newline at end of file
		}
	}
	flush()
	return hunks
}

func parseHunkHeader(header string) (oldStart, oldCount, newStart, newCount int, ok bool) {
	trimmed := strings.TrimSpace(header)
	if !strings.HasPrefix(trimmed, "@@") {
		return 0, 0, 0, 0, false
	}
	trimmed = strings.TrimPrefix(trimmed, "@@")
	trimmed = strings.TrimSuffix(trimmed, "@@")
	trimmed = strings.TrimSpace(trimmed)

	parts := strings.Fields(trimmed)
	if len(parts) < 2 {
		return 0, 0, 0, 0, false
	}
	oldStart, oldCount, ok = parseHunkRange(parts[0], '-')
	if !ok {
		return 0, 0, 0, 0, false
	}
	newStart, newCount, ok = parseHunkRange(parts[1], '+')
	if !ok {
		return 0, 0, 0, 0, false
	}
	return oldStart, oldCount, newStart, newCount, true
}

func parseHunkRange(token string, prefix byte) (start int, count int, ok bool) {
	token = strings.TrimSpace(token)
	if token == "" || token[0] != prefix {
		return 0, 0, false
	}
	token = token[1:]
	parts := strings.Split(token, ",")
	start, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, false
	}
	count = 1
	if len(parts) > 1 && parts[1] != "" {
		if c, err := strconv.Atoi(parts[1]); err == nil {
			count = c
		}
	}
	return start, count, true
}

// nextFile moves to the next file
func (d *DiffViewer) nextFile() {
	if d.currentFile < len(d.files)-1 {
		d.currentFile++
		if d.currentFile < len(d.filePositions) {
			d.cursor = d.filePositions[d.currentFile]
		}
		d.ensureCursorVisible()
		d.render()
	}
}

// prevFile moves to the previous file
func (d *DiffViewer) prevFile() {
	if d.currentFile > 0 {
		d.currentFile--
		if d.currentFile < len(d.filePositions) {
			d.cursor = d.filePositions[d.currentFile]
		}
		d.ensureCursorVisible()
		d.render()
	}
}

func (d *DiffViewer) scrollToFile(index int) {
	if index < 0 || index >= len(d.filePositions) {
		return
	}
	d.viewport.SetYOffset(d.filePositions[index])
}

func (d *DiffViewer) ensureCursorVisible() {
	if d.cursor < 0 {
		d.cursor = 0
	}
	if len(d.lineMapping) == 0 {
		d.viewport.SetYOffset(0)
		return
	}
	if d.cursor >= len(d.lineMapping) {
		d.cursor = len(d.lineMapping) - 1
	}
	if d.cursor < d.viewport.YOffset {
		d.viewport.SetYOffset(d.cursor)
		return
	}
	bottom := d.viewport.YOffset + d.viewport.Height - 1
	if bottom < d.viewport.YOffset {
		bottom = d.viewport.YOffset
	}
	if d.cursor > bottom {
		d.viewport.SetYOffset(d.cursor - d.viewport.Height + 1)
	}
}

func (d *DiffViewer) clampCursor() {
	if d.cursor < 0 {
		d.cursor = 0
	}
	if len(d.lineMapping) == 0 {
		d.cursor = 0
		return
	}
	if d.cursor >= len(d.lineMapping) {
		d.cursor = len(d.lineMapping) - 1
	}
	d.ensureCursorVisible()
}

func (d *DiffViewer) bumpContentVersion() {
	d.contentVersion++
	d.invalidateCache()
}

func (d *DiffViewer) invalidateCache() {
	d.cachedVersion = -1
	d.cachedView = ""
}

func (d *DiffViewer) applyCursorHighlight(content string, startLine int) string {
	if content == "" {
		return content
	}
	lines := strings.Split(content, "\n")
	for i, line := range lines {
		if line == "" && i == len(lines)-1 {
			continue
		}
		lineIndex := startLine + i
		if d.selectionOn {
			selectionStart := d.selectionFrom
			selectionEnd := d.cursor
			if selectionStart > selectionEnd {
				selectionStart, selectionEnd = selectionEnd, selectionStart
			}
			if lineIndex >= selectionStart && lineIndex <= selectionEnd {
				lines[i] = d.selectStyle.Render(line)
			}
		}
		if lineIndex == d.cursor {
			lines[i] = d.cursorStyle.Render(line)
		}
	}
	return strings.Join(lines, "\n")
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
			d.cursor = pos
			d.ensureCursorVisible()
			d.render()
			return
		}
	}

	// If no hunk found after current position, go to last hunk
	if len(d.hunkPositions) > 0 {
		d.currentHunk = len(d.hunkPositions) - 1
		d.cursor = d.hunkPositions[d.currentHunk]
		d.ensureCursorVisible()
		d.render()
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
			d.cursor = d.hunkPositions[i]
			d.ensureCursorVisible()
			d.render()
			return
		}
	}

	// If no hunk found before current position, go to first hunk
	if len(d.hunkPositions) > 0 {
		d.currentHunk = 0
		d.cursor = d.hunkPositions[d.currentHunk]
		d.ensureCursorVisible()
		d.render()
	}
}

// nextComment moves cursor to the next line that has comments
func (d *DiffViewer) nextComment() {
	if len(d.lineComments) == 0 || len(d.lineMapping) == 0 {
		return
	}

	// Search from cursor+1 to end, then wrap to beginning
	for i := d.cursor + 1; i < len(d.lineMapping); i++ {
		if d.lineHasComment(i) {
			d.cursor = i
			d.ensureCursorVisible()
			d.render()
			return
		}
	}

	// Wrap around to beginning
	for i := 0; i < d.cursor; i++ {
		if d.lineHasComment(i) {
			d.cursor = i
			d.ensureCursorVisible()
			d.render()
			return
		}
	}
}

// prevComment moves cursor to the previous line that has comments
func (d *DiffViewer) prevComment() {
	if len(d.lineComments) == 0 || len(d.lineMapping) == 0 {
		return
	}

	// Search from cursor-1 to beginning, then wrap to end
	for i := d.cursor - 1; i >= 0; i-- {
		if d.lineHasComment(i) {
			d.cursor = i
			d.ensureCursorVisible()
			d.render()
			return
		}
	}

	// Wrap around to end
	for i := len(d.lineMapping) - 1; i > d.cursor; i-- {
		if d.lineHasComment(i) {
			d.cursor = i
			d.ensureCursorVisible()
			d.render()
			return
		}
	}
}

// lineHasComment checks if a line at the given index has comments
func (d *DiffViewer) lineHasComment(index int) bool {
	if index < 0 || index >= len(d.lineMapping) {
		return false
	}

	info := d.lineMapping[index]
	if !info.isCode || info.filePath == "" {
		return false
	}

	// Check both sides for comments
	if info.lineNo > 0 {
		leftKey := commentKey(info.filePath, models.DiffSideLeft, info.lineNo)
		if _, ok := d.lineComments[leftKey]; ok {
			return true
		}
		rightKey := commentKey(info.filePath, models.DiffSideRight, info.lineNo)
		if _, ok := d.lineComments[rightKey]; ok {
			return true
		}
	}

	return false
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

// CurrentLineInfo returns information about the current cursor line.
func (d *DiffViewer) CurrentLineInfo() (filePath string, lineNo int, side models.DiffSide, isCode bool) {
	if d.cursor < 0 || d.cursor >= len(d.lineMapping) {
		return "", 0, "", false
	}

	info := d.lineMapping[d.cursor]
	return info.filePath, info.lineNo, info.side, info.isCode
}

// CurrentCommentID returns the comment id if cursor is on an inline comment line.
func (d *DiffViewer) CurrentCommentID() string {
	if d.cursor < 0 || d.cursor >= len(d.lineMapping) {
		return ""
	}
	info := d.lineMapping[d.cursor]
	if !info.isComment {
		return ""
	}
	return info.commentID
}

// JumpToLine moves cursor to the closest mapped line for a file/line/side.
func (d *DiffViewer) JumpToLine(path string, line int, side models.DiffSide) bool {
	if path == "" || line <= 0 || len(d.lineMapping) == 0 {
		return false
	}
	best := -1
	for i, info := range d.lineMapping {
		if info.filePath != path || !info.isCode {
			continue
		}
		if info.lineNo == line && (side == "" || info.side == side) {
			best = i
			break
		}
		if best == -1 && info.lineNo == line {
			best = i
		}
	}
	if best == -1 {
		return false
	}
	d.cursor = best
	d.ensureCursorVisible()
	d.render()
	return true
}

// FindNext moves cursor to the next line containing query.
func (d *DiffViewer) FindNext(query string) bool {
	return d.find(query, true)
}

// FindPrev moves cursor to the previous line containing query.
func (d *DiffViewer) FindPrev(query string) bool {
	return d.find(query, false)
}

func (d *DiffViewer) find(query string, forward bool) bool {
	q := strings.ToLower(strings.TrimSpace(query))
	if q == "" || len(d.searchTexts) == 0 {
		return false
	}

	n := len(d.searchTexts)
	start := d.cursor
	for step := 1; step <= n; step++ {
		idx := 0
		if forward {
			idx = (start + step) % n
		} else {
			idx = (start - step + n) % n
		}
		if strings.Contains(strings.ToLower(d.searchTexts[idx]), q) {
			d.cursor = idx
			d.ensureCursorVisible()
			d.render()
			return true
		}
	}
	return false
}

// EnsureCursorOnCodeLine moves the cursor to the nearest code line if needed.
func (d *DiffViewer) EnsureCursorOnCodeLine() bool {
	if len(d.lineMapping) == 0 {
		return false
	}
	if _, _, _, isCode := d.CurrentLineInfo(); isCode {
		return true
	}

	// Search forward
	for i := d.cursor + 1; i < len(d.lineMapping); i++ {
		if d.lineMapping[i].isCode {
			d.cursor = i
			d.ensureCursorVisible()
			d.render()
			return true
		}
	}
	// Search backward
	for i := d.cursor - 1; i >= 0; i-- {
		if d.lineMapping[i].isCode {
			d.cursor = i
			d.ensureCursorVisible()
			d.render()
			return true
		}
	}

	return false
}

// GetLineInfoAt returns information about a specific line in the viewport
func (d *DiffViewer) GetLineInfoAt(offset int) (filePath string, lineNo int, side models.DiffSide, isCode bool) {
	if offset < 0 || offset >= len(d.lineMapping) {
		return "", 0, "", false
	}

	info := d.lineMapping[offset]
	return info.filePath, info.lineNo, info.side, info.isCode
}

// SetThemeColors applies diff colors at runtime.
func (d *DiffViewer) SetThemeColors(added, deleted, context, hunk, lineNo, file, cursorBg, selectBg string) {
	d.addedStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(added))
	d.deletedStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(deleted))
	d.contextStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(context))
	d.hunkStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(hunk))
	d.lineNoStyle = lipgloss.NewStyle().Foreground(lipgloss.Color(lineNo))
	d.fileStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(file))
	d.cursorStyle = lipgloss.NewStyle().Background(lipgloss.Color(cursorBg))
	d.selectStyle = lipgloss.NewStyle().Background(lipgloss.Color(selectBg))
	d.render()
}

// Status returns a formatted status string showing current position
func (d *DiffViewer) Status() string {
	if d.diff == nil || len(d.files) == 0 {
		return ""
	}

	// File position
	filePos := fmt.Sprintf("File %d/%d", d.currentFile+1, len(d.files))

	// Count total hunks and find current hunk position
	totalHunks := 0
	currentHunkGlobal := 0
	for i, file := range d.files {
		if i < d.currentFile {
			currentHunkGlobal += len(file.Hunks)
		} else if i == d.currentFile {
			currentHunkGlobal += d.currentHunk + 1
		}
		totalHunks += len(file.Hunks)
	}

	hunkPos := ""
	if totalHunks > 0 {
		hunkPos = fmt.Sprintf(" | Hunk %d/%d", currentHunkGlobal, totalHunks)
	}

	// Total additions/deletions
	changes := fmt.Sprintf(" | +%d -%d", d.diff.Additions, d.diff.Deletions)

	return filePos + hunkPos + changes
}

// CurrentHunk returns the current hunk index within the current file
func (d *DiffViewer) CurrentHunk() int {
	return d.currentHunk
}

// HunkCount returns the total number of hunks in the current file
func (d *DiffViewer) HunkCount() int {
	if d.currentFile < len(d.files) {
		return len(d.files[d.currentFile].Hunks)
	}
	return 0
}
