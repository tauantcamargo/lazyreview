package components_test

import (
	"fmt"

	"lazyreview/pkg/components"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
)

// ExampleVirtualList demonstrates basic usage of the VirtualList component
func ExampleVirtualList() {
	// Create 1000 items
	items := make([]list.Item, 1000)
	for i := 0; i < 1000; i++ {
		items[i] = components.NewSimpleItem(
			fmt.Sprintf("id-%d", i),
			fmt.Sprintf("Item %d", i),
			fmt.Sprintf("Description for item %d", i),
		)
	}

	// Create virtual list
	vl := components.NewVirtualList("My List", items, 80, 24)

	// Navigate
	vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}}) // Down
	vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}}) // Down
	vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'G'}}) // Jump to bottom
	vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}}) // Jump to top
	vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyCtrlD})                     // Page down

	// Get selected item
	selected := vl.SelectedItem()
	if item, ok := selected.(components.SimpleItem); ok {
		fmt.Println(item.Title())
	}

	// Filter (will match "Item 5", "Item 50", "Item 51", ..., "Item 59", "Item 500", etc.)
	vl.SetFilterText("Item 5")

	fmt.Printf("Filtered to %d items\n", vl.ItemCount())

	// Output:
	// Item 3
	// Filtered to 111 items
}

// ExampleVirtualList_withPRItems demonstrates usage with PR items
func ExampleVirtualList_withPRItems() {
	// Create PR items
	items := make([]list.Item, 100)
	for i := 0; i < 100; i++ {
		items[i] = components.NewPRListItem(
			fmt.Sprintf("pr-%d", i),
			i+1,
			fmt.Sprintf("Add feature %d", i),
			"developer",
			"open",
			i%10 == 0, // Every 10th is draft
			"2 hours ago",
		)
	}

	vl := components.NewVirtualList("Pull Requests", items, 80, 24)

	// Navigate to 5th item
	vl.Select(4)

	selected := vl.SelectedItem()
	if pr, ok := selected.(components.PRListItem); ok {
		fmt.Printf("Selected: %s\n", pr.Title())
	}

	// Output:
	// Selected: #5 Add feature 4
}
