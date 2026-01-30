package services

import (
	"strings"
	"time"

	"lazyreview/internal/models"
)

// FilterService provides filtering capabilities for pull requests
type FilterService struct{}

// NewFilterService creates a new FilterService instance
func NewFilterService() *FilterService {
	return &FilterService{}
}

// ApplyFilter filters a list of PRs based on the provided criteria
func (s *FilterService) ApplyFilter(prs []models.PullRequest, filter models.PRFilter, currentUser string) []models.PullRequest {
	if len(prs) == 0 {
		return prs
	}

	result := make([]models.PullRequest, 0, len(prs))
	for _, pr := range prs {
		if s.MatchesPR(pr, filter, currentUser) {
			result = append(result, pr)
		}
	}

	return result
}

// MatchesPR checks if a single PR matches all filter criteria
func (s *FilterService) MatchesPR(pr models.PullRequest, filter models.PRFilter, currentUser string) bool {
	// Check state filter
	if !s.matchesState(pr, filter) {
		return false
	}

	// Check author filter
	if !s.matchesAuthor(pr, filter, currentUser) {
		return false
	}

	// Check assignee filter
	if !s.matchesAssignee(pr, filter, currentUser) {
		return false
	}

	// Check review requested filter
	if !s.matchesReviewRequested(pr, filter, currentUser) {
		return false
	}

	// Check review decision filter
	if !s.matchesReviewDecision(pr, filter) {
		return false
	}

	// Check label filters
	if !s.matchesLabels(pr, filter) {
		return false
	}

	// Check date filters
	if !s.matchesDateFilters(pr, filter) {
		return false
	}

	// Check draft filter
	if !s.matchesDraft(pr, filter) {
		return false
	}

	// Check conflicts filter
	if !s.matchesConflicts(pr, filter) {
		return false
	}

	// Check title search
	if !s.matchesTitleSearch(pr, filter) {
		return false
	}

	// Check repository scope
	if !s.matchesRepository(pr, filter) {
		return false
	}

	return true
}

// matchesState checks if the PR state matches the filter
func (s *FilterService) matchesState(pr models.PullRequest, filter models.PRFilter) bool {
	if len(filter.States) == 0 {
		return true
	}

	for _, state := range filter.States {
		if pr.State == state {
			return true
		}
	}

	return false
}

// matchesAuthor checks if the PR author matches the filter
func (s *FilterService) matchesAuthor(pr models.PullRequest, filter models.PRFilter, currentUser string) bool {
	if !filter.AuthorMe && len(filter.Authors) == 0 {
		return true
	}

	// Check AuthorMe flag
	if filter.AuthorMe && currentUser != "" {
		if strings.EqualFold(pr.Author.Login, currentUser) {
			return true
		}
	}

	// Check explicit authors list
	for _, author := range filter.Authors {
		if strings.EqualFold(pr.Author.Login, author) {
			return true
		}
	}

	// If we have author filters but no match, return false
	if filter.AuthorMe || len(filter.Authors) > 0 {
		return false
	}

	return true
}

// matchesAssignee checks if the PR assignees match the filter
func (s *FilterService) matchesAssignee(pr models.PullRequest, filter models.PRFilter, currentUser string) bool {
	if !filter.AssigneeMe && len(filter.Assignees) == 0 {
		return true
	}

	// Check AssigneeMe flag
	if filter.AssigneeMe && currentUser != "" {
		for _, assignee := range pr.Assignees {
			if strings.EqualFold(assignee.Login, currentUser) {
				return true
			}
		}
	}

	// Check explicit assignees list
	for _, filterAssignee := range filter.Assignees {
		for _, prAssignee := range pr.Assignees {
			if strings.EqualFold(prAssignee.Login, filterAssignee) {
				return true
			}
		}
	}

	// If we have assignee filters but no match, return false
	if filter.AssigneeMe || len(filter.Assignees) > 0 {
		return false
	}

	return true
}

// matchesReviewRequested checks if the PR has review requests matching the filter
func (s *FilterService) matchesReviewRequested(pr models.PullRequest, filter models.PRFilter, currentUser string) bool {
	if !filter.ReviewRequestedMe && len(filter.ReviewRequested) == 0 {
		return true
	}

	// Check ReviewRequestedMe flag
	if filter.ReviewRequestedMe && currentUser != "" {
		for _, reviewer := range pr.Reviewers {
			if strings.EqualFold(reviewer.Login, currentUser) {
				return true
			}
		}
	}

	// Check explicit review requested list
	for _, filterReviewer := range filter.ReviewRequested {
		for _, prReviewer := range pr.Reviewers {
			if strings.EqualFold(prReviewer.Login, filterReviewer) {
				return true
			}
		}
	}

	// If we have review requested filters but no match, return false
	if filter.ReviewRequestedMe || len(filter.ReviewRequested) > 0 {
		return false
	}

	return true
}

