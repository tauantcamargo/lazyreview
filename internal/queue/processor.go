package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"lazyreview/internal/models"
	"lazyreview/internal/storage"
	"lazyreview/pkg/providers"
)

const (
	defaultRetryDelay = 30 * time.Second
	maxRetryDelay     = 10 * time.Minute
)

type commentPayload struct {
	Body     string `json:"body"`
	FilePath string `json:"file_path,omitempty"`
	Line     int    `json:"line,omitempty"`
	Side     string `json:"side,omitempty"`
	CommitID string `json:"commit_id,omitempty"`
}

type reviewPayload struct {
	Body string `json:"body"`
}

// ProcessQueue attempts to execute queued actions.
func ProcessQueue(ctx context.Context, store storage.Storage, provider providers.Provider, limit int) (int, int, error) {
	actions, err := store.ListPendingActions(limit)
	if err != nil {
		return 0, 0, err
	}
	processed := 0
	failed := 0

	for _, action := range actions {
		if action.ProviderType != string(provider.Type()) || action.Host != provider.Host() {
			continue
		}

		err := executeAction(ctx, provider, action)
		if err == nil {
			_ = store.DeleteQueueAction(action.ID)
			processed++
			continue
		}

		failed++
		action.Attempts++
		action.LastError = err.Error()
		action.NextAttemptAt = nextAttempt(action.Attempts)
		_ = store.UpdateQueueAction(action)
	}

	return processed, failed, nil
}

func executeAction(ctx context.Context, provider providers.Provider, action storage.QueueAction) error {
	switch action.Type {
	case storage.QueueActionComment:
		var payload commentPayload
		if err := json.Unmarshal([]byte(action.Payload), &payload); err != nil {
			return fmt.Errorf("invalid comment payload: %w", err)
		}
		comment := models.CommentInput{Body: payload.Body}
		if payload.FilePath != "" && payload.Line > 0 {
			comment.Path = payload.FilePath
			comment.Line = payload.Line
			if payload.Side != "" {
				comment.Side = models.DiffSide(payload.Side)
			} else {
				comment.Side = models.DiffSideRight
			}
			comment.CommitID = payload.CommitID
		}
		return provider.CreateComment(ctx, action.Owner, action.Repo, action.PRNumber, comment)
	case storage.QueueActionApprove:
		var payload reviewPayload
		_ = json.Unmarshal([]byte(action.Payload), &payload)
		return provider.ApproveReview(ctx, action.Owner, action.Repo, action.PRNumber, payload.Body)
	case storage.QueueActionRequestChanges:
		var payload reviewPayload
		_ = json.Unmarshal([]byte(action.Payload), &payload)
		return provider.RequestChanges(ctx, action.Owner, action.Repo, action.PRNumber, payload.Body)
	case storage.QueueActionReviewComment:
		var payload reviewPayload
		if err := json.Unmarshal([]byte(action.Payload), &payload); err != nil {
			return fmt.Errorf("invalid review payload: %w", err)
		}
		review := models.ReviewInput{Event: models.ReviewEventComment, Body: payload.Body}
		return provider.CreateReview(ctx, action.Owner, action.Repo, action.PRNumber, review)
	default:
		return fmt.Errorf("unknown action type: %s", action.Type)
	}
}

func nextAttempt(attempts int) time.Time {
	delay := defaultRetryDelay * time.Duration(1<<min(attempts, 6))
	if delay > maxRetryDelay {
		delay = maxRetryDelay
	}
	return time.Now().UTC().Add(delay)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
