package services

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_analytics.db")

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		t.Fatalf("failed to enable foreign keys: %v", err)
	}

	return db
}

func TestNewAnalyticsService(t *testing.T) {
	t.Run("creates service with default config", func(t *testing.T) {
		db := setupTestDB(t)
		defer db.Close()

		config := DefaultAnalyticsConfig()
		config.AutoCleanup = false // Disable for tests

		service, err := NewAnalyticsService(db, config)
		if err != nil {
			t.Fatalf("failed to create analytics service: %v", err)
		}
		defer service.Close()

		if service.db == nil {
			t.Error("expected db to be set")
		}
		if service.config.RetentionDays != 90 {
			t.Errorf("expected retention days to be 90, got %d", service.config.RetentionDays)
		}
	})

	t.Run("returns error with nil database", func(t *testing.T) {
		config := DefaultAnalyticsConfig()
		_, err := NewAnalyticsService(nil, config)
		if err == nil {
			t.Error("expected error with nil database")
		}
	})

	t.Run("initializes schema", func(t *testing.T) {
		db := setupTestDB(t)
		defer db.Close()

		config := DefaultAnalyticsConfig()
		config.AutoCleanup = false

		service, err := NewAnalyticsService(db, config)
		if err != nil {
			t.Fatalf("failed to create analytics service: %v", err)
		}
		defer service.Close()

		// Verify tables exist
		tables := []string{"analytics_events", "analytics_daily_stats"}
		for _, table := range tables {
			var name string
			err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table).Scan(&name)
			if err != nil {
				t.Errorf("table %s not found: %v", table, err)
			}
		}
	})
}

func TestTrackEvent(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultAnalyticsConfig()
	config.AutoCleanup = false
	service, err := NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer service.Close()

	ctx := context.Background()

	t.Run("tracks valid event", func(t *testing.T) {
		event := ReviewEvent{
			ID:           "event-1",
			Type:         EventReviewStart,
			ProviderType: "github",
			Host:         "github.com",
			Owner:        "golang",
			Repo:         "go",
			PRNumber:     123,
			Timestamp:    time.Now().UTC(),
			Metadata: map[string]interface{}{
				"user": "testuser",
			},
		}

		err := service.TrackEvent(ctx, event)
		if err != nil {
			t.Errorf("failed to track event: %v", err)
		}

		// Verify event was stored
		var count int
		err = db.QueryRow("SELECT COUNT(*) FROM analytics_events WHERE id = ?", event.ID).Scan(&count)
		if err != nil {
			t.Errorf("failed to query event: %v", err)
		}
		if count != 1 {
			t.Errorf("expected 1 event, got %d", count)
		}
	})

	t.Run("returns error with empty ID", func(t *testing.T) {
		event := ReviewEvent{
			Type:      EventReviewStart,
			Timestamp: time.Now().UTC(),
		}

		err := service.TrackEvent(ctx, event)
		if err == nil {
			t.Error("expected error with empty ID")
		}
	})

	t.Run("returns error with empty type", func(t *testing.T) {
		event := ReviewEvent{
			ID:        "event-2",
			Timestamp: time.Now().UTC(),
		}

		err := service.TrackEvent(ctx, event)
		if err == nil {
			t.Error("expected error with empty type")
		}
	})

	t.Run("sets timestamp if not provided", func(t *testing.T) {
		before := time.Now().UTC()

		event := ReviewEvent{
			ID:           "event-3",
			Type:         EventReviewComment,
			ProviderType: "github",
			Host:         "github.com",
			Owner:        "golang",
			Repo:         "go",
			PRNumber:     456,
		}

		err := service.TrackEvent(ctx, event)
		if err != nil {
			t.Errorf("failed to track event: %v", err)
		}

		// Verify timestamp was set
		var timestamp time.Time
		err = db.QueryRow("SELECT timestamp FROM analytics_events WHERE id = ?", event.ID).Scan(&timestamp)
		if err != nil {
			t.Errorf("failed to query timestamp: %v", err)
		}

		after := time.Now().UTC()
		if timestamp.Before(before) || timestamp.After(after) {
			t.Errorf("timestamp %v not in expected range [%v, %v]", timestamp, before, after)
		}
	})
}

