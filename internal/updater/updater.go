package updater

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strings"
	"time"
)

const (
	defaultRepo   = "tauantcamargo/lazyreview"
	defaultAPIURL = "https://api.github.com"
)

var (
	// ErrHomebrewInstallation is returned when LazyReview was installed via Homebrew
	ErrHomebrewInstallation = errors.New("installed via Homebrew - use 'brew upgrade lazyreview' instead")

	// ErrAlreadyLatest is returned when the installed version is already the latest
	ErrAlreadyLatest = errors.New("already running the latest version")

	// ErrChecksumMismatch is returned when downloaded binary checksum doesn't match
	ErrChecksumMismatch = errors.New("checksum verification failed")

	// ErrUnsupportedPlatform is returned for platforms that don't support self-update
	ErrUnsupportedPlatform = errors.New("self-update not supported on this platform")
)

type releaseAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

type releaseInfo struct {
	TagName string         `json:"tag_name"`
	Assets  []releaseAsset `json:"assets"`
	Body    string         `json:"body"`
}

// UpdateResult describes the outcome of an update attempt.
type UpdateResult struct {
	Updated      bool
	Version      string
	AssetName    string
	ReleaseNotes string
}

// VersionInfo contains version and availability information
type VersionInfo struct {
	Current         string
	Latest          string
	UpdateAvailable bool
	ReleaseNotes    string
}

// CurrentVersion returns the build version when available.
func CurrentVersion() string {
	info, ok := debug.ReadBuildInfo()
	if !ok || info == nil {
		return "dev"
	}
	version := strings.TrimSpace(info.Main.Version)
	if version == "" || version == "(devel)" {
		return "dev"
	}
	return version
}

// LatestVersion returns the latest release tag.
func LatestVersion(ctx context.Context) (string, error) {
	release, err := fetchLatestRelease(ctx)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(release.TagName), nil
}

// CheckForUpdate checks if a new version is available
func CheckForUpdate(ctx context.Context) (*VersionInfo, error) {
	current := CurrentVersion()

	release, err := fetchLatestRelease(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to check for updates: %w", err)
	}

	latest := strings.TrimSpace(release.TagName)
	updateAvailable := false

	// Skip version comparison for dev builds
	if current != "dev" {
		updateAvailable = compareVersions(current, latest) < 0
	}

	return &VersionInfo{
		Current:         current,
		Latest:          latest,
		UpdateAvailable: updateAvailable,
		ReleaseNotes:    release.Body,
	}, nil
}

// compareVersions compares two semantic version strings
// Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
func compareVersions(v1, v2 string) int {
	// Remove 'v' prefix if present
	v1 = strings.TrimPrefix(v1, "v")
	v2 = strings.TrimPrefix(v2, "v")

	// Simple string comparison for now
	// In production, use github.com/hashicorp/go-version
	if v1 == v2 {
		return 0
	}
	if v1 < v2 {
		return -1
	}
	return 1
}

// IsHomebrewInstallation checks if the binary was installed via Homebrew
func IsHomebrewInstallation() bool {
	exePath, err := os.Executable()
	if err != nil {
		return false
	}

	// Resolve symlinks (Homebrew uses symlinks)
	realPath, err := filepath.EvalSymlinks(exePath)
	if err != nil {
		realPath = exePath
	}

	// Check if path contains Homebrew cellar or opt directories
	return strings.Contains(realPath, "/Cellar/") ||
		strings.Contains(realPath, "/opt/homebrew/") ||
		strings.Contains(realPath, "/usr/local/Cellar/")
}

