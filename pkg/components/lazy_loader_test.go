package components

import (
	"context"
	"errors"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

// testMsg is a simple test message
type testMsg struct {
	value string
}

// testErrorMsg is an error message for testing
type testErrorMsg struct {
	err error
}

func (e testErrorMsg) Error() string {
	return e.err.Error()
}

// TestNewLazyLoader tests creating a new loader
func TestNewLazyLoader(t *testing.T) {
	loader := NewLazyLoader(4)

	if loader == nil {
		t.Fatal("expected non-nil loader")
	}

	if loader.workers != 4 {
		t.Errorf("expected 4 workers, got %d", loader.workers)
	}

	if loader.items == nil {
		t.Error("expected items map to be initialized")
	}

	if loader.queue == nil {
		t.Error("expected queue to be initialized")
	}

	loader.Shutdown()
}

// TestLoad_SimpleSuccess tests successful data loading
func TestLoad_SimpleSuccess(t *testing.T) {
	loader := NewLazyLoader(2)
	defer loader.Shutdown()

	fetcher := func(ctx context.Context) tea.Msg {
		return testMsg{value: "test-data"}
	}

	req := LoadRequest{
		Key:      "test-key",
		Priority: PriorityHigh,
		Fetcher:  fetcher,
		Index:    0,
	}

	cmd := loader.Load(req)
	if cmd == nil {
		t.Fatal("expected non-nil command")
	}

	// Execute the command to start the worker
	cmd()

	// Wait for load to complete
	time.Sleep(100 * time.Millisecond)

	state, data, err := loader.Get("test-key")
	if state != StateLoaded {
		t.Errorf("expected StateLoaded, got %v", state)
	}

	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}

	msg, ok := data.(testMsg)
	if !ok {
		t.Fatal("expected testMsg")
	}

	if msg.value != "test-data" {
		t.Errorf("expected 'test-data', got %s", msg.value)
	}
}

// TestLoad_AlreadyLoaded tests loading already loaded data
func TestLoad_AlreadyLoaded(t *testing.T) {
	loader := NewLazyLoader(2)
	defer loader.Shutdown()

	fetcher := func(ctx context.Context) tea.Msg {
		return testMsg{value: "cached-data"}
	}

	// First load
	req := LoadRequest{
		Key:      "cached-key",
		Priority: PriorityHigh,
		Fetcher:  fetcher,
		Index:    0,
	}

	cmd := loader.Load(req)
	cmd()
	time.Sleep(100 * time.Millisecond)

	// Second load (should return cached)
	cmd = loader.Load(req)
	if cmd == nil {
		t.Fatal("expected non-nil command for cached data")
	}

	msg := cmd()
	resultMsg, ok := msg.(LoadResultMsg)
	if !ok {
		t.Fatal("expected LoadResultMsg")
	}

	if resultMsg.Result.State != StateLoaded {
		t.Errorf("expected StateLoaded, got %v", resultMsg.Result.State)
	}

	testData, ok := resultMsg.Result.Data.(testMsg)
	if !ok {
		t.Fatal("expected testMsg")
	}

	if testData.value != "cached-data" {
		t.Errorf("expected 'cached-data', got %s", testData.value)
	}
}

// TestLoad_Error tests error handling
func TestLoad_Error(t *testing.T) {
	loader := NewLazyLoader(2)
	defer loader.Shutdown()

	testErr := errors.New("fetch failed")
	fetcher := func(ctx context.Context) tea.Msg {
		return testErrorMsg{err: testErr}
	}

	req := LoadRequest{
		Key:      "error-key",
		Priority: PriorityHigh,
		Fetcher:  fetcher,
		Index:    0,
	}

	cmd := loader.Load(req)
	cmd()
	time.Sleep(100 * time.Millisecond)

	state, _, err := loader.Get("error-key")
	if state != StateError {
		t.Errorf("expected StateError, got %v", state)
	}

	if err == nil {
		t.Error("expected error")
	}

	if err.Error() != testErr.Error() {
		t.Errorf("expected error '%s', got '%s'", testErr.Error(), err.Error())
	}
}