func TestGetEventsByPR(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultAnalyticsConfig()
	config.AutoCleanup = false
	service, err := NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer service.Close()

	ctx := context.Background()

	// Insert test events
	events := []ReviewEvent{
		{
			ID:           "event-pr1-1",
			Type:         EventReviewStart,
			ProviderType: "github",
			Host:         "github.com",
			Owner:        "golang",
			Repo:         "go",
			PRNumber:     100,
			Timestamp:    time.Now().UTC().Add(-2 * time.Hour),
		},
		{
			ID:           "event-pr1-2",
			Type:         EventReviewComment,
			ProviderType: "github",
			Host:         "github.com",
			Owner:        "golang",
			Repo:         "go",
			PRNumber:     100,
			Timestamp:    time.Now().UTC().Add(-1 * time.Hour),
		},
		{
			ID:           "event-pr2-1",
			Type:         EventReviewStart,
			ProviderType: "github",
			Host:         "github.com",
			Owner:        "golang",
			Repo:         "go",
			PRNumber:     200,
			Timestamp:    time.Now().UTC(),
		},
	}

	for _, event := range events {
		if err := service.TrackEvent(ctx, event); err != nil {
			t.Fatalf("failed to track event: %v", err)
		}
	}

	t.Run("retrieves events for PR", func(t *testing.T) {
		result, err := service.GetEventsByPR(ctx, "github", "github.com", "golang", "go", 100)
		if err != nil {
			t.Errorf("failed to get events: %v", err)
		}

		if len(result) != 2 {
			t.Errorf("expected 2 events, got %d", len(result))
		}

		// Verify chronological order
		if len(result) == 2 && result[0].Timestamp.After(result[1].Timestamp) {
			t.Error("events not in chronological order")
		}
	})

	t.Run("returns empty for non-existent PR", func(t *testing.T) {
		result, err := service.GetEventsByPR(ctx, "github", "github.com", "golang", "go", 999)
		if err != nil {
			t.Errorf("failed to get events: %v", err)
		}

		if len(result) != 0 {
			t.Errorf("expected 0 events, got %d", len(result))
		}
	})
}

func TestGetEventsByDateRange(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultAnalyticsConfig()
	config.AutoCleanup = false
	service, err := NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer service.Close()

	ctx := context.Background()
	now := time.Now().UTC()

	// Insert events across different time ranges
	events := []ReviewEvent{
		{
			ID:        "event-old",
			Type:      EventReviewStart,
			Timestamp: now.Add(-72 * time.Hour),
		},
		{
			ID:        "event-recent-1",
			Type:      EventReviewComment,
			Timestamp: now.Add(-24 * time.Hour),
		},
		{
			ID:        "event-recent-2",
			Type:      EventReviewApprove,
			Timestamp: now.Add(-12 * time.Hour),
		},
	}

	for _, event := range events {
		if err := service.TrackEvent(ctx, event); err != nil {
			t.Fatalf("failed to track event: %v", err)
		}
	}

	t.Run("retrieves events in date range", func(t *testing.T) {
		start := now.Add(-48 * time.Hour)
		end := now

		result, err := service.GetEventsByDateRange(ctx, start, end)
		if err != nil {
			t.Errorf("failed to get events: %v", err)
		}

		if len(result) != 2 {
			t.Errorf("expected 2 events, got %d", len(result))
		}
	})

	t.Run("returns empty for range with no events", func(t *testing.T) {
		start := now.Add(-100 * time.Hour)
		end := now.Add(-80 * time.Hour)

		result, err := service.GetEventsByDateRange(ctx, start, end)
		if err != nil {
			t.Errorf("failed to get events: %v", err)
		}

		if len(result) != 0 {
			t.Errorf("expected 0 events, got %d", len(result))
		}
	})
}