// CanSelfUpdate checks if self-update is possible
func CanSelfUpdate() (bool, error) {
	if runtime.GOOS == "windows" {
		return false, ErrUnsupportedPlatform
	}

	if IsHomebrewInstallation() {
		return false, ErrHomebrewInstallation
	}

	exePath, err := os.Executable()
	if err != nil {
		return false, fmt.Errorf("failed to locate executable: %w", err)
	}

	// Check if we have write permission to the binary
	info, err := os.Stat(exePath)
	if err != nil {
		return false, fmt.Errorf("failed to stat executable: %w", err)
	}

	// Check if we can write to the parent directory
	parentDir := filepath.Dir(exePath)
	testFile := filepath.Join(parentDir, ".lazyreview-update-test")
	f, err := os.Create(testFile)
	if err != nil {
		return false, fmt.Errorf("no write permission to install directory: %w", err)
	}
	f.Close()
	os.Remove(testFile)

	_ = info // Use info if needed for future checks
	return true, nil
}

// Update downloads and installs the latest release binary.
func Update(ctx context.Context) (UpdateResult, error) {
	// Check if self-update is possible
	canUpdate, err := CanSelfUpdate()
	if err != nil {
		return UpdateResult{}, err
	}
	if !canUpdate {
		return UpdateResult{}, errors.New("self-update not available")
	}

	// Check for updates
	versionInfo, err := CheckForUpdate(ctx)
	if err != nil {
		return UpdateResult{}, err
	}

	// Already on latest version
	if !versionInfo.UpdateAvailable && versionInfo.Current != "dev" {
		return UpdateResult{
			Updated:      false,
			Version:      versionInfo.Current,
			ReleaseNotes: versionInfo.ReleaseNotes,
		}, ErrAlreadyLatest
	}

	release, err := fetchLatestRelease(ctx)
	if err != nil {
		return UpdateResult{}, err
	}

	asset, err := selectAsset(release)
	if err != nil {
		return UpdateResult{}, err
	}

	// Find checksum asset
	checksumAsset, err := findChecksumAsset(release)
	if err != nil {
		return UpdateResult{}, err
	}

	tmpDir, err := os.MkdirTemp("", "lazyreview-update-*")
	if err != nil {
		return UpdateResult{}, fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// Download archive
	archivePath := filepath.Join(tmpDir, asset.Name)
	if err := downloadFile(ctx, asset.BrowserDownloadURL, archivePath); err != nil {
		return UpdateResult{}, err
	}

	// Download and verify checksum
	checksumPath := filepath.Join(tmpDir, checksumAsset.Name)
	if err := downloadFile(ctx, checksumAsset.BrowserDownloadURL, checksumPath); err != nil {
		return UpdateResult{}, fmt.Errorf("failed to download checksum: %w", err)
	}

	if err := verifyChecksum(archivePath, checksumPath, asset.Name); err != nil {
		return UpdateResult{}, err
	}

	binPath, err := extractBinary(archivePath, tmpDir)
	if err != nil {
		return UpdateResult{}, err
	}

	exePath, err := os.Executable()
	if err != nil {
		return UpdateResult{}, fmt.Errorf("failed to locate executable: %w", err)
	}

	// Resolve symlinks to get actual binary path
	realPath, err := filepath.EvalSymlinks(exePath)
	if err != nil {
		realPath = exePath
	}

	if err := replaceBinary(realPath, binPath); err != nil {
		return UpdateResult{}, err
	}

	return UpdateResult{
		Updated:      true,
		Version:      release.TagName,
		AssetName:    asset.Name,
		ReleaseNotes: release.Body,
	}, nil
}

func fetchLatestRelease(ctx context.Context) (releaseInfo, error) {
	url := fmt.Sprintf("%s/repos/%s/releases/latest", defaultAPIURL, defaultRepo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return releaseInfo{}, fmt.Errorf("failed to create request: %w", err)
	}

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return releaseInfo{}, fmt.Errorf("failed to fetch release: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return releaseInfo{}, fmt.Errorf("failed to fetch release: %s", resp.Status)
	}

	var release releaseInfo
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return releaseInfo{}, fmt.Errorf("failed to decode release: %w", err)
	}
	if release.TagName == "" {
		return releaseInfo{}, errors.New("latest release missing tag")
	}

	return release, nil
}

