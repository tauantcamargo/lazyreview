package services

import (
	"sync"
	"time"
)

// RateLimiter controls the rate of API requests.
type RateLimiter struct {
	mu       sync.Mutex
	rate     int           // requests per second
	tokens   int           // available tokens
	maxBurst int           // maximum burst size
	lastTick time.Time     // last token refresh
	ticker   *time.Ticker  // background ticker
	done     chan struct{} // shutdown signal
}

// NewRateLimiter creates a new rate limiter with the given requests per second.
// If rate is 0 or negative, no rate limiting is applied.
func NewRateLimiter(requestsPerSecond int) *RateLimiter {
	if requestsPerSecond <= 0 {
		return nil
	}

	rl := &RateLimiter{
		rate:     requestsPerSecond,
		tokens:   requestsPerSecond,
		maxBurst: requestsPerSecond * 2, // allow burst of 2x the rate
		lastTick: time.Now(),
		done:     make(chan struct{}),
	}

	// Start background token refresh
	rl.ticker = time.NewTicker(time.Second)
	go rl.refillLoop()

	return rl
}

// Wait blocks until a request can be made, respecting the rate limit.
func (rl *RateLimiter) Wait() {
	if rl == nil {
		return
	}

	for {
		rl.mu.Lock()
		if rl.tokens > 0 {
			rl.tokens--
			rl.mu.Unlock()
			return
		}
		rl.mu.Unlock()
		time.Sleep(10 * time.Millisecond)
	}
}

// TryAcquire attempts to acquire a token without blocking.
// Returns true if a token was acquired, false otherwise.
func (rl *RateLimiter) TryAcquire() bool {
	if rl == nil {
		return true
	}

	rl.mu.Lock()
	defer rl.mu.Unlock()

	if rl.tokens > 0 {
		rl.tokens--
		return true
	}
	return false
}

// Stop stops the rate limiter's background goroutine.
func (rl *RateLimiter) Stop() {
	if rl == nil {
		return
	}

	close(rl.done)
	rl.ticker.Stop()
}

func (rl *RateLimiter) refillLoop() {
	for {
		select {
		case <-rl.done:
			return
		case <-rl.ticker.C:
			rl.mu.Lock()
			rl.tokens += rl.rate
			if rl.tokens > rl.maxBurst {
				rl.tokens = rl.maxBurst
			}
			rl.mu.Unlock()
		}
	}
}
