package git

import (
	"testing"
)

func TestParseRemoteURL(t *testing.T) {
	tests := []struct {
		name        string
		url         string
		wantHost    string
		wantOwner   string
		wantRepo    string
		wantProvider string
		wantErr     bool
	}{
		{
			name:        "GitHub SSH",
			url:         "git@github.com:owner/repo.git",
			wantHost:    "github.com",
			wantOwner:   "owner",
			wantRepo:    "repo",
			wantProvider: "github",
			wantErr:     false,
		},
		{
			name:        "GitHub HTTPS",
			url:         "https://github.com/owner/repo.git",
			wantHost:    "github.com",
			wantOwner:   "owner",
			wantRepo:    "repo",
			wantProvider: "github",
			wantErr:     false,
		},
		{
			name:        "GitHub HTTPS without .git",
			url:         "https://github.com/owner/repo",
			wantHost:    "github.com",
			wantOwner:   "owner",
			wantRepo:    "repo",
			wantProvider: "github",
			wantErr:     false,
		},
		{
			name:        "GitLab SSH",
			url:         "git@gitlab.com:owner/repo.git",
			wantHost:    "gitlab.com",
			wantOwner:   "owner",
			wantRepo:    "repo",
			wantProvider: "gitlab",
			wantErr:     false,
		},
		{
			name:        "GitLab HTTPS with subgroup",
			url:         "https://gitlab.com/group/subgroup/repo.git",
			wantHost:    "gitlab.com",
			wantOwner:   "group/subgroup",
			wantRepo:    "repo",
			wantProvider: "gitlab",
			wantErr:     false,
		},
		{
			name:        "Bitbucket SSH",
			url:         "git@bitbucket.org:workspace/repo.git",
			wantHost:    "bitbucket.org",
			wantOwner:   "workspace",
			wantRepo:    "repo",
			wantProvider: "bitbucket",
			wantErr:     false,
		},
		{
			name:        "Bitbucket HTTPS",
			url:         "https://bitbucket.org/workspace/repo.git",
			wantHost:    "bitbucket.org",
			wantOwner:   "workspace",
			wantRepo:    "repo",
			wantProvider: "bitbucket",
			wantErr:     false,
		},
		{
			name:        "Azure DevOps HTTPS",
			url:         "https://dev.azure.com/organization/project/_git/repo",
			wantHost:    "dev.azure.com",
			wantOwner:   "organization/project",
			wantRepo:    "repo",
			wantProvider: "azuredevops",
			wantErr:     false,
		},
		{
			name:        "Azure DevOps SSH",
			url:         "git@ssh.dev.azure.com:v3/organization/project/repo",
			wantHost:    "dev.azure.com",
			wantOwner:   "organization/project",
			wantRepo:    "repo",
			wantProvider: "azuredevops",
			wantErr:     false,
		},
		{
			name:        "Self-hosted GitLab",
			url:         "https://git.company.com/team/repo.git",
			wantHost:    "git.company.com",
			wantOwner:   "team",
			wantRepo:    "repo",
			wantProvider: "gitlab",
			wantErr:     false,
		},
		{
			name:    "Empty URL",
			url:     "",
			wantErr: true,
		},
		{
			name:    "Invalid URL",
			url:     "not-a-valid-url",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			remote, err := ParseRemoteURL(tt.url)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ParseRemoteURL() expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("ParseRemoteURL() unexpected error: %v", err)
				return
			}

			if remote.Host != tt.wantHost {
				t.Errorf("ParseRemoteURL() Host = %v, want %v", remote.Host, tt.wantHost)
			}

			if remote.Owner != tt.wantOwner {
				t.Errorf("ParseRemoteURL() Owner = %v, want %v", remote.Owner, tt.wantOwner)
			}

			if remote.Repo != tt.wantRepo {
				t.Errorf("ParseRemoteURL() Repo = %v, want %v", remote.Repo, tt.wantRepo)
			}

			if remote.Provider != tt.wantProvider {
				t.Errorf("ParseRemoteURL() Provider = %v, want %v", remote.Provider, tt.wantProvider)
			}
		})
	}
}

