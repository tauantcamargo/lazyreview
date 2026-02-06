package gui

import (
	"fmt"
	"lazyreview/internal/models"
	"lazyreview/pkg/components"

	"github.com/charmbracelet/bubbles/list"
)

// buildPRListItems converts a slice of PullRequests to list.Items
// This includes all status indicators, labels, and formatting
func buildPRListItems(prs []models.PullRequest, includeRepo bool) []list.Item {
	// Use auto-detect mode for backward compatibility
	indicators := components.GetIndicators(components.UnicodeModeAuto)
	return buildPRListItemsWithIndicators(prs, includeRepo, indicators)
}

// buildPRListItemsWithIndicators converts PRs to list items with custom indicators
func buildPRListItemsWithIndicators(prs []models.PullRequest, includeRepo bool, indicators components.IndicatorSet) []list.Item {
	items := make([]list.Item, len(prs))
	for i, pr := range prs {
		items[i] = prToListItem(pr, includeRepo, indicators)
	}
	return items
}

// prToListItem converts a single PullRequest to a list.Item
// includeRepo determines whether to show the repo name (for multi-repo views)
func prToListItem(pr models.PullRequest, includeRepo bool, indicators components.IndicatorSet) list.Item {
	// Build status indicators
	statusIcons := ""
	if ci := indicators.ChecksStatusIndicator(pr.ChecksStatus); ci != "" {
		statusIcons += ci + " "
	}
	if rv := indicators.ReviewDecisionIndicator(pr.ReviewDecision); rv != "" {
		statusIcons += rv + " "
	}
	if draft := indicators.DraftIndicator(pr.IsDraft); draft != "" {
		statusIcons += draft + " "
	}
	if conflict := indicators.ConflictIndicator(pr.MergeableState); conflict != "" {
		statusIcons += conflict + " "
	}

	// Build title
	title := fmt.Sprintf("#%d %s", pr.Number, pr.Title)

	// Build description
	labels := formatLabels(pr.Labels, 2)
	relTime := formatRelativeTime(pr.UpdatedAt)

	var desc string
	if includeRepo {
		// Multi-repo view: include repo name
		desc = fmt.Sprintf("%s%s/%s • by %s • %s • %s%s",
			statusIcons,
			pr.Repository.Owner,
			pr.Repository.Name,
			pr.Author.Login,
			relTime,
			pr.State,
			labels)
	} else {
		// Single repo view: omit repo name
		desc = fmt.Sprintf("%sby %s • %s • %s%s",
			statusIcons,
			pr.Author.Login,
			relTime,
			pr.State,
			labels)
	}

	return components.NewSimpleItem(fmt.Sprintf("%d", pr.Number), title, desc)
}
