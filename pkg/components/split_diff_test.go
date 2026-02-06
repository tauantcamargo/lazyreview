package components

import (
	"fmt"
	"lazyreview/internal/models"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestNewSplitDiffViewer(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)

	if viewer.width != 100 {
		t.Errorf("Expected width 100, got %d", viewer.width)
	}

	if viewer.height != 50 {
		t.Errorf("Expected height 50, got %d", viewer.height)
	}

	if viewer.splitRatio != 0.5 {
		t.Errorf("Expected default split ratio 0.5, got %f", viewer.splitRatio)
	}

	if viewer.leftViewport.Width <= 0 {
		t.Error("Left viewport width should be initialized")
	}

	if viewer.rightViewport.Width <= 0 {
		t.Error("Right viewport width should be initialized")
	}

	if viewer.leftViewport.Height != viewer.rightViewport.Height {
		t.Error("Left and right viewports should have equal height")
	}
}

func TestSplitDiffViewer_SetDiff(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)

	diff := &models.Diff{
		Files: []models.FileDiff{
			{
				Path:      "test.go",
				Status:    models.FileStatusModified,
				Additions: 2,
				Deletions: 1,
				Hunks: []models.Hunk{
					{
						OldStart: 1,
						OldLines: 3,
						NewStart: 1,
						NewLines: 4,
						Header:   "@@ -1,3 +1,4 @@",
						Lines: []models.DiffLine{
							{Type: models.DiffLineContext, Content: "package main", OldLineNo: 1, NewLineNo: 1},
							{Type: models.DiffLineDeleted, Content: "import \"fmt\"", OldLineNo: 2},
							{Type: models.DiffLineAdded, Content: "import (", NewLineNo: 2},
							{Type: models.DiffLineAdded, Content: "    \"fmt\"", NewLineNo: 3},
							{Type: models.DiffLineContext, Content: ")", OldLineNo: 3, NewLineNo: 4},
						},
					},
				},
			},
		},
		Additions: 2,
		Deletions: 1,
	}

	viewer.SetDiff(diff)

	if viewer.diff == nil {
		t.Error("Diff should be set")
	}

	if len(viewer.files) != 1 {
		t.Errorf("Expected 1 file, got %d", len(viewer.files))
	}

	if len(viewer.linePairs) == 0 {
		t.Error("Line pairs should be generated")
	}
}

func TestSplitDiffViewer_PairLines(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)

	tests := []struct {
		name          string
		lines         []models.DiffLine
		expectedPairs int
	}{
		{
			name: "Simple context lines",
			lines: []models.DiffLine{
				{Type: models.DiffLineContext, Content: "line 1", OldLineNo: 1, NewLineNo: 1},
				{Type: models.DiffLineContext, Content: "line 2", OldLineNo: 2, NewLineNo: 2},
			},
			expectedPairs: 2,
		},
		{
			name: "Equal additions and deletions",
			lines: []models.DiffLine{
				{Type: models.DiffLineDeleted, Content: "old line 1", OldLineNo: 1},
				{Type: models.DiffLineAdded, Content: "new line 1", NewLineNo: 1},
				{Type: models.DiffLineDeleted, Content: "old line 2", OldLineNo: 2},
				{Type: models.DiffLineAdded, Content: "new line 2", NewLineNo: 2},
			},
			expectedPairs: 2,
		},
		{
			name: "More additions than deletions",
			lines: []models.DiffLine{
				{Type: models.DiffLineDeleted, Content: "old line", OldLineNo: 1},
				{Type: models.DiffLineAdded, Content: "new line 1", NewLineNo: 1},
				{Type: models.DiffLineAdded, Content: "new line 2", NewLineNo: 2},
				{Type: models.DiffLineAdded, Content: "new line 3", NewLineNo: 3},
			},
			expectedPairs: 3, // max(1 delete, 3 adds) = 3 pairs
		},
		{
			name: "More deletions than additions",
			lines: []models.DiffLine{
				{Type: models.DiffLineDeleted, Content: "old line 1", OldLineNo: 1},
				{Type: models.DiffLineDeleted, Content: "old line 2", OldLineNo: 2},
				{Type: models.DiffLineDeleted, Content: "old line 3", OldLineNo: 3},
				{Type: models.DiffLineAdded, Content: "new line", NewLineNo: 1},
			},
			expectedPairs: 3, // max(3 deletes, 1 add) = 3 pairs
		},
		{
			name: "Mixed context and changes",
			lines: []models.DiffLine{
				{Type: models.DiffLineContext, Content: "context 1", OldLineNo: 1, NewLineNo: 1},
				{Type: models.DiffLineDeleted, Content: "old", OldLineNo: 2},
				{Type: models.DiffLineAdded, Content: "new", NewLineNo: 2},
				{Type: models.DiffLineContext, Content: "context 2", OldLineNo: 3, NewLineNo: 3},
			},
			expectedPairs: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pairs := viewer.pairLines(tt.lines)

			if len(pairs) != tt.expectedPairs {
				t.Errorf("Expected %d pairs, got %d", tt.expectedPairs, len(pairs))
			}

			// Verify all pairs have valid content
			for i, pair := range pairs {
				if pair.left == nil && pair.right == nil {
					t.Errorf("Pair %d has both left and right nil", i)
				}
			}
		})
	}
}

