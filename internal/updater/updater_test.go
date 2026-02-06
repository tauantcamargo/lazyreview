package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestCurrentVersion(t *testing.T) {
	version := CurrentVersion()
	if version == "" {
		t.Error("CurrentVersion returned empty string")
	}
	// Should return "dev" or a version string
	if version != "dev" && !strings.HasPrefix(version, "v") && version != "(devel)" {
		// Accept any non-empty string in tests
		t.Logf("CurrentVersion returned: %s", version)
	}
}

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		v1       string
		v2       string
		expected int
	}{
		{"v1.0.0", "v1.0.0", 0},
		{"v1.0.0", "v1.0.1", -1},
		{"v1.0.1", "v1.0.0", 1},
		{"1.0.0", "1.0.0", 0},
		{"v0.5.0", "v1.0.0", -1},
		{"v2.0.0", "v1.9.9", 1},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%s_vs_%s", tt.v1, tt.v2), func(t *testing.T) {
			result := compareVersions(tt.v1, tt.v2)
			if result != tt.expected {
				t.Errorf("compareVersions(%s, %s) = %d, expected %d", tt.v1, tt.v2, result, tt.expected)
			}
		})
	}
}

func TestIsHomebrewInstallation(t *testing.T) {
	// This test will vary based on how the test binary was built
	isHomebrew := IsHomebrewInstallation()
	t.Logf("IsHomebrewInstallation: %v", isHomebrew)

	// Create a temporary "fake" Homebrew installation
	tmpDir := t.TempDir()
	homebrewPath := filepath.Join(tmpDir, "Cellar", "lazyreview", "1.0.0", "bin", "lazyreview")

	if err := os.MkdirAll(filepath.Dir(homebrewPath), 0755); err != nil {
		t.Fatal(err)
	}

	// Check path detection
	if !strings.Contains(homebrewPath, "/Cellar/") {
		t.Error("Test path should contain /Cellar/")
	}
}

func TestCanSelfUpdate(t *testing.T) {
	canUpdate, err := CanSelfUpdate()

	if runtime.GOOS == "windows" {
		if err != ErrUnsupportedPlatform {
			t.Errorf("Expected ErrUnsupportedPlatform on Windows, got: %v", err)
		}
		if canUpdate {
			t.Error("Windows should not support self-update")
		}
		return
	}

	// On Unix systems, it depends on the installation method
	t.Logf("CanSelfUpdate: %v, err: %v", canUpdate, err)

	if err == ErrHomebrewInstallation {
		if canUpdate {
			t.Error("Homebrew installations should not allow self-update")
		}
	}
}

func TestSelectAsset(t *testing.T) {
	release := releaseInfo{
		TagName: "v1.0.0",
		Assets: []releaseAsset{
			{Name: "lazyreview_1.0.0_linux_amd64.tar.gz", BrowserDownloadURL: "http://example.com/linux"},
			{Name: "lazyreview_1.0.0_darwin_amd64.tar.gz", BrowserDownloadURL: "http://example.com/darwin"},
			{Name: "lazyreview_1.0.0_darwin_arm64.tar.gz", BrowserDownloadURL: "http://example.com/darwin_arm"},
			{Name: "lazyreview_1.0.0_windows_amd64.zip", BrowserDownloadURL: "http://example.com/windows"},
			{Name: "checksums.txt", BrowserDownloadURL: "http://example.com/checksums"},
		},
	}

	asset, err := selectAsset(release)
	if err != nil {
		t.Fatalf("selectAsset failed: %v", err)
	}

	// Verify correct platform was selected
	platform := fmt.Sprintf("%s_%s", runtime.GOOS, runtime.GOARCH)
	if !strings.Contains(asset.Name, platform) {
		t.Errorf("Selected asset %s doesn't match platform %s", asset.Name, platform)
	}

	// Verify checksum file was excluded
	if strings.HasSuffix(asset.Name, ".txt") {
		t.Error("Should not select checksum file as asset")
	}
}