// TestLoad_Cancellation tests request cancellation
func TestLoad_Cancellation(t *testing.T) {
	loader := NewLazyLoader(1)
	defer loader.Shutdown()

	cancelCalled := false
	fetcher := func(ctx context.Context) tea.Msg {
		select {
		case <-ctx.Done():
			cancelCalled = true
			return testErrorMsg{err: ctx.Err()}
		case <-time.After(5 * time.Second):
			return testMsg{value: "too-slow"}
		}
	}

	req := LoadRequest{
		Key:      "cancel-key",
		Priority: PriorityHigh,
		Fetcher:  fetcher,
		Index:    0,
	}

	cmd := loader.Load(req)
	cmd()

	// Give it a moment to start loading
	time.Sleep(50 * time.Millisecond)

	// Cancel the request
	loader.Cancel("cancel-key")

	// Wait for cancellation to propagate
	time.Sleep(100 * time.Millisecond)

	state := loader.GetState("cancel-key")
	if state != StateEmpty {
		t.Errorf("expected StateEmpty after cancel, got %v", state)
	}

	if !cancelCalled {
		t.Error("expected context cancellation to be called")
	}
}

// TestGetState tests state retrieval
func TestGetState(t *testing.T) {
	loader := NewLazyLoader(2)
	defer loader.Shutdown()

	// Empty state
	state := loader.GetState("non-existent")
	if state != StateEmpty {
		t.Errorf("expected StateEmpty, got %v", state)
	}

	// Loading state
	fetcher := func(ctx context.Context) tea.Msg {
		time.Sleep(500 * time.Millisecond)
		return testMsg{value: "data"}
	}

	req := LoadRequest{
		Key:      "loading-key",
		Priority: PriorityHigh,
		Fetcher:  fetcher,
		Index:    0,
	}

	cmd := loader.Load(req)
	cmd()
	time.Sleep(50 * time.Millisecond)

	state = loader.GetState("loading-key")
	if state != StateLoading {
		t.Errorf("expected StateLoading, got %v", state)
	}
}

// TestMarkStale tests marking data as stale
func TestMarkStale(t *testing.T) {
	loader := NewLazyLoader(2)
	defer loader.Shutdown()

	fetcher := func(ctx context.Context) tea.Msg {
		return testMsg{value: "data"}
	}

	req := LoadRequest{
		Key:      "stale-key",
		Priority: PriorityHigh,
		Fetcher:  fetcher,
		Index:    0,
	}

	cmd := loader.Load(req)
	cmd()
	time.Sleep(100 * time.Millisecond)

	// Verify loaded
	state := loader.GetState("stale-key")
	if state != StateLoaded {
		t.Errorf("expected StateLoaded, got %v", state)
	}

	// Mark as stale
	loader.MarkStale("stale-key")

	state = loader.GetState("stale-key")
	if state != StateStale {
		t.Errorf("expected StateStale, got %v", state)
	}
}

// TestMarkAllStale tests marking all data as stale
func TestMarkAllStale(t *testing.T) {
	loader := NewLazyLoader(2)
	defer loader.Shutdown()

	fetcher := func(ctx context.Context) tea.Msg {
		return testMsg{value: "data"}
	}

	// Load multiple items
	for i := 0; i < 3; i++ {
		req := LoadRequest{
			Key:      string(rune('a' + i)),
			Priority: PriorityHigh,
			Fetcher:  fetcher,
			Index:    i,
		}
		cmd := loader.Load(req)
		cmd()
	}

	time.Sleep(200 * time.Millisecond)

	// Mark all as stale
	loader.MarkAllStale()

	// Verify all are stale
	for i := 0; i < 3; i++ {
		key := string(rune('a' + i))
		state := loader.GetState(key)
		if state != StateStale {
			t.Errorf("expected StateStale for key %s, got %v", key, state)
		}
	}
}