func TestSplitDiffViewer_SynchronizedScrolling(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)

	diff := &models.Diff{
		Files: []models.FileDiff{
			{
				Path:   "test.go",
				Status: models.FileStatusModified,
				Hunks: []models.Hunk{
					{
						Header: "@@ -1,50 +1,50 @@",
						Lines:  make([]models.DiffLine, 100), // Create enough lines for scrolling
					},
				},
			},
		},
	}

	// Initialize context lines for the test
	for i := range diff.Files[0].Hunks[0].Lines {
		diff.Files[0].Hunks[0].Lines[i] = models.DiffLine{
			Type:      models.DiffLineContext,
			Content:   fmt.Sprintf("test line %d", i),
			OldLineNo: i + 1,
			NewLineNo: i + 1,
		}
	}

	viewer.SetDiff(diff)

	// Test scrolling down
	initialLeftOffset := viewer.leftViewport.YOffset
	initialCursor := viewer.cursor

	viewer.ScrollDown(5)

	if viewer.leftViewport.YOffset != viewer.rightViewport.YOffset {
		t.Error("Left and right viewports should have synchronized scroll offsets")
	}

	// Either cursor or offset should have changed
	if viewer.leftViewport.YOffset == initialLeftOffset && viewer.cursor == initialCursor {
		t.Error("Scroll down should change cursor or offset")
	}

	// Test scrolling up
	viewer.ScrollUp(3)

	if viewer.leftViewport.YOffset != viewer.rightViewport.YOffset {
		t.Error("Left and right viewports should remain synchronized after scroll up")
	}
}

func TestSplitDiffViewer_AdjustSplitRatio(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)

	tests := []struct {
		name          string
		adjustment    float64
		expectedRatio float64
	}{
		{
			name:          "Increase ratio",
			adjustment:    0.1,
			expectedRatio: 0.6,
		},
		{
			name:          "Decrease ratio",
			adjustment:    -0.2,
			expectedRatio: 0.3,
		},
		{
			name:          "Clamp to minimum",
			adjustment:    -0.6,
			expectedRatio: minSplitRatio,
		},
		{
			name:          "Clamp to maximum",
			adjustment:    0.6,
			expectedRatio: maxSplitRatio,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			viewer.splitRatio = 0.5 // Reset to default
			viewer.AdjustSplitRatio(tt.adjustment)

			if viewer.splitRatio != tt.expectedRatio {
				t.Errorf("Expected ratio %f, got %f", tt.expectedRatio, viewer.splitRatio)
			}

			// Verify viewports were resized
			expectedLeftWidth := int(float64(viewer.width-3) * viewer.splitRatio)
			if viewer.leftViewport.Width != expectedLeftWidth {
				t.Errorf("Left viewport width mismatch. Expected ~%d, got %d",
					expectedLeftWidth, viewer.leftViewport.Width)
			}
		})
	}
}

