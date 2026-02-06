# LazyReview Performance Benchmarks

This directory contains comprehensive benchmark tests for LazyReview's performance-critical operations.

## Running Benchmarks

### Run all benchmarks
```bash
go test -bench=. -benchmem ./benchmarks
```

### Run specific benchmark
```bash
go test -bench=BenchmarkPRListFiltering -benchmem ./benchmarks
```

### Run with profiling
```bash
# CPU profiling
go test -bench=. -benchmem -cpuprofile=cpu.prof ./benchmarks

# Memory profiling
go test -bench=. -benchmem -memprofile=mem.prof ./benchmarks

# Block profiling
go test -bench=. -benchmem -blockprofile=block.prof ./benchmarks
```

### Analyze profiles
```bash
# CPU profile
go tool pprof cpu.prof

# Memory profile
go tool pprof mem.prof

# View in web browser
go tool pprof -http=:8080 cpu.prof
```

### Generate benchmark comparison
```bash
# Save baseline
go test -bench=. -benchmem ./benchmarks > baseline.txt

# After changes
go test -bench=. -benchmem ./benchmarks > new.txt

# Compare (requires benchstat)
benchstat baseline.txt new.txt
```

## Benchmark Categories

### PR List Operations (`pr_list_bench_test.go`)
- **BenchmarkPRListFiltering**: Simple filtering operations
- **BenchmarkPRListFilteringComplex**: Complex multi-criteria filtering
- **BenchmarkPRListSorting**: Sorting operations
- **BenchmarkPRListPagination**: Pagination logic
- **BenchmarkPRCache**: Cache get/set operations
- **BenchmarkPRCacheWithEviction**: Cache with TTL eviction
- **BenchmarkPRListMatching**: Filter matching operations
- **BenchmarkPRSummaryGeneration**: Summary generation
- **BenchmarkPRCombineFilters**: Filter combination logic

**Target**: <100ms P95 for filtering 1000 PRs

### Diff Rendering (`diff_bench_test.go`)
- **BenchmarkDiffParsing**: Unified diff parsing
- **BenchmarkDiffRendering**: Syntax highlighting (100 files)
- **BenchmarkDiffRenderingLarge**: Syntax highlighting (1000 files)
- **BenchmarkDiffNavigation**: Hunk navigation operations
- **BenchmarkDiffLineHighlighting**: Multi-language syntax highlighting
- **BenchmarkDiffHunkExpansion**: Expanding collapsed hunks
- **BenchmarkDiffCommentInsertion**: Adding inline comments

**Target**: <200ms for rendering 100-file diff with syntax highlighting

### Startup Performance (`startup_bench_test.go`)
- **BenchmarkConfigLoad**: Configuration loading
- **BenchmarkStorageInit**: SQLite initialization
- **BenchmarkCacheInit**: Cache service initialization
- **BenchmarkFilterServiceInit**: Filter service initialization
- **BenchmarkAggregatorInit**: Aggregator service initialization
- **BenchmarkFullStartup**: Complete startup sequence
- **BenchmarkStorageQueryPRs**: Database queries
- **BenchmarkStorageQueryPRByNumber**: Single PR queries
- **BenchmarkStorageSavePR**: PR persistence
- **BenchmarkStorageUpdatePR**: PR updates
- **BenchmarkConcurrentStorageReads**: Concurrent database reads

**Target**: <2s for full application startup

### Memory Usage (`memory_bench_test.go`)
- **BenchmarkMemoryPRListAllocation**: Large PR list allocation
- **BenchmarkMemoryPRFiltering**: Memory during filtering
- **BenchmarkMemoryCacheGrowth**: Cache memory growth
- **BenchmarkMemoryDiffAllocation**: Diff structure allocation
- **BenchmarkMemoryDiffLargeAllocation**: Large diff allocation
- **BenchmarkMemoryCommentAllocation**: Comment structure allocation
- **BenchmarkMemoryAggregatorWithLargeDataset**: Aggregator memory usage
- **BenchmarkMemoryLeakDetection**: Memory leak detection
- **BenchmarkMemoryPRStructSize**: PR structure size
- **BenchmarkMemoryStringConcatenation**: String operations
- **BenchmarkMemorySliceGrowth**: Dynamic slice growth
- **BenchmarkMemorySlicePreallocation**: Preallocated slice comparison

**Target**: <100MB peak memory for typical workload (1000 PRs)

## Performance SLOs

See [PERFORMANCE.md](../PERFORMANCE.md) for detailed Service Level Objectives.

## Continuous Benchmarking

Benchmarks run automatically in CI on every PR:
- Detects performance regressions >10%
- Generates benchmark comparison reports
- Fails CI if critical thresholds exceeded

See `.github/workflows/benchmark.yml` for configuration.

## Tips for Benchmark Development

1. **Always use `b.ResetTimer()`** after setup code
2. **Use `b.ReportAllocs()`** for memory benchmarks
3. **Pre-generate test data** outside benchmark loop
4. **Use `b.RunParallel()`** for concurrent scenarios
5. **Avoid I/O in benchmarks** (use `:memory:` for SQLite)
6. **Run multiple iterations** for stable results: `go test -bench=. -count=5`

## Profiling Workflow

1. Identify slow benchmark
2. Run with CPU profiling: `go test -bench=BenchmarkSlow -cpuprofile=cpu.prof`
3. Analyze: `go tool pprof -http=:8080 cpu.prof`
4. Look for hot spots in flame graph
5. Optimize and re-benchmark
6. Compare results with `benchstat`

## Installing benchstat

```bash
go install golang.org/x/perf/cmd/benchstat@latest
```
