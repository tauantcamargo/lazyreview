package services

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"lazyreview/internal/models"
)

func TestPersistentCache_SetAndGet(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Close()

	ctx := context.Background()
	pr := createCachedTestPR(123, "Test PR")

	// Test Set
	err := cache.Set(ctx, "test-key", pr)
	if err != nil {
		t.Fatalf("Set failed: %v", err)
	}

	// Test Get from L1 (in-memory)
	retrieved, found := cache.Get(ctx, "test-key")
	if !found {
		t.Fatal("Expected to find key in cache")
	}
	if retrieved.Number != pr.Number {
		t.Errorf("Expected PR number %d, got %d", pr.Number, retrieved.Number)
	}
}

func TestPersistentCache_L1ToL2Persistence(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	cache1, err := NewPersistentCache(dbPath, 1*time.Hour)
	if err != nil {
		t.Fatalf("Failed to create cache: %v", err)
	}

	ctx := context.Background()
	pr := createCachedTestPR(456, "Persistent PR")

	// Set in first cache instance
	err = cache1.Set(ctx, "persist-key", pr)
	if err != nil {
		t.Fatalf("Set failed: %v", err)
	}
	cache1.Close()

	// Create new cache instance (simulating restart)
	cache2, err := NewPersistentCache(dbPath, 1*time.Hour)
	if err != nil {
		t.Fatalf("Failed to create second cache: %v", err)
	}
	defer cache2.Close()

	// Should load from L2 (SQLite)
	retrieved, found := cache2.Get(ctx, "persist-key")
	if !found {
		t.Fatal("Expected to find persisted key after restart")
	}
	if retrieved.Number != pr.Number {
		t.Errorf("Expected PR number %d, got %d", pr.Number, retrieved.Number)
	}
}

func TestPersistentCache_TTLExpiration(t *testing.T) {
	cache := setupTestCacheWithTTL(t, 100*time.Millisecond)
	defer cache.Close()

	ctx := context.Background()
	pr := createCachedTestPR(789, "Expiring PR")

	// Set with short TTL
	err := cache.Set(ctx, "expire-key", pr)
	if err != nil {
		t.Fatalf("Set failed: %v", err)
	}

	// Should be available immediately
	_, found := cache.Get(ctx, "expire-key")
	if !found {
		t.Fatal("Expected key to be available immediately")
	}

	// Wait for expiration
	time.Sleep(150 * time.Millisecond)

	// Should be expired
	_, found = cache.Get(ctx, "expire-key")
	if found {
		t.Fatal("Expected key to be expired")
	}
}

func TestPersistentCache_Delete(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Close()

	ctx := context.Background()
	pr := createCachedTestPR(111, "Delete me")

	cache.Set(ctx, "delete-key", pr)
	cache.Delete(ctx, "delete-key")

	_, found := cache.Get(ctx, "delete-key")
	if found {
		t.Fatal("Expected key to be deleted")
	}
}

func TestPersistentCache_Clear(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Close()

	ctx := context.Background()

	// Add multiple items
	cache.Set(ctx, "key1", createCachedTestPR(1, "PR 1"))
	cache.Set(ctx, "key2", createCachedTestPR(2, "PR 2"))
	cache.Set(ctx, "key3", createCachedTestPR(3, "PR 3"))

	cache.Clear(ctx)

	// All should be cleared
	_, found := cache.Get(ctx, "key1")
	if found {
		t.Fatal("Expected all keys to be cleared")
	}
}

func TestPersistentCache_CacheWarming(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "warm.db")
	cache1, err := NewPersistentCache(dbPath, 1*time.Hour)
	if err != nil {
		t.Fatalf("Failed to create cache: %v", err)
	}

	ctx := context.Background()

	// Add items with last_accessed timestamps
	for i := 1; i <= 10; i++ {
		key := formatPRCacheKey("owner", "repo", i)
		cache1.Set(ctx, key, createCachedTestPR(i, "PR "+string(rune(i))))
		time.Sleep(10 * time.Millisecond) // Ensure different timestamps
	}
	cache1.Close()

	// Create new cache - should warm with most recent items
	cache2, err := NewPersistentCache(dbPath, 1*time.Hour)
	if err != nil {
		t.Fatalf("Failed to create second cache: %v", err)
	}
	defer cache2.Close()

	// Recent items should be in L1 (fast access)
	stats := cache2.Stats()
	if stats.L1Size == 0 {
		t.Fatal("Expected cache warming to populate L1")
	}
}

