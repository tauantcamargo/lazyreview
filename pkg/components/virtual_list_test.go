package components

import (
	"fmt"
	"testing"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
)

// TestVirtualList_ViewportCalculation tests the core viewport calculation logic
func TestVirtualList_ViewportCalculation(t *testing.T) {
	tests := []struct {
		name           string
		totalItems     int
		visibleHeight  int
		cursor         int
		buffer         int
		expectedStart  int
		expectedEnd    int
		expectedBuffer int
	}{
		{
			name:           "Start of list",
			totalItems:     100,
			visibleHeight:  10,
			cursor:         0,
			buffer:         5,
			expectedStart:  0,  // Can't go below 0
			expectedEnd:    14, // 10 visible (0-9) + 5 buffer = 14
			expectedBuffer: 5,
		},
		{
			name:           "Middle of list",
			totalItems:     100,
			visibleHeight:  10,
			cursor:         50,
			buffer:         5,
			expectedStart:  40, // cursor(50) - half(5) = 45, minus buffer(5) = 40
			expectedEnd:    59, // cursor(50) + half(5) - 1 = 54, plus buffer(5) = 59
			expectedBuffer: 5,
		},
		{
			name:           "End of list",
			totalItems:     100,
			visibleHeight:  10,
			cursor:         99,
			buffer:         5,
			expectedStart:  85, // itemCount(100) - visible(10) = 90, minus buffer(5) = 85
			expectedEnd:    99, // Can't go above 99
			expectedBuffer: 5,
		},
		{
			name:           "Small list fits in viewport",
			totalItems:     5,
			visibleHeight:  10,
			cursor:         2,
			buffer:         5,
			expectedStart:  0,
			expectedEnd:    4,
			expectedBuffer: 0,
		},
		{
			name:           "Zero buffer",
			totalItems:     100,
			visibleHeight:  10,
			cursor:         50,
			buffer:         0,
			expectedStart:  45, // 50 - 5 = 45
			expectedEnd:    54, // 45 + 10 - 1 = 54 (inclusive)
			expectedBuffer: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			items := make([]list.Item, tt.totalItems)
			for i := 0; i < tt.totalItems; i++ {
				items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
			}

			// Calculate height to fit exactly visibleHeight items
			// itemHeight = 3 (title + description + padding)
			// availableHeight = height (with no status/help/title)
			// visibleItems = availableHeight / itemHeight
			// So: height = visibleItems * itemHeight
			totalHeight := tt.visibleHeight * 3
			vl := NewVirtualList("Test", items, 80, totalHeight)
			vl.buffer = tt.buffer
			vl.cursor = tt.cursor
			vl.itemHeight = 3
			vl.showStatusBar = false
			vl.showHelp = false
			vl.title = "" // Remove title to simplify calculation

			start, end := vl.calculateViewport()

			if start != tt.expectedStart {
				t.Errorf("expected start %d, got %d (visibleItems=%d)", tt.expectedStart, start, vl.visibleItemCount())
			}
			if end != tt.expectedEnd {
				t.Errorf("expected end %d, got %d (visibleItems=%d)", tt.expectedEnd, end, vl.visibleItemCount())
			}
		})
	}
}

// TestVirtualList_Navigation tests cursor movement
func TestVirtualList_Navigation(t *testing.T) {
	items := make([]list.Item, 100)
	for i := 0; i < 100; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
	}

	vl := NewVirtualList("Test", items, 80, 10)

	// Test down navigation
	t.Run("Down navigation", func(t *testing.T) {
		vl.cursor = 0
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		if vl.cursor != 1 {
			t.Errorf("expected cursor 1, got %d", vl.cursor)
		}
	})

	// Test up navigation
	t.Run("Up navigation", func(t *testing.T) {
		vl.cursor = 5
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'k'}})
		if vl.cursor != 4 {
			t.Errorf("expected cursor 4, got %d", vl.cursor)
		}
	})

	// Test top navigation
	t.Run("Jump to top", func(t *testing.T) {
		vl.cursor = 50
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})
		if vl.cursor != 0 {
			t.Errorf("expected cursor 0, got %d", vl.cursor)
		}
	})

	// Test bottom navigation
	t.Run("Jump to bottom", func(t *testing.T) {
		vl.cursor = 0
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'G'}})
		if vl.cursor != 99 {
			t.Errorf("expected cursor 99, got %d", vl.cursor)
		}
	})

	// Test boundary conditions
	t.Run("Up at top", func(t *testing.T) {
		vl.cursor = 0
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'k'}})
		if vl.cursor != 0 {
			t.Errorf("expected cursor to stay at 0, got %d", vl.cursor)
		}
	})

	t.Run("Down at bottom", func(t *testing.T) {
		vl.cursor = 99
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		if vl.cursor != 99 {
			t.Errorf("expected cursor to stay at 99, got %d", vl.cursor)
		}
	})
}

