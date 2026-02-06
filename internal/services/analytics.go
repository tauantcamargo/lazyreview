// Package services provides business logic for LazyReview.
package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// EventType represents the type of review event tracked.
type EventType string

const (
	// EventReviewStart tracks when a user starts reviewing a PR.
	EventReviewStart EventType = "review_start"
	// EventReviewComment tracks when a user adds a review comment.
	EventReviewComment EventType = "review_comment"
	// EventReviewApprove tracks when a user approves a PR.
	EventReviewApprove EventType = "review_approve"
	// EventReviewRequestChanges tracks when a user requests changes.
	EventReviewRequestChanges EventType = "review_request_changes"
	// EventPRMerge tracks when a PR is merged.
	EventPRMerge EventType = "pr_merge"
)

// ReviewEvent represents a single tracked event in the analytics system.
type ReviewEvent struct {
	ID           string
	Type         EventType
	ProviderType string
	Host         string
	Owner        string
	Repo         string
	PRNumber     int
	Timestamp    time.Time
	Metadata     map[string]interface{}
}

// DailyStats represents aggregated statistics for a single day.
type DailyStats struct {
	Date              time.Time
	ReviewsStarted    int
	ReviewsCompleted  int
	CommentsAdded     int
	PRsMerged         int
	AvgReviewDuration float64 // in minutes
}

// WeeklyStats represents aggregated statistics for a week.
type WeeklyStats struct {
	WeekStart         time.Time
	WeekEnd           time.Time
	ReviewsStarted    int
	ReviewsCompleted  int
	CommentsAdded     int
	PRsMerged         int
	AvgReviewDuration float64 // in minutes
}

// MonthlyStats represents aggregated statistics for a month.
type MonthlyStats struct {
	Year              int
	Month             time.Month
	ReviewsStarted    int
	ReviewsCompleted  int
	CommentsAdded     int
	PRsMerged         int
	AvgReviewDuration float64 // in minutes
}

// AnalyticsConfig holds configuration for the analytics service.
type AnalyticsConfig struct {
	// RetentionDays is the number of days to retain event data (default: 90).
	RetentionDays int
	// AutoCleanup enables automatic cleanup of old events.
	AutoCleanup bool
	// CleanupInterval is the interval for automatic cleanup (default: 24h).
	CleanupInterval time.Duration
}

// DefaultAnalyticsConfig returns default configuration.
func DefaultAnalyticsConfig() AnalyticsConfig {
	return AnalyticsConfig{
		RetentionDays:   90,
		AutoCleanup:     true,
		CleanupInterval: 24 * time.Hour,
	}
}

// AnalyticsService manages review analytics tracking and aggregation.
type AnalyticsService struct {
	db     *sql.DB
	config AnalyticsConfig
	stopCh chan struct{}
}

// NewAnalyticsService creates a new analytics service.
// It initializes the database schema and optionally starts automatic cleanup.
func NewAnalyticsService(db *sql.DB, config AnalyticsConfig) (*AnalyticsService, error) {
	if db == nil {
		return nil, errors.New("database connection is required")
	}

	service := &AnalyticsService{
		db:     db,
		config: config,
		stopCh: make(chan struct{}),
	}

	if err := service.initSchema(); err != nil {
		return nil, fmt.Errorf("failed to initialize analytics schema: %w", err)
	}

	if config.AutoCleanup {
		go service.runAutoCleanup()
	}

	return service, nil
}

