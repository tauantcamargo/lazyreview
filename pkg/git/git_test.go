package git

import (
	"testing"
)

func TestGitContext_GetPrimaryRemote(t *testing.T) {
	tests := []struct {
		name    string
		remotes []Remote
		want    string // remote name we expect to get
	}{
		{
			name: "Prefers origin",
			remotes: []Remote{
				{Name: "upstream", Owner: "org", Repo: "repo", Provider: "github", Host: "github.com"},
				{Name: "origin", Owner: "user", Repo: "repo", Provider: "github", Host: "github.com"},
			},
			want: "origin",
		},
		{
			name: "Falls back to upstream",
			remotes: []Remote{
				{Name: "upstream", Owner: "org", Repo: "repo", Provider: "github", Host: "github.com"},
				{Name: "other", Owner: "user", Repo: "repo", Provider: "github", Host: "github.com"},
			},
			want: "upstream",
		},
		{
			name: "Returns first if no origin or upstream",
			remotes: []Remote{
				{Name: "fork", Owner: "user", Repo: "repo", Provider: "github", Host: "github.com"},
				{Name: "other", Owner: "org", Repo: "repo", Provider: "github", Host: "github.com"},
			},
			want: "fork",
		},
		{
			name:    "Returns nil for empty remotes",
			remotes: []Remote{},
			want:    "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := &GitContext{
				IsGitRepo: true,
				Remotes:   tt.remotes,
			}

			got := ctx.GetPrimaryRemote()

			if tt.want == "" {
				if got != nil {
					t.Errorf("GetPrimaryRemote() = %v, want nil", got)
				}
				return
			}

			if got == nil {
				t.Errorf("GetPrimaryRemote() = nil, want %s", tt.want)
				return
			}

			if got.Name != tt.want {
				t.Errorf("GetPrimaryRemote() = %s, want %s", got.Name, tt.want)
			}
		})
	}
}

func TestGitContext_GetRemoteByProvider(t *testing.T) {
	ctx := &GitContext{
		IsGitRepo: true,
		Remotes: []Remote{
			{Name: "origin", Owner: "user", Repo: "repo", Provider: "github", Host: "github.com"},
			{Name: "gitlab", Owner: "org", Repo: "repo", Provider: "gitlab", Host: "gitlab.com"},
		},
	}

	tests := []struct {
		name     string
		provider string
		want     string // remote name
	}{
		{
			name:     "Find GitHub remote",
			provider: "github",
			want:     "origin",
		},
		{
			name:     "Find GitLab remote",
			provider: "gitlab",
			want:     "gitlab",
		},
		{
			name:     "Provider not found",
			provider: "bitbucket",
			want:     "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ctx.GetRemoteByProvider(tt.provider)

			if tt.want == "" {
				if got != nil {
					t.Errorf("GetRemoteByProvider() = %v, want nil", got)
				}
				return
			}

			if got == nil {
				t.Errorf("GetRemoteByProvider() = nil, want %s", tt.want)
				return
			}

			if got.Name != tt.want {
				t.Errorf("GetRemoteByProvider() = %s, want %s", got.Name, tt.want)
			}
		})
	}
}

func TestParseRemotes(t *testing.T) {
	output := `origin	git@github.com:user/repo.git (fetch)
origin	git@github.com:user/repo.git (push)
upstream	https://github.com/org/repo.git (fetch)
upstream	https://github.com/org/repo.git (push)`

	remotes, err := parseRemotes(output)
	if err != nil {
		t.Fatalf("parseRemotes() error = %v", err)
	}

	if len(remotes) != 2 {
		t.Errorf("parseRemotes() returned %d remotes, want 2", len(remotes))
	}

	// Check origin
	var originFound bool
	for _, r := range remotes {
		if r.Name == "origin" {
			originFound = true
			if r.Owner != "user" {
				t.Errorf("origin Owner = %s, want user", r.Owner)
			}
			if r.Repo != "repo" {
				t.Errorf("origin Repo = %s, want repo", r.Repo)
			}
			if r.Provider != "github" {
				t.Errorf("origin Provider = %s, want github", r.Provider)
			}
		}
	}

	if !originFound {
		t.Error("origin remote not found")
	}
}

func TestRemoteString(t *testing.T) {
	tests := []struct {
		name   string
		remote Remote
		want   string
	}{
		{
			name: "Remote with name",
			remote: Remote{
				Name:     "origin",
				Owner:    "user",
				Repo:     "repo",
				Provider: "github",
			},
			want: "origin (user/repo on github)",
		},
		{
			name: "Remote without name",
			remote: Remote{
				Owner:    "user",
				Repo:     "repo",
				Provider: "github",
			},
			want: "user/repo on github",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.remote.String()
			if got != tt.want {
				t.Errorf("Remote.String() = %q, want %q", got, tt.want)
			}
		})
	}
}
