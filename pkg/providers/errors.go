package providers

import (
	"errors"
	"fmt"
)

// Common provider errors
var (
	// ErrNotAuthenticated indicates no valid authentication token
	ErrNotAuthenticated = errors.New("not authenticated")

	// ErrInvalidToken indicates the token is invalid or expired
	ErrInvalidToken = errors.New("invalid or expired token")

	// ErrNotFound indicates the requested resource was not found
	ErrNotFound = errors.New("resource not found")

	// ErrForbidden indicates insufficient permissions
	ErrForbidden = errors.New("forbidden: insufficient permissions")

	// ErrSAMLRequired indicates the organization requires SAML SSO authorization
	ErrSAMLRequired = errors.New("organization requires SAML SSO authorization")

	// ErrRateLimited indicates the API rate limit was exceeded
	ErrRateLimited = errors.New("rate limit exceeded")

	// ErrConflict indicates a conflict (e.g., merge conflict)
	ErrConflict = errors.New("conflict")

	// ErrNotMergeable indicates the PR cannot be merged
	ErrNotMergeable = errors.New("pull request is not mergeable")

	// ErrAlreadyMerged indicates the PR is already merged
	ErrAlreadyMerged = errors.New("pull request is already merged")

	// ErrBranchProtected indicates the branch is protected
	ErrBranchProtected = errors.New("branch is protected")

	// ErrReviewRequired indicates reviews are required before merge
	ErrReviewRequired = errors.New("reviews required before merge")

	// ErrChecksNotPassed indicates CI checks haven't passed
	ErrChecksNotPassed = errors.New("status checks have not passed")

	// ErrUnsupported indicates the operation is not supported by this provider
	ErrUnsupported = errors.New("operation not supported by this provider")
)

// ProviderError wraps an error with provider context
type ProviderError struct {
	Provider string
	Op       string
	Err      error
}

func (e *ProviderError) Error() string {
	return fmt.Sprintf("%s: %s: %v", e.Provider, e.Op, e.Err)
}

func (e *ProviderError) Unwrap() error {
	return e.Err
}

// NewProviderError creates a new provider error
func NewProviderError(provider, op string, err error) *ProviderError {
	return &ProviderError{
		Provider: provider,
		Op:       op,
		Err:      err,
	}
}

// APIError represents an API-level error from a provider
type APIError struct {
	StatusCode int
	Message    string
	Details    map[string]any
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("API error %d: %s", e.StatusCode, e.Message)
	}
	return fmt.Sprintf("API error %d", e.StatusCode)
}

// NewAPIError creates a new API error
func NewAPIError(statusCode int, message string) *APIError {
	return &APIError{
		StatusCode: statusCode,
		Message:    message,
	}
}

// RateLimitError contains rate limit information
type RateLimitError struct {
	Limit     int
	Remaining int
	ResetAt   int64 // Unix timestamp
	Message   string
}

func (e *RateLimitError) Error() string {
	return fmt.Sprintf("rate limit exceeded: %s (resets at %d)", e.Message, e.ResetAt)
}

// IsNotFound returns true if the error indicates a resource was not found
func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

// IsRateLimited returns true if the error indicates rate limiting
func IsRateLimited(err error) bool {
	if errors.Is(err, ErrRateLimited) {
		return true
	}
	var rateLimitErr *RateLimitError
	return errors.As(err, &rateLimitErr)
}

// IsForbidden returns true if the error indicates insufficient permissions
func IsForbidden(err error) bool {
	return errors.Is(err, ErrForbidden)
}

// IsAuthError returns true if the error is authentication-related
func IsAuthError(err error) bool {
	return errors.Is(err, ErrNotAuthenticated) || errors.Is(err, ErrInvalidToken)
}

// SAMLError contains information about SAML SSO requirement
type SAMLError struct {
	Organization string
	Message      string
}

func (e *SAMLError) Error() string {
	if e.Organization != "" {
		return fmt.Sprintf("organization '%s' requires SAML SSO: authorize your token at GitHub > Settings > Applications > Authorized OAuth Apps", e.Organization)
	}
	return "organization requires SAML SSO: authorize your token at GitHub > Settings > Applications > Authorized OAuth Apps"
}

func (e *SAMLError) Is(target error) bool {
	return target == ErrSAMLRequired
}

// NewSAMLError creates a new SAML error
func NewSAMLError(org, message string) *SAMLError {
	return &SAMLError{
		Organization: org,
		Message:      message,
	}
}

// IsSAMLError returns true if the error is a SAML SSO error
func IsSAMLError(err error) bool {
	if errors.Is(err, ErrSAMLRequired) {
		return true
	}
	var samlErr *SAMLError
	return errors.As(err, &samlErr)
}