func selectAsset(release releaseInfo) (releaseAsset, error) {
	platform := fmt.Sprintf("%s_%s", runtime.GOOS, runtime.GOARCH)
	for _, asset := range release.Assets {
		// Skip checksum files
		if strings.HasSuffix(asset.Name, ".txt") || strings.HasSuffix(asset.Name, ".sha256") {
			continue
		}
		if strings.Contains(asset.Name, platform) && strings.HasSuffix(asset.Name, ".tar.gz") {
			return asset, nil
		}
		if runtime.GOOS == "windows" && strings.Contains(asset.Name, platform) && strings.HasSuffix(asset.Name, ".zip") {
			return asset, nil
		}
	}
	return releaseAsset{}, fmt.Errorf("no asset found for platform %s", platform)
}

func findChecksumAsset(release releaseInfo) (releaseAsset, error) {
	// Look for checksums.txt or similar
	for _, asset := range release.Assets {
		name := strings.ToLower(asset.Name)
		if name == "checksums.txt" || name == "sha256sums.txt" || strings.Contains(name, "checksum") {
			return asset, nil
		}
	}
	return releaseAsset{}, errors.New("checksum file not found in release")
}

func verifyChecksum(filePath, checksumPath, assetName string) error {
	// Calculate SHA256 of downloaded file
	f, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open file for checksum: %w", err)
	}
	defer f.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, f); err != nil {
		return fmt.Errorf("failed to calculate checksum: %w", err)
	}
	calculatedSum := hex.EncodeToString(hash.Sum(nil))

	// Read expected checksum
	checksumData, err := os.ReadFile(checksumPath)
	if err != nil {
		return fmt.Errorf("failed to read checksum file: %w", err)
	}

	// Parse checksums.txt format (each line: "hash filename")
	lines := strings.Split(string(checksumData), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}

		expectedSum := parts[0]
		fileName := parts[1]

		if fileName == assetName {
			if calculatedSum != expectedSum {
				return fmt.Errorf("%w: expected %s, got %s", ErrChecksumMismatch, expectedSum, calculatedSum)
			}
			return nil
		}
	}

	return fmt.Errorf("checksum not found for %s", assetName)
}

func downloadFile(ctx context.Context, url, dest string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create download request: %w", err)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to download asset: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("failed to download asset: %s", resp.Status)
	}

	out, err := os.Create(dest)
	if err != nil {
		return fmt.Errorf("failed to create archive: %w", err)
	}
	defer out.Close()

	if _, err := io.Copy(out, resp.Body); err != nil {
		return fmt.Errorf("failed to write archive: %w", err)
	}

	return nil
}

func extractBinary(archivePath, destDir string) (string, error) {
	if strings.HasSuffix(archivePath, ".tar.gz") {
		return extractTarGz(archivePath, destDir)
	}
	if strings.HasSuffix(archivePath, ".zip") {
		return extractZip(archivePath, destDir)
	}
	return "", fmt.Errorf("unsupported archive: %s", archivePath)
}

func extractTarGz(path, destDir string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("failed to open archive: %w", err)
	}
	defer file.Close()

	gzReader, err := gzip.NewReader(file)
	if err != nil {
		return "", fmt.Errorf("failed to read gzip: %w", err)
	}
	defer gzReader.Close()

	tarReader := tar.NewReader(gzReader)
	for {
		header, err := tarReader.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return "", fmt.Errorf("failed to read tar: %w", err)
		}
		if header.Typeflag != tar.TypeReg {
			continue
		}
		if filepath.Base(header.Name) != "lazyreview" {
			continue
		}
		target := filepath.Join(destDir, "lazyreview")
		out, err := os.Create(target)
		if err != nil {
			return "", fmt.Errorf("failed to create binary: %w", err)
		}
		if _, err := io.Copy(out, tarReader); err != nil {
			out.Close()
			return "", fmt.Errorf("failed to extract binary: %w", err)
		}
		out.Close()
		return target, nil
	}

	return "", errors.New("binary not found in archive")
}

