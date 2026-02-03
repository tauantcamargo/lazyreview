package services

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"lazyreview/internal/models"
	"lazyreview/internal/storage"
	"lazyreview/pkg/providers"
)

// AggregationSection represents a grouped dashboard section.
type AggregationSection string

const (
	SectionNeedsReview AggregationSection = "needs_review"
	SectionMyPRs       AggregationSection = "my_prs"
	SectionAll         AggregationSection = "all"
)

// AggregationResult contains PRs for each section.
type AggregationResult struct {
	NeedsReview []models.PullRequest
	MyPRs       []models.PullRequest
	All         []models.PullRequest
}

// Aggregator fetches PRs across multiple repositories.
type Aggregator struct {
	provider    providers.Provider
	cache       *Cache[[]models.PullRequest]
	concurrency int
}

// NewAggregator creates a new aggregator.
func NewAggregator(provider providers.Provider) *Aggregator {
	return &Aggregator{
		provider:    provider,
		cache:       NewCache[[]models.PullRequest](2 * time.Minute),
		concurrency: 6,
	}
}

// SetConcurrency overrides the concurrency limit.
func (a *Aggregator) SetConcurrency(limit int) {
	if limit <= 0 {
		return
	}
	a.concurrency = limit
}

// FetchDashboard loads PRs for dashboard sections.
func (a *Aggregator) FetchDashboard(ctx context.Context, repos []storage.RepoRef, currentUser string) (AggregationResult, error) {
	result := AggregationResult{}
	if len(repos) == 0 {
		return result, nil
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 3)

	wg.Add(1)
	go func() {
		defer wg.Done()
		prs, err := a.fetchSection(ctx, repos, SectionNeedsReview, providers.ListOptions{
			State:           models.PRStateOpen,
			ReviewRequested: currentUser,
			PerPage:         50,
			Page:            1,
		})
		if err != nil {
			errCh <- err
			return
		}
		result.NeedsReview = prs
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		prs, err := a.fetchSection(ctx, repos, SectionMyPRs, providers.ListOptions{
			State:   models.PRStateOpen,
			Author:  currentUser,
			PerPage: 50,
			Page:    1,
		})
		if err != nil {
			errCh <- err
			return
		}
		result.MyPRs = prs
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		prs, err := a.fetchSection(ctx, repos, SectionAll, providers.ListOptions{
			State:   models.PRStateOpen,
			PerPage: 50,
			Page:    1,
		})
		if err != nil {
			errCh <- err
			return
		}
		result.All = prs
	}()

	wg.Wait()
	close(errCh)
	for err := range errCh {
		if err != nil {
			return result, err
		}
	}

	return result, nil
}

func (a *Aggregator) fetchSection(ctx context.Context, repos []storage.RepoRef, section AggregationSection, opts providers.ListOptions) ([]models.PullRequest, error) {
	if current := strings.TrimSpace(opts.ReviewRequested); section == SectionNeedsReview && current == "" {
		return nil, nil
	}
	if current := strings.TrimSpace(opts.Author); section == SectionMyPRs && current == "" {
		return nil, nil
	}

	key := a.cacheKey(section, repos, opts)
	if cached, ok := a.cache.Get(key); ok {
		return cached, nil
	}

	var (
		mu  sync.Mutex
		prs []models.PullRequest
		err error
		sem = make(chan struct{}, a.concurrency)
		wg  sync.WaitGroup
	)

	for _, repo := range repos {
		repo := repo
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			items, e := a.provider.ListPullRequests(ctx, repo.Owner, repo.Repo, opts)
			if e != nil {
				mu.Lock()
				if err == nil {
					err = fmt.Errorf("%s/%s: %w", repo.Owner, repo.Repo, e)
				}
				mu.Unlock()
				return
			}
			mu.Lock()
			prs = append(prs, items...)
			mu.Unlock()
		}()
	}

	wg.Wait()
	if err != nil {
		return nil, err
	}

	sort.Slice(prs, func(i, j int) bool {
		return prs[i].UpdatedAt.After(prs[j].UpdatedAt)
	})

	a.cache.Set(key, prs)
	return prs, nil
}

func (a *Aggregator) cacheKey(section AggregationSection, repos []storage.RepoRef, opts providers.ListOptions) string {
	parts := make([]string, 0, len(repos))
	for _, repo := range repos {
		parts = append(parts, fmt.Sprintf("%s:%s:%s/%s", repo.ProviderType, repo.Host, repo.Owner, repo.Repo))
	}
	sort.Strings(parts)
	payload := fmt.Sprintf("%s|%s|%s|%s|%s", section, strings.Join(parts, ","), opts.Author, opts.ReviewRequested, opts.State)
	sum := sha1.Sum([]byte(payload))
	return hex.EncodeToString(sum[:])
}
