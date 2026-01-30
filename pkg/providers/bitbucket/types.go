package bitbucket

import "time"

// Bitbucket API types

// bbUser represents a Bitbucket user
type bbUser struct {
	UUID        string `json:"uuid"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AccountID   string `json:"account_id"`
	Links       struct {
		Avatar struct {
			Href string `json:"href"`
		} `json:"avatar"`
	} `json:"links"`
}

// bbPullRequest represents a Bitbucket pull request
type bbPullRequest struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	State       string `json:"state"` // OPEN, MERGED, DECLINED, SUPERSEDED
	Source      struct {
		Branch struct {
			Name string `json:"name"`
		} `json:"branch"`
	} `json:"source"`
	Destination struct {
		Branch struct {
			Name string `json:"name"`
		} `json:"branch"`
	} `json:"destination"`
	Author    bbUser `json:"author"`
	Reviewers []struct {
		User     bbUser `json:"user"`
		Approved bool   `json:"approved"`
	} `json:"reviewers"`
	Participants []struct {
		User     bbUser `json:"user"`
		Approved bool   `json:"approved"`
		Role     string `json:"role"` // PARTICIPANT, REVIEWER
	} `json:"participants"`
	Links struct {
		HTML struct {
			Href string `json:"href"`
		} `json:"html"`
		Diff struct {
			Href string `json:"href"`
		} `json:"diff"`
	} `json:"links"`
	CreatedOn   time.Time `json:"created_on"`
	UpdatedOn   time.Time `json:"updated_on"`
	MergeCommit *struct{} `json:"merge_commit,omitempty"`
	ClosedBy    *bbUser   `json:"closed_by,omitempty"`
	CloseSource bool      `json:"close_source_branch"`
}

// bbDiffStat represents diff statistics for a file
type bbDiffStat struct {
	Status       string `json:"status"` // added, removed, modified, renamed
	LinesAdded   int    `json:"lines_added"`
	LinesRemoved int    `json:"lines_removed"`
	Old          *struct {
		Path string `json:"path"`
	} `json:"old,omitempty"`
	New *struct {
		Path string `json:"path"`
	} `json:"new,omitempty"`
}

// bbComment represents a comment on a pull request
type bbComment struct {
	ID      int `json:"id"`
	Content struct {
		Raw  string `json:"raw"`
		HTML string `json:"html"`
	} `json:"content"`
	User      bbUser    `json:"user"`
	CreatedOn time.Time `json:"created_on"`
	UpdatedOn time.Time `json:"updated_on"`
	Inline    *struct {
		Path string `json:"path"`
		From *int   `json:"from,omitempty"`
		To   *int   `json:"to,omitempty"`
	} `json:"inline,omitempty"`
	Parent *struct {
		ID int `json:"id"`
	} `json:"parent,omitempty"`
	Deleted bool `json:"deleted"`
}

// bbPaginated is the paginated response wrapper
type bbPaginated[T any] struct {
	Values   []T    `json:"values"`
	Page     int    `json:"page"`
	PageLen  int    `json:"pagelen"`
	Size     int    `json:"size"`
	Next     string `json:"next,omitempty"`
	Previous string `json:"previous,omitempty"`
}

// bbError represents an API error
type bbError struct {
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}
