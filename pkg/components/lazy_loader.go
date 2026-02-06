package components

import (
	"context"
	"fmt"
	"sync"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

// LoadPriority defines the priority of a load request
type LoadPriority int

const (
	PriorityLow      LoadPriority = iota // Off-screen, far from viewport
	PriorityMedium                       // Near viewport (in buffer zone)
	PriorityHigh                         // Visible in viewport
	PriorityCritical                     // User explicitly requested
)

// LoadState represents the current state of a data item
type LoadState int

const (
	StateEmpty   LoadState = iota // No data loaded yet
	StateLoading                  // Currently being fetched
	StateLoaded                   // Data successfully loaded
	StateStale                    // Data loaded but outdated
	StateError                    // Failed to load
)

// LoadRequest represents a request to load data
type LoadRequest struct {
	Key      string       // Unique identifier for the data
	Priority LoadPriority // Request priority
	Fetcher  LoadFunc     // Function to fetch the data
	Index    int          // Index in the list (for viewport calculation)
}

// LoadFunc is a function that fetches data
// Returns the data as tea.Msg and any error
type LoadFunc func(ctx context.Context) tea.Msg

// LoadResult represents the result of a load operation
type LoadResult struct {
	Key   string
	State LoadState
	Data  tea.Msg
	Err   error
}

// LoadResultMsg is sent when a load operation completes
type LoadResultMsg struct {
	Result LoadResult
}

// LazyLoader manages asynchronous data loading with priority queue
type LazyLoader struct {
	mu              sync.RWMutex
	items           map[string]*loadItem
	queue           *priorityQueue
	workers         int
	workerPool      chan struct{}
	ctx             context.Context
	cancel          context.CancelFunc
	pendingRequests map[string]*LoadRequest
	maxRetries      int
	retryDelay      time.Duration
}

// loadItem tracks the state of a single data item
type loadItem struct {
	key       string
	state     LoadState
	data      tea.Msg
	err       error
	loadedAt  time.Time
	retries   int
	cancelCtx context.Context
	cancel    context.CancelFunc
}

// priorityQueue implements a simple priority queue for load requests
type priorityQueue struct {
	items []*queueItem
	mu    sync.Mutex
}

type queueItem struct {
	request  *LoadRequest
	priority LoadPriority
	addedAt  time.Time
}

// NewLazyLoader creates a new lazy loader
func NewLazyLoader(workers int) *LazyLoader {
	ctx, cancel := context.WithCancel(context.Background())

	return &LazyLoader{
		items:           make(map[string]*loadItem),
		queue:           newPriorityQueue(),
		workers:         workers,
		workerPool:      make(chan struct{}, workers),
		ctx:             ctx,
		cancel:          cancel,
		pendingRequests: make(map[string]*LoadRequest),
		maxRetries:      3,
		retryDelay:      time.Second,
	}
}

// Load queues a load request
func (l *LazyLoader) Load(req LoadRequest) tea.Cmd {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Check if already loaded or loading
	if item, exists := l.items[req.Key]; exists {
		switch item.state {
		case StateLoaded:
			// Already loaded, return immediately
			return func() tea.Msg {
				return LoadResultMsg{
					Result: LoadResult{
						Key:   req.Key,
						State: StateLoaded,
						Data:  item.data,
					},
				}
			}
		case StateLoading:
			// Already loading, don't queue again
			return nil
		case StateError:
			// Only retry if below max retries
			if item.retries >= l.maxRetries {
				return nil
			}
		}
	}

	// Add to pending requests
	l.pendingRequests[req.Key] = &req

	// Queue the request
	l.queue.Push(&queueItem{
		request:  &req,
		priority: req.Priority,
		addedAt:  time.Now(),
	})

	// Start processing
	return l.startWorker()
}

// startWorker attempts to start a worker to process the queue
func (l *LazyLoader) startWorker() tea.Cmd {
	return func() tea.Msg {
		// Try to acquire a worker slot
		select {
		case l.workerPool <- struct{}{}:
			// Got a slot, process queue
			go l.processQueue()
		default:
			// All workers busy, request will be processed when a worker frees up
		}
		return nil
	}
}

// processQueue processes items from the priority queue
func (l *LazyLoader) processQueue() {
	defer func() {
		<-l.workerPool // Release worker slot
	}()

	for {
		item := l.queue.Pop()
		if item == nil {
			return // Queue empty
		}

		req := item.request

		// Create cancelable context for this request
		ctx, cancel := context.WithCancel(l.ctx)

		// Mark as loading
		l.mu.Lock()
		l.items[req.Key] = &loadItem{
			key:       req.Key,
			state:     StateLoading,
			cancelCtx: ctx,
			cancel:    cancel,
		}
		l.mu.Unlock()

		// Fetch the data
		result := l.fetch(ctx, req)

		// Update state
		l.mu.Lock()
		if loadItem, exists := l.items[req.Key]; exists {
			loadItem.state = result.State
			loadItem.data = result.Data
			loadItem.err = result.Err
			loadItem.loadedAt = time.Now()
			if result.State == StateError {
				loadItem.retries++
			}
		}
		delete(l.pendingRequests, req.Key)
		l.mu.Unlock()

		// Clean up context
		cancel()
	}
}

// fetch executes the load function and returns the result
func (l *LazyLoader) fetch(ctx context.Context, req *LoadRequest) LoadResult {
	// Check if context was cancelled before starting
	select {
	case <-ctx.Done():
		return LoadResult{
			Key:   req.Key,
			State: StateError,
			Err:   ctx.Err(),
		}
	default:
	}

	// Execute the fetcher
	data := req.Fetcher(ctx)

	// Check if it's an error message
	if errMsg, ok := data.(interface{ Error() string }); ok {
		return LoadResult{
			Key:   req.Key,
			State: StateError,
			Err:   fmt.Errorf("%s", errMsg.Error()),
		}
	}

	return LoadResult{
		Key:   req.Key,
		State: StateLoaded,
		Data:  data,
	}
}

// Get returns the current state and data for a key
func (l *LazyLoader) Get(key string) (LoadState, tea.Msg, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()

	item, exists := l.items[key]
	if !exists {
		return StateEmpty, nil, nil
	}

	return item.state, item.data, item.err
}

// GetState returns just the state for a key
func (l *LazyLoader) GetState(key string) LoadState {
	l.mu.RLock()
	defer l.mu.RUnlock()

	item, exists := l.items[key]
	if !exists {
		return StateEmpty
	}

	return item.state
}

// MarkStale marks data as stale (needs refresh)
func (l *LazyLoader) MarkStale(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if item, exists := l.items[key]; exists && item.state == StateLoaded {
		item.state = StateStale
	}
}

// MarkAllStale marks all loaded data as stale
func (l *LazyLoader) MarkAllStale() {
	l.mu.Lock()
	defer l.mu.Unlock()

	for _, item := range l.items {
		if item.state == StateLoaded {
			item.state = StateStale
		}
	}
}

// Cancel cancels a pending load request
func (l *LazyLoader) Cancel(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if item, exists := l.items[key]; exists && item.state == StateLoading {
		if item.cancel != nil {
			item.cancel()
		}
		delete(l.items, key)
	}

	delete(l.pendingRequests, key)
}

// CancelAll cancels all pending and in-flight requests
func (l *LazyLoader) CancelAll() {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Cancel all in-flight requests
	for _, item := range l.items {
		if item.cancel != nil {
			item.cancel()
		}
	}

	// Clear state
	l.items = make(map[string]*loadItem)
	l.pendingRequests = make(map[string]*LoadRequest)
	l.queue.Clear()
}

// UpdateViewport updates priorities based on viewport position
// visibleStart and visibleEnd are inclusive indices
func (l *LazyLoader) UpdateViewport(visibleStart, visibleEnd, buffer int) tea.Cmd {
	// Collect requests that need re-queuing while holding the lock
	var requestsToRequeue []LoadRequest

	l.mu.Lock()
	for _, req := range l.pendingRequests {
		newPriority := l.calculatePriority(req.Index, visibleStart, visibleEnd, buffer)

		// If priority changed significantly, collect for re-queue
		if newPriority != req.Priority && (newPriority == PriorityHigh || newPriority == PriorityCritical) {
			reqCopy := *req
			reqCopy.Priority = newPriority
			requestsToRequeue = append(requestsToRequeue, reqCopy)
		}
	}
	l.mu.Unlock()

	// Re-queue collected requests outside the lock to avoid deadlock
	var cmds []tea.Cmd
	for _, req := range requestsToRequeue {
		cmds = append(cmds, l.Load(req))
	}

	return tea.Batch(cmds...)
}

// calculatePriority determines priority based on viewport position
func (l *LazyLoader) calculatePriority(index, visibleStart, visibleEnd, buffer int) LoadPriority {
	// In visible range
	if index >= visibleStart && index <= visibleEnd {
		return PriorityHigh
	}

	// In buffer zone
	bufferStart := visibleStart - buffer
	bufferEnd := visibleEnd + buffer
	if index >= bufferStart && index <= bufferEnd {
		return PriorityMedium
	}

	// Outside visible area
	return PriorityLow
}

// Clear clears all cached data
func (l *LazyLoader) Clear() {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Cancel all in-flight requests
	for _, item := range l.items {
		if item.cancel != nil {
			item.cancel()
		}
	}

	l.items = make(map[string]*loadItem)
	l.pendingRequests = make(map[string]*LoadRequest)
	l.queue.Clear()
}

// Shutdown gracefully shuts down the loader
func (l *LazyLoader) Shutdown() {
	l.cancel()
	l.CancelAll()
}

// Stats returns statistics about the loader
func (l *LazyLoader) Stats() LoaderStats {
	l.mu.RLock()
	defer l.mu.RUnlock()

	stats := LoaderStats{
		TotalItems:    len(l.items),
		QueuedItems:   l.queue.Len(),
		ActiveWorkers: len(l.workerPool),
	}

	for _, item := range l.items {
		switch item.state {
		case StateLoading:
			stats.LoadingItems++
		case StateLoaded:
			stats.LoadedItems++
		case StateStale:
			stats.StaleItems++
		case StateError:
			stats.ErrorItems++
		}
	}

	return stats
}

// LoaderStats contains statistics about the loader
type LoaderStats struct {
	TotalItems    int
	LoadedItems   int
	LoadingItems  int
	StaleItems    int
	ErrorItems    int
	QueuedItems   int
	ActiveWorkers int
}

// priorityQueue implementation

func newPriorityQueue() *priorityQueue {
	return &priorityQueue{
		items: make([]*queueItem, 0),
	}
}

func (pq *priorityQueue) Push(item *queueItem) {
	pq.mu.Lock()
	defer pq.mu.Unlock()

	pq.items = append(pq.items, item)
	pq.sort()
}

func (pq *priorityQueue) Pop() *queueItem {
	pq.mu.Lock()
	defer pq.mu.Unlock()

	if len(pq.items) == 0 {
		return nil
	}

	item := pq.items[0]
	pq.items = pq.items[1:]
	return item
}

func (pq *priorityQueue) Len() int {
	pq.mu.Lock()
	defer pq.mu.Unlock()

	return len(pq.items)
}

func (pq *priorityQueue) Clear() {
	pq.mu.Lock()
	defer pq.mu.Unlock()

	pq.items = make([]*queueItem, 0)
}

func (pq *priorityQueue) sort() {
	// Simple bubble sort for small queues
	// Priority: Critical > High > Medium > Low
	// Within same priority: FIFO (earlier addedAt first)
	for i := 0; i < len(pq.items); i++ {
		for j := i + 1; j < len(pq.items); j++ {
			if pq.items[j].priority > pq.items[i].priority {
				pq.items[i], pq.items[j] = pq.items[j], pq.items[i]
			} else if pq.items[j].priority == pq.items[i].priority {
				if pq.items[j].addedAt.Before(pq.items[i].addedAt) {
					pq.items[i], pq.items[j] = pq.items[j], pq.items[i]
				}
			}
		}
	}
}
