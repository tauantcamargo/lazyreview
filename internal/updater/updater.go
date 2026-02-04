package updater

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const (
	defaultRepo   = "tauantcamargo/lazyreview"
	defaultAPIURL = "https://api.github.com"
)

type releaseAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

type releaseInfo struct {
	TagName string         `json:"tag_name"`
	Assets  []releaseAsset `json:"assets"`
}

// UpdateResult describes the outcome of an update attempt.
type UpdateResult struct {
	Updated   bool
	Version   string
	AssetName string
}

// Update downloads and installs the latest release binary.
func Update(ctx context.Context) (UpdateResult, error) {
	if runtime.GOOS == "windows" {
		return UpdateResult{}, errors.New("auto-update not supported on Windows yet")
	}

	release, err := fetchLatestRelease(ctx)
	if err != nil {
		return UpdateResult{}, err
	}

	asset, err := selectAsset(release)
	if err != nil {
		return UpdateResult{}, err
	}

	tmpDir, err := os.MkdirTemp("", "lazyreview-update-*")
	if err != nil {
		return UpdateResult{}, fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	archivePath := filepath.Join(tmpDir, asset.Name)
	if err := downloadFile(ctx, asset.BrowserDownloadURL, archivePath); err != nil {
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

	if err := replaceBinary(exePath, binPath); err != nil {
		return UpdateResult{}, err
	}

	return UpdateResult{
		Updated:   true,
		Version:   release.TagName,
		AssetName: asset.Name,
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
		if strings.Contains(asset.Name, platform) && strings.HasSuffix(asset.Name, ".tar.gz") {
			return asset, nil
		}
		if runtime.GOOS == "windows" && strings.Contains(asset.Name, platform) && strings.HasSuffix(asset.Name, ".zip") {
			return asset, nil
		}
	}
	return releaseAsset{}, fmt.Errorf("no asset found for platform %s", platform)
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
	if err := os.Chmod(newBinaryPath, info.Mode()); err != nil {
		return fmt.Errorf("failed to set permissions: %w", err)
	}

	backupPath := targetPath + ".bak"
	_ = os.Remove(backupPath)

	if err := os.Rename(targetPath, backupPath); err != nil {
		return fmt.Errorf("failed to backup binary: %w", err)
	}
	if err := os.Rename(newBinaryPath, targetPath); err != nil {
		_ = os.Rename(backupPath, targetPath)
		return fmt.Errorf("failed to install update: %w", err)
	}

	_ = os.Remove(backupPath)
	return nil
}