// TestVirtualList_PageNavigation tests page up/down
func TestVirtualList_PageNavigation(t *testing.T) {
	items := make([]list.Item, 100)
	for i := 0; i < 100; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
	}

	// Setup for 10 visible items: height = visibleItems * itemHeight
	vl := NewVirtualList("Test", items, 80, 30) // 10 * 3 = 30
	vl.itemHeight = 3
	vl.showStatusBar = false
	vl.showHelp = false
	vl.title = ""

	t.Run("Page down", func(t *testing.T) {
		vl.cursor = 0
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyCtrlD})
		expected := 5 // half page (10/2 = 5)
		if vl.cursor != expected {
			t.Errorf("expected cursor %d, got %d", expected, vl.cursor)
		}
	})

	t.Run("Page up", func(t *testing.T) {
		vl.cursor = 10
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyCtrlU})
		expected := 5 // half page back
		if vl.cursor != expected {
			t.Errorf("expected cursor %d, got %d", expected, vl.cursor)
		}
	})

	t.Run("Page down near end", func(t *testing.T) {
		vl.cursor = 96
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyCtrlD})
		if vl.cursor != 99 {
			t.Errorf("expected cursor 99 (clamped), got %d", vl.cursor)
		}
	})

	t.Run("Page up at start", func(t *testing.T) {
		vl.cursor = 2
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyCtrlU})
		if vl.cursor != 0 {
			t.Errorf("expected cursor 0 (clamped), got %d", vl.cursor)
		}
	})
}

// TestVirtualList_RenderedItems tests that only visible items are rendered
func TestVirtualList_RenderedItems(t *testing.T) {
	items := make([]list.Item, 1000)
	for i := 0; i < 1000; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
	}

	vl := NewVirtualList("Test", items, 80, 10)
	vl.buffer = 5

	t.Run("Renders only visible range", func(t *testing.T) {
		vl.cursor = 100
		start, end := vl.calculateViewport()

		// With buffer of 5, should render ~20 items (10 visible + 5 before + 5 after)
		renderedCount := end - start + 1
		if renderedCount > 25 { // Allow some margin
			t.Errorf("expected to render ~20 items, got %d", renderedCount)
		}
	})

	t.Run("Start position at top", func(t *testing.T) {
		vl.cursor = 0
		start, _ := vl.calculateViewport()
		if start != 0 {
			t.Errorf("expected start 0, got %d", start)
		}
	})

	t.Run("End position at bottom", func(t *testing.T) {
		vl.cursor = 999
		_, end := vl.calculateViewport()
		if end != 999 {
			t.Errorf("expected end 999, got %d", end)
		}
	})
}

// TestVirtualList_MemoryConstant tests that memory usage is constant
func TestVirtualList_MemoryConstant(t *testing.T) {
	// This is more of a conceptual test - in production we'd measure actual memory
	t.Run("Small list", func(t *testing.T) {
		items := make([]list.Item, 100)
		for i := 0; i < 100; i++ {
			items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
		}

		vl := NewVirtualList("Test", items, 80, 10)
		start, end := vl.calculateViewport()
		smallRendered := end - start + 1

		if smallRendered > 30 {
			t.Errorf("rendering too many items for small list: %d", smallRendered)
		}
	})

	t.Run("Large list", func(t *testing.T) {
		items := make([]list.Item, 10000)
		for i := 0; i < 10000; i++ {
			items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
		}

		vl := NewVirtualList("Test", items, 80, 10)
		vl.cursor = 5000
		start, end := vl.calculateViewport()
		largeRendered := end - start + 1

		if largeRendered > 30 {
			t.Errorf("rendering too many items for large list: %d", largeRendered)
		}
	})
}

// TestVirtualList_FilterMaintainsVirtualScroll tests filtering behavior
func TestVirtualList_FilterMaintainsVirtualScroll(t *testing.T) {
	items := make([]list.Item, 100)
	for i := 0; i < 100; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
	}

	vl := NewVirtualList("Test", items, 80, 10)

	t.Run("Filter reduces visible items", func(t *testing.T) {
		// Simulate filtering - this would normally be handled by the filter logic
		filteredItems := make([]list.Item, 10)
		for i := 0; i < 10; i++ {
			filteredItems[i] = items[i]
		}

		vl.items = filteredItems
		vl.filteredItems = filteredItems
		vl.cursor = 0

		start, end := vl.calculateViewport()
		renderedCount := end - start + 1

		if renderedCount > 20 {
			t.Errorf("filtered list rendering too many items: %d", renderedCount)
		}
	})
}

