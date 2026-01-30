package keyring

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/99designs/keyring"
	"golang.org/x/term"
)

const (
	// ServiceName is the keyring service name
	ServiceName = "lazyreview"
)

// Store provides secure credential storage
type Store struct {
	ring keyring.Keyring
}

// Config holds configuration for the keyring store
type Config struct {
	// ServiceName is the name of the service in the keyring
	ServiceName string

	// AllowedBackends limits which backends can be used
	AllowedBackends []keyring.BackendType

	// FileDir is the directory for file-based fallback
	FileDir string

	// FilePasswordFunc prompts for password when using file backend
	FilePasswordFunc func(string) (string, error)
}

// DefaultConfig returns the default keyring configuration
func DefaultConfig() Config {
	homeDir, _ := os.UserHomeDir()
	fileDir := filepath.Join(homeDir, ".config", "lazyreview", "credentials")

	return Config{
		ServiceName: ServiceName,
		AllowedBackends: []keyring.BackendType{
			keyring.KeychainBackend,      // macOS
			keyring.WinCredBackend,       // Windows
			keyring.SecretServiceBackend, // Linux (GNOME Keyring, KWallet)
			keyring.KWalletBackend,       // Linux KDE
			keyring.FileBackend,          // Fallback
		},
		FileDir: fileDir,
		FilePasswordFunc: func(prompt string) (string, error) {
			// First check environment variable
			if pass := os.Getenv("LAZYREVIEW_KEYRING_PASS"); pass != "" {
				return pass, nil
			}

			// Prompt interactively if we have a terminal
			fd := int(os.Stdin.Fd())
			if !term.IsTerminal(fd) {
				return "", fmt.Errorf("LAZYREVIEW_KEYRING_PASS environment variable not set (needed for non-interactive credential storage)")
			}

			fmt.Println("\nCredentials will be stored in an encrypted file.")
			fmt.Println("Tip: Set LAZYREVIEW_KEYRING_PASS env var to skip this prompt.")
			fmt.Print("\nEnter encryption password: ")
			password, err := term.ReadPassword(fd)
			fmt.Println()
			if err != nil {
				return "", fmt.Errorf("failed to read password: %w", err)
			}

			if len(password) == 0 {
				return "", fmt.Errorf("password cannot be empty")
			}

			return string(password), nil
		},
	}
}

// NewStore creates a new credential store
func NewStore(cfg Config) (*Store, error) {
	if cfg.ServiceName == "" {
		cfg.ServiceName = ServiceName
	}

	ring, err := keyring.Open(keyring.Config{
		ServiceName:              cfg.ServiceName,
		AllowedBackends:          cfg.AllowedBackends,
		FileDir:                  cfg.FileDir,
		FilePasswordFunc:         cfg.FilePasswordFunc,
		KeychainTrustApplication: true,
		KeychainSynchronizable:   false,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open keyring: %w", err)
	}

	return &Store{ring: ring}, nil
}

// NewDefaultStore creates a store with default configuration
func NewDefaultStore() (*Store, error) {
	return NewStore(DefaultConfig())
}

// Set stores a credential
func (s *Store) Set(key, value string) error {
	return s.ring.Set(keyring.Item{
		Key:  key,
		Data: []byte(value),
	})
}

// Get retrieves a credential
func (s *Store) Get(key string) (string, error) {
	item, err := s.ring.Get(key)
	if err != nil {
		if err == keyring.ErrKeyNotFound {
			return "", ErrNotFound
		}
		return "", fmt.Errorf("failed to get credential: %w", err)
	}
	return string(item.Data), nil
}

// Delete removes a credential
func (s *Store) Delete(key string) error {
	err := s.ring.Remove(key)
	if err != nil {
		if err == keyring.ErrKeyNotFound {
			return ErrNotFound
		}
		return fmt.Errorf("failed to delete credential: %w", err)
	}
	return nil
}

// Keys returns all stored keys
func (s *Store) Keys() ([]string, error) {
	return s.ring.Keys()
}

// TokenKey generates a key for storing a provider token
func TokenKey(providerType, host string) string {
	return fmt.Sprintf("%s:%s:token", providerType, host)
}

// Errors
var (
	ErrNotFound = fmt.Errorf("credential not found")
)
