package storage

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_repos (
    workspace_id TEXT NOT NULL,
    provider_type TEXT NOT NULL,
    host TEXT NOT NULL,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    PRIMARY KEY (workspace_id, provider_type, host, owner, repo),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recent_repos (
    provider_type TEXT NOT NULL,
    host TEXT NOT NULL,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (provider_type, host, owner, repo)
);

CREATE TABLE IF NOT EXISTS favorites (
    provider_type TEXT NOT NULL,
    host TEXT NOT NULL,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (provider_type, host, owner, repo)
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
`

// SQLiteStorage implements the Storage interface using SQLite
type SQLiteStorage struct {
	db *sql.DB
}

// NewSQLiteStorage creates a new SQLite storage instance
func NewSQLiteStorage(dbPath string) (*SQLiteStorage, error) {
	// Create config directory if it doesn't exist
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	// Open database connection
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Enable foreign keys
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	// Initialize schema
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return &SQLiteStorage{db: db}, nil
}

// DefaultStorage creates a storage instance at the default location
func DefaultStorage() (*SQLiteStorage, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	dbPath := filepath.Join(homeDir, ".config", "lazyreview", "lazyreview.db")
	return NewSQLiteStorage(dbPath)
}

// Close closes the database connection
func (s *SQLiteStorage) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

// CreateWorkspace creates a new workspace
func (s *SQLiteStorage) CreateWorkspace(workspace Workspace) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert workspace
	_, err = tx.Exec(
		"INSERT INTO workspaces (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
		workspace.ID,
		workspace.Name,
		workspace.Description,
		workspace.CreatedAt,
		workspace.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert workspace: %w", err)
	}

	// Insert repos
	for _, repo := range workspace.Repos {
		_, err = tx.Exec(
			"INSERT INTO workspace_repos (workspace_id, provider_type, host, owner, repo) VALUES (?, ?, ?, ?, ?)",
			workspace.ID,
			repo.ProviderType,
			repo.Host,
			repo.Owner,
			repo.Repo,
		)
		if err != nil {
			return fmt.Errorf("failed to insert workspace repo: %w", err)
		}
	}

	return tx.Commit()
}

// GetWorkspace retrieves a workspace by ID
func (s *SQLiteStorage) GetWorkspace(id string) (*Workspace, error) {
	// Get workspace
	var workspace Workspace
	err := s.db.QueryRow(
		"SELECT id, name, description, created_at, updated_at FROM workspaces WHERE id = ?",
		id,
	).Scan(
		&workspace.ID,
		&workspace.Name,
		&workspace.Description,
		&workspace.CreatedAt,
		&workspace.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("workspace not found: %s", id)
		}
		return nil, fmt.Errorf("failed to query workspace: %w", err)
	}

	// Get repos
	rows, err := s.db.Query(
		"SELECT provider_type, host, owner, repo FROM workspace_repos WHERE workspace_id = ?",
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query workspace repos: %w", err)
	}
	defer rows.Close()

	workspace.Repos = []RepoRef{}
	for rows.Next() {
		var repo RepoRef
		if err := rows.Scan(&repo.ProviderType, &repo.Host, &repo.Owner, &repo.Repo); err != nil {
			return nil, fmt.Errorf("failed to scan repo: %w", err)
		}
		workspace.Repos = append(workspace.Repos, repo)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating repos: %w", err)
	}

	return &workspace, nil
}

// ListWorkspaces retrieves all workspaces
func (s *SQLiteStorage) ListWorkspaces() ([]Workspace, error) {
	rows, err := s.db.Query(
		"SELECT id, name, description, created_at, updated_at FROM workspaces ORDER BY updated_at DESC",
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query workspaces: %w", err)
	}
	defer rows.Close()

	workspaces := []Workspace{}
	for rows.Next() {
		var workspace Workspace
		if err := rows.Scan(
			&workspace.ID,
			&workspace.Name,
			&workspace.Description,
			&workspace.CreatedAt,
			&workspace.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan workspace: %w", err)
		}

		// Get repos for this workspace
		repoRows, err := s.db.Query(
			"SELECT provider_type, host, owner, repo FROM workspace_repos WHERE workspace_id = ?",
			workspace.ID,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to query workspace repos: %w", err)
		}

		workspace.Repos = []RepoRef{}
		for repoRows.Next() {
			var repo RepoRef
			if err := repoRows.Scan(&repo.ProviderType, &repo.Host, &repo.Owner, &repo.Repo); err != nil {
				repoRows.Close()
				return nil, fmt.Errorf("failed to scan repo: %w", err)
			}
			workspace.Repos = append(workspace.Repos, repo)
		}
		repoRows.Close()

		if err := repoRows.Err(); err != nil {
			return nil, fmt.Errorf("error iterating repos: %w", err)
		}

		workspaces = append(workspaces, workspace)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating workspaces: %w", err)
	}

	return workspaces, nil
}

// UpdateWorkspace updates an existing workspace
func (s *SQLiteStorage) UpdateWorkspace(workspace Workspace) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Update workspace
	result, err := tx.Exec(
		"UPDATE workspaces SET name = ?, description = ?, updated_at = ? WHERE id = ?",
		workspace.Name,
		workspace.Description,
		time.Now(),
		workspace.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update workspace: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("workspace not found: %s", workspace.ID)
	}

	// Delete existing repos
	_, err = tx.Exec("DELETE FROM workspace_repos WHERE workspace_id = ?", workspace.ID)
	if err != nil {
		return fmt.Errorf("failed to delete workspace repos: %w", err)
	}

	// Insert new repos
	for _, repo := range workspace.Repos {
		_, err = tx.Exec(
			"INSERT INTO workspace_repos (workspace_id, provider_type, host, owner, repo) VALUES (?, ?, ?, ?, ?)",
			workspace.ID,
			repo.ProviderType,
			repo.Host,
			repo.Owner,
			repo.Repo,
		)
		if err != nil {
			return fmt.Errorf("failed to insert workspace repo: %w", err)
		}
	}

	return tx.Commit()
}

// DeleteWorkspace deletes a workspace
func (s *SQLiteStorage) DeleteWorkspace(id string) error {
	result, err := s.db.Exec("DELETE FROM workspaces WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete workspace: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("workspace not found: %s", id)
	}

	return nil
}

// AddRepoToWorkspace adds a repository to a workspace
func (s *SQLiteStorage) AddRepoToWorkspace(workspaceID string, repo RepoRef) error {
	// First, update the workspace's updated_at timestamp
	_, err := s.db.Exec(
		"UPDATE workspaces SET updated_at = ? WHERE id = ?",
		time.Now(),
		workspaceID,
	)
	if err != nil {
		return fmt.Errorf("failed to update workspace timestamp: %w", err)
	}

	// Insert the repo (or ignore if it already exists)
	_, err = s.db.Exec(
		"INSERT OR IGNORE INTO workspace_repos (workspace_id, provider_type, host, owner, repo) VALUES (?, ?, ?, ?, ?)",
		workspaceID,
		repo.ProviderType,
		repo.Host,
		repo.Owner,
		repo.Repo,
	)
	if err != nil {
		return fmt.Errorf("failed to insert workspace repo: %w", err)
	}

	return nil
}

// RemoveRepoFromWorkspace removes a repository from a workspace
func (s *SQLiteStorage) RemoveRepoFromWorkspace(workspaceID string, repo RepoRef) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Update workspace timestamp
	_, err = tx.Exec(
		"UPDATE workspaces SET updated_at = ? WHERE id = ?",
		time.Now(),
		workspaceID,
	)
	if err != nil {
		return fmt.Errorf("failed to update workspace timestamp: %w", err)
	}

	// Delete the repo
	_, err = tx.Exec(
		"DELETE FROM workspace_repos WHERE workspace_id = ? AND provider_type = ? AND host = ? AND owner = ? AND repo = ?",
		workspaceID,
		repo.ProviderType,
		repo.Host,
		repo.Owner,
		repo.Repo,
	)
	if err != nil {
		return fmt.Errorf("failed to delete workspace repo: %w", err)
	}

	return tx.Commit()
}

// AddRecentRepo adds or updates a recently accessed repository
func (s *SQLiteStorage) AddRecentRepo(repo RepoRef) error {
	_, err := s.db.Exec(
		"INSERT OR REPLACE INTO recent_repos (provider_type, host, owner, repo, last_accessed) VALUES (?, ?, ?, ?, ?)",
		repo.ProviderType,
		repo.Host,
		repo.Owner,
		repo.Repo,
		time.Now(),
	)
	if err != nil {
		return fmt.Errorf("failed to insert recent repo: %w", err)
	}

	return nil
}

// GetRecentRepos retrieves the most recently accessed repositories
func (s *SQLiteStorage) GetRecentRepos(limit int) ([]RepoRef, error) {
	rows, err := s.db.Query(
		"SELECT provider_type, host, owner, repo FROM recent_repos ORDER BY last_accessed DESC LIMIT ?",
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent repos: %w", err)
	}
	defer rows.Close()

	repos := []RepoRef{}
	for rows.Next() {
		var repo RepoRef
		if err := rows.Scan(&repo.ProviderType, &repo.Host, &repo.Owner, &repo.Repo); err != nil {
			return nil, fmt.Errorf("failed to scan repo: %w", err)
		}
		repos = append(repos, repo)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating repos: %w", err)
	}

	return repos, nil
}

// AddFavorite adds a repository to favorites
func (s *SQLiteStorage) AddFavorite(repo RepoRef) error {
	_, err := s.db.Exec(
		"INSERT OR IGNORE INTO favorites (provider_type, host, owner, repo, added_at) VALUES (?, ?, ?, ?, ?)",
		repo.ProviderType,
		repo.Host,
		repo.Owner,
		repo.Repo,
		time.Now(),
	)
	if err != nil {
		return fmt.Errorf("failed to insert favorite: %w", err)
	}

	return nil
}

// RemoveFavorite removes a repository from favorites
func (s *SQLiteStorage) RemoveFavorite(repo RepoRef) error {
	_, err := s.db.Exec(
		"DELETE FROM favorites WHERE provider_type = ? AND host = ? AND owner = ? AND repo = ?",
		repo.ProviderType,
		repo.Host,
		repo.Owner,
		repo.Repo,
	)
	if err != nil {
		return fmt.Errorf("failed to delete favorite: %w", err)
	}

	return nil
}

// ListFavorites retrieves all favorite repositories
func (s *SQLiteStorage) ListFavorites() ([]RepoRef, error) {
	rows, err := s.db.Query(
		"SELECT provider_type, host, owner, repo FROM favorites ORDER BY added_at DESC",
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query favorites: %w", err)
	}
	defer rows.Close()

	repos := []RepoRef{}
	for rows.Next() {
		var repo RepoRef
		if err := rows.Scan(&repo.ProviderType, &repo.Host, &repo.Owner, &repo.Repo); err != nil {
			return nil, fmt.Errorf("failed to scan repo: %w", err)
		}
		repos = append(repos, repo)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating repos: %w", err)
	}

	return repos, nil
}

// IsFavorite checks if a repository is in favorites
func (s *SQLiteStorage) IsFavorite(repo RepoRef) (bool, error) {
	var count int
	err := s.db.QueryRow(
		"SELECT COUNT(*) FROM favorites WHERE provider_type = ? AND host = ? AND owner = ? AND repo = ?",
		repo.ProviderType,
		repo.Host,
		repo.Owner,
		repo.Repo,
	).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to query favorite: %w", err)
	}

	return count > 0, nil
}

// GetSetting retrieves a setting value
func (s *SQLiteStorage) GetSetting(key string) (string, error) {
	var value string
	err := s.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", fmt.Errorf("setting not found: %s", key)
		}
		return "", fmt.Errorf("failed to query setting: %w", err)
	}

	return value, nil
}

// SetSetting sets a setting value
func (s *SQLiteStorage) SetSetting(key, value string) error {
	_, err := s.db.Exec(
		"INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
		key,
		value,
	)
	if err != nil {
		return fmt.Errorf("failed to set setting: %w", err)
	}

	return nil
}
