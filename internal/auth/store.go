package auth

import (
	"encoding/json"
	"fmt"
	"time"

	"lazyreview/internal/config"
	"lazyreview/pkg/keyring"
)

// Credential represents stored authentication credentials
type Credential struct {
	// ProviderType is the type of provider (github, gitlab, etc.)
	ProviderType config.ProviderType `json:"provider_type"`

	// Host is the provider host
	Host string `json:"host"`

	// Token is the authentication token
	Token string `json:"token"`

	// Username is the authenticated username (optional, cached)
	Username string `json:"username,omitempty"`

	// CreatedAt is when the credential was stored
	CreatedAt time.Time `json:"created_at"`

	// ValidatedAt is when the token was last validated
	ValidatedAt time.Time `json:"validated_at,omitempty"`
}

// CredentialStore manages authentication credentials
type CredentialStore struct {
	keyring *keyring.Store
}

// NewCredentialStore creates a new credential store
func NewCredentialStore() (*CredentialStore, error) {
	kr, err := keyring.NewDefaultStore()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize keyring: %w", err)
	}

	return &CredentialStore{keyring: kr}, nil
}

// Save stores a credential
func (s *CredentialStore) Save(cred Credential) error {
	if cred.CreatedAt.IsZero() {
		cred.CreatedAt = time.Now()
	}

	data, err := json.Marshal(cred)
	if err != nil {
		return fmt.Errorf("failed to marshal credential: %w", err)
	}

	key := s.credentialKey(cred.ProviderType, cred.Host)
	if err := s.keyring.Set(key, string(data)); err != nil {
		return fmt.Errorf("failed to store credential: %w", err)
	}

	return nil
}

// Get retrieves a credential
func (s *CredentialStore) Get(providerType config.ProviderType, host string) (*Credential, error) {
	key := s.credentialKey(providerType, host)
	data, err := s.keyring.Get(key)
	if err != nil {
		if err == keyring.ErrNotFound {
			return nil, ErrCredentialNotFound
		}
		return nil, fmt.Errorf("failed to retrieve credential: %w", err)
	}

	var cred Credential
	if err := json.Unmarshal([]byte(data), &cred); err != nil {
		return nil, fmt.Errorf("failed to parse credential: %w", err)
	}

	return &cred, nil
}

// Delete removes a credential
func (s *CredentialStore) Delete(providerType config.ProviderType, host string) error {
	key := s.credentialKey(providerType, host)
	if err := s.keyring.Delete(key); err != nil {
		if err == keyring.ErrNotFound {
			return ErrCredentialNotFound
		}
		return fmt.Errorf("failed to delete credential: %w", err)
	}
	return nil
}

// List returns all stored credentials
func (s *CredentialStore) List() ([]Credential, error) {
	keys, err := s.keyring.Keys()
	if err != nil {
		return nil, fmt.Errorf("failed to list credentials: %w", err)
	}

	var creds []Credential
	for _, key := range keys {
		data, err := s.keyring.Get(key)
		if err != nil {
			continue // Skip invalid entries
		}

		var cred Credential
		if err := json.Unmarshal([]byte(data), &cred); err != nil {
			continue // Skip invalid entries
		}

		creds = append(creds, cred)
	}

	return creds, nil
}

// DeleteAll removes all stored credentials
func (s *CredentialStore) DeleteAll() error {
	keys, err := s.keyring.Keys()
	if err != nil {
		return fmt.Errorf("failed to list credentials: %w", err)
	}

	var lastErr error
	for _, key := range keys {
		if err := s.keyring.Delete(key); err != nil && err != keyring.ErrNotFound {
			lastErr = err
		}
	}

	return lastErr
}

// UpdateValidation updates the validation timestamp for a credential
func (s *CredentialStore) UpdateValidation(providerType config.ProviderType, host string) error {
	cred, err := s.Get(providerType, host)
	if err != nil {
		return err
	}

	cred.ValidatedAt = time.Now()
	return s.Save(*cred)
}

// credentialKey generates a key for storing a credential
func (s *CredentialStore) credentialKey(providerType config.ProviderType, host string) string {
	return fmt.Sprintf("cred:%s:%s", providerType, host)
}

// Errors
var (
	ErrCredentialNotFound = fmt.Errorf("credential not found")
)