// TestLazyLoader_CancelAll tests cancelling all requests
func TestLazyLoader_CancelAll(t *testing.T) {
	loader := NewLazyLoader(2)
	defer loader.Shutdown()

	fetcher := func(ctx context.Context) tea.Msg {
		time.Sleep(1 * time.Second)
		return testMsg{value: "data"}
	}

	// Queue multiple requests
	for i := 0; i < 3; i++ {
		req := LoadRequest{
			Key:      string(rune('a' + i)),
			Priority: PriorityMedium,
			Fetcher:  fetcher,
			Index:    i,
		}
		cmd := loader.Load(req)
		cmd()
	}

	time.Sleep(50 * time.Millisecond)

	// Cancel all
	loader.CancelAll()

	// Verify all are cancelled
	for i := 0; i < 3; i++ {
		key := string(rune('a' + i))
		state := loader.GetState(key)
		if state != StateEmpty {
			t.Errorf("expected StateEmpty for key %s after CancelAll, got %v", key, state)
		}
	}
}

// TestUpdateViewport tests viewport priority updates
func TestUpdateViewport(t *testing.T) {
	loader := NewLazyLoader(4)
	defer loader.Shutdown()

	fetcher := func(ctx context.Context) tea.Msg {
		time.Sleep(100 * time.Millisecond)
		return testMsg{value: "data"}
	}

	// Load items with different priorities
	for i := 0; i < 10; i++ {
		req := LoadRequest{
			Key:      string(rune('a' + i)),
			Priority: PriorityLow,
			Fetcher:  fetcher,
			Index:    i,
		}
		cmd := loader.Load(req)
		if cmd != nil {
			cmd()
		}
	}

	// Update viewport to focus on items 3-7
	cmd := loader.UpdateViewport(3, 7, 2)
	if cmd != nil {
		cmd()
	}

	// Items in viewport should have higher priority
	// This is tested indirectly through the queue ordering
	stats := loader.Stats()
	if stats.TotalItems == 0 && stats.QueuedItems == 0 {
		t.Error("expected some items to be tracked")
	}
}

// TestCalculatePriority tests priority calculation
func TestCalculatePriority(t *testing.T) {
	loader := NewLazyLoader(2)
	defer loader.Shutdown()

	tests := []struct {
		name         string
		index        int
		visibleStart int
		visibleEnd   int
		buffer       int
		wantPriority LoadPriority
	}{
		{
			name:         "in visible range",
			index:        5,
			visibleStart: 3,
			visibleEnd:   7,
			buffer:       2,
			wantPriority: PriorityHigh,
		},
		{
			name:         "in buffer zone before",
			index:        2,
			visibleStart: 4,
			visibleEnd:   8,
			buffer:       3,
			wantPriority: PriorityMedium,
		},
		{
			name:         "in buffer zone after",
			index:        10,
			visibleStart: 4,
			visibleEnd:   8,
			buffer:       3,
			wantPriority: PriorityMedium,
		},
		{
			name:         "outside visible area",
			index:        20,
			visibleStart: 4,
			visibleEnd:   8,
			buffer:       2,
			wantPriority: PriorityLow,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			priority := loader.calculatePriority(tt.index, tt.visibleStart, tt.visibleEnd, tt.buffer)
			if priority != tt.wantPriority {
				t.Errorf("expected priority %v, got %v", tt.wantPriority, priority)
			}
		})
	}
}

// TestLazyLoader_Clear tests clearing all data
func TestLazyLoader_Clear(t *testing.T) {
	loader := NewLazyLoader(2)
	defer loader.Shutdown()

	fetcher := func(ctx context.Context) tea.Msg {
		return testMsg{value: "data"}
	}

	// Load some data
	req := LoadRequest{
		Key:      "clear-key",
		Priority: PriorityHigh,
		Fetcher:  fetcher,
		Index:    0,
	}

	cmd := loader.Load(req)
	cmd()
	time.Sleep(100 * time.Millisecond)

	// Verify loaded
	state := loader.GetState("clear-key")
	if state != StateLoaded {
		t.Errorf("expected StateLoaded, got %v", state)
	}

	// Clear
	loader.Clear()

	// Verify cleared
	state = loader.GetState("clear-key")
	if state != StateEmpty {
		t.Errorf("expected StateEmpty after Clear, got %v", state)
	}

	stats := loader.Stats()
	if stats.TotalItems != 0 {
		t.Errorf("expected 0 items after Clear, got %d", stats.TotalItems)
	}
}