func extractZip(path, destDir string) (string, error) {
	reader, err := zip.OpenReader(path)
	if err != nil {
		return "", fmt.Errorf("failed to open zip: %w", err)
	}
	defer reader.Close()

	for _, file := range reader.File {
		if filepath.Base(file.Name) != "lazyreview.exe" {
			continue
		}
		rc, err := file.Open()
		if err != nil {
			return "", fmt.Errorf("failed to open zip entry: %w", err)
		}
		defer rc.Close()

		target := filepath.Join(destDir, "lazyreview.exe")
		out, err := os.Create(target)
		if err != nil {
			rc.Close()
			return "", fmt.Errorf("failed to create binary: %w", err)
		}
		if _, err := io.Copy(out, rc); err != nil {
			out.Close()
			rc.Close()
			return "", fmt.Errorf("failed to extract binary: %w", err)
		}
		out.Close()
		rc.Close()
		return target, nil
	}
	return "", errors.New("binary not found in zip")
}

func replaceBinary(targetPath, newBinaryPath string) error {
	info, err := os.Stat(targetPath)
	if err != nil {
		return fmt.Errorf("failed to stat target: %w", err)
	}

	// Set executable permissions on new binary
	if err := os.Chmod(newBinaryPath, info.Mode()|0111); err != nil {
		return fmt.Errorf("failed to set permissions: %w", err)
	}

	// Create backup
	backupPath := targetPath + ".bak"

	// Remove old backup if it exists
	if _, err := os.Stat(backupPath); err == nil {
		if err := os.Remove(backupPath); err != nil {
			return fmt.Errorf("failed to remove old backup: %w", err)
		}
	}

	// Backup current binary
	if err := copyFile(targetPath, backupPath); err != nil {
		return fmt.Errorf("failed to create backup: %w", err)
	}

	// Atomically replace binary
	// Use rename which is atomic on most filesystems
	if err := os.Rename(newBinaryPath, targetPath); err != nil {
		// Rollback on failure
		if rollbackErr := copyFile(backupPath, targetPath); rollbackErr != nil {
			return fmt.Errorf("failed to install update and rollback failed: %w (rollback: %v)", err, rollbackErr)
		}
		return fmt.Errorf("failed to install update (rolled back): %w", err)
	}

	// Keep backup for potential rollback
	// User can manually delete it or we can clean it up on next successful launch
	return nil
}

// Rollback restores the previous version from backup
func Rollback() error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to locate executable: %w", err)
	}

	// Resolve symlinks
	realPath, err := filepath.EvalSymlinks(exePath)
	if err != nil {
		realPath = exePath
	}

	backupPath := realPath + ".bak"

	// Check if backup exists
	if _, err := os.Stat(backupPath); os.IsNotExist(err) {
		return errors.New("no backup found to rollback to")
	}

	// Replace current binary with backup
	if err := copyFile(backupPath, realPath); err != nil {
		return fmt.Errorf("failed to restore from backup: %w", err)
	}

	return nil
}

// CleanupBackup removes the backup file
func CleanupBackup() error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to locate executable: %w", err)
	}

	realPath, err := filepath.EvalSymlinks(exePath)
	if err != nil {
		realPath = exePath
	}

	backupPath := realPath + ".bak"

	if _, err := os.Stat(backupPath); err == nil {
		return os.Remove(backupPath)
	}

	return nil
}

func copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	srcInfo, err := srcFile.Stat()
	if err != nil {
		return err
	}

	dstFile, err := os.OpenFile(dst, os.O_RDWR|os.O_CREATE|os.O_TRUNC, srcInfo.Mode())
	if err != nil {
		return err
	}
	defer dstFile.Close()

	if _, err := io.Copy(dstFile, srcFile); err != nil {
		return err
	}

	return dstFile.Sync()
}
