// Package storage provides persistent storage for LazyReview using SQLite.
// It manages workspaces, recent repositories, favorites, and application settings.
//
// Example usage:
//
//	store, err := storage.DefaultStorage()
//	if err != nil {
//	    log.Fatal(err)
//	}
//	defer store.Close()
//
//	// Create a workspace
//	workspace := storage.Workspace{
//	    ID:   "ws-1",
//	    Name: "My Projects",
//	    Repos: []storage.RepoRef{
//	        {ProviderType: "github", Host: "github.com", Owner: "user", Repo: "repo"},
//	    },
//	}
//	err = store.CreateWorkspace(workspace)
package storage

import "time"

// RepoRef represents a reference to a repository across any provider
type RepoRef struct {
	ProviderType string
	Host         string
	Owner        string
	Repo         string
}

// Workspace represents a collection of repositories grouped together
type Workspace struct {
	ID          string
	Name        string
	Description string
	Repos       []RepoRef
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// Storage defines the interface for persistent storage operations
type Storage interface {
	// Workspaces
	CreateWorkspace(workspace Workspace) error
	GetWorkspace(id string) (*Workspace, error)
	ListWorkspaces() ([]Workspace, error)
	UpdateWorkspace(workspace Workspace) error
	DeleteWorkspace(id string) error
	AddRepoToWorkspace(workspaceID string, repo RepoRef) error
	RemoveRepoFromWorkspace(workspaceID string, repo RepoRef) error

	// Recent repos
	AddRecentRepo(repo RepoRef) error
	GetRecentRepos(limit int) ([]RepoRef, error)

	// Favorites
	AddFavorite(repo RepoRef) error
	RemoveFavorite(repo RepoRef) error
	ListFavorites() ([]RepoRef, error)
	IsFavorite(repo RepoRef) (bool, error)

	// Settings
	GetSetting(key string) (string, error)
	SetSetting(key, value string) error

	Close() error
}