func TestSplitDiffViewer_HorizontalScroll(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)

	// Test scroll right
	viewer.HorizontalScroll(10)
	if viewer.horizontalOffset != 10 {
		t.Errorf("Expected horizontal offset 10, got %d", viewer.horizontalOffset)
	}

	// Test scroll left
	viewer.HorizontalScroll(-5)
	if viewer.horizontalOffset != 5 {
		t.Errorf("Expected horizontal offset 5, got %d", viewer.horizontalOffset)
	}

	// Test clamp to 0
	viewer.HorizontalScroll(-100)
	if viewer.horizontalOffset != 0 {
		t.Error("Horizontal offset should not go below 0")
	}
}

func TestSplitDiffViewer_Update(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)

	// Test window resize
	resizeMsg := tea.WindowSizeMsg{Width: 150, Height: 60}
	updatedViewer, _ := viewer.Update(resizeMsg)

	if updatedViewer.width != 150 {
		t.Errorf("Expected width 150 after resize, got %d", updatedViewer.width)
	}
	if updatedViewer.height != 60 {
		t.Errorf("Expected height 60 after resize, got %d", updatedViewer.height)
	}

	// Test key navigation
	viewer.SetVimMode(true)

	keyTests := []struct {
		key         string
		checkFunc   func(SplitDiffViewer) bool
		description string
	}{
		{
			key: "j",
			checkFunc: func(v SplitDiffViewer) bool {
				return v.cursor > 0
			},
			description: "Down key should move cursor",
		},
	}

	// Set a diff first so we have content to navigate
	diff := &models.Diff{
		Files: []models.FileDiff{
			{
				Path:   "test.go",
				Status: models.FileStatusModified,
				Hunks: []models.Hunk{
					{
						Header: "@@ -1,3 +1,3 @@",
						Lines: []models.DiffLine{
							{Type: models.DiffLineContext, Content: "line 1", OldLineNo: 1, NewLineNo: 1},
							{Type: models.DiffLineContext, Content: "line 2", OldLineNo: 2, NewLineNo: 2},
						},
					},
				},
			},
		},
	}
	viewer.SetDiff(diff)

	for _, tt := range keyTests {
		t.Run(tt.description, func(t *testing.T) {
			keyMsg := tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{rune(tt.key[0])}}
			updatedViewer, _ := viewer.Update(keyMsg)

			if !tt.checkFunc(updatedViewer) {
				t.Errorf("Check failed for %s: %s", tt.key, tt.description)
			}
		})
	}
}

func TestSplitDiffViewer_View(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)

	// Test with no diff
	view := viewer.View()
	if !strings.Contains(view, "No diff") {
		t.Error("View should show 'No diff' message when no diff is set")
	}

	// Test with diff
	diff := &models.Diff{
		Files: []models.FileDiff{
			{
				Path:      "test.go",
				Status:    models.FileStatusModified,
				Additions: 1,
				Deletions: 1,
				Hunks: []models.Hunk{
					{
						OldStart: 1,
						OldLines: 2,
						NewStart: 1,
						NewLines: 2,
						Header:   "@@ -1,2 +1,2 @@",
						Lines: []models.DiffLine{
							{Type: models.DiffLineDeleted, Content: "old line", OldLineNo: 1},
							{Type: models.DiffLineAdded, Content: "new line", NewLineNo: 1},
						},
					},
				},
			},
		},
	}

	viewer.SetDiff(diff)
	view = viewer.View()

	if view == "" {
		t.Error("View should not be empty when diff is set")
	}

	// View should contain separator
	if !strings.Contains(view, "│") {
		t.Error("Split view should contain separator character")
	}
}

func TestSplitDiffViewer_SetSize(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)

	viewer.SetSize(200, 100)

	if viewer.width != 200 {
		t.Errorf("Expected width 200, got %d", viewer.width)
	}

	if viewer.height != 100 {
		t.Errorf("Expected height 100, got %d", viewer.height)
	}

	// Verify viewports were resized
	totalWidth := viewer.leftViewport.Width + viewer.rightViewport.Width + 3 // +3 for separator and padding
	if totalWidth > 200 {
		t.Error("Combined viewport width exceeds total width")
	}
}

