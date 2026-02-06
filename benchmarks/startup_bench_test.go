package benchmarks

import (
	"testing"
	"time"

	"lazyreview/internal/config"
	"lazyreview/internal/models"
	"lazyreview/internal/services"
	"lazyreview/internal/storage"
)

// BenchmarkConfigLoad benchmarks configuration loading
func BenchmarkConfigLoad(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = config.Default()
	}
}

// BenchmarkStorageInit benchmarks SQLite storage initialization
func BenchmarkStorageInit(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		db, err := storage.NewSQLiteStorage(":memory:")
		if err != nil {
			b.Fatal(err)
		}
		_ = db.Close()
	}
}

// BenchmarkCacheInit benchmarks cache service initialization
func BenchmarkCacheInit(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = services.NewCache[[]models.PullRequest](120 * time.Second)
	}
}

// BenchmarkFilterServiceInit benchmarks filter service initialization
func BenchmarkFilterServiceInit(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = services.NewFilterService()
	}
}

// BenchmarkFullStartup benchmarks full application startup sequence
func BenchmarkFullStartup(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Simulate startup sequence
		cfg := config.Default()
		db, err := storage.NewSQLiteStorage(":memory:")
		if err != nil {
			b.Fatal(err)
		}
		cache := services.NewCache[[]models.PullRequest](time.Duration(cfg.Performance.CacheTTL) * time.Second)
		_ = services.NewFilterService()

		_ = cache
		_ = db.Close()
	}
}

// BenchmarkWorkspaceOperations benchmarks workspace CRUD operations
func BenchmarkWorkspaceOperations(b *testing.B) {
	db, err := storage.NewSQLiteStorage(":memory:")
	if err != nil {
		b.Fatal(err)
	}
	defer db.Close()

	workspace := storage.Workspace{
		ID:          "test-workspace",
		Name:        "Test Workspace",
		Description: "Benchmark workspace",
		Repos: []storage.RepoRef{
			{ProviderType: "github", Host: "github.com", Owner: "org", Repo: "repo"},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = db.CreateWorkspace(workspace)
		_, _ = db.GetWorkspace(workspace.ID)
		_ = db.DeleteWorkspace(workspace.ID)
	}
}

// BenchmarkRecentRepos benchmarks recent repo tracking
func BenchmarkRecentRepos(b *testing.B) {
	db, err := storage.NewSQLiteStorage(":memory:")
	if err != nil {
		b.Fatal(err)
	}
	defer db.Close()

	repo := storage.RepoRef{
		ProviderType: "github",
		Host:         "github.com",
		Owner:        "testorg",
		Repo:         "testrepo",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = db.AddRecentRepo(repo)
		_, _ = db.GetRecentRepos(10)
	}
}

// BenchmarkFavorites benchmarks favorite operations
func BenchmarkFavorites(b *testing.B) {
	db, err := storage.NewSQLiteStorage(":memory:")
	if err != nil {
		b.Fatal(err)
	}
	defer db.Close()

	repo := storage.RepoRef{
		ProviderType: "github",
		Host:         "github.com",
		Owner:        "testorg",
		Repo:         "testrepo",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = db.AddFavorite(repo)
		_, _ = db.IsFavorite(repo)
		_ = db.RemoveFavorite(repo)
	}
}

// BenchmarkQueueOperations benchmarks offline queue operations
func BenchmarkQueueOperations(b *testing.B) {
	db, err := storage.NewSQLiteStorage(":memory:")
	if err != nil {
		b.Fatal(err)
	}
	defer db.Close()

	action := storage.QueueAction{
		ID:           "action-1",
		Type:         storage.QueueActionComment,
		ProviderType: "github",
		Host:         "github.com",
		Owner:        "testorg",
		Repo:         "testrepo",
		PRNumber:     123,
		Payload:      `{"body": "test comment"}`,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = db.EnqueueAction(action)
		_, _ = db.ListPendingActions(10)
		_ = db.DeleteQueueAction(action.ID)
	}
}
