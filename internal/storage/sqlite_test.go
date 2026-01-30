package storage

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func setupTestDB(t *testing.T) (*SQLiteStorage, string) {
	t.Helper()

	// Create temp directory
	tmpDir, err := os.MkdirTemp("", "lazyreview-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	// Create storage
	dbPath := filepath.Join(tmpDir, "test.db")
	storage, err := NewSQLiteStorage(dbPath)
	if err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("failed to create storage: %v", err)
	}

	return storage, tmpDir
}

func cleanupTestDB(t *testing.T, storage *SQLiteStorage, tmpDir string) {
	t.Helper()

	if err := storage.Close(); err != nil {
		t.Errorf("failed to close storage: %v", err)
	}

	if err := os.RemoveAll(tmpDir); err != nil {
		t.Errorf("failed to remove temp dir: %v", err)
	}
}

func TestWorkspaceOperations(t *testing.T) {
	storage, tmpDir := setupTestDB(t)
	defer cleanupTestDB(t, storage, tmpDir)

	t.Run("CreateAndGetWorkspace", func(t *testing.T) {
		workspace := Workspace{
			ID:          "ws-1",
			Name:        "Test Workspace",
			Description: "A test workspace",
			Repos: []RepoRef{
				{ProviderType: "github", Host: "github.com", Owner: "test", Repo: "repo1"},
				{ProviderType: "gitlab", Host: "gitlab.com", Owner: "test", Repo: "repo2"},
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		// Create workspace
		if err := storage.CreateWorkspace(workspace); err != nil {
			t.Fatalf("CreateWorkspace failed: %v", err)
		}

		// Get workspace
		retrieved, err := storage.GetWorkspace("ws-1")
		if err != nil {
			t.Fatalf("GetWorkspace failed: %v", err)
		}

		if retrieved.ID != workspace.ID {
			t.Errorf("expected ID %s, got %s", workspace.ID, retrieved.ID)
		}
		if retrieved.Name != workspace.Name {
			t.Errorf("expected name %s, got %s", workspace.Name, retrieved.Name)
		}
		if len(retrieved.Repos) != len(workspace.Repos) {
			t.Errorf("expected %d repos, got %d", len(workspace.Repos), len(retrieved.Repos))
		}
	})

	t.Run("GetNonexistentWorkspace", func(t *testing.T) {
		_, err := storage.GetWorkspace("nonexistent")
		if err == nil {
			t.Error("expected error for nonexistent workspace")
		}
	})

	t.Run("ListWorkspaces", func(t *testing.T) {
		// Create multiple workspaces
		ws1 := Workspace{
			ID:        "ws-list-1",
			Name:      "Workspace 1",
			Repos:     []RepoRef{},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		ws2 := Workspace{
			ID:        "ws-list-2",
			Name:      "Workspace 2",
			Repos:     []RepoRef{},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		if err := storage.CreateWorkspace(ws1); err != nil {
			t.Fatalf("CreateWorkspace failed: %v", err)
		}
		if err := storage.CreateWorkspace(ws2); err != nil {
			t.Fatalf("CreateWorkspace failed: %v", err)
		}

		// List workspaces
		workspaces, err := storage.ListWorkspaces()
		if err != nil {
			t.Fatalf("ListWorkspaces failed: %v", err)
		}

		if len(workspaces) < 2 {
			t.Errorf("expected at least 2 workspaces, got %d", len(workspaces))
		}
	})

	t.Run("UpdateWorkspace", func(t *testing.T) {
		workspace := Workspace{
			ID:          "ws-update",
			Name:        "Original Name",
			Description: "Original Description",
			Repos:       []RepoRef{},
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		if err := storage.CreateWorkspace(workspace); err != nil {
			t.Fatalf("CreateWorkspace failed: %v", err)
		}

		// Update workspace
		workspace.Name = "Updated Name"
		workspace.Description = "Updated Description"
		workspace.Repos = []RepoRef{
			{ProviderType: "github", Host: "github.com", Owner: "test", Repo: "new-repo"},
		}

		if err := storage.UpdateWorkspace(workspace); err != nil {
			t.Fatalf("UpdateWorkspace failed: %v", err)
		}

		// Verify update
		retrieved, err := storage.GetWorkspace("ws-update")
		if err != nil {
			t.Fatalf("GetWorkspace failed: %v", err)
		}

		if retrieved.Name != "Updated Name" {
			t.Errorf("expected name 'Updated Name', got %s", retrieved.Name)
		}
		if len(retrieved.Repos) != 1 {
			t.Errorf("expected 1 repo, got %d", len(retrieved.Repos))
		}
	})

	t.Run("DeleteWorkspace", func(t *testing.T) {
		workspace := Workspace{
			ID:        "ws-delete",
			Name:      "To Delete",
			Repos:     []RepoRef{},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		if err := storage.CreateWorkspace(workspace); err != nil {
			t.Fatalf("CreateWorkspace failed: %v", err)
		}

		// Delete workspace
		if err := storage.DeleteWorkspace("ws-delete"); err != nil {
			t.Fatalf("DeleteWorkspace failed: %v", err)
		}

		// Verify deletion
		_, err := storage.GetWorkspace("ws-delete")
		if err == nil {
			t.Error("expected error for deleted workspace")
		}
	})

	t.Run("AddRepoToWorkspace", func(t *testing.T) {
		workspace := Workspace{
			ID:        "ws-add-repo",
			Name:      "Add Repo Test",
			Repos:     []RepoRef{},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		if err := storage.CreateWorkspace(workspace); err != nil {
			t.Fatalf("CreateWorkspace failed: %v", err)
		}

		// Add repo
		repo := RepoRef{
			ProviderType: "github",
			Host:         "github.com",
			Owner:        "test",
			Repo:         "added-repo",
		}

		if err := storage.AddRepoToWorkspace("ws-add-repo", repo); err != nil {
			t.Fatalf("AddRepoToWorkspace failed: %v", err)
		}

		// Verify addition
		retrieved, err := storage.GetWorkspace("ws-add-repo")
		if err != nil {
			t.Fatalf("GetWorkspace failed: %v", err)
		}

		if len(retrieved.Repos) != 1 {
			t.Errorf("expected 1 repo, got %d", len(retrieved.Repos))
		}
	})

	t.Run("RemoveRepoFromWorkspace", func(t *testing.T) {
		repo := RepoRef{
			ProviderType: "github",
			Host:         "github.com",
			Owner:        "test",
			Repo:         "to-remove",
		}

		workspace := Workspace{
			ID:        "ws-remove-repo",
			Name:      "Remove Repo Test",
			Repos:     []RepoRef{repo},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		if err := storage.CreateWorkspace(workspace); err != nil {
			t.Fatalf("CreateWorkspace failed: %v", err)
		}

		// Remove repo
		if err := storage.RemoveRepoFromWorkspace("ws-remove-repo", repo); err != nil {
			t.Fatalf("RemoveRepoFromWorkspace failed: %v", err)
		}

		// Verify removal
		retrieved, err := storage.GetWorkspace("ws-remove-repo")
		if err != nil {
			t.Fatalf("GetWorkspace failed: %v", err)
		}

		if len(retrieved.Repos) != 0 {
			t.Errorf("expected 0 repos, got %d", len(retrieved.Repos))
		}
	})
}

func TestRecentRepos(t *testing.T) {
	storage, tmpDir := setupTestDB(t)
	defer cleanupTestDB(t, storage, tmpDir)

	repo1 := RepoRef{ProviderType: "github", Host: "github.com", Owner: "test", Repo: "repo1"}
	repo2 := RepoRef{ProviderType: "gitlab", Host: "gitlab.com", Owner: "test", Repo: "repo2"}

	t.Run("AddRecentRepo", func(t *testing.T) {
		if err := storage.AddRecentRepo(repo1); err != nil {
			t.Fatalf("AddRecentRepo failed: %v", err)
		}

		time.Sleep(10 * time.Millisecond) // Ensure different timestamps

		if err := storage.AddRecentRepo(repo2); err != nil {
			t.Fatalf("AddRecentRepo failed: %v", err)
		}
	})

	t.Run("GetRecentRepos", func(t *testing.T) {
		repos, err := storage.GetRecentRepos(10)
		if err != nil {
			t.Fatalf("GetRecentRepos failed: %v", err)
		}

		if len(repos) != 2 {
			t.Errorf("expected 2 repos, got %d", len(repos))
		}

		// Most recent should be first
		if repos[0].Repo != "repo2" {
			t.Errorf("expected repo2 first, got %s", repos[0].Repo)
		}
	})

	t.Run("GetRecentReposWithLimit", func(t *testing.T) {
		repos, err := storage.GetRecentRepos(1)
		if err != nil {
			t.Fatalf("GetRecentRepos failed: %v", err)
		}

		if len(repos) != 1 {
			t.Errorf("expected 1 repo, got %d", len(repos))
		}
	})

	t.Run("UpdateRecentRepo", func(t *testing.T) {
		time.Sleep(10 * time.Millisecond)

		// Add repo1 again to update its timestamp
		if err := storage.AddRecentRepo(repo1); err != nil {
			t.Fatalf("AddRecentRepo failed: %v", err)
		}

		repos, err := storage.GetRecentRepos(10)
		if err != nil {
			t.Fatalf("GetRecentRepos failed: %v", err)
		}

		// repo1 should now be first
		if repos[0].Repo != "repo1" {
			t.Errorf("expected repo1 first after update, got %s", repos[0].Repo)
		}
	})
}

func TestFavorites(t *testing.T) {
	storage, tmpDir := setupTestDB(t)
	defer cleanupTestDB(t, storage, tmpDir)

	repo := RepoRef{ProviderType: "github", Host: "github.com", Owner: "test", Repo: "favorite"}

	t.Run("AddFavorite", func(t *testing.T) {
		if err := storage.AddFavorite(repo); err != nil {
			t.Fatalf("AddFavorite failed: %v", err)
		}
	})

	t.Run("IsFavorite", func(t *testing.T) {
		isFav, err := storage.IsFavorite(repo)
		if err != nil {
			t.Fatalf("IsFavorite failed: %v", err)
		}

		if !isFav {
			t.Error("expected repo to be favorite")
		}
	})

	t.Run("ListFavorites", func(t *testing.T) {
		favorites, err := storage.ListFavorites()
		if err != nil {
			t.Fatalf("ListFavorites failed: %v", err)
		}

		if len(favorites) != 1 {
			t.Errorf("expected 1 favorite, got %d", len(favorites))
		}

		if favorites[0].Repo != "favorite" {
			t.Errorf("expected repo 'favorite', got %s", favorites[0].Repo)
		}
	})

	t.Run("RemoveFavorite", func(t *testing.T) {
		if err := storage.RemoveFavorite(repo); err != nil {
			t.Fatalf("RemoveFavorite failed: %v", err)
		}

		isFav, err := storage.IsFavorite(repo)
		if err != nil {
			t.Fatalf("IsFavorite failed: %v", err)
		}

		if isFav {
			t.Error("expected repo not to be favorite after removal")
		}
	})

	t.Run("IsNotFavorite", func(t *testing.T) {
		nonFavRepo := RepoRef{ProviderType: "github", Host: "github.com", Owner: "test", Repo: "not-fav"}

		isFav, err := storage.IsFavorite(nonFavRepo)
		if err != nil {
			t.Fatalf("IsFavorite failed: %v", err)
		}

		if isFav {
			t.Error("expected repo not to be favorite")
		}
	})
}

func TestSettings(t *testing.T) {
	storage, tmpDir := setupTestDB(t)
	defer cleanupTestDB(t, storage, tmpDir)

	t.Run("SetAndGetSetting", func(t *testing.T) {
		if err := storage.SetSetting("theme", "dark"); err != nil {
			t.Fatalf("SetSetting failed: %v", err)
		}

		value, err := storage.GetSetting("theme")
		if err != nil {
			t.Fatalf("GetSetting failed: %v", err)
		}

		if value != "dark" {
			t.Errorf("expected 'dark', got %s", value)
		}
	})

	t.Run("UpdateSetting", func(t *testing.T) {
		if err := storage.SetSetting("theme", "light"); err != nil {
			t.Fatalf("SetSetting failed: %v", err)
		}

		value, err := storage.GetSetting("theme")
		if err != nil {
			t.Fatalf("GetSetting failed: %v", err)
		}

		if value != "light" {
			t.Errorf("expected 'light', got %s", value)
		}
	})

	t.Run("GetNonexistentSetting", func(t *testing.T) {
		_, err := storage.GetSetting("nonexistent")
		if err == nil {
			t.Error("expected error for nonexistent setting")
		}
	})
}

func TestDatabaseCreation(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "lazyreview-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	t.Run("CreatesDirectoryIfNotExists", func(t *testing.T) {
		dbPath := filepath.Join(tmpDir, "nested", "dir", "test.db")

		storage, err := NewSQLiteStorage(dbPath)
		if err != nil {
			t.Fatalf("NewSQLiteStorage failed: %v", err)
		}
		defer storage.Close()

		// Verify database file was created
		if _, err := os.Stat(dbPath); os.IsNotExist(err) {
			t.Error("database file was not created")
		}
	})
}

func TestForeignKeyConstraints(t *testing.T) {
	storage, tmpDir := setupTestDB(t)
	defer cleanupTestDB(t, storage, tmpDir)

	t.Run("CascadeDeleteWorkspaceRepos", func(t *testing.T) {
		workspace := Workspace{
			ID:   "ws-cascade",
			Name: "Cascade Test",
			Repos: []RepoRef{
				{ProviderType: "github", Host: "github.com", Owner: "test", Repo: "repo1"},
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		if err := storage.CreateWorkspace(workspace); err != nil {
			t.Fatalf("CreateWorkspace failed: %v", err)
		}

		// Delete workspace
		if err := storage.DeleteWorkspace("ws-cascade"); err != nil {
			t.Fatalf("DeleteWorkspace failed: %v", err)
		}

		// Verify repos were also deleted
		var count int
		err := storage.db.QueryRow(
			"SELECT COUNT(*) FROM workspace_repos WHERE workspace_id = ?",
			"ws-cascade",
		).Scan(&count)
		if err != nil {
			t.Fatalf("query failed: %v", err)
		}

		if count != 0 {
			t.Errorf("expected 0 repos after cascade delete, got %d", count)
		}
	})
}