func TestPersistentCache_ForceRefresh(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Close()

	ctx := context.Background()
	key := "refresh-key"

	// Set initial value
	pr1 := createCachedTestPR(100, "Original")
	cache.Set(ctx, key, pr1)

	// Update with force refresh
	pr2 := createCachedTestPR(100, "Updated")
	err := cache.SetForceRefresh(ctx, key, pr2)
	if err != nil {
		t.Fatalf("SetForceRefresh failed: %v", err)
	}

	// Should get updated value
	retrieved, found := cache.Get(ctx, key)
	if !found {
		t.Fatal("Expected to find refreshed key")
	}
	if retrieved.Title != "Updated" {
		t.Errorf("Expected updated title, got %s", retrieved.Title)
	}
}

func TestPersistentCache_GetWithLoader(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Close()

	ctx := context.Background()
	key := "loader-key"

	loaderCalled := false
	loader := func() (*models.PullRequest, error) {
		loaderCalled = true
		return createCachedTestPR(999, "Loaded from API"), nil
	}

	// First call should invoke loader
	pr, err := cache.GetWithLoader(ctx, key, loader)
	if err != nil {
		t.Fatalf("GetWithLoader failed: %v", err)
	}
	if !loaderCalled {
		t.Fatal("Expected loader to be called")
	}
	if pr.Number != 999 {
		t.Errorf("Expected loaded PR number 999, got %d", pr.Number)
	}

	// Second call should use cache
	loaderCalled = false
	pr, err = cache.GetWithLoader(ctx, key, loader)
	if err != nil {
		t.Fatalf("GetWithLoader failed: %v", err)
	}
	if loaderCalled {
		t.Fatal("Expected loader NOT to be called on cache hit")
	}
}

func TestPersistentCache_Stats(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Close()

	ctx := context.Background()

	// Add some items
	for i := 1; i <= 5; i++ {
		cache.Set(ctx, formatPRCacheKey("owner", "repo", i), createCachedTestPR(i, "PR"))
	}

	stats := cache.Stats()
	if stats.L1Size != 5 {
		t.Errorf("Expected L1Size=5, got %d", stats.L1Size)
	}
	if stats.L2Size != 5 {
		t.Errorf("Expected L2Size=5, got %d", stats.L2Size)
	}

	// Trigger some hits
	cache.Get(ctx, formatPRCacheKey("owner", "repo", 1))
	cache.Get(ctx, formatPRCacheKey("owner", "repo", 2))
	cache.Get(ctx, "nonexistent")

	stats = cache.Stats()
	if stats.L1Hits != 2 {
		t.Errorf("Expected 2 L1 hits, got %d", stats.L1Hits)
	}
	if stats.L1Misses != 1 {
		t.Errorf("Expected 1 L1 miss, got %d", stats.L1Misses)
	}
}

func TestPersistentCache_EventInvalidation(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Close()

	ctx := context.Background()

	// Set PR cache
	prKey := formatPRCacheKey("owner", "repo", 123)
	pr := createCachedTestPR(123, "Original PR")
	cache.Set(ctx, prKey, pr)

	// Simulate PR update event
	cache.InvalidatePattern(ctx, "pr:owner/repo/*")

	// Should be invalidated
	_, found := cache.Get(ctx, prKey)
	if found {
		t.Fatal("Expected PR to be invalidated after event")
	}
}

func TestPersistentCache_ConcurrentAccess(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Close()

	ctx := context.Background()
	done := make(chan bool, 20) // Buffered channel

	// Concurrent writes
	for i := 0; i < 10; i++ {
		go func(n int) {
			key := formatPRCacheKey("owner", "repo", n)
			cache.Set(ctx, key, createCachedTestPR(n, "Concurrent PR"))
			done <- true
		}(i)
	}

	// Wait for all writes
	for i := 0; i < 10; i++ {
		<-done
	}

	// Give SQLite time to flush writes
	time.Sleep(100 * time.Millisecond)

	// Concurrent reads
	for i := 0; i < 10; i++ {
		go func(n int) {
			key := formatPRCacheKey("owner", "repo", n)
			_, _ = cache.Get(ctx, key)
			done <- true
		}(i)
	}

	// Wait for all reads
	for i := 0; i < 10; i++ {
		<-done
	}

	// Should have all items
	stats := cache.Stats()
	if stats.L1Size != 10 {
		t.Errorf("Expected 10 items after concurrent access, got %d", stats.L1Size)
	}
}