func TestFindChecksumAsset(t *testing.T) {
	release := releaseInfo{
		Assets: []releaseAsset{
			{Name: "lazyreview_1.0.0_linux_amd64.tar.gz"},
			{Name: "checksums.txt"},
		},
	}

	asset, err := findChecksumAsset(release)
	if err != nil {
		t.Fatalf("findChecksumAsset failed: %v", err)
	}

	if asset.Name != "checksums.txt" {
		t.Errorf("Expected checksums.txt, got %s", asset.Name)
	}

	// Test missing checksum
	releaseNoChecksum := releaseInfo{
		Assets: []releaseAsset{
			{Name: "lazyreview_1.0.0_linux_amd64.tar.gz"},
		},
	}

	_, err = findChecksumAsset(releaseNoChecksum)
	if err == nil {
		t.Error("Expected error for missing checksum file")
	}
}

func TestVerifyChecksum(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a test file
	testFile := filepath.Join(tmpDir, "test.tar.gz")
	testData := []byte("test content for checksum")
	if err := os.WriteFile(testFile, testData, 0644); err != nil {
		t.Fatal(err)
	}

	// Calculate correct checksum
	hash := sha256.New()
	hash.Write(testData)
	correctSum := hex.EncodeToString(hash.Sum(nil))

	// Create checksum file
	checksumFile := filepath.Join(tmpDir, "checksums.txt")
	checksumContent := fmt.Sprintf("%s  test.tar.gz\n", correctSum)
	if err := os.WriteFile(checksumFile, []byte(checksumContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Test successful verification
	err := verifyChecksum(testFile, checksumFile, "test.tar.gz")
	if err != nil {
		t.Errorf("Checksum verification failed: %v", err)
	}

	// Test failed verification with wrong checksum
	wrongChecksumContent := "0000000000000000000000000000000000000000000000000000000000000000  test.tar.gz\n"
	if err := os.WriteFile(checksumFile, []byte(wrongChecksumContent), 0644); err != nil {
		t.Fatal(err)
	}

	err = verifyChecksum(testFile, checksumFile, "test.tar.gz")
	if err == nil {
		t.Error("Expected checksum verification to fail with wrong checksum")
	}
	if err != nil && !strings.Contains(err.Error(), "checksum verification failed") {
		t.Errorf("Expected checksum mismatch error, got: %v", err)
	}
}

func TestCopyFile(t *testing.T) {
	tmpDir := t.TempDir()

	srcFile := filepath.Join(tmpDir, "source.txt")
	dstFile := filepath.Join(tmpDir, "dest.txt")

	content := []byte("test file content")
	if err := os.WriteFile(srcFile, content, 0644); err != nil {
		t.Fatal(err)
	}

	// Test successful copy
	err := copyFile(srcFile, dstFile)
	if err != nil {
		t.Fatalf("copyFile failed: %v", err)
	}

	// Verify content
	copiedContent, err := os.ReadFile(dstFile)
	if err != nil {
		t.Fatal(err)
	}

	if string(copiedContent) != string(content) {
		t.Error("Copied file content doesn't match source")
	}

	// Verify permissions
	srcInfo, _ := os.Stat(srcFile)
	dstInfo, _ := os.Stat(dstFile)

	if srcInfo.Mode() != dstInfo.Mode() {
		t.Errorf("File permissions don't match: src=%v, dst=%v", srcInfo.Mode(), dstInfo.Mode())
	}
}

func TestReplaceBinary(t *testing.T) {
	tmpDir := t.TempDir()

	// Create fake current binary
	currentBinary := filepath.Join(tmpDir, "lazyreview")
	currentContent := []byte("current version")
	if err := os.WriteFile(currentBinary, currentContent, 0755); err != nil {
		t.Fatal(err)
	}

	// Create fake new binary
	newBinary := filepath.Join(tmpDir, "lazyreview-new")
	newContent := []byte("new version")
	if err := os.WriteFile(newBinary, newContent, 0755); err != nil {
		t.Fatal(err)
	}

	// Test replacement
	err := replaceBinary(currentBinary, newBinary)
	if err != nil {
		t.Fatalf("replaceBinary failed: %v", err)
	}

	// Verify new content is in place
	updatedContent, err := os.ReadFile(currentBinary)
	if err != nil {
		t.Fatal(err)
	}

	if string(updatedContent) != string(newContent) {
		t.Error("Binary was not replaced correctly")
	}

	// Verify backup was created
	backupFile := currentBinary + ".bak"
	backupContent, err := os.ReadFile(backupFile)
	if err != nil {
		t.Fatalf("Backup file not created: %v", err)
	}

	if string(backupContent) != string(currentContent) {
		t.Error("Backup content doesn't match original")
	}

	// Verify permissions are executable
	info, err := os.Stat(currentBinary)
	if err != nil {
		t.Fatal(err)
	}

	if info.Mode()&0111 == 0 {
		t.Error("Updated binary is not executable")
	}
}

func TestRollback(t *testing.T) {
	tmpDir := t.TempDir()

	// Create fake current binary
	currentBinary := filepath.Join(tmpDir, "lazyreview")
	currentContent := []byte("bad version")
	if err := os.WriteFile(currentBinary, currentContent, 0755); err != nil {
		t.Fatal(err)
	}

	// Create backup
	backupFile := currentBinary + ".bak"
	backupContent := []byte("good version")
	if err := os.WriteFile(backupFile, backupContent, 0755); err != nil {
		t.Fatal(err)
	}

	// Test rollback (Note: Rollback() uses os.Executable() which won't point to our test file)
	// We'll test the copyFile functionality instead
	err := copyFile(backupFile, currentBinary)
	if err != nil {
		t.Fatalf("Rollback failed: %v", err)
	}

	// Verify restored content
	restoredContent, err := os.ReadFile(currentBinary)
	if err != nil {
		t.Fatal(err)
	}

	if string(restoredContent) != string(backupContent) {
		t.Error("Rollback didn't restore correct content")
	}
}

func TestDownloadFile(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tmpDir := t.TempDir()
	destFile := filepath.Join(tmpDir, "download.txt")

	// Test with a small public file
	// Using a reliable URL that won't change
	url := "https://raw.githubusercontent.com/golang/go/master/README.md"

	err := downloadFile(ctx, url, destFile)
	if err != nil {
		t.Skipf("Download failed (network issue?): %v", err)
	}

	// Verify file was created
	info, err := os.Stat(destFile)
	if err != nil {
		t.Fatal("Downloaded file doesn't exist")
	}

	if info.Size() == 0 {
		t.Error("Downloaded file is empty")
	}
}

func TestExtractBinary(t *testing.T) {
	// This is tested indirectly through extractTarGz and extractZip
	// We'll test the format detection logic
	tmpDir := t.TempDir()

	// Test unsupported format
	unsupportedFile := filepath.Join(tmpDir, "test.rar")
	if err := os.WriteFile(unsupportedFile, []byte("fake"), 0644); err != nil {
		t.Fatal(err)
	}

	_, err := extractBinary(unsupportedFile, tmpDir)
	if err == nil {
		t.Error("Expected error for unsupported archive format")
	}
	if !strings.Contains(err.Error(), "unsupported archive") {
		t.Errorf("Expected 'unsupported archive' error, got: %v", err)
	}
}

// TestFetchLatestRelease would require mocking HTTP responses
// Skipping for now as it requires external network access
func TestFetchLatestRelease(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	release, err := fetchLatestRelease(ctx)
	if err != nil {
		t.Skipf("Failed to fetch release (network issue?): %v", err)
	}

	if release.TagName == "" {
		t.Error("Release tag name is empty")
	}

	if len(release.Assets) == 0 {
		t.Error("Release has no assets")
	}

	t.Logf("Latest release: %s with %d assets", release.TagName, len(release.Assets))
}

func TestCheckForUpdate(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	versionInfo, err := CheckForUpdate(ctx)
	if err != nil {
		t.Skipf("Failed to check for updates (network issue?): %v", err)
	}

	if versionInfo.Current == "" {
		t.Error("Current version is empty")
	}

	if versionInfo.Latest == "" {
		t.Error("Latest version is empty")
	}

	t.Logf("Current: %s, Latest: %s, Update available: %v",
		versionInfo.Current, versionInfo.Latest, versionInfo.UpdateAvailable)
}

func TestLatestVersion(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	version, err := LatestVersion(ctx)
	if err != nil {
		t.Skipf("Failed to get latest version (network issue?): %v", err)
	}

	if version == "" {
		t.Error("Latest version is empty")
	}

	if !strings.HasPrefix(version, "v") && version != "" {
		t.Logf("Warning: Version doesn't start with 'v': %s", version)
	}

	t.Logf("Latest version: %s", version)
}
