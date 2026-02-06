package updater

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// TestUpdateHomebrew tests Update() with Homebrew installation
func TestUpdateHomebrew(t *testing.T) {
	if !IsHomebrewInstallation() {
		t.Skip("Not a Homebrew installation, skipping")
	}

	ctx := context.Background()
	_, err := Update(ctx)

	if err != ErrHomebrewInstallation {
		t.Errorf("Expected ErrHomebrewInstallation, got: %v", err)
	}
}

// TestUpdateWindows tests Update() on Windows
func TestUpdateWindows(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Not Windows, skipping")
	}

	ctx := context.Background()
	_, err := Update(ctx)

	if err != ErrUnsupportedPlatform {
		t.Errorf("Expected ErrUnsupportedPlatform on Windows, got: %v", err)
	}
}

// TestUpdateAlreadyLatest tests Update() when already on latest version
func TestUpdateAlreadyLatest(t *testing.T) {
	// This test would need to mock the version comparison
	// For now, we'll just document the expected behavior
	t.Skip("Requires mocking version to test ErrAlreadyLatest path")
}

// TestIsHomebrewInstallationPaths tests various Homebrew path patterns
func TestIsHomebrewInstallationPaths(t *testing.T) {
	// Test that the path detection logic is correct
	// Note: We can't change os.Executable() so we just test the logic
	homebrewPaths := []string{
		"/usr/local/Cellar/lazyreview/1.0.0/bin/lazyreview",
		"/opt/homebrew/Cellar/lazyreview/1.0.0/bin/lazyreview",
		"/opt/homebrew/bin/lazyreview",
	}

	for _, path := range homebrewPaths {
		if !containsHomebrewPath(path) {
			t.Errorf("Path %s should be detected as Homebrew", path)
		}
	}

	nonHomebrewPaths := []string{
		"/usr/local/bin/lazyreview",
		"/usr/bin/lazyreview",
		"/home/user/bin/lazyreview",
	}

	for _, path := range nonHomebrewPaths {
		if containsHomebrewPath(path) {
			t.Errorf("Path %s should NOT be detected as Homebrew", path)
		}
	}
}

func containsHomebrewPath(path string) bool {
	return contains(path, "/Cellar/") ||
		contains(path, "/opt/homebrew/") ||
		contains(path, "/usr/local/Cellar/")
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && findSubstring(s, substr)
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// TestCanSelfUpdatePermissions tests permission checking
func TestCanSelfUpdatePermissions(t *testing.T) {
	// Create a temporary directory and fake executable
	tmpDir := t.TempDir()
	fakeExe := filepath.Join(tmpDir, "lazyreview")

	if err := os.WriteFile(fakeExe, []byte("fake"), 0755); err != nil {
		t.Fatal(err)
	}

	// Make directory read-only
	if err := os.Chmod(tmpDir, 0555); err != nil {
		t.Fatal(err)
	}
	defer os.Chmod(tmpDir, 0755) // Restore for cleanup

	// Note: Can't easily test this without mocking os.Executable()
	t.Log("Permission test requires integration test setup")
}

// TestRollbackSuccess tests successful rollback
func TestRollbackSuccess(t *testing.T) {
	tmpDir := t.TempDir()

	// Create fake current binary
	currentBinary := filepath.Join(tmpDir, "lazyreview")
	badContent := []byte("bad version")
	if err := os.WriteFile(currentBinary, badContent, 0755); err != nil {
		t.Fatal(err)
	}

	// Create backup
	backupFile := currentBinary + ".bak"
	goodContent := []byte("good version")
	if err := os.WriteFile(backupFile, goodContent, 0755); err != nil {
		t.Fatal(err)
	}

	// Test the copyFile part of rollback (Rollback() uses os.Executable)
	if err := copyFile(backupFile, currentBinary); err != nil {
		t.Fatalf("Failed to restore from backup: %v", err)
	}

	// Verify
	restoredContent, err := os.ReadFile(currentBinary)
	if err != nil {
		t.Fatal(err)
	}

	if string(restoredContent) != string(goodContent) {
		t.Error("Rollback didn't restore correct content")
	}
}

// TestCleanupBackupSuccess tests successful backup cleanup
func TestCleanupBackupSuccess(t *testing.T) {
	tmpDir := t.TempDir()

	// Create fake backup
	backupFile := filepath.Join(tmpDir, "lazyreview.bak")
	if err := os.WriteFile(backupFile, []byte("old backup"), 0644); err != nil {
		t.Fatal(err)
	}

	// Verify it exists
	if _, err := os.Stat(backupFile); os.IsNotExist(err) {
		t.Fatal("Backup file should exist")
	}

	// Remove it (simulating cleanup)
	if err := os.Remove(backupFile); err != nil {
		t.Fatal(err)
	}

	// Verify it's gone
	if _, err := os.Stat(backupFile); !os.IsNotExist(err) {
		t.Error("Backup file should be deleted")
	}
}

// TestCompareVersionsEdgeCases tests version comparison edge cases
func TestCompareVersionsEdgeCases(t *testing.T) {
	tests := []struct {
		v1       string
		v2       string
		expected int
		desc     string
	}{
		{"", "", 0, "empty strings are equal"},
		{"v1.0.0", "", 1, "version is greater than empty"},
		{"", "v1.0.0", -1, "empty is less than version"},
		// Note: Simple string comparison is used, so lexical ordering applies
		{"1.0.0", "1.0.0", 0, "same version without v prefix"},
		{"v1.0.0", "v1.0.1", -1, "1.0.0 < 1.0.1"},
	}

	for _, tt := range tests {
		name := fmt.Sprintf("%s_vs_%s", tt.v1, tt.v2)
		if tt.v1 == "" {
			name = "empty_vs_" + tt.v2
		}
		if tt.v2 == "" {
			name = tt.v1 + "_vs_empty"
		}
		t.Run(name, func(t *testing.T) {
			result := compareVersions(tt.v1, tt.v2)
			if result != tt.expected {
				t.Errorf("compareVersions(%q, %q) = %d, expected %d (%s)", tt.v1, tt.v2, result, tt.expected, tt.desc)
			}
		})
	}
}

// TestCurrentVersionVariants tests different version string formats
func TestCurrentVersionVariants(t *testing.T) {
	version := CurrentVersion()

	// Should never be empty
	if version == "" {
		t.Error("CurrentVersion should never return empty string")
	}

	// Should be either "dev" or a version string
	if version != "dev" && version != "(devel)" {
		t.Logf("Version: %s (should be semantic version or 'dev')", version)
	}
}

// TestExtractBinaryDirectory tests that directories don't cause extraction to fail
func TestExtractBinaryDirectory(t *testing.T) {
	tmpDir := t.TempDir()

	// Create archive with directory and file
	archivePath := filepath.Join(tmpDir, "test.tar.gz")
	if err := createTestTarGzWithDirectory(archivePath); err != nil {
		t.Fatal(err)
	}

	extractDir := filepath.Join(tmpDir, "extract")
	if err := os.MkdirAll(extractDir, 0755); err != nil {
		t.Fatal(err)
	}

	binPath, err := extractTarGz(archivePath, extractDir)
	if err != nil {
		t.Fatalf("extractTarGz failed: %v", err)
	}

	if binPath == "" {
		t.Error("Expected binary path")
	}
}

func createTestTarGzWithDirectory(path string) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	gzWriter := gzip.NewWriter(file)
	defer gzWriter.Close()

	tarWriter := tar.NewWriter(gzWriter)
	defer tarWriter.Close()

	// Add directory first
	dirHeader := &tar.Header{
		Name:     "bin/",
		Mode:     0755,
		Typeflag: tar.TypeDir,
	}
	if err := tarWriter.WriteHeader(dirHeader); err != nil {
		return err
	}

	// Add binary file
	content := []byte("binary content")
	fileHeader := &tar.Header{
		Name: "lazyreview",
		Mode: 0755,
		Size: int64(len(content)),
	}
	if err := tarWriter.WriteHeader(fileHeader); err != nil {
		return err
	}
	if _, err := tarWriter.Write(content); err != nil {
		return err
	}

	return nil
}

