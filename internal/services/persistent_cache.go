package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"lazyreview/internal/models"

	_ "modernc.org/sqlite"
)

const persistentCacheSchema = `
CREATE TABLE IF NOT EXISTS cache_entries (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    last_accessed DATETIME NOT NULL,
    access_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_accessed ON cache_entries(last_accessed DESC);
`

// PersistentCache implements a 3-tier caching strategy:
// L1: In-memory (instant access)
// L2: SQLite (persistent across restarts)
// L3: API (provider fetch)
type PersistentCache struct {
	mu sync.RWMutex

	// L1: In-memory cache
	l1 map[string]*persistentCacheEntry[*models.PullRequest]

	// L2: SQLite database
	db *sql.DB

	// Configuration
	ttl time.Duration

	// Statistics
	stats CacheStats
}

// persistentCacheEntry represents an L1 cache entry
type persistentCacheEntry[T any] struct {
	value     T
	expiresAt time.Time
}

// CacheStats tracks cache performance metrics
type CacheStats struct {
	L1Size   int
	L2Size   int
	L1Hits   int
	L1Misses int
	L2Hits   int
	L2Misses int
}

// NewPersistentCache creates a new persistent cache with the given database path and TTL
func NewPersistentCache(dbPath string, ttl time.Duration) (*PersistentCache, error) {
	// Open database
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open cache database: %w", err)
	}

	// Enable WAL mode for better concurrency
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to enable WAL mode: %w", err)
	}

	// Initialize schema
	if _, err := db.Exec(persistentCacheSchema); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize cache schema: %w", err)
	}

	cache := &PersistentCache{
		l1:  make(map[string]*persistentCacheEntry[*models.PullRequest]),
		db:  db,
		ttl: ttl,
	}

	// Warm the cache with recently accessed items
	if err := cache.warmCache(context.Background()); err != nil {
		// Log warning but don't fail - cache warming is optional
		// In production, use proper logging: log.Warn("cache warming failed", "error", err)
	}

	// Start background cleanup goroutine
	go cache.cleanupExpired()

	return cache, nil
}

// Get retrieves a value from the cache (L1 → L2 → miss)
func (c *PersistentCache) Get(ctx context.Context, key string) (*models.PullRequest, bool) {
	// Try L1 first (in-memory)
	c.mu.RLock()
	if entry, ok := c.l1[key]; ok {
		if time.Now().Before(entry.expiresAt) {
			c.stats.L1Hits++
			c.mu.RUnlock()

			// Update access timestamp in background
			go c.updateAccessTime(key)

			return entry.value, true
		}
		// L1 entry expired, remove it
		c.mu.RUnlock()
		c.mu.Lock()
		delete(c.l1, key)
		c.mu.Unlock()
		c.mu.RLock()
	}
	c.stats.L1Misses++
	c.mu.RUnlock()

	// Try L2 (SQLite)
	pr, found := c.getFromL2(ctx, key)
	if found {
		c.mu.Lock()
		c.stats.L2Hits++
		c.mu.Unlock()

		// Promote to L1
		c.setL1(key, pr)
		return pr, true
	}

	c.mu.Lock()
	c.stats.L2Misses++
	c.mu.Unlock()

	return nil, false
}

// Set stores a value in both L1 and L2 caches
func (c *PersistentCache) Set(ctx context.Context, key string, value *models.PullRequest) error {
	// Store in L1
	c.setL1(key, value)

	// Store in L2
	return c.setL2(ctx, key, value)
}

// SetForceRefresh bypasses cache and stores a fresh value
func (c *PersistentCache) SetForceRefresh(ctx context.Context, key string, value *models.PullRequest) error {
	// Invalidate existing entry
	c.Delete(ctx, key)

	// Store fresh value
	return c.Set(ctx, key, value)
}

// GetWithLoader retrieves from cache or loads using the provided function
func (c *PersistentCache) GetWithLoader(ctx context.Context, key string, loader func() (*models.PullRequest, error)) (*models.PullRequest, error) {
	// Try cache first
	if value, found := c.Get(ctx, key); found {
		return value, nil
	}

	// Load from source (L3)
	value, err := loader()
	if err != nil {
		return nil, err
	}

	// Store in cache
	if err := c.Set(ctx, key, value); err != nil {
		// Log warning but return the value anyway
		// In production: log.Warn("cache set failed", "error", err)
	}

	return value, nil
}

// Delete removes a key from both L1 and L2 caches
func (c *PersistentCache) Delete(ctx context.Context, key string) error {
	// Remove from L1
	c.mu.Lock()
	delete(c.l1, key)
	c.mu.Unlock()

	// Remove from L2
	_, err := c.db.ExecContext(ctx, "DELETE FROM cache_entries WHERE key = ?", key)
	return err
}

// Clear removes all entries from both L1 and L2 caches
func (c *PersistentCache) Clear(ctx context.Context) error {
	// Clear L1
	c.mu.Lock()
	c.l1 = make(map[string]*persistentCacheEntry[*models.PullRequest])
	c.mu.Unlock()

	// Clear L2
	_, err := c.db.ExecContext(ctx, "DELETE FROM cache_entries")
	return err
}

