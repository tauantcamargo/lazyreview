package gui

import (
	"testing"
	"time"

	"lazyreview/internal/models"
	"lazyreview/pkg/components"

	tea "github.com/charmbracelet/bubbletea"
)

// BenchmarkVirtualListNavigation benchmarks navigation performance in the virtual list
func BenchmarkVirtualListNavigation(b *testing.B) {
	// Create a large list of PRs (1000 items)
	prs := make([]models.PullRequest, 1000)
	for i := 0; i < 1000; i++ {
		prs[i] = models.PullRequest{
			Number: i + 1,
			Title:  "Test PR " + string(rune('A'+i%26)),
			Author: models.User{
				Login: "testuser",
			},
			State:     models.PRStateOpen,
			UpdatedAt: time.Now(),
			Repository: models.Repository{
				Owner: "testorg",
				Name:  "testrepo",
			},
		}
	}

	// Convert to list items
	items := buildPRListItems(prs, true)

	// Create virtual list
	vlist := components.NewVirtualList("Pull Requests", items, 80, 40)

	b.ResetTimer()

	// Benchmark navigation operations
	for i := 0; i < b.N; i++ {
		// Simulate down navigation
		keyMsg := tea.KeyMsg{
			Type: tea.KeyRunes,
			Runes: []rune{'j'},
		}
		vlist, _ = vlist.Update(keyMsg)
	}
}

// TestVirtualListNavigationLatency ensures navigation is under 100ms P95
func TestVirtualListNavigationLatency(t *testing.T) {
	// Create a large list of PRs (1000 items)
	prs := make([]models.PullRequest, 1000)
	for i := 0; i < 1000; i++ {
		prs[i] = models.PullRequest{
			Number: i + 1,
			Title:  "Test PR " + string(rune('A'+i%26)),
			Author: models.User{
				Login: "testuser",
			},
			State:     models.PRStateOpen,
			UpdatedAt: time.Now(),
			Repository: models.Repository{
				Owner: "testorg",
				Name:  "testrepo",
			},
		}
	}

	// Convert to list items
	items := buildPRListItems(prs, true)

	// Create virtual list
	vlist := components.NewVirtualList("Pull Requests", items, 80, 40)

	// Measure 100 navigation operations
	iterations := 100
	durations := make([]time.Duration, iterations)

	for i := 0; i < iterations; i++ {
		start := time.Now()

		// Simulate down navigation
		keyMsg := tea.KeyMsg{
			Type: tea.KeyRunes,
			Runes: []rune{'j'},
		}
		vlist, _ = vlist.Update(keyMsg)

		durations[i] = time.Since(start)
	}

	// Calculate P95 (95th percentile)
	// Sort durations (simple bubble sort for small dataset)
	for i := 0; i < len(durations); i++ {
		for j := i + 1; j < len(durations); j++ {
			if durations[j] < durations[i] {
				durations[i], durations[j] = durations[j], durations[i]
			}
		}
	}

	p95Index := int(float64(len(durations)) * 0.95)
	p95 := durations[p95Index]

	t.Logf("Navigation P95 latency: %v", p95)

	// Assert P95 < 100ms
	maxLatency := 100 * time.Millisecond
	if p95 > maxLatency {
		t.Errorf("Navigation P95 latency %v exceeds maximum %v", p95, maxLatency)
	}
}

// TestVirtualListItemCount ensures all items are accessible
func TestVirtualListItemCount(t *testing.T) {
	prs := make([]models.PullRequest, 50)
	for i := 0; i < 50; i++ {
		prs[i] = models.PullRequest{
			Number: i + 1,
			Title:  "Test PR",
			Author: models.User{Login: "test"},
			State:  models.PRStateOpen,
		}
	}

	items := buildPRListItems(prs, false)
	vlist := components.NewVirtualList("Pull Requests", items, 80, 40)

	if vlist.ItemCount() != 50 {
		t.Errorf("Expected 50 items, got %d", vlist.ItemCount())
	}
}

// TestVirtualListFiltering ensures filtering preserves performance
func TestVirtualListFiltering(t *testing.T) {
	prs := make([]models.PullRequest, 500)
	for i := 0; i < 500; i++ {
		prs[i] = models.PullRequest{
			Number: i + 1,
			Title:  "Test PR " + string(rune('A'+i%26)),
			Author: models.User{Login: "testuser"},
			State:  models.PRStateOpen,
		}
	}

	items := buildPRListItems(prs, false)
	vlist := components.NewVirtualList("Pull Requests", items, 80, 40)

	// Apply filter
	start := time.Now()
	_ = vlist.SetFilterText("Test PR A")
	filterDuration := time.Since(start)

	t.Logf("Filter application time: %v", filterDuration)

	// Filtering should be fast (< 50ms)
	if filterDuration > 50*time.Millisecond {
		t.Errorf("Filter application took %v, expected < 50ms", filterDuration)
	}
}
