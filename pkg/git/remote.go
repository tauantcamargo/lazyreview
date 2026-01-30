package git

import (
	"fmt"
	"regexp"
	"strings"
)

// ParseRemoteURL parses a Git remote URL and extracts provider information
// Supports SSH, HTTPS, and Git protocol URLs for:
// - GitHub (github.com)
// - GitLab (gitlab.com or self-hosted)
// - Bitbucket (bitbucket.org)
// - Azure DevOps (dev.azure.com)
func ParseRemoteURL(rawURL string) (*Remote, error) {
	if rawURL == "" {
		return nil, fmt.Errorf("empty remote URL")
	}

	remote := &Remote{
		URL: rawURL,
	}

	// Try Azure DevOps format first (more specific patterns)
	if parsed := parseAzureDevOpsURL(rawURL); parsed != nil {
		remote.Host = parsed.Host
		remote.Owner = parsed.Owner
		remote.Repo = parsed.Repo
		remote.Provider = "azuredevops"
		return remote, nil
	}

	// Try HTTPS format: https://host/owner/repo.git
	if parsed := parseHTTPSURL(rawURL); parsed != nil {
		remote.Host = parsed.Host
		remote.Owner = parsed.Owner
		remote.Repo = parsed.Repo
		remote.Provider = DetectProvider(parsed.Host)
		return remote, nil
	}

	// Try SSH format: git@host:owner/repo.git
	if parsed := parseSSHURL(rawURL); parsed != nil {
		remote.Host = parsed.Host
		remote.Owner = parsed.Owner
		remote.Repo = parsed.Repo
		remote.Provider = DetectProvider(parsed.Host)
		return remote, nil
	}

	return nil, fmt.Errorf("unsupported remote URL format: %s", rawURL)
}

// parseSSHURL parses SSH-style Git URLs
// Format: git@github.com:owner/repo.git
// Format: git@gitlab.com:group/subgroup/repo.git
func parseSSHURL(url string) *Remote {
	// Skip if it looks like HTTPS
	if strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") {
		return nil
	}

	// SSH format: git@host:path/to/repo.git or user@host:path/to/repo.git
	sshPattern := regexp.MustCompile(`^(?:[^@]+@)?([^:]+):(.+)$`)
	matches := sshPattern.FindStringSubmatch(url)

	if len(matches) != 3 {
		return nil
	}

	host := matches[1]
	path := strings.TrimSuffix(matches[2], ".git")

	// Split path into owner/repo
	// Handle GitLab subgroups: group/subgroup/repo -> group/subgroup + repo
	parts := strings.Split(path, "/")
	if len(parts) < 2 {
		return nil
	}

	repo := parts[len(parts)-1]
	owner := strings.Join(parts[:len(parts)-1], "/")

	return &Remote{
		Host:  host,
		Owner: owner,
		Repo:  repo,
	}
}

// parseHTTPSURL parses HTTPS Git URLs
// Format: https://github.com/owner/repo.git
// Format: https://gitlab.com/group/subgroup/repo.git
func parseHTTPSURL(url string) *Remote {
	// HTTPS format: https://host/path/to/repo.git
	httpsPattern := regexp.MustCompile(`^https?://([^/]+)/(.+)$`)
	matches := httpsPattern.FindStringSubmatch(url)

	if len(matches) != 3 {
		return nil
	}

	host := matches[1]
	path := strings.TrimSuffix(matches[2], ".git")

	// Split path into owner/repo
	parts := strings.Split(path, "/")
	if len(parts) < 2 {
		return nil
	}

	repo := parts[len(parts)-1]
	owner := strings.Join(parts[:len(parts)-1], "/")

	return &Remote{
		Host:  host,
		Owner: owner,
		Repo:  repo,
	}
}

// parseAzureDevOpsURL parses Azure DevOps URLs
// Format: https://dev.azure.com/organization/project/_git/repo
// Format: git@ssh.dev.azure.com:v3/organization/project/repo
func parseAzureDevOpsURL(url string) *Remote {
	// HTTPS format
	azureHTTPSPattern := regexp.MustCompile(`^https://dev\.azure\.com/([^/]+)/([^/]+)/_git/(.+?)(?:\.git)?$`)
	matches := azureHTTPSPattern.FindStringSubmatch(url)

	if len(matches) == 4 {
		org := matches[1]
		project := matches[2]
		repo := matches[3]

		return &Remote{
			Host:  "dev.azure.com",
			Owner: org + "/" + project,
			Repo:  repo,
		}
	}

	// SSH format
	azureSSHPattern := regexp.MustCompile(`^(?:git@)?ssh\.dev\.azure\.com:v3/([^/]+)/([^/]+)/(.+?)(?:\.git)?$`)
	matches = azureSSHPattern.FindStringSubmatch(url)

	if len(matches) == 4 {
		org := matches[1]
		project := matches[2]
		repo := strings.TrimSuffix(matches[3], ".git")

		return &Remote{
			Host:  "dev.azure.com",
			Owner: org + "/" + project,
			Repo:  repo,
		}
	}

	return nil
}

// DetectProvider returns the provider type based on the host
func DetectProvider(host string) string {
	host = strings.ToLower(host)

	switch {
	case strings.Contains(host, "github"):
		return "github"
	case strings.Contains(host, "gitlab"):
		return "gitlab"
	case strings.Contains(host, "bitbucket"):
		return "bitbucket"
	case strings.Contains(host, "azure"):
		return "azuredevops"
	default:
		// Check common self-hosted patterns
		if strings.HasPrefix(host, "git.") {
			return "gitlab" // Common GitLab pattern
		}
		return "unknown"
	}
}

// GetOwnerRepo splits owner and repo from a path
// Handles nested groups like "group/subgroup/repo"
func GetOwnerRepo(path string) (owner, repo string) {
	parts := strings.Split(strings.TrimSuffix(path, ".git"), "/")
	if len(parts) < 2 {
		return "", ""
	}

	repo = parts[len(parts)-1]
	owner = strings.Join(parts[:len(parts)-1], "/")

	return owner, repo
}

// IsValidRemote checks if a remote has all required fields
func (r *Remote) IsValid() bool {
	return r.Host != "" && r.Owner != "" && r.Repo != "" && r.Provider != "unknown"
}

// String returns a human-readable representation of the remote
func (r *Remote) String() string {
	if r.Name != "" {
		return fmt.Sprintf("%s (%s/%s on %s)", r.Name, r.Owner, r.Repo, r.Provider)
	}
	return fmt.Sprintf("%s/%s on %s", r.Owner, r.Repo, r.Provider)
}

// FullName returns the owner/repo full name
func (r *Remote) FullName() string {
	return fmt.Sprintf("%s/%s", r.Owner, r.Repo)
}
