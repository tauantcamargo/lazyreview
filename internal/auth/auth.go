package auth

import (
	"context"
	"fmt"
	"time"

	"lazyreview/internal/config"
)

// TokenValidator validates tokens against a provider
type TokenValidator interface {
	ValidateToken(ctx context.Context, token string) (username string, err error)
}

// Service handles authentication operations
type Service struct {
	store      *CredentialStore
	validators map[config.ProviderType]TokenValidator
}

// NewService creates a new auth service
func NewService() (*Service, error) {
	store, err := NewCredentialStore()
	if err != nil {
		return nil, err
	}

	return &Service{
		store:      store,
		validators: make(map[config.ProviderType]TokenValidator),
	}, nil
}

// RegisterValidator registers a token validator for a provider type
func (s *Service) RegisterValidator(providerType config.ProviderType, validator TokenValidator) {
	s.validators[providerType] = validator
}

// Login authenticates with a provider and stores the credential
func (s *Service) Login(ctx context.Context, providerType config.ProviderType, host, token string) (*Credential, error) {
	// Validate token if we have a validator
	var username string
	if validator, ok := s.validators[providerType]; ok {
		var err error
		username, err = validator.ValidateToken(ctx, token)
		if err != nil {
			return nil, fmt.Errorf("token validation failed: %w", err)
		}
	}

	// Store credential
	cred := Credential{
		ProviderType: providerType,
		Host:         host,
		Token:        token,
		Username:     username,
		CreatedAt:    time.Now(),
		ValidatedAt:  time.Now(),
	}

	if err := s.store.Save(cred); err != nil {
		return nil, fmt.Errorf("failed to save credential: %w", err)
	}

	return &cred, nil
}

// Logout removes a credential
func (s *Service) Logout(providerType config.ProviderType, host string) error {
	return s.store.Delete(providerType, host)
}

// LogoutAll removes all credentials
func (s *Service) LogoutAll() error {
	return s.store.DeleteAll()
}

// GetCredential retrieves a stored credential
func (s *Service) GetCredential(providerType config.ProviderType, host string) (*Credential, error) {
	return s.store.Get(providerType, host)
}

// GetToken retrieves just the token for a provider
func (s *Service) GetToken(providerType config.ProviderType, host string) (string, error) {
	cred, err := s.store.Get(providerType, host)
	if err != nil {
		return "", err
	}
	return cred.Token, nil
}

// ListCredentials returns all stored credentials
func (s *Service) ListCredentials() ([]Credential, error) {
	return s.store.List()
}

// IsAuthenticated checks if a credential exists for a provider
func (s *Service) IsAuthenticated(providerType config.ProviderType, host string) bool {
	_, err := s.store.Get(providerType, host)
	return err == nil
}

// Status represents the authentication status for a provider
type Status struct {
	ProviderType  config.ProviderType
	Host          string
	Authenticated bool
	Username      string
	ValidatedAt   time.Time
	CreatedAt     time.Time
}

// GetStatus returns the authentication status for a provider
func (s *Service) GetStatus(providerType config.ProviderType, host string) Status {
	cred, err := s.store.Get(providerType, host)
	if err != nil {
		return Status{
			ProviderType:  providerType,
			Host:          host,
			Authenticated: false,
		}
	}

	return Status{
		ProviderType:  providerType,
		Host:          host,
		Authenticated: true,
		Username:      cred.Username,
		ValidatedAt:   cred.ValidatedAt,
		CreatedAt:     cred.CreatedAt,
	}
}

// GetAllStatus returns authentication status for all stored credentials
func (s *Service) GetAllStatus() ([]Status, error) {
	creds, err := s.store.List()
	if err != nil {
		return nil, err
	}

	statuses := make([]Status, len(creds))
	for i, cred := range creds {
		statuses[i] = Status{
			ProviderType:  cred.ProviderType,
			Host:          cred.Host,
			Authenticated: true,
			Username:      cred.Username,
			ValidatedAt:   cred.ValidatedAt,
			CreatedAt:     cred.CreatedAt,
		}
	}

	return statuses, nil
}

// RefreshValidation re-validates a token and updates the timestamp
func (s *Service) RefreshValidation(ctx context.Context, providerType config.ProviderType, host string) error {
	cred, err := s.store.Get(providerType, host)
	if err != nil {
		return err
	}

	// Validate if we have a validator
	if validator, ok := s.validators[providerType]; ok {
		username, err := validator.ValidateToken(ctx, cred.Token)
		if err != nil {
			return fmt.Errorf("token validation failed: %w", err)
		}
		cred.Username = username
	}

	cred.ValidatedAt = time.Now()
	return s.store.Save(*cred)
}