func TestAggregateDaily(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultAnalyticsConfig()
	config.AutoCleanup = false
	service, err := NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer service.Close()

	ctx := context.Background()
	testDate := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)

	// Insert events for the test date
	events := []ReviewEvent{
		{
			ID:           "agg-1",
			Type:         EventReviewStart,
			ProviderType: "github",
			Host:         "github.com",
			Owner:        "test",
			Repo:         "repo",
			PRNumber:     1,
			Timestamp:    testDate,
		},
		{
			ID:           "agg-2",
			Type:         EventReviewComment,
			ProviderType: "github",
			Host:         "github.com",
			Owner:        "test",
			Repo:         "repo",
			PRNumber:     1,
			Timestamp:    testDate.Add(10 * time.Minute),
		},
		{
			ID:           "agg-3",
			Type:         EventReviewApprove,
			ProviderType: "github",
			Host:         "github.com",
			Owner:        "test",
			Repo:         "repo",
			PRNumber:     1,
			Timestamp:    testDate.Add(30 * time.Minute),
		},
		{
			ID:        "agg-4",
			Type:      EventPRMerge,
			Timestamp: testDate.Add(1 * time.Hour),
		},
	}

	for _, event := range events {
		if err := service.TrackEvent(ctx, event); err != nil {
			t.Fatalf("failed to track event: %v", err)
		}
	}

	t.Run("aggregates daily statistics", func(t *testing.T) {
		err := service.AggregateDaily(ctx, testDate)
		if err != nil {
			t.Errorf("failed to aggregate daily: %v", err)
		}

		stats, err := service.GetDailyStats(ctx, testDate)
		if err != nil {
			t.Errorf("failed to get daily stats: %v", err)
		}

		if stats.ReviewsStarted != 1 {
			t.Errorf("expected 1 review started, got %d", stats.ReviewsStarted)
		}
		if stats.ReviewsCompleted != 1 {
			t.Errorf("expected 1 review completed, got %d", stats.ReviewsCompleted)
		}
		if stats.CommentsAdded != 1 {
			t.Errorf("expected 1 comment added, got %d", stats.CommentsAdded)
		}
		if stats.PRsMerged != 1 {
			t.Errorf("expected 1 PR merged, got %d", stats.PRsMerged)
		}
		if stats.AvgReviewDuration <= 0 || stats.AvgReviewDuration > 60 {
			t.Errorf("expected average duration between 0 and 60 minutes, got %f", stats.AvgReviewDuration)
		}
	})

	t.Run("updates existing daily statistics", func(t *testing.T) {
		// Add another event
		event := ReviewEvent{
			ID:        "agg-5",
			Type:      EventReviewStart,
			Timestamp: testDate.Add(2 * time.Hour),
		}
		if err := service.TrackEvent(ctx, event); err != nil {
			t.Fatalf("failed to track event: %v", err)
		}

		// Re-aggregate
		err := service.AggregateDaily(ctx, testDate)
		if err != nil {
			t.Errorf("failed to aggregate daily: %v", err)
		}

		stats, err := service.GetDailyStats(ctx, testDate)
		if err != nil {
			t.Errorf("failed to get daily stats: %v", err)
		}

		if stats.ReviewsStarted != 2 {
			t.Errorf("expected 2 reviews started after update, got %d", stats.ReviewsStarted)
		}
	})
}

func TestGetDailyStats(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultAnalyticsConfig()
	config.AutoCleanup = false
	service, err := NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer service.Close()

	ctx := context.Background()

	t.Run("returns empty stats for date with no data", func(t *testing.T) {
		date := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		stats, err := service.GetDailyStats(ctx, date)
		if err != nil {
			t.Errorf("failed to get daily stats: %v", err)
		}

		if stats.ReviewsStarted != 0 {
			t.Errorf("expected 0 reviews started, got %d", stats.ReviewsStarted)
		}
	})
}

func TestGetWeeklyStats(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultAnalyticsConfig()
	config.AutoCleanup = false
	service, err := NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer service.Close()

	ctx := context.Background()

	// Create daily stats for a week
	weekStart := time.Date(2024, 1, 8, 0, 0, 0, 0, time.UTC) // Monday
	for i := 0; i < 7; i++ {
		date := weekStart.AddDate(0, 0, i)
		_, err := db.Exec(
			`INSERT INTO analytics_daily_stats (date, reviews_started, reviews_completed, comments_added, prs_merged, avg_review_duration_minutes)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			date.Format("2006-01-02"), i+1, i, i*2, i/2, float64(i*10),
		)
		if err != nil {
			t.Fatalf("failed to insert daily stats: %v", err)
		}
	}

	t.Run("aggregates weekly statistics", func(t *testing.T) {
		stats, err := service.GetWeeklyStats(ctx, weekStart)
		if err != nil {
			t.Errorf("failed to get weekly stats: %v", err)
		}

		if stats.ReviewsStarted <= 0 {
			t.Error("expected reviews started > 0")
		}
		if !stats.WeekStart.Equal(weekStart) {
			t.Errorf("expected week start %v, got %v", weekStart, stats.WeekStart)
		}
	})

	t.Run("normalizes to Monday", func(t *testing.T) {
		// Start from Wednesday
		wednesday := weekStart.AddDate(0, 0, 2)
		stats, err := service.GetWeeklyStats(ctx, wednesday)
		if err != nil {
			t.Errorf("failed to get weekly stats: %v", err)
		}

		if stats.WeekStart.Weekday() != time.Monday {
			t.Errorf("expected week start to be Monday, got %v", stats.WeekStart.Weekday())
		}
	})
}

func TestGetMonthlyStats(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultAnalyticsConfig()
	config.AutoCleanup = false
	service, err := NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer service.Close()

	ctx := context.Background()

	// Create daily stats for a month
	year, month := 2024, time.January
	for day := 1; day <= 31; day++ {
		date := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
		_, err := db.Exec(
			`INSERT INTO analytics_daily_stats (date, reviews_started, reviews_completed, comments_added, prs_merged, avg_review_duration_minutes)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			date.Format("2006-01-02"), day, day-1, day*2, day/2, float64(day*5),
		)
		if err != nil {
			t.Fatalf("failed to insert daily stats: %v", err)
		}
	}

	t.Run("aggregates monthly statistics", func(t *testing.T) {
		stats, err := service.GetMonthlyStats(ctx, year, month)
		if err != nil {
			t.Errorf("failed to get monthly stats: %v", err)
		}

		if stats.ReviewsStarted <= 0 {
			t.Error("expected reviews started > 0")
		}
		if stats.Year != year {
			t.Errorf("expected year %d, got %d", year, stats.Year)
		}
		if stats.Month != month {
			t.Errorf("expected month %v, got %v", month, stats.Month)
		}
	})
}