// matchesReviewDecision checks if the PR review decision matches the filter
func (s *FilterService) matchesReviewDecision(pr models.PullRequest, filter models.PRFilter) bool {
	if len(filter.ReviewDecision) == 0 {
		return true
	}

	for _, decision := range filter.ReviewDecision {
		if pr.ReviewDecision == decision {
			return true
		}
	}

	return false
}

// matchesLabels checks if the PR labels match the filter
func (s *FilterService) matchesLabels(pr models.PullRequest, filter models.PRFilter) bool {
	// Check exclude labels first (higher priority)
	if len(filter.ExcludeLabels) > 0 {
		for _, excludeLabel := range filter.ExcludeLabels {
			for _, prLabel := range pr.Labels {
				if strings.EqualFold(prLabel.Name, excludeLabel) {
					return false // PR has an excluded label
				}
			}
		}
	}

	// Check include labels (all must be present)
	if len(filter.Labels) > 0 {
		for _, requiredLabel := range filter.Labels {
			found := false
			for _, prLabel := range pr.Labels {
				if strings.EqualFold(prLabel.Name, requiredLabel) {
					found = true
					break
				}
			}
			if !found {
				return false // Required label not found
			}
		}
	}

	return true
}

// matchesDateFilters checks if the PR dates match the filter criteria
func (s *FilterService) matchesDateFilters(pr models.PullRequest, filter models.PRFilter) bool {
	// Check CreatedAfter
	if filter.CreatedAfter != nil {
		if pr.CreatedAt.Before(*filter.CreatedAfter) {
			return false
		}
	}

	// Check CreatedBefore
	if filter.CreatedBefore != nil {
		if pr.CreatedAt.After(*filter.CreatedBefore) {
			return false
		}
	}

	// Check UpdatedAfter
	if filter.UpdatedAfter != nil {
		if pr.UpdatedAt.Before(*filter.UpdatedAfter) {
			return false
		}
	}

	// Check UpdatedBefore
	if filter.UpdatedBefore != nil {
		if pr.UpdatedAt.After(*filter.UpdatedBefore) {
			return false
		}
	}

	return true
}

// matchesDraft checks if the PR draft status matches the filter
func (s *FilterService) matchesDraft(pr models.PullRequest, filter models.PRFilter) bool {
	if filter.IsDraft == nil {
		return true
	}

	return pr.IsDraft == *filter.IsDraft
}

// matchesConflicts checks if the PR conflict status matches the filter
func (s *FilterService) matchesConflicts(pr models.PullRequest, filter models.PRFilter) bool {
	if filter.HasConflicts == nil {
		return true
	}

	hasConflicts := pr.MergeableState == models.MergeableStateConflicting
	return hasConflicts == *filter.HasConflicts
}

// matchesTitleSearch checks if the PR title contains the search string
func (s *FilterService) matchesTitleSearch(pr models.PullRequest, filter models.PRFilter) bool {
	if filter.TitleContains == "" {
		return true
	}

	return strings.Contains(
		strings.ToLower(pr.Title),
		strings.ToLower(filter.TitleContains),
	)
}

// matchesRepository checks if the PR repository matches the filter scope
func (s *FilterService) matchesRepository(pr models.PullRequest, filter models.PRFilter) bool {
	if len(filter.Repos) == 0 {
		return true
	}

	for _, repoRef := range filter.Repos {
		// Match on owner and repo name (most common case)
		if strings.EqualFold(pr.Repository.Owner, repoRef.Owner) &&
			strings.EqualFold(pr.Repository.Name, repoRef.Repo) {
			return true
		}

		// Also check against FullName if it matches the pattern
		if strings.EqualFold(pr.Repository.FullName, repoRef.FullName()) {
			return true
		}
	}

	return false
}

// CountMatching returns the count of PRs that match the filter
func (s *FilterService) CountMatching(prs []models.PullRequest, filter models.PRFilter, currentUser string) int {
	count := 0
	for _, pr := range prs {
		if s.MatchesPR(pr, filter, currentUser) {
			count++
		}
	}
	return count
}

// GetMatchingSummaries returns summaries of PRs that match the filter
func (s *FilterService) GetMatchingSummaries(prs []models.PullRequest, filter models.PRFilter, currentUser string) []models.PullRequestSummary {
	matched := s.ApplyFilter(prs, filter, currentUser)
	summaries := make([]models.PullRequestSummary, len(matched))
	for i, pr := range matched {
		summaries[i] = pr.ToSummary()
	}
	return summaries
}