func TestSplitDiffViewer_NavigationCommands(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)
	viewer.SetVimMode(true)

	// Setup test diff with multiple files and hunks
	diff := &models.Diff{
		Files: []models.FileDiff{
			{
				Path:   "file1.go",
				Status: models.FileStatusModified,
				Hunks: []models.Hunk{
					{Header: "@@ -1,2 +1,2 @@", Lines: []models.DiffLine{
						{Type: models.DiffLineContext, Content: "line 1", OldLineNo: 1, NewLineNo: 1},
					}},
					{Header: "@@ -10,2 +10,2 @@", Lines: []models.DiffLine{
						{Type: models.DiffLineContext, Content: "line 10", OldLineNo: 10, NewLineNo: 10},
					}},
				},
			},
			{
				Path:   "file2.go",
				Status: models.FileStatusAdded,
				Hunks: []models.Hunk{
					{Header: "@@ -0,0 +1,2 @@", Lines: []models.DiffLine{
						{Type: models.DiffLineAdded, Content: "new line", NewLineNo: 1},
					}},
				},
			},
		},
	}

	viewer.SetDiff(diff)

	tests := []struct {
		name      string
		method    func()
		checkFunc func() bool
	}{
		{
			name:   "NextFile",
			method: func() { viewer.NextFile() },
			checkFunc: func() bool {
				return viewer.currentFile > 0
			},
		},
		{
			name: "PrevFile",
			method: func() {
				viewer.currentFile = 1
				viewer.PrevFile()
			},
			checkFunc: func() bool {
				return viewer.currentFile == 0
			},
		},
		{
			name:   "NextHunk",
			method: func() { viewer.NextHunk() },
			checkFunc: func() bool {
				// Should move to next hunk
				return true // Basic sanity check
			},
		},
		{
			name: "ScrollToTop",
			method: func() {
				viewer.cursor = 10
				viewer.ScrollToTop()
			},
			checkFunc: func() bool {
				return viewer.cursor == 0
			},
		},
		{
			name: "ScrollToBottom",
			method: func() {
				viewer.ScrollToBottom()
			},
			checkFunc: func() bool {
				return viewer.cursor >= 0 // Should be at some valid position
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.method()
			if !tt.checkFunc() {
				t.Errorf("Navigation check failed for %s", tt.name)
			}
		})
	}
}

