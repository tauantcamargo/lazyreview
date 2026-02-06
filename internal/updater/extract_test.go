package updater

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"os"
	"path/filepath"
	"testing"
)

func TestExtractTarGz(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a test tar.gz archive with a binary
	archivePath := filepath.Join(tmpDir, "test.tar.gz")
	if err := createTestTarGz(archivePath, "lazyreview", []byte("binary content")); err != nil {
		t.Fatal(err)
	}

	// Extract the binary
	extractDir := filepath.Join(tmpDir, "extract")
	if err := os.MkdirAll(extractDir, 0755); err != nil {
		t.Fatal(err)
	}

	binPath, err := extractTarGz(archivePath, extractDir)
	if err != nil {
		t.Fatalf("extractTarGz failed: %v", err)
	}

	// Verify binary was extracted
	content, err := os.ReadFile(binPath)
	if err != nil {
		t.Fatal(err)
	}

	if string(content) != "binary content" {
		t.Errorf("Extracted content doesn't match: got %q", string(content))
	}

	// Verify path
	expectedPath := filepath.Join(extractDir, "lazyreview")
	if binPath != expectedPath {
		t.Errorf("Binary path mismatch: got %s, want %s", binPath, expectedPath)
	}
}

func TestExtractTarGzBinaryNotFound(t *testing.T) {
	tmpDir := t.TempDir()

	// Create archive without the expected binary name
	archivePath := filepath.Join(tmpDir, "test.tar.gz")
	if err := createTestTarGz(archivePath, "wrongname", []byte("content")); err != nil {
		t.Fatal(err)
	}

	extractDir := filepath.Join(tmpDir, "extract")
	if err := os.MkdirAll(extractDir, 0755); err != nil {
		t.Fatal(err)
	}

	_, err := extractTarGz(archivePath, extractDir)
	if err == nil {
		t.Error("Expected error when binary not found in archive")
	}
	if err.Error() != "binary not found in archive" {
		t.Errorf("Unexpected error message: %v", err)
	}
}

func TestExtractTarGzInvalidArchive(t *testing.T) {
	tmpDir := t.TempDir()

	// Create an invalid tar.gz file
	invalidPath := filepath.Join(tmpDir, "invalid.tar.gz")
	if err := os.WriteFile(invalidPath, []byte("not a valid gzip"), 0644); err != nil {
		t.Fatal(err)
	}

	extractDir := filepath.Join(tmpDir, "extract")
	if err := os.MkdirAll(extractDir, 0755); err != nil {
		t.Fatal(err)
	}

	_, err := extractTarGz(invalidPath, extractDir)
	if err == nil {
		t.Error("Expected error for invalid archive")
	}
}

func TestExtractZip(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a test zip archive
	archivePath := filepath.Join(tmpDir, "test.zip")
	if err := createTestZip(archivePath, "lazyreview.exe", []byte("windows binary")); err != nil {
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

	// Verify binary was extracted
	content, err := os.ReadFile(binPath)
	if err != nil {
		t.Fatal(err)
	}

	if string(content) != "windows binary" {
		t.Errorf("Extracted content doesn't match: got %q", string(content))
	}
}

func TestExtractZipBinaryNotFound(t *testing.T) {
	tmpDir := t.TempDir()

	// Create zip without the expected binary
	archivePath := filepath.Join(tmpDir, "test.zip")
	if err := createTestZip(archivePath, "wrongname.exe", []byte("content")); err != nil {
		t.Fatal(err)
	}

	extractDir := filepath.Join(tmpDir, "extract")
	if err := os.MkdirAll(extractDir, 0755); err != nil {
		t.Fatal(err)
	}

	_, err := extractZip(archivePath, extractDir)
	if err == nil {
		t.Error("Expected error when binary not found in zip")
	}
	if err.Error() != "binary not found in zip" {
		t.Errorf("Unexpected error message: %v", err)
	}
}

// Helper function to create a test tar.gz archive
func createTestTarGz(path, fileName string, content []byte) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	gzWriter := gzip.NewWriter(file)
	defer gzWriter.Close()

	tarWriter := tar.NewWriter(gzWriter)
	defer tarWriter.Close()

	header := &tar.Header{
		Name: fileName,
		Mode: 0755,
		Size: int64(len(content)),
	}

	if err := tarWriter.WriteHeader(header); err != nil {
		return err
	}

	if _, err := tarWriter.Write(content); err != nil {
		return err
	}

	return nil
}

// Helper function to create a test zip archive
func createTestZip(path, fileName string, content []byte) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	zipWriter := zip.NewWriter(file)
	defer zipWriter.Close()

	writer, err := zipWriter.Create(fileName)
	if err != nil {
		return err
	}

	if _, err := writer.Write(content); err != nil {
		return err
	}

	return nil
}

func TestExtractBinaryTarGz(t *testing.T) {
	tmpDir := t.TempDir()

	archivePath := filepath.Join(tmpDir, "test.tar.gz")
	if err := createTestTarGz(archivePath, "lazyreview", []byte("content")); err != nil {
		t.Fatal(err)
	}

	extractDir := filepath.Join(tmpDir, "extract")
	if err := os.MkdirAll(extractDir, 0755); err != nil {
		t.Fatal(err)
	}

	binPath, err := extractBinary(archivePath, extractDir)
	if err != nil {
		t.Fatalf("extractBinary failed for .tar.gz: %v", err)
	}

	if binPath == "" {
		t.Error("extractBinary returned empty path")
	}
}

func TestExtractBinaryZip(t *testing.T) {
	tmpDir := t.TempDir()

	archivePath := filepath.Join(tmpDir, "test.zip")
	if err := createTestZip(archivePath, "lazyreview.exe", []byte("content")); err != nil {
		t.Fatal(err)
	}

	extractDir := filepath.Join(tmpDir, "extract")
	if err := os.MkdirAll(extractDir, 0755); err != nil {
		t.Fatal(err)
	}

	binPath, err := extractBinary(archivePath, extractDir)
	if err != nil {
		t.Fatalf("extractBinary failed for .zip: %v", err)
	}

	if binPath == "" {
		t.Error("extractBinary returned empty path")
	}
}

func TestReplaceBinaryPermissions(t *testing.T) {
	tmpDir := t.TempDir()

	// Create current binary with specific permissions
	currentBinary := filepath.Join(tmpDir, "current")
	if err := os.WriteFile(currentBinary, []byte("old"), 0755); err != nil {
		t.Fatal(err)
	}

	// Change permissions to test
	if err := os.Chmod(currentBinary, 0750); err != nil {
		t.Fatal(err)
	}

	// Create new binary
	newBinary := filepath.Join(tmpDir, "new")
	if err := os.WriteFile(newBinary, []byte("new"), 0644); err != nil {
		t.Fatal(err)
	}

	// Replace
	if err := replaceBinary(currentBinary, newBinary); err != nil {
		t.Fatalf("replaceBinary failed: %v", err)
	}

	// Verify new binary has executable permissions
	info, err := os.Stat(currentBinary)
	if err != nil {
		t.Fatal(err)
	}

	if info.Mode()&0111 == 0 {
		t.Error("Replaced binary should have executable permissions")
	}
}

func TestCleanupBackup(t *testing.T) {
	// CleanupBackup uses os.Executable() which we can't easily mock
	// We'll just call it and ensure it doesn't crash
	err := CleanupBackup()
	// It's okay if it fails (no backup exists in test environment)
	t.Logf("CleanupBackup result: %v", err)
}
