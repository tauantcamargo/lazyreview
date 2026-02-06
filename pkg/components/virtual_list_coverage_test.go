package components

import (
	"fmt"
	"strings"
	"testing"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
)

// TestVirtualList_Styles tests style customization
func TestVirtualList_Styles(t *testing.T) {
	items := make([]list.Item, 10)
	for i := 0; i < 10; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	vl := NewVirtualList("Test", items, 80, 30)

	t.Run("SetThemeColors", func(t *testing.T) {
		vl.SetThemeColors("200", "250", "240", "238")
		// Just verify it doesn't panic
	})

	t.Run("SetVimMode", func(t *testing.T) {
		vl.SetVimMode(true)
		vl.SetVimMode(false)
		// Just verify it doesn't panic
	})
}

// TestVirtualList_Filtering tests filter functionality
func TestVirtualList_Filtering(t *testing.T) {
	items := make([]list.Item, 100)
	for i := 0; i < 100; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	vl := NewVirtualList("Test", items, 80, 30)

	t.Run("Enter filter mode", func(t *testing.T) {
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'/'}})
		if !vl.filtering {
			t.Error("should be in filtering mode")
		}
	})

	t.Run("Type filter query", func(t *testing.T) {
		vl.filtering = true
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'I'}})
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'t'}})
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'e'}})
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'m'}})

		if vl.filterQuery != "Item" {
			t.Errorf("expected filter query 'Item', got '%s'", vl.filterQuery)
		}
	})

	t.Run("Backspace in filter", func(t *testing.T) {
		vl.filtering = true
		vl.filterQuery = "Item"
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyBackspace})

		if vl.filterQuery != "Ite" {
			t.Errorf("expected filter query 'Ite', got '%s'", vl.filterQuery)
		}
	})

	t.Run("Backspace at empty query", func(t *testing.T) {
		vl.filtering = true
		vl.filterQuery = ""
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyBackspace})

		if vl.filterQuery != "" {
			t.Errorf("filter query should remain empty")
		}
	})

	t.Run("Exit filter with Esc", func(t *testing.T) {
		vl.filtering = true
		vl.filterQuery = "Item"
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyEsc})

		if vl.filtering {
			t.Error("should not be in filtering mode")
		}
		if vl.filterQuery != "" {
			t.Error("filter query should be cleared")
		}
	})

	t.Run("Exit filter with Enter", func(t *testing.T) {
		vl.filtering = true
		vl.filterQuery = "Item 5"
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyEnter})

		if vl.filtering {
			t.Error("should not be in filtering mode")
		}
		if len(vl.filteredItems) == 0 {
			t.Error("should have filtered items")
		}
	})

	t.Run("SetFilterText", func(t *testing.T) {
		vl.SetFilterText("Item 42")
		if vl.filterQuery != "Item 42" {
			t.Errorf("expected filter query 'Item 42', got '%s'", vl.filterQuery)
		}
		if len(vl.filteredItems) != 1 {
			t.Errorf("expected 1 filtered item, got %d", len(vl.filteredItems))
		}
	})

	t.Run("ResetFilter", func(t *testing.T) {
		vl.filterQuery = "Item 42"
		vl.filtering = true
		vl.ResetFilter()

		if vl.filterQuery != "" {
			t.Error("filter query should be empty")
		}
		if vl.filtering {
			t.Error("should not be in filtering mode")
		}
		if len(vl.filteredItems) != 100 {
			t.Errorf("expected 100 items, got %d", len(vl.filteredItems))
		}
	})

	t.Run("FilterValue", func(t *testing.T) {
		vl.filterQuery = "test"
		if vl.FilterValue() != "test" {
			t.Errorf("expected 'test', got '%s'", vl.FilterValue())
		}
	})
}

// TestVirtualList_Rendering tests view rendering
func TestVirtualList_Rendering(t *testing.T) {
	items := make([]list.Item, 100)
	for i := 0; i < 100; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description "+fmt.Sprint(i))
	}

	vl := NewVirtualList("Test List", items, 80, 30)
	vl.showStatusBar = true
	vl.showHelp = true

	t.Run("Render with title", func(t *testing.T) {
		view := vl.View()
		if !strings.Contains(view, "Test List") {
			t.Error("view should contain title")
		}
	})

	t.Run("Render with status bar", func(t *testing.T) {
		view := vl.View()
		if !strings.Contains(view, "/") {
			t.Error("view should contain status bar")
		}
	})

	t.Run("Render with help", func(t *testing.T) {
		vl.showHelp = true
		view := vl.View()
		if !strings.Contains(view, "navigate") || !strings.Contains(view, "filter") {
			t.Error("view should contain help text")
		}
	})

	t.Run("Render without title", func(t *testing.T) {
		vl.title = ""
		view := vl.View()
		if strings.Contains(view, "Test List") {
			t.Error("view should not contain title")
		}
	})

	t.Run("Render in filter mode", func(t *testing.T) {
		vl.filtering = true
		vl.filterQuery = "test"
		view := vl.View()
		if !strings.Contains(view, "/") {
			t.Error("view should contain filter prompt")
		}
	})

	t.Run("Render selected item", func(t *testing.T) {
		vl.filtering = false
		vl.cursor = 5
		view := vl.View()
		if !strings.Contains(view, ">") {
			t.Error("view should contain cursor indicator")
		}
	})

	t.Run("Render items with descriptions", func(t *testing.T) {
		view := vl.View()
		if !strings.Contains(view, "Description") {
			t.Error("view should contain item descriptions")
		}
	})
}

