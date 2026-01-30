package storage_test

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"lazyreview/internal/storage"
)

func ExampleSQLiteStorage_workspaceManagement() {
	// Create temporary storage for the example
	tmpDir, _ := os.MkdirTemp("", "example-*")
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "example.db")
	store, err := storage.NewSQLiteStorage(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()

	// Create a workspace
	workspace := storage.Workspace{
		ID:          "ws-1",
		Name:        "My Projects",
		Description: "Personal projects workspace",
		Repos: []storage.RepoRef{
			{
				ProviderType: "github",
				Host:         "github.com",
				Owner:        "myorg",
				Repo:         "project1",
			},
			{
				ProviderType: "github",
				Host:         "github.com",
				Owner:        "myorg",
				Repo:         "project2",
			},
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := store.CreateWorkspace(workspace); err != nil {
		log.Fatal(err)
	}

	// List all workspaces
	workspaces, err := store.ListWorkspaces()
	if err != nil {
		log.Fatal(err)
	}

	for _, ws := range workspaces {
		fmt.Printf("Workspace: %s (%d repos)\n", ws.Name, len(ws.Repos))
	}

	// Output:
	// Workspace: My Projects (2 repos)
}

func ExampleSQLiteStorage_recentRepos() {
	tmpDir, _ := os.MkdirTemp("", "example-*")
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "example.db")
	store, err := storage.NewSQLiteStorage(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()

	// Track recently accessed repositories
	repos := []storage.RepoRef{
		{ProviderType: "github", Host: "github.com", Owner: "user", Repo: "repo1"},
		{ProviderType: "github", Host: "github.com", Owner: "user", Repo: "repo2"},
		{ProviderType: "gitlab", Host: "gitlab.com", Owner: "user", Repo: "repo3"},
	}

	for _, repo := range repos {
		if err := store.AddRecentRepo(repo); err != nil {
			log.Fatal(err)
		}
		time.Sleep(1 * time.Millisecond) // Ensure different timestamps
	}

	// Get 5 most recent repos
	recent, err := store.GetRecentRepos(5)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d recent repositories\n", len(recent))
	fmt.Printf("Most recent: %s/%s\n", recent[0].Owner, recent[0].Repo)

	// Output:
	// Found 3 recent repositories
	// Most recent: user/repo3
}

func ExampleSQLiteStorage_favorites() {
	tmpDir, _ := os.MkdirTemp("", "example-*")
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "example.db")
	store, err := storage.NewSQLiteStorage(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()

	repo := storage.RepoRef{
		ProviderType: "github",
		Host:         "github.com",
		Owner:        "myorg",
		Repo:         "awesome-project",
	}

	// Add to favorites
	if err := store.AddFavorite(repo); err != nil {
		log.Fatal(err)
	}

	// Check if it's a favorite
	isFav, err := store.IsFavorite(repo)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Is favorite: %v\n", isFav)

	// List all favorites
	favorites, err := store.ListFavorites()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Total favorites: %d\n", len(favorites))

	// Output:
	// Is favorite: true
	// Total favorites: 1
}

func ExampleSQLiteStorage_settings() {
	tmpDir, _ := os.MkdirTemp("", "example-*")
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "example.db")
	store, err := storage.NewSQLiteStorage(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()

	// Store settings
	if err := store.SetSetting("theme", "dark"); err != nil {
		log.Fatal(err)
	}

	if err := store.SetSetting("editor", "vim"); err != nil {
		log.Fatal(err)
	}

	// Retrieve settings
	theme, err := store.GetSetting("theme")
	if err != nil {
		log.Fatal(err)
	}

	editor, err := store.GetSetting("editor")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Theme: %s, Editor: %s\n", theme, editor)

	// Output:
	// Theme: dark, Editor: vim
}

func ExampleDefaultStorage() {
	// In production, use DefaultStorage() to get storage at the standard location
	// store, err := storage.DefaultStorage()
	// if err != nil {
	//     log.Fatal(err)
	// }
	// defer store.Close()
	//
	// Database will be at: ~/.config/lazyreview/lazyreview.db

	fmt.Println("Storage location: ~/.config/lazyreview/lazyreview.db")
	// Output:
	// Storage location: ~/.config/lazyreview/lazyreview.db
}
