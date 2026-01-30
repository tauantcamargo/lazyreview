package services_test

import (
	"fmt"
	"time"

	"lazyreview/internal/models"
	"lazyreview/internal/services"
)

// Example demonstrates basic filtering of pull requests
func Example_basicFiltering() {
	filterService := services.NewFilterService()

	// Create sample PRs
	prs := []models.PullRequest{
		{
			Number: 1,
			Title:  "Fix authentication bug",
			State:  models.PRStateOpen,
			Author: models.User{Login: "alice"},
			Labels: []models.Label{{Name: "bug"}},
		},
		{
			Number: 2,
			Title:  "Add new feature",
			State:  models.PRStateOpen,
			Author: models.User{Login: "bob"},
			Labels: []models.Label{{Name: "feature"}},
		},
		{
			Number: 3,
			Title:  "Fix another bug",
			State:  models.PRStateClosed,
			Author: models.User{Login: "alice"},
			Labels: []models.Label{{Name: "bug"}},
		},
	}

	// Filter for open PRs with bug label
	filter := models.PRFilter{
		States: []models.PullRequestState{models.PRStateOpen},
		Labels: []string{"bug"},
	}

	results := filterService.ApplyFilter(prs, filter, "")

	fmt.Printf("Found %d open PRs with bug label\n", len(results))
	for _, pr := range results {
		fmt.Printf("PR #%d: %s\n", pr.Number, pr.Title)
	}

	// Output:
	// Found 1 open PRs with bug label
	// PR #1: Fix authentication bug
}

// Example demonstrates preset filters
func Example_presetFilters() {
	filterService := services.NewFilterService()

	prs := []models.PullRequest{
		{
			Number: 1,
			State:  models.PRStateOpen,
			Author: models.User{Login: "alice"},
		},
		{
			Number: 2,
			State:  models.PRStateOpen,
			Author: models.User{Login: "bob"},
			Reviewers: []models.User{
				{Login: "alice"},
			},
		},
	}

	// Filter for PRs authored by current user
	myPRsFilter := models.FilterMyPRs("alice")
	myPRs := filterService.ApplyFilter(prs, myPRsFilter, "alice")
	fmt.Printf("My PRs: %d\n", len(myPRs))

	// Filter for PRs needing review from current user
	needsReviewFilter := models.FilterNeedsMyReview("alice")
	needsReview := filterService.ApplyFilter(prs, needsReviewFilter, "alice")
	fmt.Printf("Needs my review: %d\n", len(needsReview))

	// Output:
	// My PRs: 1
	// Needs my review: 1
}

// Example demonstrates date filtering
func Example_dateFiltering() {
	filterService := services.NewFilterService()

	now := time.Now()
	weekAgo := now.AddDate(0, 0, -7)
	twoDaysAgo := now.AddDate(0, 0, -2)

	prs := []models.PullRequest{
		{
			Number:    1,
			State:     models.PRStateOpen,
			CreatedAt: now.AddDate(0, 0, -1), // yesterday
		},
		{
			Number:    2,
			State:     models.PRStateOpen,
			CreatedAt: now.AddDate(0, 0, -10), // 10 days ago
		},
	}

	// Filter for PRs created in the last week
	filter := models.PRFilter{
		States:       []models.PullRequestState{models.PRStateOpen},
		CreatedAfter: &weekAgo,
	}

	results := filterService.ApplyFilter(prs, filter, "")
	fmt.Printf("PRs created in last week: %d\n", len(results))

	// More restrictive filter (last 2 days)
	filter.CreatedAfter = &twoDaysAgo
	results = filterService.ApplyFilter(prs, filter, "")
	fmt.Printf("PRs created in last 2 days: %d\n", len(results))

	// Output:
	// PRs created in last week: 1
	// PRs created in last 2 days: 1
}

// Example demonstrates combining filters
func Example_combiningFilters() {
	filterService := services.NewFilterService()

	// Create two separate filters
	filter1 := models.PRFilter{
		States:  []models.PullRequestState{models.PRStateOpen, models.PRStateMerged},
		Authors: []string{"alice"},
	}

	filter2 := models.PRFilter{
		States:  []models.PullRequestState{models.PRStateOpen, models.PRStateClosed},
		Authors: []string{"bob"},
	}

	// Combine them (AND logic)
	combined := filterService.CombineFilters(filter1, filter2)

	// States are intersected (only open remains)
	fmt.Printf("Combined states: %d\n", len(combined.States))

	// Authors are union (both alice and bob)
	fmt.Printf("Combined authors: %d\n", len(combined.Authors))

	// Output:
	// Combined states: 1
	// Combined authors: 2
}

// Example demonstrates complex filtering
func Example_complexFiltering() {
	filterService := services.NewFilterService()
	isDraft := false

	prs := []models.PullRequest{
		{
			Number: 1,
			Title:  "Fix critical authentication bug",
			State:  models.PRStateOpen,
			Author: models.User{Login: "alice"},
			Labels: []models.Label{
				{Name: "bug"},
				{Name: "critical"},
			},
			IsDraft:        false,
			ReviewDecision: models.ReviewDecisionApproved,
			Repository: models.Repository{
				Owner: "myorg",
				Name:  "backend",
			},
		},
		{
			Number: 2,
			Title:  "Add new authentication method",
			State:  models.PRStateOpen,
			Author: models.User{Login: "bob"},
			Labels: []models.Label{{Name: "feature"}},
			IsDraft: true,
		},
	}

	// Complex filter combining multiple criteria
	filter := models.PRFilter{
		States:         []models.PullRequestState{models.PRStateOpen},
		Labels:         []string{"bug", "critical"}, // Must have both
		IsDraft:        &isDraft,
		ReviewDecision: []models.ReviewDecision{models.ReviewDecisionApproved},
		TitleContains:  "authentication",
		Repos: []models.RepoRef{
			{Owner: "myorg", Repo: "backend"},
		},
	}

	results := filterService.ApplyFilter(prs, filter, "")
	fmt.Printf("Found %d critical bugs in backend repo\n", len(results))

	if len(results) > 0 {
		fmt.Printf("PR #%d: %s (approved, ready to merge)\n",
			results[0].Number,
			results[0].Title,
		)
	}

	// Output:
	// Found 1 critical bugs in backend repo
	// PR #1: Fix critical authentication bug (approved, ready to merge)
}