// CombineFilters combines multiple filters with AND logic
func (s *FilterService) CombineFilters(filters ...models.PRFilter) models.PRFilter {
	if len(filters) == 0 {
		return models.PRFilter{}
	}

	combined := filters[0]

	for i := 1; i < len(filters); i++ {
		filter := filters[i]

		// Combine states (intersection)
		if len(filter.States) > 0 {
			if len(combined.States) > 0 {
				combined.States = s.intersectStates(combined.States, filter.States)
			} else {
				combined.States = filter.States
			}
		}

		// Combine authors (union)
		combined.Authors = s.unionStrings(combined.Authors, filter.Authors)
		combined.AuthorMe = combined.AuthorMe || filter.AuthorMe

		// Combine assignees (union)
		combined.Assignees = s.unionStrings(combined.Assignees, filter.Assignees)
		combined.AssigneeMe = combined.AssigneeMe || filter.AssigneeMe

		// Combine review requested (union)
		combined.ReviewRequested = s.unionStrings(combined.ReviewRequested, filter.ReviewRequested)
		combined.ReviewRequestedMe = combined.ReviewRequestedMe || filter.ReviewRequestedMe

		// Combine review decisions (intersection)
		if len(filter.ReviewDecision) > 0 {
			if len(combined.ReviewDecision) > 0 {
				combined.ReviewDecision = s.intersectReviewDecisions(combined.ReviewDecision, filter.ReviewDecision)
			} else {
				combined.ReviewDecision = filter.ReviewDecision
			}
		}

		// Combine labels (union for includes, union for excludes)
		combined.Labels = s.unionStrings(combined.Labels, filter.Labels)
		combined.ExcludeLabels = s.unionStrings(combined.ExcludeLabels, filter.ExcludeLabels)

		// Combine date filters (most restrictive)
		combined.CreatedAfter = s.latestTime(combined.CreatedAfter, filter.CreatedAfter)
		combined.CreatedBefore = s.earliestTime(combined.CreatedBefore, filter.CreatedBefore)
		combined.UpdatedAfter = s.latestTime(combined.UpdatedAfter, filter.UpdatedAfter)
		combined.UpdatedBefore = s.earliestTime(combined.UpdatedBefore, filter.UpdatedBefore)

		// Combine boolean filters (prefer specific values over nil)
		if filter.IsDraft != nil {
			combined.IsDraft = filter.IsDraft
		}
		if filter.HasConflicts != nil {
			combined.HasConflicts = filter.HasConflicts
		}

		// Combine title search (concatenate with space)
		if filter.TitleContains != "" {
			if combined.TitleContains != "" {
				combined.TitleContains = combined.TitleContains + " " + filter.TitleContains
			} else {
				combined.TitleContains = filter.TitleContains
			}
		}

		// Combine repos (union)
		combined.Repos = s.unionRepos(combined.Repos, filter.Repos)
	}

	return combined
}

// Helper functions for combining filters

func (s *FilterService) intersectStates(a, b []models.PullRequestState) []models.PullRequestState {
	result := make([]models.PullRequestState, 0)
	for _, stateA := range a {
		for _, stateB := range b {
			if stateA == stateB {
				result = append(result, stateA)
				break
			}
		}
	}
	return result
}

func (s *FilterService) intersectReviewDecisions(a, b []models.ReviewDecision) []models.ReviewDecision {
	result := make([]models.ReviewDecision, 0)
	for _, decA := range a {
		for _, decB := range b {
			if decA == decB {
				result = append(result, decA)
				break
			}
		}
	}
	return result
}

func (s *FilterService) unionStrings(a, b []string) []string {
	seen := make(map[string]bool)
	result := make([]string, 0, len(a)+len(b))

	for _, s := range a {
		lower := strings.ToLower(s)
		if !seen[lower] {
			seen[lower] = true
			result = append(result, s)
		}
	}

	for _, s := range b {
		lower := strings.ToLower(s)
		if !seen[lower] {
			seen[lower] = true
			result = append(result, s)
		}
	}

	return result
}

func (s *FilterService) unionRepos(a, b []models.RepoRef) []models.RepoRef {
	seen := make(map[string]bool)
	result := make([]models.RepoRef, 0, len(a)+len(b))

	for _, repo := range a {
		key := repo.UniqueKey()
		if !seen[key] {
			seen[key] = true
			result = append(result, repo)
		}
	}

	for _, repo := range b {
		key := repo.UniqueKey()
		if !seen[key] {
			seen[key] = true
			result = append(result, repo)
		}
	}

	return result
}

func (s *FilterService) latestTime(a, b *time.Time) *time.Time {
	if a == nil {
		return b
	}
	if b == nil {
		return a
	}
	if b.After(*a) {
		return b
	}
	return a
}

func (s *FilterService) earliestTime(a, b *time.Time) *time.Time {
	if a == nil {
		return b
	}
	if b == nil {
		return a
	}
	if b.Before(*a) {
		return b
	}
	return a
}