// initSchema creates the analytics tables if they don't exist.
func (s *AnalyticsService) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS analytics_events (
		id TEXT PRIMARY KEY,
		type TEXT NOT NULL,
		provider_type TEXT NOT NULL,
		host TEXT NOT NULL,
		owner TEXT NOT NULL,
		repo TEXT NOT NULL,
		pr_number INTEGER NOT NULL,
		timestamp DATETIME NOT NULL,
		metadata TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
	CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(type);
	CREATE INDEX IF NOT EXISTS idx_analytics_events_pr ON analytics_events(provider_type, host, owner, repo, pr_number);

	CREATE TABLE IF NOT EXISTS analytics_daily_stats (
		date DATE PRIMARY KEY,
		reviews_started INTEGER DEFAULT 0,
		reviews_completed INTEGER DEFAULT 0,
		comments_added INTEGER DEFAULT 0,
		prs_merged INTEGER DEFAULT 0,
		avg_review_duration_minutes REAL DEFAULT 0,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_analytics_daily_stats_date ON analytics_daily_stats(date DESC);
	`

	if _, err := s.db.Exec(schema); err != nil {
		return fmt.Errorf("failed to create analytics schema: %w", err)
	}

	return nil
}

// TrackEvent records a review event.
func (s *AnalyticsService) TrackEvent(ctx context.Context, event ReviewEvent) error {
	if event.ID == "" {
		return errors.New("event ID is required")
	}
	if event.Type == "" {
		return errors.New("event type is required")
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now().UTC()
	}

	metadataJSON, err := json.Marshal(event.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal event metadata: %w", err)
	}

	query := `
		INSERT INTO analytics_events
		(id, type, provider_type, host, owner, repo, pr_number, timestamp, metadata, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err = s.db.ExecContext(
		ctx,
		query,
		event.ID,
		string(event.Type),
		event.ProviderType,
		event.Host,
		event.Owner,
		event.Repo,
		event.PRNumber,
		event.Timestamp,
		string(metadataJSON),
		time.Now().UTC(),
	)
	if err != nil {
		return fmt.Errorf("failed to insert event: %w", err)
	}

	return nil
}

// GetEventsByPR retrieves all events for a specific PR.
func (s *AnalyticsService) GetEventsByPR(ctx context.Context, providerType, host, owner, repo string, prNumber int) ([]ReviewEvent, error) {
	query := `
		SELECT id, type, provider_type, host, owner, repo, pr_number, timestamp, metadata
		FROM analytics_events
		WHERE provider_type = ? AND host = ? AND owner = ? AND repo = ? AND pr_number = ?
		ORDER BY timestamp ASC
	`

	rows, err := s.db.QueryContext(ctx, query, providerType, host, owner, repo, prNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	return s.scanEvents(rows)
}

// GetEventsByDateRange retrieves events within a date range.
func (s *AnalyticsService) GetEventsByDateRange(ctx context.Context, start, end time.Time) ([]ReviewEvent, error) {
	query := `
		SELECT id, type, provider_type, host, owner, repo, pr_number, timestamp, metadata
		FROM analytics_events
		WHERE timestamp BETWEEN ? AND ?
		ORDER BY timestamp DESC
	`

	rows, err := s.db.QueryContext(ctx, query, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	return s.scanEvents(rows)
}

// scanEvents is a helper to scan multiple events from rows.
func (s *AnalyticsService) scanEvents(rows *sql.Rows) ([]ReviewEvent, error) {
	events := []ReviewEvent{}
	for rows.Next() {
		var event ReviewEvent
		var metadataJSON string
		var eventType string

		err := rows.Scan(
			&event.ID,
			&eventType,
			&event.ProviderType,
			&event.Host,
			&event.Owner,
			&event.Repo,
			&event.PRNumber,
			&event.Timestamp,
			&metadataJSON,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan event: %w", err)
		}

		event.Type = EventType(eventType)

		if metadataJSON != "" {
			if err := json.Unmarshal([]byte(metadataJSON), &event.Metadata); err != nil {
				return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
			}
		}

		events = append(events, event)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating events: %w", err)
	}

	return events, nil
}

// GetDailyStats retrieves daily statistics for a specific date.
func (s *AnalyticsService) GetDailyStats(ctx context.Context, date time.Time) (*DailyStats, error) {
	dateStr := date.Format("2006-01-02")

	query := `
		SELECT date, reviews_started, reviews_completed, comments_added, prs_merged, avg_review_duration_minutes
		FROM analytics_daily_stats
		WHERE date = ?
	`

	var stats DailyStats
	var dateStr2 string

	err := s.db.QueryRowContext(ctx, query, dateStr).Scan(
		&dateStr2,
		&stats.ReviewsStarted,
		&stats.ReviewsCompleted,
		&stats.CommentsAdded,
		&stats.PRsMerged,
		&stats.AvgReviewDuration,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Return empty stats for date with no data
			stats.Date = date
			return &stats, nil
		}
		return nil, fmt.Errorf("failed to query daily stats: %w", err)
	}

	stats.Date, _ = time.Parse("2006-01-02", dateStr2)
	return &stats, nil
}

// AggregateDaily aggregates events into daily statistics.
func (s *AnalyticsService) AggregateDaily(ctx context.Context, date time.Time) error {
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	endOfDay := startOfDay.Add(24 * time.Hour)

	// Count events by type
	query := `
		SELECT
			COUNT(CASE WHEN type = ? THEN 1 END) as reviews_started,
			COUNT(CASE WHEN type IN (?, ?) THEN 1 END) as reviews_completed,
			COUNT(CASE WHEN type = ? THEN 1 END) as comments_added,
			COUNT(CASE WHEN type = ? THEN 1 END) as prs_merged
		FROM analytics_events
		WHERE timestamp >= ? AND timestamp < ?
	`

	var reviewsStarted, reviewsCompleted, commentsAdded, prsMerged int
	err := s.db.QueryRowContext(
		ctx,
		query,
		EventReviewStart,
		EventReviewApprove,
		EventReviewRequestChanges,
		EventReviewComment,
		EventPRMerge,
		startOfDay,
		endOfDay,
	).Scan(&reviewsStarted, &reviewsCompleted, &commentsAdded, &prsMerged)
	if err != nil {
		return fmt.Errorf("failed to aggregate event counts: %w", err)
	}

	// Calculate average review duration
	avgDuration, err := s.calculateAvgReviewDuration(ctx, startOfDay, endOfDay)
	if err != nil {
		return fmt.Errorf("failed to calculate average review duration: %w", err)
	}

	// Insert or update daily stats
	upsertQuery := `
		INSERT INTO analytics_daily_stats
		(date, reviews_started, reviews_completed, comments_added, prs_merged, avg_review_duration_minutes, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(date) DO UPDATE SET
			reviews_started = excluded.reviews_started,
			reviews_completed = excluded.reviews_completed,
			comments_added = excluded.comments_added,
			prs_merged = excluded.prs_merged,
			avg_review_duration_minutes = excluded.avg_review_duration_minutes,
			updated_at = excluded.updated_at
	`

	dateStr := startOfDay.Format("2006-01-02")
	_, err = s.db.ExecContext(
		ctx,
		upsertQuery,
		dateStr,
		reviewsStarted,
		reviewsCompleted,
		commentsAdded,
		prsMerged,
		avgDuration,
		time.Now().UTC(),
	)
	if err != nil {
		return fmt.Errorf("failed to upsert daily stats: %w", err)
	}

	return nil
}

// calculateAvgReviewDuration calculates the average time from review start to completion.
func (s *AnalyticsService) calculateAvgReviewDuration(ctx context.Context, start, end time.Time) (float64, error) {
	// Find all review_start events in the time range
	query := `
		SELECT provider_type, host, owner, repo, pr_number, timestamp
		FROM analytics_events
		WHERE type = ? AND timestamp >= ? AND timestamp < ?
		ORDER BY timestamp ASC
	`

	rows, err := s.db.QueryContext(ctx, query, EventReviewStart, start, end)
	if err != nil {
		return 0, fmt.Errorf("failed to query review start events: %w", err)
	}
	defer rows.Close()

	var totalDuration float64
	var count int

	for rows.Next() {
		var providerType, host, owner, repo string
		var prNumber int
		var startTime time.Time

		if err := rows.Scan(&providerType, &host, &owner, &repo, &prNumber, &startTime); err != nil {
			return 0, fmt.Errorf("failed to scan review start event: %w", err)
		}

		// Find the completion event (approve or request changes)
		completionQuery := `
			SELECT timestamp
			FROM analytics_events
			WHERE provider_type = ? AND host = ? AND owner = ? AND repo = ? AND pr_number = ?
				AND type IN (?, ?)
				AND timestamp > ?
			ORDER BY timestamp ASC
			LIMIT 1
		`

		var completionTime time.Time
		err := s.db.QueryRowContext(
			ctx,
			completionQuery,
			providerType, host, owner, repo, prNumber,
			EventReviewApprove, EventReviewRequestChanges,
			startTime,
		).Scan(&completionTime)

		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return 0, fmt.Errorf("failed to query completion event: %w", err)
		}

		if !completionTime.IsZero() {
			duration := completionTime.Sub(startTime).Minutes()
			totalDuration += duration
			count++
		}
	}

	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("error iterating review start events: %w", err)
	}

	if count == 0 {
		return 0, nil
	}

	return totalDuration / float64(count), nil
}

// GetWeeklyStats aggregates statistics for a week.
func (s *AnalyticsService) GetWeeklyStats(ctx context.Context, weekStart time.Time) (*WeeklyStats, error) {
	// Normalize to start of week (Monday)
	weekStart = time.Date(weekStart.Year(), weekStart.Month(), weekStart.Day(), 0, 0, 0, 0, time.UTC)
	for weekStart.Weekday() != time.Monday {
		weekStart = weekStart.AddDate(0, 0, -1)
	}
	weekEnd := weekStart.AddDate(0, 0, 7)

	query := `
		SELECT
			COALESCE(SUM(reviews_started), 0),
			COALESCE(SUM(reviews_completed), 0),
			COALESCE(SUM(comments_added), 0),
			COALESCE(SUM(prs_merged), 0),
			COALESCE(AVG(avg_review_duration_minutes), 0)
		FROM analytics_daily_stats
		WHERE date >= ? AND date < ?
	`

	stats := &WeeklyStats{
		WeekStart: weekStart,
		WeekEnd:   weekEnd,
	}

	err := s.db.QueryRowContext(ctx, query, weekStart.Format("2006-01-02"), weekEnd.Format("2006-01-02")).Scan(
		&stats.ReviewsStarted,
		&stats.ReviewsCompleted,
		&stats.CommentsAdded,
		&stats.PRsMerged,
		&stats.AvgReviewDuration,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query weekly stats: %w", err)
	}

	return stats, nil
}

// GetMonthlyStats aggregates statistics for a month.
func (s *AnalyticsService) GetMonthlyStats(ctx context.Context, year int, month time.Month) (*MonthlyStats, error) {
	monthStart := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
	monthEnd := monthStart.AddDate(0, 1, 0)

	query := `
		SELECT
			COALESCE(SUM(reviews_started), 0),
			COALESCE(SUM(reviews_completed), 0),
			COALESCE(SUM(comments_added), 0),
			COALESCE(SUM(prs_merged), 0),
			COALESCE(AVG(avg_review_duration_minutes), 0)
		FROM analytics_daily_stats
		WHERE date >= ? AND date < ?
	`

	stats := &MonthlyStats{
		Year:  year,
		Month: month,
	}

	err := s.db.QueryRowContext(ctx, query, monthStart.Format("2006-01-02"), monthEnd.Format("2006-01-02")).Scan(
		&stats.ReviewsStarted,
		&stats.ReviewsCompleted,
		&stats.CommentsAdded,
		&stats.PRsMerged,
		&stats.AvgReviewDuration,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query monthly stats: %w", err)
	}

	return stats, nil
}

// CleanupOldEvents removes events older than the configured retention period.
func (s *AnalyticsService) CleanupOldEvents(ctx context.Context) (int64, error) {
	cutoff := time.Now().UTC().AddDate(0, 0, -s.config.RetentionDays)

	result, err := s.db.ExecContext(
		ctx,
		"DELETE FROM analytics_events WHERE timestamp < ?",
		cutoff,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to delete old events: %w", err)
	}

	deleted, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	return deleted, nil
}

// runAutoCleanup periodically cleans up old events.
func (s *AnalyticsService) runAutoCleanup() {
	ticker := time.NewTicker(s.config.CleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			_, _ = s.CleanupOldEvents(ctx)
			cancel()
		case <-s.stopCh:
			return
		}
	}
}

// Close stops the analytics service and cleanup goroutine.
func (s *AnalyticsService) Close() error {
	if s.config.AutoCleanup {
		close(s.stopCh)
	}
	return nil
}