func TestCleanupOldEvents(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultAnalyticsConfig()
	config.RetentionDays = 30
	config.AutoCleanup = false
	service, err := NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer service.Close()

	ctx := context.Background()
	now := time.Now().UTC()

	// Insert old and recent events
	events := []ReviewEvent{
		{
			ID:        "old-1",
			Type:      EventReviewStart,
			Timestamp: now.AddDate(0, 0, -40), // 40 days old
		},
		{
			ID:        "old-2",
			Type:      EventReviewComment,
			Timestamp: now.AddDate(0, 0, -35), // 35 days old
		},
		{
			ID:        "recent-1",
			Type:      EventReviewApprove,
			Timestamp: now.AddDate(0, 0, -20), // 20 days old
		},
		{
			ID:        "recent-2",
			Type:      EventPRMerge,
			Timestamp: now.AddDate(0, 0, -10), // 10 days old
		},
	}

	for _, event := range events {
		if err := service.TrackEvent(ctx, event); err != nil {
			t.Fatalf("failed to track event: %v", err)
		}
	}

	t.Run("deletes events older than retention period", func(t *testing.T) {
		deleted, err := service.CleanupOldEvents(ctx)
		if err != nil {
			t.Errorf("failed to cleanup old events: %v", err)
		}

		if deleted != 2 {
			t.Errorf("expected 2 deleted events, got %d", deleted)
		}

		// Verify remaining events
		var count int
		err = db.QueryRow("SELECT COUNT(*) FROM analytics_events").Scan(&count)
		if err != nil {
			t.Errorf("failed to query event count: %v", err)
		}
		if count != 2 {
			t.Errorf("expected 2 remaining events, got %d", count)
		}
	})

	t.Run("returns zero when no old events", func(t *testing.T) {
		deleted, err := service.CleanupOldEvents(ctx)
		if err != nil {
			t.Errorf("failed to cleanup old events: %v", err)
		}

		if deleted != 0 {
			t.Errorf("expected 0 deleted events, got %d", deleted)
		}
	})
}

func TestDefaultAnalyticsConfig(t *testing.T) {
	config := DefaultAnalyticsConfig()

	if config.RetentionDays != 90 {
		t.Errorf("expected retention days to be 90, got %d", config.RetentionDays)
	}
	if !config.AutoCleanup {
		t.Error("expected auto cleanup to be enabled")
	}
	if config.CleanupInterval != 24*time.Hour {
		t.Errorf("expected cleanup interval to be 24h, got %v", config.CleanupInterval)
	}
}

func TestClose(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	t.Run("closes service cleanly", func(t *testing.T) {
		config := DefaultAnalyticsConfig()
		config.AutoCleanup = false

		service, err := NewAnalyticsService(db, config)
		if err != nil {
			t.Fatalf("failed to create analytics service: %v", err)
		}

		err = service.Close()
		if err != nil {
			t.Errorf("failed to close service: %v", err)
		}
	})

	t.Run("closes service with auto cleanup", func(t *testing.T) {
		db := setupTestDB(t)
		defer db.Close()

		config := DefaultAnalyticsConfig()
		config.AutoCleanup = true
		config.CleanupInterval = 100 * time.Millisecond

		service, err := NewAnalyticsService(db, config)
		if err != nil {
			t.Fatalf("failed to create analytics service: %v", err)
		}

		// Give cleanup goroutine time to start
		time.Sleep(50 * time.Millisecond)

		err = service.Close()
		if err != nil {
			t.Errorf("failed to close service: %v", err)
		}

		// Give cleanup goroutine time to stop
		time.Sleep(50 * time.Millisecond)
	})
}