// TestVirtualList_Resize tests window resize behavior
func TestVirtualList_Resize(t *testing.T) {
	items := make([]list.Item, 100)
	for i := 0; i < 100; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
	}

	vl := NewVirtualList("Test", items, 80, 10)
	vl.cursor = 50

	t.Run("Resize maintains cursor position", func(t *testing.T) {
		oldCursor := vl.cursor
		vl, _ = vl.Update(tea.WindowSizeMsg{Width: 100, Height: 20})

		if vl.cursor != oldCursor {
			t.Errorf("cursor changed after resize: expected %d, got %d", oldCursor, vl.cursor)
		}

		if vl.height != 20 {
			t.Errorf("height not updated: expected 20, got %d", vl.height)
		}

		if vl.width != 100 {
			t.Errorf("width not updated: expected 100, got %d", vl.width)
		}
	})
}

// TestVirtualList_EmptyList tests behavior with empty list
func TestVirtualList_EmptyList(t *testing.T) {
	vl := NewVirtualList("Test", []list.Item{}, 80, 10)

	t.Run("Empty list navigation", func(t *testing.T) {
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		if vl.cursor != 0 {
			t.Errorf("cursor should stay at 0 for empty list, got %d", vl.cursor)
		}

		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'k'}})
		if vl.cursor != 0 {
			t.Errorf("cursor should stay at 0 for empty list, got %d", vl.cursor)
		}
	})

	t.Run("Empty list viewport", func(t *testing.T) {
		start, end := vl.calculateViewport()
		if start != 0 || end != -1 {
			t.Errorf("empty list viewport should be (0, -1), got (%d, %d)", start, end)
		}
	})
}

// TestVirtualList_SelectedItem tests selection
func TestVirtualList_SelectedItem(t *testing.T) {
	items := make([]list.Item, 100)
	for i := 0; i < 100; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), fmt.Sprintf("Description %d", i))
	}

	vl := NewVirtualList("Test", items, 80, 10)
	vl.cursor = 42

	t.Run("SelectedItem returns correct item", func(t *testing.T) {
		selected := vl.SelectedItem()
		if selected == nil {
			t.Fatal("SelectedItem returned nil")
		}

		item := selected.(SimpleItem)
		if item.ID() != "id-42" {
			t.Errorf("expected id-42, got %s", item.ID())
		}
		if item.Title() != "Item 42" {
			t.Errorf("expected Item 42, got %s", item.Title())
		}
	})

	t.Run("SelectedIndex returns correct index", func(t *testing.T) {
		if vl.SelectedIndex() != 42 {
			t.Errorf("expected index 42, got %d", vl.SelectedIndex())
		}
	})
}

// TestVirtualList_SetItems tests dynamic item updates
func TestVirtualList_SetItems(t *testing.T) {
	initialItems := make([]list.Item, 10)
	for i := 0; i < 10; i++ {
		initialItems[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
	}

	vl := NewVirtualList("Test", initialItems, 80, 10)
	vl.cursor = 5

	newItems := make([]list.Item, 20)
	for i := 0; i < 20; i++ {
		newItems[i] = NewSimpleItem(fmt.Sprintf("new-id-%d", i), fmt.Sprintf("New Item %d", i), "")
	}

	t.Run("SetItems updates items", func(t *testing.T) {
		vl.SetItems(newItems)

		if len(vl.items) != 20 {
			t.Errorf("expected 20 items, got %d", len(vl.items))
		}

		// Cursor should reset to 0 when items change
		if vl.cursor != 0 {
			t.Errorf("expected cursor reset to 0, got %d", vl.cursor)
		}
	})
}

// TestVirtualList_BubbleTeaInterface tests Bubble Tea interface compliance
func TestVirtualList_BubbleTeaInterface(t *testing.T) {
	items := make([]list.Item, 100)
	for i := 0; i < 100; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
	}

	vl := NewVirtualList("Test", items, 80, 10)

	t.Run("Init returns nil", func(t *testing.T) {
		cmd := vl.Init()
		if cmd != nil {
			t.Errorf("Init should return nil, got %v", cmd)
		}
	})

	t.Run("Update handles WindowSizeMsg", func(t *testing.T) {
		vl, cmd := vl.Update(tea.WindowSizeMsg{Width: 100, Height: 20})
		if cmd != nil {
			t.Errorf("Update should return nil cmd for WindowSizeMsg, got %v", cmd)
		}
		if vl.width != 100 || vl.height != 20 {
			t.Errorf("size not updated correctly")
		}
	})

	t.Run("View returns string", func(t *testing.T) {
		view := vl.View()
		if view == "" {
			t.Error("View should return non-empty string")
		}
	})
}
