package errors

// ErrorCode represents a unique error identifier in LR-xxx format
type ErrorCode string

// Authentication errors (LR-1xx)
const (
	ErrCodeAuthRequired          ErrorCode = "LR-101"
	ErrCodeAuthTokenExpired      ErrorCode = "LR-102"
	ErrCodeAuthInsufficientPerms ErrorCode = "LR-103"
	ErrCodeAuthSAMLRequired      ErrorCode = "LR-104"
)

// API errors (LR-2xx)
const (
	ErrCodeAPIRateLimit       ErrorCode = "LR-201"
	ErrCodeAPINetwork         ErrorCode = "LR-202"
	ErrCodeAPIInvalidResponse ErrorCode = "LR-203"
	ErrCodeAPINotFound        ErrorCode = "LR-204"
)

// Configuration errors (LR-3xx)
const (
	ErrCodeConfigInvalid          ErrorCode = "LR-301"
	ErrCodeConfigMissing          ErrorCode = "LR-302"
	ErrCodeConfigProviderNotFound ErrorCode = "LR-303"
)

// AI provider errors (LR-4xx)
const (
	ErrCodeAIProviderError ErrorCode = "LR-401"
	ErrCodeAITokenMissing  ErrorCode = "LR-402"
	ErrCodeAIRateLimit     ErrorCode = "LR-403"
)

// Internal errors (LR-5xx)
const (
	ErrCodeInternalUnexpected ErrorCode = "LR-501"
	ErrCodeInternalStorage    ErrorCode = "LR-502"
)
