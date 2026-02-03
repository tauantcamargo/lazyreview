package services

import (
	"sync"
	"time"
)

// Cache is a simple in-memory TTL cache.
type Cache[T any] struct {
	mu      sync.RWMutex
	entries map[string]cacheEntry[T]
	ttl     time.Duration
}

type cacheEntry[T any] struct {
	value     T
	expiresAt time.Time
}

// NewCache creates a new cache with the given TTL.
func NewCache[T any](ttl time.Duration) *Cache[T] {
	return &Cache[T]{
		entries: make(map[string]cacheEntry[T]),
		ttl:     ttl,
	}
}

// Get returns a cached value if it exists and hasn't expired.
func (c *Cache[T]) Get(key string) (T, bool) {
	var zero T
	if c == nil {
		return zero, false
	}
	c.mu.RLock()
	entry, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok {
		return zero, false
	}
	if time.Now().After(entry.expiresAt) {
		c.mu.Lock()
		delete(c.entries, key)
		c.mu.Unlock()
		return zero, false
	}
	return entry.value, true
}

// Set stores a value in the cache.
func (c *Cache[T]) Set(key string, value T) {
	if c == nil {
		return
	}
	expiresAt := time.Now().Add(c.ttl)
	c.mu.Lock()
	c.entries[key] = cacheEntry[T]{value: value, expiresAt: expiresAt}
	c.mu.Unlock()
}

// Clear removes all entries.
func (c *Cache[T]) Clear() {
	if c == nil {
		return
	}
	c.mu.Lock()
	c.entries = make(map[string]cacheEntry[T])
	c.mu.Unlock()
}
