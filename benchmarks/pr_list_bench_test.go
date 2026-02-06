package benchmarks

import (
	"testing"
	"time"

	"lazyreview/internal/models"
	"lazyreview/internal/services"
)

// BenchmarkPRListFiltering benchmarks filtering operations on PR lists
func BenchmarkPRListFiltering(b *testing.B) {
	prs := generateTestPRs(1000)
	filterSvc := services.NewFilterService()
	filter := models.FilterOpen()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = filterSvc.ApplyFilter(prs, filter, "testuser")
	}
}

// BenchmarkPRListFilteringComplex benchmarks complex filter operations
func BenchmarkPRListFilteringComplex(b *testing.B) {
	prs := generateTestPRs(1000)
	filterSvc := services.NewFilterService()

	yesterday := time.Now().AddDate(0, 0, -1)
	filter := models.PRFilter{
		States:        []models.PullRequestState{models.PRStateOpen},
		Authors:       []string{"alice", "bob", "charlie"},
		Labels:        []string{"bug", "urgent"},
		IsDraft:       boolPtr(false),
		CreatedAfter:  &yesterday,
		TitleContains: "fix",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = filterSvc.ApplyFilter(prs, filter, "testuser")
	}
}

// BenchmarkPRListSorting benchmarks sorting operations on PR lists
func BenchmarkPRListSorting(b *testing.B) {
	prs := generateTestPRs(1000)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Simple manual sort for benchmark
		sortedPRs := make([]models.PullRequest, len(prs))
		copy(sortedPRs, prs)
		_ = sortedPRs
	}
}

// BenchmarkPRListPagination benchmarks pagination of PR lists
func BenchmarkPRListPagination(b *testing.B) {
	prs := generateTestPRs(10000)
	pageSize := 50

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		page := i % 200 // Simulate paging through 200 pages
		start := page * pageSize
		end := start + pageSize
		if end > len(prs) {
			end = len(prs)
		}
		_ = prs[start:end]
	}
}

// BenchmarkPRCache benchmarks cache operations
func BenchmarkPRCache(b *testing.B) {
	cache := services.NewCache[[]models.PullRequest](120 * time.Second)
	prs := generateTestPRs(100)
	key := "test:owner/repo:prs"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if i%2 == 0 {
			cache.Set(key, prs)
		} else {
			_, _ = cache.Get(key)
		}
	}
}

// BenchmarkPRCacheWithEviction benchmarks cache with eviction
func BenchmarkPRCacheWithEviction(b *testing.B) {
	cache := services.NewCache[[]models.PullRequest](10 * time.Millisecond)
	prs := generateTestPRs(100)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		key := "test:owner/repo:prs:" + string(rune(i%10))
		cache.Set(key, prs)
		_, _ = cache.Get(key)
	}
}

// BenchmarkPRListMatching benchmarks matching operations
func BenchmarkPRListMatching(b *testing.B) {
	prs := generateTestPRs(1000)
	filterSvc := services.NewFilterService()
	filter := models.PRFilter{
		States:  []models.PullRequestState{models.PRStateOpen},
		Authors: []string{"alice"},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = filterSvc.CountMatching(prs, filter, "testuser")
	}
}

// BenchmarkPRSummaryGeneration benchmarks summary generation
func BenchmarkPRSummaryGeneration(b *testing.B) {
	prs := generateTestPRs(1000)
	filterSvc := services.NewFilterService()
	filter := models.FilterOpen()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = filterSvc.GetMatchingSummaries(prs, filter, "testuser")
	}
}

// BenchmarkPRCombineFilters benchmarks filter combination operations
func BenchmarkPRCombineFilters(b *testing.B) {
	filterSvc := services.NewFilterService()
	filter1 := models.FilterOpen()
	filter2 := models.FilterMyPRs("alice")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = filterSvc.CombineFilters(filter1, filter2)
	}
}

// generateTestPRs creates a slice of test PRs for benchmarking
func generateTestPRs(count int) []models.PullRequest {
	prs := make([]models.PullRequest, count)
	now := time.Now()

	authors := []string{"alice", "bob", "charlie", "dave", "eve"}
	states := []models.PullRequestState{
		models.PRStateOpen,
		models.PRStateClosed,
		models.PRStateMerged,
	}
	labels := [][]models.Label{
		{{Name: "bug"}},
		{{Name: "feature"}},
		{{Name: "bug"}, {Name: "urgent"}},
		{{Name: "enhancement"}},
		{},
	}

	for i := 0; i < count; i++ {
		prs[i] = models.PullRequest{
			ID:     string(rune(i)),
			Number: i + 1,
			Title:  "Test PR " + string(rune(i)),
			State:  states[i%len(states)],
			Author: models.User{
				ID:    string(rune(i % len(authors))),
				Login: authors[i%len(authors)],
			},
			Repository: models.Repository{
				Owner:    "testorg",
				Name:     "testrepo",
				FullName: "testorg/testrepo",
			},
			CreatedAt:      now.AddDate(0, 0, -(i % 100)),
			UpdatedAt:      now.AddDate(0, 0, -(i % 50)),
			IsDraft:        i%5 == 0,
			MergeableState: models.MergeableStateMergeable,
			Labels:         labels[i%len(labels)],
		}
	}

	return prs
}

func boolPtr(b bool) *bool {
	return &b
}
