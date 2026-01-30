package gitlab

import (
	"strconv"
	"time"

	"lazyreview/internal/models"

	gl "gitlab.com/gitlab-org/api/client-go"
)

// mapUser converts a GitLab User to our User model
func mapUser(user *gl.User) *models.User {
	if user == nil {
		return nil
	}
	return &models.User{
		ID:        strconv.FormatInt(user.ID, 10),
		Login:     user.Username,
		Name:      user.Name,
		Email:     user.Email,
		AvatarURL: user.AvatarURL,
	}
}

// mapBasicUser converts a GitLab BasicUser to our User model
func mapBasicUser(user *gl.BasicUser) *models.User {
	if user == nil {
		return nil
	}
	return &models.User{
		ID:        strconv.FormatInt(user.ID, 10),
		Login:     user.Username,
		Name:      user.Name,
		AvatarURL: user.AvatarURL,
	}
}

// mapBasicMergeRequest converts a GitLab BasicMergeRequest to our PullRequest model
func mapBasicMergeRequest(mr *gl.BasicMergeRequest, owner, repo string) *models.PullRequest {
	if mr == nil {
		return nil
	}

	pr := &models.PullRequest{
		ID:           strconv.FormatInt(mr.IID, 10),
		Number:       int(mr.IID),
		Title:        mr.Title,
		Body:         mr.Description,
		State:        mapMRState(mr.State),
		SourceBranch: mr.SourceBranch,
		TargetBranch: mr.TargetBranch,
		IsDraft:      mr.Draft,
		URL:          mr.WebURL,
		Repository: models.Repository{
			ID:       strconv.FormatInt(mr.ProjectID, 10),
			Owner:    owner,
			Name:     repo,
			FullName: owner + "/" + repo,
		},
	}

	// Map author
	if mr.Author != nil {
		pr.Author = *mapBasicUser(mr.Author)
	}

	// Map assignees
	for _, assignee := range mr.Assignees {
		pr.Assignees = append(pr.Assignees, *mapBasicUser(assignee))
	}

	// Map reviewers
	for _, reviewer := range mr.Reviewers {
		pr.Reviewers = append(pr.Reviewers, *mapBasicUser(reviewer))
	}

	// Map labels
	for _, label := range mr.Labels {
		pr.Labels = append(pr.Labels, models.Label{
			Name: label,
		})
	}

	// Map timestamps
	if mr.CreatedAt != nil {
		pr.CreatedAt = *mr.CreatedAt
	}
	if mr.UpdatedAt != nil {
		pr.UpdatedAt = *mr.UpdatedAt
	}
	if mr.MergedAt != nil {
		pr.MergedAt = mr.MergedAt
	}
	if mr.ClosedAt != nil {
		pr.ClosedAt = mr.ClosedAt
	}

	// Map mergeable state
	pr.MergeableState = mapMergeableState(mr.DetailedMergeStatus)

	return pr
}

// mapMergeRequest converts a GitLab MergeRequest to our PullRequest model
func mapMergeRequest(mr *gl.MergeRequest, owner, repo string) *models.PullRequest {
	if mr == nil {
		return nil
	}

	pr := &models.PullRequest{
		ID:           strconv.FormatInt(mr.IID, 10),
		Number:       int(mr.IID),
		Title:        mr.Title,
		Body:         mr.Description,
		State:        mapMRState(mr.State),
		SourceBranch: mr.SourceBranch,
		TargetBranch: mr.TargetBranch,
		IsDraft:      mr.Draft,
		URL:          mr.WebURL,
		Repository: models.Repository{
			ID:       strconv.FormatInt(mr.ProjectID, 10),
			Owner:    owner,
			Name:     repo,
			FullName: owner + "/" + repo,
		},
	}

	// Map author
	if mr.Author != nil {
		pr.Author = *mapBasicUser(mr.Author)
	}

	// Map assignees
	for _, assignee := range mr.Assignees {
		pr.Assignees = append(pr.Assignees, *mapBasicUser(assignee))
	}

	// Map reviewers
	for _, reviewer := range mr.Reviewers {
		pr.Reviewers = append(pr.Reviewers, *mapBasicUser(reviewer))
	}

	// Map labels
	for _, label := range mr.Labels {
		pr.Labels = append(pr.Labels, models.Label{
			Name: label,
		})
	}

	// Map timestamps
	if mr.CreatedAt != nil {
		pr.CreatedAt = *mr.CreatedAt
	}
	if mr.UpdatedAt != nil {
		pr.UpdatedAt = *mr.UpdatedAt
	}
	if mr.MergedAt != nil {
		pr.MergedAt = mr.MergedAt
	}
	if mr.ClosedAt != nil {
		pr.ClosedAt = mr.ClosedAt
	}

	// Map mergeable state from DetailedMergeStatus
	pr.MergeableState = mapMergeableState(mr.DetailedMergeStatus)

	return pr
}