// TestVirtualList_EmptyState tests empty list rendering
func TestVirtualList_EmptyState(t *testing.T) {
	vl := NewVirtualList("Empty List", []list.Item{}, 80, 30)

	t.Run("Empty list view", func(t *testing.T) {
		view := vl.View()
		if !strings.Contains(view, "No items") {
			t.Error("view should show 'No items' message")
		}
	})

	t.Run("Empty filtered list", func(t *testing.T) {
		items := make([]list.Item, 10)
		for i := 0; i < 10; i++ {
			items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
		}

		vl := NewVirtualList("Test", items, 80, 30)
		vl.filtering = true
		vl.filterQuery = "nonexistent"
		vl.applyFilter()

		view := vl.View()
		if !strings.Contains(view, "No matches") {
			t.Error("view should show 'No matches found' message")
		}
	})
}

// TestVirtualList_APICompatibility tests API compatibility with List
func TestVirtualList_APICompatibility(t *testing.T) {
	items := make([]list.Item, 100)
	for i := 0; i < 100; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	vl := NewVirtualList("Test", items, 80, 30)

	t.Run("Title", func(t *testing.T) {
		if vl.Title() != "Test" {
			t.Errorf("expected 'Test', got '%s'", vl.Title())
		}
	})

	t.Run("SetTitle", func(t *testing.T) {
		vl.SetTitle("New Title")
		if vl.Title() != "New Title" {
			t.Errorf("expected 'New Title', got '%s'", vl.Title())
		}
	})

	t.Run("ItemCount", func(t *testing.T) {
		if vl.ItemCount() != 100 {
			t.Errorf("expected 100, got %d", vl.ItemCount())
		}
	})

	t.Run("Items", func(t *testing.T) {
		items := vl.Items()
		if len(items) != 100 {
			t.Errorf("expected 100 items, got %d", len(items))
		}
	})

	t.Run("Select", func(t *testing.T) {
		vl.Select(42)
		if vl.SelectedIndex() != 42 {
			t.Errorf("expected index 42, got %d", vl.SelectedIndex())
		}
	})

	t.Run("Select out of bounds (negative)", func(t *testing.T) {
		vl.Select(-5)
		if vl.SelectedIndex() != 0 {
			t.Errorf("expected index 0, got %d", vl.SelectedIndex())
		}
	})

	t.Run("Select out of bounds (too large)", func(t *testing.T) {
		vl.Select(200)
		if vl.SelectedIndex() != 99 {
			t.Errorf("expected index 99, got %d", vl.SelectedIndex())
		}
	})

	t.Run("SetSize", func(t *testing.T) {
		vl.SetSize(100, 50)
		if vl.Width() != 100 || vl.Height() != 50 {
			t.Errorf("expected size (100, 50), got (%d, %d)", vl.Width(), vl.Height())
		}
	})

	t.Run("Focus/Blur", func(t *testing.T) {
		vl.Focus()
		if !vl.IsFocused() {
			t.Error("should be focused")
		}

		vl.Blur()
		if vl.IsFocused() {
			t.Error("should not be focused")
		}
	})

	t.Run("IsFiltering", func(t *testing.T) {
		vl.filtering = true
		if !vl.IsFiltering() {
			t.Error("should be filtering")
		}

		vl.filtering = false
		if vl.IsFiltering() {
			t.Error("should not be filtering")
		}
	})

	t.Run("SelectedItem with empty list", func(t *testing.T) {
		emptyVL := NewVirtualList("Empty", []list.Item{}, 80, 30)
		if emptyVL.SelectedItem() != nil {
			t.Error("SelectedItem should return nil for empty list")
		}
	})

	t.Run("SelectedItem out of bounds", func(t *testing.T) {
		vl.cursor = 200
		if vl.SelectedItem() != nil {
			t.Error("SelectedItem should return nil when cursor out of bounds")
		}
	})
}