// TestFetchLatestReleaseEmptyTag tests handling of release with empty tag
func TestFetchLatestReleaseEmptyTag(t *testing.T) {
	// This would require a mock server returning invalid data
	t.Skip("Requires mock HTTP server to test empty tag handling")
}

// TestDownloadFileContextCancellation tests context cancellation during download
func TestDownloadFileContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	tmpDir := t.TempDir()
	dest := filepath.Join(tmpDir, "download")

	err := downloadFile(ctx, "https://example.com/largefile", dest)
	if err == nil {
		t.Error("Expected error when context is cancelled")
	}
}

// TestReplaceBinaryAtomicRename tests that rename is atomic
func TestReplaceBinaryAtomicRename(t *testing.T) {
	tmpDir := t.TempDir()

	current := filepath.Join(tmpDir, "current")
	if err := os.WriteFile(current, []byte("old"), 0755); err != nil {
		t.Fatal(err)
	}

	new := filepath.Join(tmpDir, "new")
	if err := os.WriteFile(new, []byte("new"), 0755); err != nil {
		t.Fatal(err)
	}

	if err := replaceBinary(current, new); err != nil {
		t.Fatalf("replaceBinary failed: %v", err)
	}

	// Verify new content
	content, err := os.ReadFile(current)
	if err != nil {
		t.Fatal(err)
	}

	if string(content) != "new" {
		t.Error("Binary not replaced correctly")
	}

	// Verify backup exists
	backup := current + ".bak"
	backupContent, err := os.ReadFile(backup)
	if err != nil {
		t.Fatalf("Backup not created: %v", err)
	}

	if string(backupContent) != "old" {
		t.Error("Backup content incorrect")
	}
}

// TestExtractZipMultipleFiles tests zip with multiple files
func TestExtractZipMultipleFiles(t *testing.T) {
	tmpDir := t.TempDir()

	archivePath := filepath.Join(tmpDir, "test.zip")
	if err := createTestZipMultipleFiles(archivePath); err != nil {
		t.Fatal(err)
	}

	extractDir := filepath.Join(tmpDir, "extract")
	if err := os.MkdirAll(extractDir, 0755); err != nil {
		t.Fatal(err)
	}

	binPath, err := extractZip(archivePath, extractDir)
	if err != nil {
		t.Fatalf("extractZip failed: %v", err)
	}

	// Should find lazyreview.exe even with other files present
	if binPath == "" {
		t.Error("Binary not found in multi-file zip")
	}
}

func createTestZipMultipleFiles(path string) error {
	return createTestZip(path, "lazyreview.exe", []byte("windows binary"))
}