// mapMRState converts GitLab MR state to our PullRequestState
func mapMRState(state string) models.PullRequestState {
	switch state {
	case "opened":
		return models.PRStateOpen
	case "closed":
		return models.PRStateClosed
	case "merged":
		return models.PRStateMerged
	default:
		return models.PRStateOpen
	}
}

// mapMergeableState converts GitLab merge status to our MergeableState
func mapMergeableState(status string) models.MergeableState {
	switch status {
	case "mergeable", "can_be_merged":
		return models.MergeableStateMergeable
	case "broken_status", "cannot_be_merged", "cannot_be_merged_recheck":
		return models.MergeableStateConflicting
	case "checking", "unchecked":
		return models.MergeableStateUnknown
	case "blocked_status", "ci_must_pass", "discussions_not_resolved", "need_rebase":
		return models.MergeableStateBlocked
	default:
		return models.MergeableStateUnknown
	}
}

// mapMergeRequestDiff converts GitLab diff to our Diff model
func mapMergeRequestDiff(diffs []*gl.MergeRequestDiff) *models.Diff {
	if diffs == nil || len(diffs) == 0 {
		return nil
	}

	diff := &models.Diff{
		Files: make([]models.FileDiff, 0),
	}

	// GitLab MergeRequestDiff contains version info, not actual diffs
	// The actual file diffs need to be fetched via GetMergeRequestChanges
	return diff
}

// mapDiffChange converts a GitLab DiffChange to our FileDiff model
func mapDiffChange(change *gl.Diff) models.FileDiff {
	fileDiff := models.FileDiff{
		Path:    change.NewPath,
		OldPath: change.OldPath,
		Patch:   change.Diff,
	}

	// Determine file status
	if change.NewFile {
		fileDiff.Status = models.FileStatusAdded
	} else if change.DeletedFile {
		fileDiff.Status = models.FileStatusDeleted
	} else if change.RenamedFile {
		fileDiff.Status = models.FileStatusRenamed
	} else {
		fileDiff.Status = models.FileStatusModified
	}

	return fileDiff
}

// mapNote converts a GitLab Note to our Comment model
func mapNote(note *gl.Note) *models.Comment {
	if note == nil {
		return nil
	}

	comment := &models.Comment{
		ID:        strconv.FormatInt(note.ID, 10),
		Body:      note.Body,
		CreatedAt: *note.CreatedAt,
		UpdatedAt: *note.UpdatedAt,
	}

	if note.Author.ID != 0 {
		comment.Author = models.User{
			ID:        strconv.FormatInt(note.Author.ID, 10),
			Login:     note.Author.Username,
			Name:      note.Author.Name,
			AvatarURL: note.Author.AvatarURL,
		}
	}

	// Map position for diff comments
	if note.Position != nil {
		comment.Path = note.Position.NewPath
		if note.Position.NewLine != 0 {
			comment.Line = int(note.Position.NewLine)
		}
	}

	return comment
}

// mapFileChange converts GitLab diff to our FileChange model
func mapFileChange(diff *gl.Diff) models.FileChange {
	fc := models.FileChange{
		Filename:         diff.NewPath,
		PreviousFilename: diff.OldPath,
		Patch:            diff.Diff,
	}

	// Determine status
	if diff.NewFile {
		fc.Status = models.FileStatusAdded
	} else if diff.DeletedFile {
		fc.Status = models.FileStatusDeleted
	} else if diff.RenamedFile {
		fc.Status = models.FileStatusRenamed
	} else {
		fc.Status = models.FileStatusModified
	}

	return fc
}

// mapReviewState converts a GitLab approval status to our ReviewState
func mapReviewState(approved bool) models.ReviewState {
	if approved {
		return models.ReviewStateApproved
	}
	return models.ReviewStatePending
}

// parseTime parses a GitLab time string
func parseTime(t *time.Time) time.Time {
	if t == nil {
		return time.Time{}
	}
	return *t
}