// TestVirtualList_PRListItem tests rendering PRListItem
func TestVirtualList_PRListItem(t *testing.T) {
	items := make([]list.Item, 10)
	for i := 0; i < 10; i++ {
		items[i] = NewPRListItem(
			fmt.Sprintf("pr-%d", i),
			i+1,
			fmt.Sprintf("PR Title %d", i),
			"author",
			"open",
			i%2 == 0, // isDraft
			"2 days ago",
		)
	}

	vl := NewVirtualList("PRs", items, 80, 30)

	t.Run("Render PR items", func(t *testing.T) {
		view := vl.View()
		if !strings.Contains(view, "PR Title") {
			t.Error("view should contain PR title")
		}
		if !strings.Contains(view, "author") {
			t.Error("view should contain author")
		}
	})

	t.Run("Render draft PR", func(t *testing.T) {
		vl.cursor = 0 // First item is draft
		view := vl.View()
		if !strings.Contains(view, "[Draft]") {
			t.Error("view should show draft indicator")
		}
	})
}

// TestVirtualList_EdgeCases tests edge cases
func TestVirtualList_EdgeCases(t *testing.T) {
	t.Run("Zero visible height", func(t *testing.T) {
		items := make([]list.Item, 100)
		for i := 0; i < 100; i++ {
			items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
		}

		vl := NewVirtualList("Test", items, 80, 0)
		start, end := vl.calculateViewport()

		if start != 0 || end != -1 {
			t.Errorf("expected (0, -1) for zero height, got (%d, %d)", start, end)
		}
	})

	t.Run("Negative height", func(t *testing.T) {
		items := make([]list.Item, 100)
		for i := 0; i < 100; i++ {
			items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
		}

		vl := NewVirtualList("Test", items, 80, -10)
		start, end := vl.calculateViewport()

		if start != 0 || end != -1 {
			t.Errorf("expected (0, -1) for negative height, got (%d, %d)", start, end)
		}
	})

	t.Run("Single item list", func(t *testing.T) {
		items := []list.Item{NewSimpleItem("id-1", "Single Item", "Description")}
		vl := NewVirtualList("Test", items, 80, 30)

		view := vl.View()
		if !strings.Contains(view, "Single Item") {
			t.Error("view should contain the single item")
		}
	})

	t.Run("Very small viewport", func(t *testing.T) {
		items := make([]list.Item, 100)
		for i := 0; i < 100; i++ {
			items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
		}

		vl := NewVirtualList("Test", items, 10, 3) // Only 1 item fits
		vl.showStatusBar = false
		vl.showHelp = false
		vl.title = ""

		view := vl.View()
		// Should still render without crashing
		if view == "" {
			t.Error("view should not be empty")
		}
	})
}

// TestVirtualList_StatusBar tests status bar rendering
func TestVirtualList_StatusBar(t *testing.T) {
	items := make([]list.Item, 100)
	for i := 0; i < 100; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
	}

	vl := NewVirtualList("Test", items, 80, 30)
	vl.showStatusBar = true

	t.Run("Status bar with items", func(t *testing.T) {
		vl.cursor = 42
		view := vl.View()
		if !strings.Contains(view, "43/100") {
			t.Error("status bar should show '43/100'")
		}
	})

	t.Run("Status bar at start", func(t *testing.T) {
		vl.cursor = 0
		view := vl.View()
		if !strings.Contains(view, "1/100") {
			t.Error("status bar should show '1/100'")
		}
	})

	t.Run("Status bar at end", func(t *testing.T) {
		vl.cursor = 99
		view := vl.View()
		if !strings.Contains(view, "100/100") {
			t.Error("status bar should show '100/100'")
		}
	})

	t.Run("Status bar with empty list", func(t *testing.T) {
		emptyVL := NewVirtualList("Test", []list.Item{}, 80, 30)
		emptyVL.showStatusBar = true
		view := emptyVL.View()
		if !strings.Contains(view, "No items") {
			t.Error("empty list should show 'No items' message")
		}
	})
}