// Integration test for complete workflow
func TestAnalyticsWorkflow(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultAnalyticsConfig()
	config.AutoCleanup = false
	service, err := NewAnalyticsService(db, config)
	if err != nil {
		t.Fatalf("failed to create analytics service: %v", err)
	}
	defer service.Close()

	ctx := context.Background()
	testDate := time.Date(2024, 2, 15, 10, 0, 0, 0, time.UTC)

	// Simulate a complete review workflow
	t.Run("complete review workflow", func(t *testing.T) {
		prInfo := struct {
			provider string
			host     string
			owner    string
			repo     string
			number   int
		}{"github", "github.com", "testorg", "testrepo", 42}

		// 1. Start review
		startEvent := ReviewEvent{
			ID:           "workflow-start",
			Type:         EventReviewStart,
			ProviderType: prInfo.provider,
			Host:         prInfo.host,
			Owner:        prInfo.owner,
			Repo:         prInfo.repo,
			PRNumber:     prInfo.number,
			Timestamp:    testDate,
			Metadata: map[string]interface{}{
				"reviewer": "alice",
			},
		}
		if err := service.TrackEvent(ctx, startEvent); err != nil {
			t.Fatalf("failed to track start event: %v", err)
		}

		// 2. Add comments
		commentEvent := ReviewEvent{
			ID:           "workflow-comment",
			Type:         EventReviewComment,
			ProviderType: prInfo.provider,
			Host:         prInfo.host,
			Owner:        prInfo.owner,
			Repo:         prInfo.repo,
			PRNumber:     prInfo.number,
			Timestamp:    testDate.Add(15 * time.Minute),
			Metadata: map[string]interface{}{
				"reviewer": "alice",
				"count":    3,
			},
		}
		if err := service.TrackEvent(ctx, commentEvent); err != nil {
			t.Fatalf("failed to track comment event: %v", err)
		}

		// 3. Approve PR
		approveEvent := ReviewEvent{
			ID:           "workflow-approve",
			Type:         EventReviewApprove,
			ProviderType: prInfo.provider,
			Host:         prInfo.host,
			Owner:        prInfo.owner,
			Repo:         prInfo.repo,
			PRNumber:     prInfo.number,
			Timestamp:    testDate.Add(25 * time.Minute),
			Metadata: map[string]interface{}{
				"reviewer": "alice",
			},
		}
		if err := service.TrackEvent(ctx, approveEvent); err != nil {
			t.Fatalf("failed to track approve event: %v", err)
		}

		// 4. Merge PR
		mergeEvent := ReviewEvent{
			ID:           "workflow-merge",
			Type:         EventPRMerge,
			ProviderType: prInfo.provider,
			Host:         prInfo.host,
			Owner:        prInfo.owner,
			Repo:         prInfo.repo,
			PRNumber:     prInfo.number,
			Timestamp:    testDate.Add(30 * time.Minute),
			Metadata: map[string]interface{}{
				"merged_by": "bob",
			},
		}
		if err := service.TrackEvent(ctx, mergeEvent); err != nil {
			t.Fatalf("failed to track merge event: %v", err)
		}

		// Verify all events for PR
		events, err := service.GetEventsByPR(ctx, prInfo.provider, prInfo.host, prInfo.owner, prInfo.repo, prInfo.number)
		if err != nil {
			t.Fatalf("failed to get PR events: %v", err)
		}
		if len(events) != 4 {
			t.Errorf("expected 4 events for PR, got %d", len(events))
		}

		// Aggregate daily stats
		if err := service.AggregateDaily(ctx, testDate); err != nil {
			t.Fatalf("failed to aggregate daily stats: %v", err)
		}

		// Verify daily stats
		stats, err := service.GetDailyStats(ctx, testDate)
		if err != nil {
			t.Fatalf("failed to get daily stats: %v", err)
		}

		if stats.ReviewsStarted != 1 {
			t.Errorf("expected 1 review started, got %d", stats.ReviewsStarted)
		}
		if stats.ReviewsCompleted != 1 {
			t.Errorf("expected 1 review completed, got %d", stats.ReviewsCompleted)
		}
		if stats.CommentsAdded != 1 {
			t.Errorf("expected 1 comment added, got %d", stats.CommentsAdded)
		}
		if stats.PRsMerged != 1 {
			t.Errorf("expected 1 PR merged, got %d", stats.PRsMerged)
		}
		if stats.AvgReviewDuration < 20 || stats.AvgReviewDuration > 30 {
			t.Errorf("expected avg duration ~25 minutes, got %f", stats.AvgReviewDuration)
		}
	})
}