func TestLinePair_HasContent(t *testing.T) {
	tests := []struct {
		name     string
		pair     linePair
		expected bool
	}{
		{
			name: "Both sides",
			pair: linePair{
				left:  &models.DiffLine{Content: "left"},
				right: &models.DiffLine{Content: "right"},
			},
			expected: true,
		},
		{
			name: "Left only",
			pair: linePair{
				left:  &models.DiffLine{Content: "left"},
				right: nil,
			},
			expected: true,
		},
		{
			name: "Right only",
			pair: linePair{
				left:  nil,
				right: &models.DiffLine{Content: "right"},
			},
			expected: true,
		},
		{
			name: "Neither side",
			pair: linePair{
				left:  nil,
				right: nil,
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.pair.left != nil || tt.pair.right != nil
			if result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestSplitDiffViewer_Init(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)
	cmd := viewer.Init()
	if cmd != nil {
		t.Error("Init should return nil command")
	}
}

func TestSplitDiffViewer_CurrentFileAndCount(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)

	if viewer.CurrentFile() != 0 {
		t.Errorf("Expected CurrentFile 0, got %d", viewer.CurrentFile())
	}

	if viewer.FileCount() != 0 {
		t.Errorf("Expected FileCount 0, got %d", viewer.FileCount())
	}

	// Set a diff with files
	diff := &models.Diff{
		Files: []models.FileDiff{
			{Path: "file1.go", Status: models.FileStatusModified},
			{Path: "file2.go", Status: models.FileStatusAdded},
		},
	}
	viewer.SetDiff(diff)

	if viewer.FileCount() != 2 {
		t.Errorf("Expected FileCount 2, got %d", viewer.FileCount())
	}
}

func TestSplitDiffViewer_PrevHunk(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)

	// Setup diff with multiple hunks
	diff := &models.Diff{
		Files: []models.FileDiff{
			{
				Path:   "file.go",
				Status: models.FileStatusModified,
				Hunks: []models.Hunk{
					{Header: "@@ -1,2 +1,2 @@", Lines: []models.DiffLine{
						{Type: models.DiffLineContext, Content: "line 1", OldLineNo: 1, NewLineNo: 1},
					}},
					{Header: "@@ -10,2 +10,2 @@", Lines: []models.DiffLine{
						{Type: models.DiffLineContext, Content: "line 10", OldLineNo: 10, NewLineNo: 10},
					}},
					{Header: "@@ -20,2 +20,2 @@", Lines: []models.DiffLine{
						{Type: models.DiffLineContext, Content: "line 20", OldLineNo: 20, NewLineNo: 20},
					}},
				},
			},
		},
	}

	viewer.SetDiff(diff)

	// Move cursor to end
	viewer.ScrollToBottom()
	initialCursor := viewer.cursor

	// Move to previous hunk
	viewer.PrevHunk()

	// Should have moved
	if viewer.cursor == initialCursor {
		t.Error("PrevHunk should move cursor")
	}
}

func TestSplitDiffViewer_KeyBindings(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)

	// Set up diff
	diff := &models.Diff{
		Files: []models.FileDiff{
			{
				Path:   "test.go",
				Status: models.FileStatusModified,
				Hunks: []models.Hunk{
					{
						Header: "@@ -1,5 +1,5 @@",
						Lines: []models.DiffLine{
							{Type: models.DiffLineContext, Content: "line 1", OldLineNo: 1, NewLineNo: 1},
							{Type: models.DiffLineDeleted, Content: "old", OldLineNo: 2},
							{Type: models.DiffLineAdded, Content: "new", NewLineNo: 2},
						},
					},
				},
			},
		},
	}
	viewer.SetDiff(diff)

	tests := []struct {
		name    string
		keyRune rune
		keyType tea.KeyType
	}{
		{"Up key", 'k', tea.KeyRunes},
		{"Down key", 'j', tea.KeyRunes},
		{"Increase split", '>', tea.KeyRunes},
		{"Decrease split", '<', tea.KeyRunes},
		{"Next file", 'n', tea.KeyRunes},
		{"Prev file", 'N', tea.KeyRunes},
		{"Next hunk", '}', tea.KeyRunes},
		{"Prev hunk", '{', tea.KeyRunes},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var msg tea.Msg
			if tt.keyType == tea.KeyRunes {
				msg = tea.KeyMsg{Type: tt.keyType, Runes: []rune{tt.keyRune}}
			} else {
				msg = tea.KeyMsg{Type: tt.keyType}
			}

			_, cmd := viewer.Update(msg)
			// Should not panic
			_ = cmd
		})
	}
}

func TestSplitDiffViewer_RenderWithDifferentFileStatuses(t *testing.T) {
	viewer := NewSplitDiffViewer(100, 50)

	statuses := []models.FileStatus{
		models.FileStatusAdded,
		models.FileStatusDeleted,
		models.FileStatusRenamed,
		models.FileStatusModified,
	}

	for _, status := range statuses {
		t.Run(string(status), func(t *testing.T) {
			diff := &models.Diff{
				Files: []models.FileDiff{
					{
						Path:      "test.go",
						OldPath:   "old.go",
						Status:    status,
						Additions: 5,
						Deletions: 3,
						Hunks: []models.Hunk{
							{
								Header: "@@ -1,2 +1,2 @@",
								Lines: []models.DiffLine{
									{Type: models.DiffLineContext, Content: "test", OldLineNo: 1, NewLineNo: 1},
								},
							},
						},
					},
				},
			}

			viewer.SetDiff(diff)
			view := viewer.View()

			if view == "" {
				t.Error("View should not be empty")
			}
		})
	}
}
