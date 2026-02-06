package components

import (
	"fmt"
	"testing"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
)

// BenchmarkVirtualList_ViewportCalculation benchmarks viewport calculation
func BenchmarkVirtualList_ViewportCalculation(b *testing.B) {
	items := make([]list.Item, 10000)
	for i := 0; i < 10000; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	vl := NewVirtualList("Test", items, 80, 60)
	vl.cursor = 5000

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = vl.calculateViewport()
	}
}

// BenchmarkVirtualList_Navigation benchmarks cursor movement
func BenchmarkVirtualList_Navigation(b *testing.B) {
	items := make([]list.Item, 10000)
	for i := 0; i < 10000; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	vl := NewVirtualList("Test", items, 80, 60)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
	}
}

// BenchmarkVirtualList_JumpToTop benchmarks jumping to top (g key)
func BenchmarkVirtualList_JumpToTop(b *testing.B) {
	items := make([]list.Item, 10000)
	for i := 0; i < 10000; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	vl := NewVirtualList("Test", items, 80, 60)
	vl.cursor = 9999

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})
	}
}

// BenchmarkVirtualList_JumpToBottom benchmarks jumping to bottom (G key)
func BenchmarkVirtualList_JumpToBottom(b *testing.B) {
	items := make([]list.Item, 10000)
	for i := 0; i < 10000; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	vl := NewVirtualList("Test", items, 80, 60)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'G'}})
	}
}

// BenchmarkVirtualList_Render benchmarks full rendering
func BenchmarkVirtualList_Render(b *testing.B) {
	items := make([]list.Item, 10000)
	for i := 0; i < 10000; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	vl := NewVirtualList("Test", items, 80, 60)
	vl.cursor = 5000

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = vl.View()
	}
}

// BenchmarkVirtualList_Filter benchmarks filtering
func BenchmarkVirtualList_Filter(b *testing.B) {
	items := make([]list.Item, 10000)
	for i := 0; i < 10000; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	vl := NewVirtualList("Test", items, 80, 60)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		vl.filterQuery = "Item 50"
		vl.applyFilter()
	}
}

// BenchmarkVirtualList_SmallList benchmarks with small list (100 items)
func BenchmarkVirtualList_SmallList(b *testing.B) {
	items := make([]list.Item, 100)
	for i := 0; i < 100; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	vl := NewVirtualList("Test", items, 80, 60)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = vl.View()
	}
}

// BenchmarkVirtualList_MediumList benchmarks with medium list (1000 items)
func BenchmarkVirtualList_MediumList(b *testing.B) {
	items := make([]list.Item, 1000)
	for i := 0; i < 1000; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	vl := NewVirtualList("Test", items, 80, 60)
	vl.cursor = 500

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = vl.View()
	}
}

// BenchmarkVirtualList_LargeList benchmarks with large list (10000 items)
func BenchmarkVirtualList_LargeList(b *testing.B) {
	items := make([]list.Item, 10000)
	for i := 0; i < 10000; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	vl := NewVirtualList("Test", items, 80, 60)
	vl.cursor = 5000

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = vl.View()
	}
}

// BenchmarkVirtualList_HugeList benchmarks with huge list (100000 items)
func BenchmarkVirtualList_HugeList(b *testing.B) {
	items := make([]list.Item, 100000)
	for i := 0; i < 100000; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	vl := NewVirtualList("Test", items, 80, 60)
	vl.cursor = 50000

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = vl.View()
	}
}

// BenchmarkVirtualList_PageNavigation benchmarks page up/down
func BenchmarkVirtualList_PageNavigation(b *testing.B) {
	items := make([]list.Item, 10000)
	for i := 0; i < 10000; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	vl := NewVirtualList("Test", items, 80, 60)
	vl.cursor = 5000

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		vl, _ = vl.Update(tea.KeyMsg{Type: tea.KeyCtrlD})
	}
}

// BenchmarkComparison_VirtualVsStandard compares virtual list to standard list
func BenchmarkComparison_VirtualVsStandard(b *testing.B) {
	items := make([]list.Item, 10000)
	for i := 0; i < 10000; i++ {
		items[i] = NewSimpleItem(fmt.Sprintf("id-%d", i), fmt.Sprintf("Item %d", i), "Description")
	}

	b.Run("VirtualList", func(b *testing.B) {
		vl := NewVirtualList("Test", items, 80, 60)
		vl.cursor = 5000

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_ = vl.View()
		}
	})

	b.Run("StandardList", func(b *testing.B) {
		l := NewList("Test", items, 80, 60)

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_ = l.View()
		}
	})
}