// TestVirtualList_AdditionalCoverage tests remaining edge cases
func TestVirtualList_AdditionalCoverage(t *testing.T) {
	items := make([]list.Item, 100)
	for i := 0; i < 100; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	t.Run("Update with unknown message type", func(t *testing.T) {
		vl := NewVirtualList("Test", items, 80, 30)
		type unknownMsg struct{}
		vl, _ = vl.Update(unknownMsg{})
		// Should not panic
	})

	t.Run("HandleNormalKey with unmatched key", func(t *testing.T) {
		vl := NewVirtualList("Test", items, 80, 30)
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'x'}})
		// Should not panic
	})

	t.Run("PageSize with zero visible items", func(t *testing.T) {
		vl := NewVirtualList("Test", items, 80, 0)
		size := vl.pageSize()
		if size != 1 {
			t.Errorf("expected pageSize 1 for zero visible items, got %d", size)
		}
	})

	t.Run("SetThemeColors with empty strings", func(t *testing.T) {
		vl := NewVirtualList("Test", items, 80, 30)
		vl.SetThemeColors("", "", "", "")
		// Should use defaults
	})

	t.Run("RenderItem out of range", func(t *testing.T) {
		vl := NewVirtualList("Test", items, 80, 30)
		result := vl.renderItem(-1)
		if result != "" {
			t.Error("renderItem with negative index should return empty string")
		}

		result = vl.renderItem(200)
		if result != "" {
			t.Error("renderItem with out of bounds index should return empty string")
		}
	})

	t.Run("Item without description", func(t *testing.T) {
		noDescItems := []list.Item{
			NewSimpleItem("id-1", "Title Only", ""),
		}
		vl := NewVirtualList("Test", noDescItems, 80, 30)
		view := vl.View()
		if !strings.Contains(view, "Title Only") {
			t.Error("should render item without description")
		}
	})

	t.Run("Very large buffer", func(t *testing.T) {
		vl := NewVirtualList("Test", items, 80, 30)
		vl.buffer = 1000
		start, end := vl.calculateViewport()
		// Should be clamped to item count
		if start < 0 || end >= 100 {
			t.Errorf("buffer should be clamped, got start=%d, end=%d", start, end)
		}
	})
}

// TestDefaultVirtualListStyles tests default styles
func TestDefaultVirtualListStyles(t *testing.T) {
	styles := DefaultVirtualListStyles()
	if styles.Title.String() == "" {
		t.Error("Title style should not be empty")
	}
}

// TestVirtualList_CompleteRendering tests complete rendering paths
func TestVirtualList_CompleteRendering(t *testing.T) {
	t.Run("Full rendering with all features", func(t *testing.T) {
		items := make([]list.Item, 50)
		for i := 0; i < 50; i++ {
			items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), fmt.Sprintf("Desc %d", i))
		}

		vl := NewVirtualList("Full Test", items, 80, 60)
		vl.showStatusBar = true
		vl.showHelp = true
		vl.cursor = 25

		// Render in various states
		_ = vl.View()

		vl.filtering = true
		vl.filterQuery = "Item"
		_ = vl.View()

		vl.filtering = false
		_ = vl.View()
	})

	t.Run("Navigate through all positions", func(t *testing.T) {
		items := make([]list.Item, 20)
		for i := 0; i < 20; i++ {
			items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
		}

		vl := NewVirtualList("Nav Test", items, 80, 30)

		// Navigate through the list
		for i := 0; i < 20; i++ {
			vl.Select(i)
			_ = vl.View()
		}
	})

	t.Run("All key combinations", func(t *testing.T) {
		items := make([]list.Item, 100)
		for i := 0; i < 100; i++ {
			items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "")
		}

		vl := NewVirtualList("Key Test", items, 80, 30)

		// Test all navigation keys
		keys := []tea.KeyMsg{
			{Type: tea.KeyUp},
			{Type: tea.KeyDown},
			{Type: tea.KeyPgUp},
			{Type: tea.KeyPgDown},
		}

		for _, key := range keys {
			vl, _ = vl.Update(key)
		}
	})
}

// customOnlyFilterItem implements only list.Item (not ListItem)
type customOnlyFilterItem struct {
	value string
}

func (c customOnlyFilterItem) FilterValue() string { return c.value }

// TestVirtualList_NonListItem tests rendering items that don't implement ListItem
func TestVirtualList_NonListItem(t *testing.T) {
	items := []list.Item{
		customOnlyFilterItem{value: "custom1"},
		customOnlyFilterItem{value: "custom2"},
		customOnlyFilterItem{value: "custom3"},
	}

	vl := NewVirtualList("Custom", items, 80, 30)
	view := vl.View()

	if !strings.Contains(view, "custom") {
		t.Error("view should contain custom item filter values")
	}
}

// TestVirtualList_ShowFlags tests show/hide flags
func TestVirtualList_ShowFlags(t *testing.T) {
	items := make([]list.Item, 10)
	for i := 0; i < 10; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Desc")
	}

	vl := NewVirtualList("Test", items, 80, 60)

	t.Run("Hide status bar", func(t *testing.T) {
		vl.showStatusBar = false
		view := vl.View()
		// View should still render
		if view == "" {
			t.Error("view should not be empty")
		}
	})

	t.Run("Hide help", func(t *testing.T) {
		vl.showHelp = false
		view := vl.View()
		if strings.Contains(view, "navigate") {
			t.Error("should not contain help text when disabled")
		}
	})

	t.Run("Hide both", func(t *testing.T) {
		vl.showStatusBar = false
		vl.showHelp = false
		view := vl.View()
		if view == "" {
			t.Error("view should not be empty")
		}
	})
}
