package services

import (
	"testing"
	"time"

	"lazyreview/internal/models"
)

// Helper function to create a test PR
func createTestPR(opts ...func(*models.PullRequest)) models.PullRequest {
	pr := models.PullRequest{
		ID:     "1",
		Number: 1,
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
		CreatedAt:      time.Now().AddDate(0, 0, -7),
		UpdatedAt:      time.Now().AddDate(0, 0, -1),
		IsDraft:        false,
		MergeableState: models.MergeableStateMergeable,
	}

	for _, opt := range opts {
		opt(&pr)
	}

	return pr
}

func TestFilterService_MatchesPR_StateFilter(t *testing.T) {
	service := NewFilterService()

	tests := []struct {
		name     string
		prState  models.PullRequestState
		filter   models.PRFilter
		expected bool
	}{
		{
			name:     "Open PR matches open filter",
			prState:  models.PRStateOpen,
			filter:   models.PRFilter{States: []models.PullRequestState{models.PRStateOpen}},
			expected: true,
		},
		{
			name:     "Open PR does not match closed filter",
			prState:  models.PRStateOpen,
			filter:   models.PRFilter{States: []models.PullRequestState{models.PRStateClosed}},
			expected: false,
		},
		{
			name:     "Merged PR matches merged filter",
			prState:  models.PRStateMerged,
			filter:   models.PRFilter{States: []models.PullRequestState{models.PRStateMerged}},
			expected: true,
		},
		{
			name:     "Open PR matches multiple states including open",
			prState:  models.PRStateOpen,
			filter:   models.PRFilter{States: []models.PullRequestState{models.PRStateOpen, models.PRStateMerged}},
			expected: true,
		},
		{
			name:     "Empty state filter matches any PR",
			prState:  models.PRStateOpen,
			filter:   models.PRFilter{},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := createTestPR(func(p *models.PullRequest) {
				p.State = tt.prState
			})

			result := service.MatchesPR(pr, tt.filter, "")
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestFilterService_MatchesPR_AuthorFilter(t *testing.T) {
	service := NewFilterService()

	tests := []struct {
		name        string
		prAuthor    string
		currentUser string
		filter      models.PRFilter
		expected    bool
	}{
		{
			name:        "Matches AuthorMe flag",
			prAuthor:    "alice",
			currentUser: "alice",
			filter:      models.PRFilter{AuthorMe: true},
			expected:    true,
		},
		{
			name:        "Does not match AuthorMe flag",
			prAuthor:    "bob",
			currentUser: "alice",
			filter:      models.PRFilter{AuthorMe: true},
			expected:    false,
		},
		{
			name:     "Matches author in list",
			prAuthor: "alice",
			filter:   models.PRFilter{Authors: []string{"alice", "bob"}},
			expected: true,
		},
		{
			name:     "Does not match author in list",
			prAuthor: "charlie",
			filter:   models.PRFilter{Authors: []string{"alice", "bob"}},
			expected: false,
		},
		{
			name:     "Case insensitive author matching",
			prAuthor: "Alice",
			filter:   models.PRFilter{Authors: []string{"alice"}},
			expected: true,
		},
		{
			name:     "Empty author filter matches any PR",
			prAuthor: "anyone",
			filter:   models.PRFilter{},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := createTestPR(func(p *models.PullRequest) {
				p.Author.Login = tt.prAuthor
			})

			result := service.MatchesPR(pr, tt.filter, tt.currentUser)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestFilterService_MatchesPR_AssigneeFilter(t *testing.T) {
	service := NewFilterService()

	tests := []struct {
		name        string
		assignees   []models.User
		currentUser string
		filter      models.PRFilter
		expected    bool
	}{
		{
			name: "Matches AssigneeMe flag",
			assignees: []models.User{
				{Login: "alice"},
				{Login: "bob"},
			},
			currentUser: "alice",
			filter:      models.PRFilter{AssigneeMe: true},
			expected:    true,
		},
		{
			name: "Does not match AssigneeMe flag",
			assignees: []models.User{
				{Login: "bob"},
			},
			currentUser: "alice",
			filter:      models.PRFilter{AssigneeMe: true},
			expected:    false,
		},
		{
			name: "Matches assignee in list",
			assignees: []models.User{
				{Login: "alice"},
			},
			filter:   models.PRFilter{Assignees: []string{"alice"}},
			expected: true,
		},
		{
			name: "Does not match assignee in list",
			assignees: []models.User{
				{Login: "charlie"},
			},
			filter:   models.PRFilter{Assignees: []string{"alice", "bob"}},
			expected: false,
		},
		{
			name:      "Empty assignees list with filter returns false",
			assignees: []models.User{},
			filter:    models.PRFilter{Assignees: []string{"alice"}},
			expected:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := createTestPR(func(p *models.PullRequest) {
				p.Assignees = tt.assignees
			})

			result := service.MatchesPR(pr, tt.filter, tt.currentUser)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestFilterService_MatchesPR_ReviewRequestedFilter(t *testing.T) {
	service := NewFilterService()

	tests := []struct {
		name        string
		reviewers   []models.User
		currentUser string
		filter      models.PRFilter
		expected    bool
	}{
		{
			name: "Matches ReviewRequestedMe flag",
			reviewers: []models.User{
				{Login: "alice"},
				{Login: "bob"},
			},
			currentUser: "alice",
			filter:      models.PRFilter{ReviewRequestedMe: true},
			expected:    true,
		},
		{
			name: "Does not match ReviewRequestedMe flag",
			reviewers: []models.User{
				{Login: "bob"},
			},
			currentUser: "alice",
			filter:      models.PRFilter{ReviewRequestedMe: true},
			expected:    false,
		},
		{
			name: "Matches reviewer in list",
			reviewers: []models.User{
				{Login: "alice"},
			},
			filter:   models.PRFilter{ReviewRequested: []string{"alice"}},
			expected: true,
		},
		{
			name: "Case insensitive reviewer matching",
			reviewers: []models.User{
				{Login: "Alice"},
			},
			filter:   models.PRFilter{ReviewRequested: []string{"alice"}},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := createTestPR(func(p *models.PullRequest) {
				p.Reviewers = tt.reviewers
			})

			result := service.MatchesPR(pr, tt.filter, tt.currentUser)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestFilterService_MatchesPR_ReviewDecisionFilter(t *testing.T) {
	service := NewFilterService()

	tests := []struct {
		name     string
		decision models.ReviewDecision
		filter   models.PRFilter
		expected bool
	}{
		{
			name:     "Matches approved decision",
			decision: models.ReviewDecisionApproved,
			filter:   models.PRFilter{ReviewDecision: []models.ReviewDecision{models.ReviewDecisionApproved}},
			expected: true,
		},
		{
			name:     "Does not match different decision",
			decision: models.ReviewDecisionPending,
			filter:   models.PRFilter{ReviewDecision: []models.ReviewDecision{models.ReviewDecisionApproved}},
			expected: false,
		},
		{
			name:     "Matches one of multiple decisions",
			decision: models.ReviewDecisionChangesRequsted,
			filter:   models.PRFilter{ReviewDecision: []models.ReviewDecision{models.ReviewDecisionApproved, models.ReviewDecisionChangesRequsted}},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := createTestPR(func(p *models.PullRequest) {
				p.ReviewDecision = tt.decision
			})

			result := service.MatchesPR(pr, tt.filter, "")
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestFilterService_MatchesPR_LabelFilter(t *testing.T) {
	service := NewFilterService()

	tests := []struct {
		name     string
		labels   []models.Label
		filter   models.PRFilter
		expected bool
	}{
		{
			name: "Matches required label",
			labels: []models.Label{
				{Name: "bug"},
				{Name: "urgent"},
			},
			filter:   models.PRFilter{Labels: []string{"bug"}},
			expected: true,
		},
		{
			name: "Matches all required labels",
			labels: []models.Label{
				{Name: "bug"},
				{Name: "urgent"},
			},
			filter:   models.PRFilter{Labels: []string{"bug", "urgent"}},
			expected: true,
		},
		{
			name: "Does not match missing required label",
			labels: []models.Label{
				{Name: "bug"},
			},
			filter:   models.PRFilter{Labels: []string{"bug", "urgent"}},
			expected: false,
		},
		{
			name: "Excluded label filters out PR",
			labels: []models.Label{
				{Name: "bug"},
				{Name: "wontfix"},
			},
			filter:   models.PRFilter{ExcludeLabels: []string{"wontfix"}},
			expected: false,
		},
		{
			name: "Does not match excluded label",
			labels: []models.Label{
				{Name: "bug"},
			},
			filter:   models.PRFilter{ExcludeLabels: []string{"wontfix"}},
			expected: true,
		},
		{
			name: "Case insensitive label matching",
			labels: []models.Label{
				{Name: "Bug"},
			},
			filter:   models.PRFilter{Labels: []string{"bug"}},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := createTestPR(func(p *models.PullRequest) {
				p.Labels = tt.labels
			})

			result := service.MatchesPR(pr, tt.filter, "")
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestFilterService_MatchesPR_DateFilters(t *testing.T) {
	service := NewFilterService()
	now := time.Now()
	yesterday := now.AddDate(0, 0, -1)
	tomorrow := now.AddDate(0, 0, 1)
	weekAgo := now.AddDate(0, 0, -7)

	tests := []struct {
		name      string
		createdAt time.Time
		updatedAt time.Time
		filter    models.PRFilter
		expected  bool
	}{
		{
			name:      "Matches CreatedAfter",
			createdAt: yesterday,
			filter:    models.PRFilter{CreatedAfter: &weekAgo},
			expected:  true,
		},
		{
			name:      "Does not match CreatedAfter",
			createdAt: weekAgo,
			filter:    models.PRFilter{CreatedAfter: &yesterday},
			expected:  false,
		},
		{
			name:      "Matches CreatedBefore",
			createdAt: yesterday,
			filter:    models.PRFilter{CreatedBefore: &tomorrow},
			expected:  true,
		},
		{
			name:      "Does not match CreatedBefore",
			createdAt: tomorrow,
			filter:    models.PRFilter{CreatedBefore: &yesterday},
			expected:  false,
		},
		{
			name:      "Matches UpdatedAfter",
			updatedAt: yesterday,
			filter:    models.PRFilter{UpdatedAfter: &weekAgo},
			expected:  true,
		},
		{
			name:      "Matches UpdatedBefore",
			updatedAt: yesterday,
			filter:    models.PRFilter{UpdatedBefore: &tomorrow},
			expected:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := createTestPR(func(p *models.PullRequest) {
				p.CreatedAt = tt.createdAt
				p.UpdatedAt = tt.updatedAt
			})

			result := service.MatchesPR(pr, tt.filter, "")
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestFilterService_MatchesPR_DraftFilter(t *testing.T) {
	service := NewFilterService()

	tests := []struct {
		name     string
		isDraft  bool
		filter   models.PRFilter
		expected bool
	}{
		{
			name:     "Matches draft filter true",
			isDraft:  true,
			filter:   models.PRFilter{IsDraft: boolPtr(true)},
			expected: true,
		},
		{
			name:     "Does not match draft filter true",
			isDraft:  false,
			filter:   models.PRFilter{IsDraft: boolPtr(true)},
			expected: false,
		},
		{
			name:     "Matches draft filter false",
			isDraft:  false,
			filter:   models.PRFilter{IsDraft: boolPtr(false)},
			expected: true,
		},
		{
			name:     "Nil draft filter matches any",
			isDraft:  true,
			filter:   models.PRFilter{},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := createTestPR(func(p *models.PullRequest) {
				p.IsDraft = tt.isDraft
			})

			result := service.MatchesPR(pr, tt.filter, "")
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestFilterService_MatchesPR_ConflictsFilter(t *testing.T) {
	service := NewFilterService()

	tests := []struct {
		name           string
		mergeableState models.MergeableState
		filter         models.PRFilter
		expected       bool
	}{
		{
			name:           "Matches HasConflicts true",
			mergeableState: models.MergeableStateConflicting,
			filter:         models.PRFilter{HasConflicts: boolPtr(true)},
			expected:       true,
		},
		{
			name:           "Does not match HasConflicts true",
			mergeableState: models.MergeableStateMergeable,
			filter:         models.PRFilter{HasConflicts: boolPtr(true)},
			expected:       false,
		},
		{
			name:           "Matches HasConflicts false",
			mergeableState: models.MergeableStateMergeable,
			filter:         models.PRFilter{HasConflicts: boolPtr(false)},
			expected:       true,
		},
		{
			name:           "Nil conflicts filter matches any",
			mergeableState: models.MergeableStateConflicting,
			filter:         models.PRFilter{},
			expected:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := createTestPR(func(p *models.PullRequest) {
				p.MergeableState = tt.mergeableState
			})

			result := service.MatchesPR(pr, tt.filter, "")
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestFilterService_MatchesPR_TitleSearch(t *testing.T) {
	service := NewFilterService()

	tests := []struct {
		name     string
		title    string
		filter   models.PRFilter
		expected bool
	}{
		{
			name:     "Matches title substring",
			title:    "Fix authentication bug",
			filter:   models.PRFilter{TitleContains: "auth"},
			expected: true,
		},
		{
			name:     "Does not match title substring",
			title:    "Fix authentication bug",
			filter:   models.PRFilter{TitleContains: "database"},
			expected: false,
		},
		{
			name:     "Case insensitive title search",
			title:    "Fix Authentication Bug",
			filter:   models.PRFilter{TitleContains: "authentication"},
			expected: true,
		},
		{
			name:     "Empty title search matches any",
			title:    "Any title",
			filter:   models.PRFilter{},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := createTestPR(func(p *models.PullRequest) {
				p.Title = tt.title
			})

			result := service.MatchesPR(pr, tt.filter, "")
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestFilterService_MatchesPR_RepositoryFilter(t *testing.T) {
	service := NewFilterService()

	tests := []struct {
		name     string
		repo     models.Repository
		filter   models.PRFilter
		expected bool
	}{
		{
			name: "Matches repository by owner and name",
			repo: models.Repository{
				Owner: "testorg",
				Name:  "testrepo",
			},
			filter: models.PRFilter{
				Repos: []models.RepoRef{
					{Owner: "testorg", Repo: "testrepo"},
				},
			},
			expected: true,
		},
		{
			name: "Does not match different repository",
			repo: models.Repository{
				Owner: "testorg",
				Name:  "testrepo",
			},
			filter: models.PRFilter{
				Repos: []models.RepoRef{
					{Owner: "otherorg", Repo: "otherrepo"},
				},
			},
			expected: false,
		},
		{
			name: "Case insensitive repository matching",
			repo: models.Repository{
				Owner: "TestOrg",
				Name:  "TestRepo",
			},
			filter: models.PRFilter{
				Repos: []models.RepoRef{
					{Owner: "testorg", Repo: "testrepo"},
				},
			},
			expected: true,
		},
		{
			name: "Matches by FullName",
			repo: models.Repository{
				Owner:    "testorg",
				Name:     "testrepo",
				FullName: "testorg/testrepo",
			},
			filter: models.PRFilter{
				Repos: []models.RepoRef{
					{Owner: "testorg", Repo: "testrepo"},
				},
			},
			expected: true,
		},
		{
			name: "Empty repo filter matches any",
			repo: models.Repository{
				Owner: "anyorg",
				Name:  "anyrepo",
			},
			filter:   models.PRFilter{},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := createTestPR(func(p *models.PullRequest) {
				p.Repository = tt.repo
			})

			result := service.MatchesPR(pr, tt.filter, "")
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestFilterService_ApplyFilter(t *testing.T) {
	service := NewFilterService()

	prs := []models.PullRequest{
		createTestPR(func(p *models.PullRequest) {
			p.Number = 1
			p.State = models.PRStateOpen
			p.Author.Login = "alice"
		}),
		createTestPR(func(p *models.PullRequest) {
			p.Number = 2
			p.State = models.PRStateClosed
			p.Author.Login = "bob"
		}),
		createTestPR(func(p *models.PullRequest) {
			p.Number = 3
			p.State = models.PRStateOpen
			p.Author.Login = "alice"
		}),
		createTestPR(func(p *models.PullRequest) {
			p.Number = 4
			p.State = models.PRStateMerged
			p.Author.Login = "charlie"
		}),
	}

	tests := []struct {
		name     string
		filter   models.PRFilter
		expected []int // PR numbers
	}{
		{
			name:     "Filter open PRs",
			filter:   models.PRFilter{States: []models.PullRequestState{models.PRStateOpen}},
			expected: []int{1, 3},
		},
		{
			name:     "Filter by author",
			filter:   models.PRFilter{Authors: []string{"alice"}},
			expected: []int{1, 3},
		},
		{
			name: "Filter open PRs by alice",
			filter: models.PRFilter{
				States:  []models.PullRequestState{models.PRStateOpen},
				Authors: []string{"alice"},
			},
			expected: []int{1, 3},
		},
		{
			name:     "Filter merged PRs",
			filter:   models.PRFilter{States: []models.PullRequestState{models.PRStateMerged}},
			expected: []int{4},
		},
		{
			name:     "No filter returns all",
			filter:   models.PRFilter{},
			expected: []int{1, 2, 3, 4},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.ApplyFilter(prs, tt.filter, "")

			if len(result) != len(tt.expected) {
				t.Errorf("expected %d results, got %d", len(tt.expected), len(result))
				return
			}

			for i, expectedNum := range tt.expected {
				if result[i].Number != expectedNum {
					t.Errorf("at position %d: expected PR #%d, got PR #%d", i, expectedNum, result[i].Number)
				}
			}
		})
	}
}

func TestFilterService_CountMatching(t *testing.T) {
	service := NewFilterService()

	prs := []models.PullRequest{
		createTestPR(func(p *models.PullRequest) { p.State = models.PRStateOpen }),
		createTestPR(func(p *models.PullRequest) { p.State = models.PRStateOpen }),
		createTestPR(func(p *models.PullRequest) { p.State = models.PRStateClosed }),
	}

	filter := models.PRFilter{States: []models.PullRequestState{models.PRStateOpen}}
	count := service.CountMatching(prs, filter, "")

	if count != 2 {
		t.Errorf("expected count 2, got %d", count)
	}
}

func TestFilterService_PresetFilters(t *testing.T) {
	service := NewFilterService()

	prs := []models.PullRequest{
		createTestPR(func(p *models.PullRequest) {
			p.Number = 1
			p.State = models.PRStateOpen
			p.Author.Login = "alice"
		}),
		createTestPR(func(p *models.PullRequest) {
			p.Number = 2
			p.State = models.PRStateOpen
			p.Reviewers = []models.User{{Login: "alice"}}
		}),
		createTestPR(func(p *models.PullRequest) {
			p.Number = 3
			p.State = models.PRStateOpen
			p.Author.Login = "bob"
		}),
	}

	t.Run("FilterMyPRs", func(t *testing.T) {
		filter := models.FilterMyPRs("alice")
		result := service.ApplyFilter(prs, filter, "alice")

		if len(result) != 1 || result[0].Number != 1 {
			t.Errorf("expected PR #1, got %d results", len(result))
		}
	})

	t.Run("FilterNeedsMyReview", func(t *testing.T) {
		filter := models.FilterNeedsMyReview("alice")
		result := service.ApplyFilter(prs, filter, "alice")

		if len(result) != 1 || result[0].Number != 2 {
			t.Errorf("expected PR #2, got %d results", len(result))
		}
	})

	t.Run("FilterOpen", func(t *testing.T) {
		filter := models.FilterOpen()
		result := service.ApplyFilter(prs, filter, "")

		if len(result) != 3 {
			t.Errorf("expected 3 results, got %d", len(result))
		}
	})
}

func TestFilterService_CombineFilters(t *testing.T) {
	service := NewFilterService()

	filter1 := models.PRFilter{
		States:  []models.PullRequestState{models.PRStateOpen},
		Authors: []string{"alice"},
	}

	filter2 := models.PRFilter{
		States:  []models.PullRequestState{models.PRStateOpen, models.PRStateMerged},
		Authors: []string{"bob"},
	}

	combined := service.CombineFilters(filter1, filter2)

	// States should be intersected (only open remains)
	if len(combined.States) != 1 || combined.States[0] != models.PRStateOpen {
		t.Errorf("expected states to be [open], got %v", combined.States)
	}

	// Authors should be union
	if len(combined.Authors) != 2 {
		t.Errorf("expected 2 authors, got %d", len(combined.Authors))
	}
}

func TestRepoRef_Methods(t *testing.T) {
	ref := models.RepoRef{
		ProviderType: "github",
		Host:         "github.com",
		Owner:        "testorg",
		Repo:         "testrepo",
	}

	t.Run("FullName", func(t *testing.T) {
		expected := "testorg/testrepo"
		if ref.FullName() != expected {
			t.Errorf("expected %s, got %s", expected, ref.FullName())
		}
	})

	t.Run("UniqueKey", func(t *testing.T) {
		expected := "github:github.com:testorg/testrepo"
		if ref.UniqueKey() != expected {
			t.Errorf("expected %s, got %s", expected, ref.UniqueKey())
		}
	})

	t.Run("IsEmpty", func(t *testing.T) {
		emptyRef := models.RepoRef{}
		if !emptyRef.IsEmpty() {
			t.Error("expected empty ref to return true")
		}

		if ref.IsEmpty() {
			t.Error("expected non-empty ref to return false")
		}
	})
}

func TestFilterService_GetMatchingSummaries(t *testing.T) {
	service := NewFilterService()

	prs := []models.PullRequest{
		createTestPR(func(p *models.PullRequest) {
			p.Number = 1
			p.State = models.PRStateOpen
		}),
		createTestPR(func(p *models.PullRequest) {
			p.Number = 2
			p.State = models.PRStateClosed
		}),
		createTestPR(func(p *models.PullRequest) {
			p.Number = 3
			p.State = models.PRStateOpen
		}),
	}

	filter := models.PRFilter{States: []models.PullRequestState{models.PRStateOpen}}
	summaries := service.GetMatchingSummaries(prs, filter, "")

	if len(summaries) != 2 {
		t.Errorf("expected 2 summaries, got %d", len(summaries))
	}

	if summaries[0].Number != 1 {
		t.Errorf("expected first summary to be PR #1, got #%d", summaries[0].Number)
	}

	if summaries[1].Number != 3 {
		t.Errorf("expected second summary to be PR #3, got #%d", summaries[1].Number)
	}
}

func TestFilterService_CombineFilters_ReviewDecisions(t *testing.T) {
	service := NewFilterService()

	filter1 := models.PRFilter{
		ReviewDecision: []models.ReviewDecision{
			models.ReviewDecisionApproved,
			models.ReviewDecisionPending,
		},
	}

	filter2 := models.PRFilter{
		ReviewDecision: []models.ReviewDecision{
			models.ReviewDecisionApproved,
			models.ReviewDecisionChangesRequsted,
		},
	}

	combined := service.CombineFilters(filter1, filter2)

	// Should intersect to only approved
	if len(combined.ReviewDecision) != 1 {
		t.Errorf("expected 1 review decision, got %d", len(combined.ReviewDecision))
	}

	if combined.ReviewDecision[0] != models.ReviewDecisionApproved {
		t.Errorf("expected approved decision, got %v", combined.ReviewDecision[0])
	}
}

func TestFilterService_CombineFilters_Repos(t *testing.T) {
	service := NewFilterService()

	filter1 := models.PRFilter{
		Repos: []models.RepoRef{
			{Owner: "org1", Repo: "repo1"},
			{Owner: "org2", Repo: "repo2"},
		},
	}

	filter2 := models.PRFilter{
		Repos: []models.RepoRef{
			{Owner: "org2", Repo: "repo2"}, // duplicate
			{Owner: "org3", Repo: "repo3"},
		},
	}

	combined := service.CombineFilters(filter1, filter2)

	// Should have 3 unique repos
	if len(combined.Repos) != 3 {
		t.Errorf("expected 3 repos, got %d", len(combined.Repos))
	}
}

func TestFilterService_CombineFilters_DateFilters(t *testing.T) {
	service := NewFilterService()
	now := time.Now()
	yesterday := now.AddDate(0, 0, -1)
	weekAgo := now.AddDate(0, 0, -7)
	tomorrow := now.AddDate(0, 0, 1)
	weekFromNow := now.AddDate(0, 0, 7)

	filter1 := models.PRFilter{
		CreatedAfter:  &weekAgo,
		CreatedBefore: &weekFromNow,
		UpdatedAfter:  &weekAgo,
		UpdatedBefore: &weekFromNow,
	}

	filter2 := models.PRFilter{
		CreatedAfter:  &yesterday, // more restrictive
		CreatedBefore: &tomorrow,  // more restrictive
		UpdatedAfter:  &yesterday, // more restrictive
		UpdatedBefore: &tomorrow,  // more restrictive
	}

	combined := service.CombineFilters(filter1, filter2)

	// Should use more restrictive dates
	if combined.CreatedAfter == nil || !combined.CreatedAfter.Equal(yesterday) {
		t.Error("expected CreatedAfter to be yesterday")
	}

	if combined.CreatedBefore == nil || !combined.CreatedBefore.Equal(tomorrow) {
		t.Error("expected CreatedBefore to be tomorrow")
	}

	if combined.UpdatedAfter == nil || !combined.UpdatedAfter.Equal(yesterday) {
		t.Error("expected UpdatedAfter to be yesterday")
	}

	if combined.UpdatedBefore == nil || !combined.UpdatedBefore.Equal(tomorrow) {
		t.Error("expected UpdatedBefore to be tomorrow")
	}
}

func TestFilterService_CombineFilters_BooleanFilters(t *testing.T) {
	service := NewFilterService()

	filter1 := models.PRFilter{}
	filter2 := models.PRFilter{
		IsDraft:      boolPtr(true),
		HasConflicts: boolPtr(false),
	}

	combined := service.CombineFilters(filter1, filter2)

	if combined.IsDraft == nil || *combined.IsDraft != true {
		t.Error("expected IsDraft to be true")
	}

	if combined.HasConflicts == nil || *combined.HasConflicts != false {
		t.Error("expected HasConflicts to be false")
	}
}

func TestFilterService_CombineFilters_TitleSearch(t *testing.T) {
	service := NewFilterService()

	filter1 := models.PRFilter{
		TitleContains: "bug",
	}

	filter2 := models.PRFilter{
		TitleContains: "fix",
	}

	combined := service.CombineFilters(filter1, filter2)

	// Should concatenate with space
	if combined.TitleContains != "bug fix" {
		t.Errorf("expected 'bug fix', got '%s'", combined.TitleContains)
	}
}

func TestFilterService_CombineFilters_EmptyList(t *testing.T) {
	service := NewFilterService()

	combined := service.CombineFilters()

	// Should return empty filter
	if len(combined.States) != 0 {
		t.Error("expected empty States")
	}
}

func TestFilterService_ApplyFilter_EmptyList(t *testing.T) {
	service := NewFilterService()

	result := service.ApplyFilter([]models.PullRequest{}, models.PRFilter{}, "")

	if len(result) != 0 {
		t.Error("expected empty result")
	}
}

func TestFilterService_ComplexFilter_Combination(t *testing.T) {
	service := NewFilterService()
	now := time.Now()
	weekAgo := now.AddDate(0, 0, -7)

	prs := []models.PullRequest{
		createTestPR(func(p *models.PullRequest) {
			p.Number = 1
			p.State = models.PRStateOpen
			p.Author.Login = "alice"
			p.Title = "Fix authentication bug"
			p.Labels = []models.Label{{Name: "bug"}}
			p.IsDraft = false
			p.CreatedAt = now.AddDate(0, 0, -3)
		}),
		createTestPR(func(p *models.PullRequest) {
			p.Number = 2
			p.State = models.PRStateOpen
			p.Author.Login = "bob"
			p.Title = "Add new feature"
			p.Labels = []models.Label{{Name: "feature"}}
			p.IsDraft = true
			p.CreatedAt = now.AddDate(0, 0, -10)
		}),
		createTestPR(func(p *models.PullRequest) {
			p.Number = 3
			p.State = models.PRStateClosed
			p.Author.Login = "alice"
			p.Title = "Fix another bug"
			p.Labels = []models.Label{{Name: "bug"}}
			p.IsDraft = false
			p.CreatedAt = now.AddDate(0, 0, -2)
		}),
	}

	// Complex filter: open, by alice, with bug label, not draft, created after weekAgo
	filter := models.PRFilter{
		States:        []models.PullRequestState{models.PRStateOpen},
		Authors:       []string{"alice"},
		Labels:        []string{"bug"},
		IsDraft:       boolPtr(false),
		CreatedAfter:  &weekAgo,
		TitleContains: "authentication",
	}

	result := service.ApplyFilter(prs, filter, "")

	if len(result) != 1 {
		t.Errorf("expected 1 result, got %d", len(result))
		return
	}

	if result[0].Number != 1 {
		t.Errorf("expected PR #1, got PR #%d", result[0].Number)
	}
}

// Helper function for creating bool pointers
func boolPtr(b bool) *bool {
	return &b
}