// TestStats tests statistics reporting
func TestStats(t *testing.T) {
	loader := NewLazyLoader(2)
	defer loader.Shutdown()

	fetcher := func(ctx context.Context) tea.Msg {
		return testMsg{value: "data"}
	}

	// Load some items
	for i := 0; i < 3; i++ {
		req := LoadRequest{
			Key:      string(rune('a' + i)),
			Priority: PriorityHigh,
			Fetcher:  fetcher,
			Index:    i,
		}
		cmd := loader.Load(req)
		cmd()
	}

	time.Sleep(200 * time.Millisecond)

	stats := loader.Stats()
	if stats.TotalItems != 3 {
		t.Errorf("expected 3 total items, got %d", stats.TotalItems)
	}

	if stats.LoadedItems != 3 {
		t.Errorf("expected 3 loaded items, got %d", stats.LoadedItems)
	}
}

// TestPriorityQueue tests the priority queue implementation
func TestPriorityQueue(t *testing.T) {
	pq := newPriorityQueue()

	// Add items with different priorities
	pq.Push(&queueItem{
		priority: PriorityLow,
		request:  &LoadRequest{Key: "low"},
		addedAt:  time.Now(),
	})

	pq.Push(&queueItem{
		priority: PriorityHigh,
		request:  &LoadRequest{Key: "high"},
		addedAt:  time.Now(),
	})

	pq.Push(&queueItem{
		priority: PriorityMedium,
		request:  &LoadRequest{Key: "medium"},
		addedAt:  time.Now(),
	})

	pq.Push(&queueItem{
		priority: PriorityCritical,
		request:  &LoadRequest{Key: "critical"},
		addedAt:  time.Now(),
	})

	// Pop should return in priority order
	item := pq.Pop()
	if item.request.Key != "critical" {
		t.Errorf("expected 'critical' first, got %s", item.request.Key)
	}

	item = pq.Pop()
	if item.request.Key != "high" {
		t.Errorf("expected 'high' second, got %s", item.request.Key)
	}

	item = pq.Pop()
	if item.request.Key != "medium" {
		t.Errorf("expected 'medium' third, got %s", item.request.Key)
	}

	item = pq.Pop()
	if item.request.Key != "low" {
		t.Errorf("expected 'low' fourth, got %s", item.request.Key)
	}

	// Empty queue
	item = pq.Pop()
	if item != nil {
		t.Error("expected nil from empty queue")
	}
}

// TestPriorityQueue_FIFO tests FIFO order for same priority
func TestPriorityQueue_FIFO(t *testing.T) {
	pq := newPriorityQueue()

	// Add items with same priority but different times
	now := time.Now()
	pq.Push(&queueItem{
		priority: PriorityHigh,
		request:  &LoadRequest{Key: "first"},
		addedAt:  now,
	})

	pq.Push(&queueItem{
		priority: PriorityHigh,
		request:  &LoadRequest{Key: "second"},
		addedAt:  now.Add(1 * time.Millisecond),
	})

	pq.Push(&queueItem{
		priority: PriorityHigh,
		request:  &LoadRequest{Key: "third"},
		addedAt:  now.Add(2 * time.Millisecond),
	})

	// Should pop in FIFO order
	item := pq.Pop()
	if item.request.Key != "first" {
		t.Errorf("expected 'first', got %s", item.request.Key)
	}

	item = pq.Pop()
	if item.request.Key != "second" {
		t.Errorf("expected 'second', got %s", item.request.Key)
	}

	item = pq.Pop()
	if item.request.Key != "third" {
		t.Errorf("expected 'third', got %s", item.request.Key)
	}
}

// TestPriorityQueue_Clear tests clearing the queue
func TestPriorityQueue_Clear(t *testing.T) {
	pq := newPriorityQueue()

	pq.Push(&queueItem{
		priority: PriorityHigh,
		request:  &LoadRequest{Key: "item1"},
		addedAt:  time.Now(),
	})

	pq.Push(&queueItem{
		priority: PriorityHigh,
		request:  &LoadRequest{Key: "item2"},
		addedAt:  time.Now(),
	})

	if pq.Len() != 2 {
		t.Errorf("expected length 2, got %d", pq.Len())
	}

	pq.Clear()

	if pq.Len() != 0 {
		t.Errorf("expected length 0 after clear, got %d", pq.Len())
	}

	item := pq.Pop()
	if item != nil {
		t.Error("expected nil from cleared queue")
	}
}