func TestPersistentCache_L2Promotion(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "promotion.db")
	cache1, err := NewPersistentCache(dbPath, 1*time.Hour)
	if err != nil {
		t.Fatalf("Failed to create cache: %v", err)
	}

	ctx := context.Background()
	pr := createCachedTestPR(555, "L2 Promotion Test")

	// Set in cache and close (persisted to L2)
	cache1.Set(ctx, "promo-key", pr)
	cache1.Close()

	// Open new cache instance
	cache2, err := NewPersistentCache(dbPath, 1*time.Hour)
	if err != nil {
		t.Fatalf("Failed to create second cache: %v", err)
	}
	defer cache2.Close()

	// Clear L1 to force L2 lookup
	cache2.mu.Lock()
	cache2.l1 = make(map[string]*persistentCacheEntry[*models.PullRequest])
	cache2.mu.Unlock()

	// Get should retrieve from L2 and promote to L1
	retrieved, found := cache2.Get(ctx, "promo-key")
	if !found {
		t.Fatal("Expected to find key in L2")
	}
	if retrieved.Number != pr.Number {
		t.Errorf("Expected PR number %d, got %d", pr.Number, retrieved.Number)
	}

	// Now it should be in L1
	cache2.mu.RLock()
	_, inL1 := cache2.l1["promo-key"]
	cache2.mu.RUnlock()

	if !inL1 {
		t.Fatal("Expected key to be promoted to L1")
	}
}

func TestPersistentCache_InvalidJSON(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Close()

	ctx := context.Background()

	// Manually insert invalid JSON into L2
	_, err := cache.db.ExecContext(ctx,
		`INSERT INTO cache_entries (key, value, created_at, expires_at, last_accessed)
		VALUES (?, ?, ?, ?, ?)`,
		"bad-json-key", "{invalid json", time.Now(), time.Now().Add(1*time.Hour), time.Now(),
	)
	if err != nil {
		t.Fatalf("Failed to insert bad JSON: %v", err)
	}

	// Get should handle deserialization error gracefully
	_, found := cache.Get(ctx, "bad-json-key")
	if found {
		t.Fatal("Expected not to find key with invalid JSON")
	}
}

func TestPersistentCache_GetWithLoaderError(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Close()

	ctx := context.Background()
	key := "error-key"

	loaderErr := fmt.Errorf("API error")
	loader := func() (*models.PullRequest, error) {
		return nil, loaderErr
	}

	_, err := cache.GetWithLoader(ctx, key, loader)
	if err == nil {
		t.Fatal("Expected loader error to propagate")
	}
	if err != loaderErr {
		t.Errorf("Expected loader error, got %v", err)
	}
}

func TestPersistentCache_MultiplePatternInvalidation(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Close()

	ctx := context.Background()

	// Add multiple items with different patterns
	cache.Set(ctx, "pr:owner1/repo1/123", createCachedTestPR(123, "PR 1"))
	cache.Set(ctx, "pr:owner1/repo1/456", createCachedTestPR(456, "PR 2"))
	cache.Set(ctx, "pr:owner2/repo2/789", createCachedTestPR(789, "PR 3"))
	cache.Set(ctx, "comment:owner1/repo1/123", createCachedTestPR(100, "Comment"))

	// Invalidate specific repository
	cache.InvalidatePattern(ctx, "pr:owner1/repo1/*")

	// owner1/repo1 PRs should be invalidated
	_, found := cache.Get(ctx, "pr:owner1/repo1/123")
	if found {
		t.Fatal("Expected pr:owner1/repo1/123 to be invalidated")
	}

	// owner2/repo2 PR should still exist
	_, found = cache.Get(ctx, "pr:owner2/repo2/789")
	if !found {
		t.Fatal("Expected pr:owner2/repo2/789 to still exist")
	}

	// Comment should still exist (different prefix)
	_, found = cache.Get(ctx, "comment:owner1/repo1/123")
	if !found {
		t.Fatal("Expected comment:owner1/repo1/123 to still exist")
	}
}

func TestPersistentCache_StatsTracking(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Close()

	ctx := context.Background()

	// Initial stats should be zero
	stats := cache.Stats()
	if stats.L1Hits != 0 || stats.L1Misses != 0 {
		t.Errorf("Expected zero initial stats, got %+v", stats)
	}

	// Add items
	cache.Set(ctx, "key1", createCachedTestPR(1, "PR 1"))
	cache.Set(ctx, "key2", createCachedTestPR(2, "PR 2"))

	// L1 hits
	cache.Get(ctx, "key1")
	cache.Get(ctx, "key1")
	cache.Get(ctx, "key2")

	// L1 miss (non-existent)
	cache.Get(ctx, "nonexistent")

	stats = cache.Stats()
	if stats.L1Hits != 3 {
		t.Errorf("Expected 3 L1 hits, got %d", stats.L1Hits)
	}
	if stats.L1Misses != 1 {
		t.Errorf("Expected 1 L1 miss, got %d", stats.L1Misses)
	}
}

