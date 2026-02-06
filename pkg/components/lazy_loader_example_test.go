package components_test

import (
	"context"
	"fmt"
	"strings"
	"time"

	"lazyreview/pkg/components"

	tea "github.com/charmbracelet/bubbletea"
)

// Example demonstrates basic usage of LazyLoader
func ExampleLazyLoader() {
	// Create a loader with 4 concurrent workers
	loader := components.NewLazyLoader(4)
	defer loader.Shutdown()

	// Define a fetcher function
	fetcher := func(ctx context.Context) tea.Msg {
		// Simulate API call
		time.Sleep(50 * time.Millisecond)
		return tea.Msg("data loaded")
	}

	// Create a load request
	req := components.LoadRequest{
		Key:      "my-data",
		Priority: components.PriorityHigh,
		Fetcher:  fetcher,
		Index:    0,
	}

	// Queue the load
	cmd := loader.Load(req)
	if cmd != nil {
		cmd() // Execute command to start worker
	}

	// Wait for load to complete
	time.Sleep(100 * time.Millisecond)

	// Check the result
	state, data, err := loader.Get("my-data")
	fmt.Printf("State: %v\n", state)
	fmt.Printf("Data: %v\n", data)
	fmt.Printf("Error: %v\n", err)

	// Output:
	// State: 2
	// Data: data loaded
	// Error: <nil>
}

// Example demonstrates handling viewport updates
func ExampleLazyLoader_UpdateViewport() {
	loader := components.NewLazyLoader(4)
	defer loader.Shutdown()

	// Queue multiple items with low priority
	for i := 0; i < 10; i++ {
		req := components.LoadRequest{
			Key:      fmt.Sprintf("item-%d", i),
			Priority: components.PriorityLow,
			Fetcher: func(ctx context.Context) tea.Msg {
				return tea.Msg(fmt.Sprintf("data-%d", i))
			},
			Index: i,
		}
		loader.Load(req)
	}

	// Update viewport to prioritize items 3-7
	cmd := loader.UpdateViewport(3, 7, 2)
	if cmd != nil {
		cmd()
	}

	fmt.Println("Viewport updated")

	// Output:
	// Viewport updated
}

// Example demonstrates marking data as stale
func ExampleLazyLoader_MarkStale() {
	loader := components.NewLazyLoader(2)
	defer loader.Shutdown()

	// Load some data
	req := components.LoadRequest{
		Key:      "cached-data",
		Priority: components.PriorityHigh,
		Fetcher: func(ctx context.Context) tea.Msg {
			return tea.Msg("old data")
		},
		Index: 0,
	}

	cmd := loader.Load(req)
	cmd()
	time.Sleep(100 * time.Millisecond)

	// Mark as stale
	loader.MarkStale("cached-data")

	// Check state
	state := loader.GetState("cached-data")
	fmt.Printf("State after marking stale: %v\n", state)

	// Output:
	// State after marking stale: 3
}

// Example demonstrates skeleton loading states
func ExampleSkeleton() {
	// Create a loading skeleton
	skeleton := components.NewSkeleton(80, 5, components.StateLoading)
	view := skeleton.View()

	fmt.Printf("View is non-empty: %v\n", len(view) > 0)
	fmt.Printf("Contains loading text: %v\n", strings.Contains(view, "Loading"))

	// Output:
	// View is non-empty: true
	// Contains loading text: true
}

// Example demonstrates skeleton list item
func ExampleSkeletonListItem() {
	// Create a loading list item
	item := components.NewSkeletonListItem(80, components.StateLoading)
	view := item.View()

	fmt.Printf("View is non-empty: %v\n", len(view) > 0)
	fmt.Printf("Contains newline: %v\n", strings.Contains(view, "\n"))

	// Output:
	// View is non-empty: true
	// Contains newline: true
}

// Example demonstrates loading indicator
func ExampleLoadingIndicator() {
	indicator := components.NewLoadingIndicator()

	// Animate through a few frames
	for i := range 3 {
		view := indicator.View()
		fmt.Printf("Frame %d non-empty: %v\n", i, len(view) > 0)
		indicator.Next()
	}

	// Output:
	// Frame 0 non-empty: true
	// Frame 1 non-empty: true
	// Frame 2 non-empty: true
}

// Example demonstrates stale indicator
func ExampleStaleIndicator() {
	indicator := components.NewStaleIndicator()
	view := indicator.View()

	fmt.Printf("View is non-empty: %v\n", len(view) > 0)
	fmt.Printf("Contains symbol: %v\n", strings.Contains(view, "⟳"))

	// Output:
	// View is non-empty: true
	// Contains symbol: true
}

// Example demonstrates error indicator
func ExampleErrorIndicator() {
	indicator := components.NewErrorIndicator("Failed to load data")
	view := indicator.View()

	fmt.Printf("View is non-empty: %v\n", len(view) > 0)
	fmt.Printf("Contains message: %v\n", strings.Contains(view, "Failed to load data"))

	// Output:
	// View is non-empty: true
	// Contains message: true
}