// InvalidatePattern removes all keys matching a pattern (e.g., "pr:owner/repo/*")
func (c *PersistentCache) InvalidatePattern(ctx context.Context, pattern string) error {
	// Convert glob pattern to SQL LIKE pattern
	sqlPattern := strings.ReplaceAll(pattern, "*", "%")

	// Remove from L1
	c.mu.Lock()
	keysToDelete := []string{}
	for key := range c.l1 {
		if matchPattern(key, pattern) {
			keysToDelete = append(keysToDelete, key)
		}
	}
	for _, key := range keysToDelete {
		delete(c.l1, key)
	}
	c.mu.Unlock()

	// Remove from L2
	_, err := c.db.ExecContext(ctx, "DELETE FROM cache_entries WHERE key LIKE ?", sqlPattern)
	return err
}

// Stats returns current cache statistics
func (c *PersistentCache) Stats() CacheStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	stats := c.stats
	stats.L1Size = len(c.l1)

	// Query L2 size
	var l2Size int
	c.db.QueryRow("SELECT COUNT(*) FROM cache_entries").Scan(&l2Size)
	stats.L2Size = l2Size

	return stats
}

// Close closes the database connection
func (c *PersistentCache) Close() error {
	if c.db != nil {
		return c.db.Close()
	}
	return nil
}

// Internal methods

func (c *PersistentCache) setL1(key string, value *models.PullRequest) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.l1[key] = &persistentCacheEntry[*models.PullRequest]{
		value:     value,
		expiresAt: time.Now().Add(c.ttl),
	}
}

func (c *PersistentCache) getFromL2(ctx context.Context, key string) (*models.PullRequest, bool) {
	var valueJSON string
	var expiresAt time.Time

	err := c.db.QueryRowContext(ctx,
		"SELECT value, expires_at FROM cache_entries WHERE key = ?",
		key,
	).Scan(&valueJSON, &expiresAt)

	if err != nil {
		if err != sql.ErrNoRows {
			// Log error in production: log.Error("L2 cache get failed", "error", err)
		}
		return nil, false
	}

	// Check expiration
	if time.Now().After(expiresAt) {
		// Entry expired, delete it
		go c.Delete(ctx, key)
		return nil, false
	}

	// Deserialize
	var pr models.PullRequest
	if err := json.Unmarshal([]byte(valueJSON), &pr); err != nil {
		// Log error in production: log.Error("cache deserialization failed", "error", err)
		go c.Delete(ctx, key)
		return nil, false
	}

	return &pr, true
}

func (c *PersistentCache) setL2(ctx context.Context, key string, value *models.PullRequest) error {
	// Serialize value
	valueJSON, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("cache serialization failed: %w", err)
	}

	now := time.Now()
	expiresAt := now.Add(c.ttl)

	_, err = c.db.ExecContext(ctx,
		`INSERT OR REPLACE INTO cache_entries
		(key, value, created_at, expires_at, last_accessed, access_count)
		VALUES (?, ?, ?, ?, ?, COALESCE((SELECT access_count FROM cache_entries WHERE key = ?) + 1, 1))`,
		key, string(valueJSON), now, expiresAt, now, key,
	)

	return err
}

func (c *PersistentCache) updateAccessTime(key string) {
	c.db.Exec(
		"UPDATE cache_entries SET last_accessed = ?, access_count = access_count + 1 WHERE key = ?",
		time.Now(), key,
	)
}

func (c *PersistentCache) warmCache(ctx context.Context) error {
	// Load the most recently accessed items into L1
	rows, err := c.db.QueryContext(ctx,
		`SELECT key, value, expires_at FROM cache_entries
		WHERE expires_at > ?
		ORDER BY last_accessed DESC
		LIMIT 100`,
		time.Now(),
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	warmed := 0
	for rows.Next() {
		var key, valueJSON string
		var expiresAt time.Time

		if err := rows.Scan(&key, &valueJSON, &expiresAt); err != nil {
			continue
		}

		var pr models.PullRequest
		if err := json.Unmarshal([]byte(valueJSON), &pr); err != nil {
			continue
		}

		c.mu.Lock()
		c.l1[key] = &persistentCacheEntry[*models.PullRequest]{
			value:     &pr,
			expiresAt: expiresAt,
		}
		c.mu.Unlock()

		warmed++
	}

	return rows.Err()
}

func (c *PersistentCache) cleanupExpired() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		// Clean L1
		c.mu.Lock()
		now := time.Now()
		for key, entry := range c.l1 {
			if now.After(entry.expiresAt) {
				delete(c.l1, key)
			}
		}
		c.mu.Unlock()

		// Clean L2
		c.db.Exec("DELETE FROM cache_entries WHERE expires_at < ?", now)
	}
}

func matchPattern(key, pattern string) bool {
	// Simple glob matching (* = wildcard)
	parts := strings.Split(pattern, "*")
	if len(parts) == 1 {
		return key == pattern
	}

	// Check prefix
	if !strings.HasPrefix(key, parts[0]) {
		return false
	}

	// Check suffix
	if !strings.HasSuffix(key, parts[len(parts)-1]) {
		return false
	}

	// Check middle parts (if any)
	pos := len(parts[0])
	for i := 1; i < len(parts)-1; i++ {
		idx := strings.Index(key[pos:], parts[i])
		if idx == -1 {
			return false
		}
		pos += idx + len(parts[i])
	}

	return true
}
