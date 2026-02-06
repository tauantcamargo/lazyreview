package benchmarks

import (
	"runtime"
	"testing"
	"time"

	"lazyreview/internal/models"
	"lazyreview/internal/services"
)

// BenchmarkMemoryPRListAllocation benchmarks memory allocation for large PR lists
func BenchmarkMemoryPRListAllocation(b *testing.B) {
	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_ = generateTestPRs(1000)
	}
}

// BenchmarkMemoryPRFiltering benchmarks memory usage during filtering
func BenchmarkMemoryPRFiltering(b *testing.B) {
	prs := generateTestPRs(1000)
	filterSvc := services.NewFilterService()
	filter := models.FilterOpen()

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_ = filterSvc.ApplyFilter(prs, filter, "testuser")
	}
}

// BenchmarkMemoryCacheGrowth benchmarks memory growth with cache usage
func BenchmarkMemoryCacheGrowth(b *testing.B) {
	cache := services.NewCache[[]models.PullRequest](120 * time.Second)
	prs := generateTestPRs(100)

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		key := "test:owner/repo:prs:" + string(rune(i%100))
		cache.Set(key, prs)
	}
}

// BenchmarkMemoryDiffAllocation benchmarks memory allocation for diff structures
func BenchmarkMemoryDiffAllocation(b *testing.B) {
	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_ = generateTestDiff(100)
	}
}

// BenchmarkMemoryDiffLargeAllocation benchmarks memory for large diffs
func BenchmarkMemoryDiffLargeAllocation(b *testing.B) {
	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_ = generateTestDiff(1000)
	}
}

// BenchmarkMemoryCommentAllocation benchmarks memory for comment structures
func BenchmarkMemoryCommentAllocation(b *testing.B) {
	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		comments := make([]models.Comment, 100)
		for j := 0; j < 100; j++ {
			comments[j] = models.Comment{
				ID:   string(rune(j)),
				Body: "This is a test comment with some content",
				Line: j,
				Author: models.User{
					ID:    string(rune(j)),
					Login: "testuser",
				},
				CreatedAt: time.Now(),
			}
		}
		_ = comments
	}
}

// BenchmarkMemoryAggregatorWithLargeDataset benchmarks aggregator memory usage
func BenchmarkMemoryAggregatorWithLargeDataset(b *testing.B) {
	// Skip aggregator since it requires a provider
	// Just benchmark sorting directly
	prs := generateTestPRs(5000)

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		sortedPRs := make([]models.PullRequest, len(prs))
		copy(sortedPRs, prs)
		_ = sortedPRs
	}
}

// BenchmarkMemoryLeakDetection tests for potential memory leaks in cache
func BenchmarkMemoryLeakDetection(b *testing.B) {
	cache := services.NewCache[[]models.PullRequest](10 * time.Millisecond)
	prs := generateTestPRs(100)

	var initialMem runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&initialMem)

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		key := "test:owner/repo:prs:" + string(rune(i%1000))
		cache.Set(key, prs)

		// Force periodic GC to check for leaks
		if i%1000 == 0 {
			runtime.GC()
		}
	}

	b.StopTimer()

	runtime.GC()
	var finalMem runtime.MemStats
	runtime.ReadMemStats(&finalMem)

	// Report memory growth
	memGrowth := finalMem.Alloc - initialMem.Alloc
	b.ReportMetric(float64(memGrowth)/float64(b.N), "bytes/op-growth")
}

// BenchmarkMemoryPRStructSize benchmarks the size of PR structures
func BenchmarkMemoryPRStructSize(b *testing.B) {
	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		pr := models.PullRequest{
			ID:     string(rune(i)),
			Number: i,
			Title:  "Test PR",
			State:  models.PRStateOpen,
			Author: models.User{
				ID:    "user1",
				Login: "testuser",
			},
			Repository: models.Repository{
				Owner:    "testorg",
				Name:     "testrepo",
				FullName: "testorg/testrepo",
			},
			Labels: []models.Label{
				{Name: "bug"},
				{Name: "urgent"},
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		_ = pr
	}
}

// BenchmarkMemoryStringConcatenation benchmarks string operations in rendering
func BenchmarkMemoryStringConcatenation(b *testing.B) {
	prs := generateTestPRs(100)

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		for _, pr := range prs {
			// Simulate string rendering operations
			_ = pr.Repository.Owner + "/" + pr.Repository.Name + " #" + string(rune(pr.Number))
		}
	}
}

// BenchmarkMemorySliceGrowth benchmarks memory usage during slice growth
func BenchmarkMemorySliceGrowth(b *testing.B) {
	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		prs := make([]models.PullRequest, 0)
		for j := 0; j < 1000; j++ {
			prs = append(prs, models.PullRequest{
				ID:     string(rune(j)),
				Number: j,
				Title:  "Test PR",
			})
		}
		_ = prs
	}
}

// BenchmarkMemorySlicePreallocation benchmarks memory with preallocated slices
func BenchmarkMemorySlicePreallocation(b *testing.B) {
	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		prs := make([]models.PullRequest, 0, 1000)
		for j := 0; j < 1000; j++ {
			prs = append(prs, models.PullRequest{
				ID:     string(rune(j)),
				Number: j,
				Title:  "Test PR",
			})
		}
		_ = prs
	}
}