func TestDetectProvider(t *testing.T) {
	tests := []struct {
		name     string
		host     string
		wantProvider string
	}{
		{
			name:     "GitHub",
			host:     "github.com",
			wantProvider: "github",
		},
		{
			name:     "GitHub Enterprise",
			host:     "github.company.com",
			wantProvider: "github",
		},
		{
			name:     "GitLab",
			host:     "gitlab.com",
			wantProvider: "gitlab",
		},
		{
			name:     "GitLab self-hosted",
			host:     "git.company.com",
			wantProvider: "gitlab",
		},
		{
			name:     "Bitbucket",
			host:     "bitbucket.org",
			wantProvider: "bitbucket",
		},
		{
			name:     "Azure DevOps",
			host:     "dev.azure.com",
			wantProvider: "azuredevops",
		},
		{
			name:     "Unknown",
			host:     "unknown.host.com",
			wantProvider: "unknown",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DetectProvider(tt.host)
			if got != tt.wantProvider {
				t.Errorf("DetectProvider() = %v, want %v", got, tt.wantProvider)
			}
		})
	}
}

func TestRemoteIsValid(t *testing.T) {
	tests := []struct {
		name   string
		remote Remote
		want   bool
	}{
		{
			name: "Valid remote",
			remote: Remote{
				Host:     "github.com",
				Owner:    "owner",
				Repo:     "repo",
				Provider: "github",
			},
			want: true,
		},
		{
			name: "Missing host",
			remote: Remote{
				Owner:    "owner",
				Repo:     "repo",
				Provider: "github",
			},
			want: false,
		},
		{
			name: "Missing owner",
			remote: Remote{
				Host:     "github.com",
				Repo:     "repo",
				Provider: "github",
			},
			want: false,
		},
		{
			name: "Missing repo",
			remote: Remote{
				Host:     "github.com",
				Owner:    "owner",
				Provider: "github",
			},
			want: false,
		},
		{
			name: "Unknown provider",
			remote: Remote{
				Host:     "unknown.com",
				Owner:    "owner",
				Repo:     "repo",
				Provider: "unknown",
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.remote.IsValid(); got != tt.want {
				t.Errorf("Remote.IsValid() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRemoteFullName(t *testing.T) {
	remote := Remote{
		Owner: "owner",
		Repo:  "repo",
	}

	want := "owner/repo"
	got := remote.FullName()

	if got != want {
		t.Errorf("Remote.FullName() = %v, want %v", got, want)
	}
}

func TestGetOwnerRepo(t *testing.T) {
	tests := []struct {
		name      string
		path      string
		wantOwner string
		wantRepo  string
	}{
		{
			name:      "Simple path",
			path:      "owner/repo",
			wantOwner: "owner",
			wantRepo:  "repo",
		},
		{
			name:      "Path with .git",
			path:      "owner/repo.git",
			wantOwner: "owner",
			wantRepo:  "repo",
		},
		{
			name:      "GitLab subgroup",
			path:      "group/subgroup/repo",
			wantOwner: "group/subgroup",
			wantRepo:  "repo",
		},
		{
			name:      "Invalid path (single component)",
			path:      "repo",
			wantOwner: "",
			wantRepo:  "",
		},
		{
			name:      "Empty path",
			path:      "",
			wantOwner: "",
			wantRepo:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotOwner, gotRepo := GetOwnerRepo(tt.path)
			if gotOwner != tt.wantOwner {
				t.Errorf("GetOwnerRepo() owner = %v, want %v", gotOwner, tt.wantOwner)
			}
			if gotRepo != tt.wantRepo {
				t.Errorf("GetOwnerRepo() repo = %v, want %v", gotRepo, tt.wantRepo)
			}
		})
	}
}