func TestPersistentCache_CloseNilDB(t *testing.T) {
	cache := &PersistentCache{
		db: nil,
	}

	err := cache.Close()
	if err != nil {
		t.Errorf("Expected no error closing nil db, got %v", err)
	}
}

func TestPersistentCache_MatchPattern(t *testing.T) {
	tests := []struct {
		key     string
		pattern string
		match   bool
	}{
		{"pr:owner/repo/123", "pr:owner/repo/123", true},       // Exact match
		{"pr:owner/repo/123", "pr:owner/repo/*", true},         // Suffix wildcard
		{"pr:owner/repo/123", "pr:*/123", true},                // Middle wildcard
		{"pr:owner/repo/123", "*/123", true},                   // Prefix wildcard
		{"pr:owner/repo/123", "pr:owner/other/*", false},       // No match
		{"comment:owner/repo/1", "pr:*", false},                // Different prefix
		{"pr:owner/repo/file.go", "pr:owner/repo/*.go", true},  // Extension match
		{"pr:owner/repo/dir/file.go", "pr:owner/*/*.go", true}, // Multiple wildcards
		{"abc", "abc", true},                                   // Simple match
		{"abc", "def", false},                                  // Simple no match
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%s~%s", tt.key, tt.pattern), func(t *testing.T) {
			result := matchPattern(tt.key, tt.pattern)
			if result != tt.match {
				t.Errorf("matchPattern(%q, %q) = %v, want %v", tt.key, tt.pattern, result, tt.match)
			}
		})
	}
}

func TestPersistentCache_CleanupExpired(t *testing.T) {
	cache := setupTestCacheWithTTL(t, 50*time.Millisecond)
	defer cache.Close()

	ctx := context.Background()

	// Add items
	cache.Set(ctx, "key1", createCachedTestPR(1, "PR 1"))
	cache.Set(ctx, "key2", createCachedTestPR(2, "PR 2"))

	// Wait for expiration
	time.Sleep(100 * time.Millisecond)

	// Manually trigger cleanup (the background goroutine runs every 5 minutes)
	c := cache
	c.mu.Lock()
	now := time.Now()
	for key, entry := range c.l1 {
		if now.After(entry.expiresAt) {
			delete(c.l1, key)
		}
	}
	c.mu.Unlock()
	c.db.Exec("DELETE FROM cache_entries WHERE expires_at < ?", now)

	// Both should be cleaned up
	stats := cache.Stats()
	if stats.L1Size != 0 {
		t.Errorf("Expected L1 to be empty after cleanup, got %d items", stats.L1Size)
	}
	if stats.L2Size != 0 {
		t.Errorf("Expected L2 to be empty after cleanup, got %d items", stats.L2Size)
	}
}

func TestPersistentCache_NewPersistentCacheErrors(t *testing.T) {
	// Test invalid database path
	_, err := NewPersistentCache("/invalid/path/that/does/not/exist/db.sqlite", 1*time.Hour)
	if err == nil {
		t.Fatal("Expected error with invalid database path")
	}
}

// Helper functions

func setupTestCache(t *testing.T) *PersistentCache {
	return setupTestCacheWithTTL(t, 1*time.Hour)
}

func setupTestCacheWithTTL(t *testing.T, ttl time.Duration) *PersistentCache {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	cache, err := NewPersistentCache(dbPath, ttl)
	if err != nil {
		t.Fatalf("Failed to create cache: %v", err)
	}
	return cache
}

func createCachedTestPR(number int, title string) *models.PullRequest {
	now := time.Now()
	return &models.PullRequest{
		ID:           "pr-" + string(rune(number)),
		Number:       number,
		Title:        title,
		State:        models.PRStateOpen,
		Author:       models.User{Login: "testuser"},
		SourceBranch: "feature",
		TargetBranch: "main",
		Repository: models.Repository{
			Owner: "testowner",
			Name:  "testrepo",
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func formatPRCacheKey(owner, repo string, number int) string {
	return "pr:" + owner + "/" + repo + "/" + string(rune(number))
}
