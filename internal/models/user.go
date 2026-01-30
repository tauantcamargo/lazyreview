package models

// User represents a user across all providers
type User struct {
	// ID is the provider-specific identifier
	ID string

	// Login is the username/handle
	Login string

	// Name is the display name
	Name string

	// Email is the user's email
	Email string

	// AvatarURL is the URL to the user's avatar
	AvatarURL string

	// URL is the web URL to the user's profile
	URL string
}

// IsEmpty returns true if the user is empty/unset
func (u *User) IsEmpty() bool {
	return u.ID == "" && u.Login == ""
}

// DisplayName returns the best name to display
func (u *User) DisplayName() string {
	if u.Name != "" {
		return u.Name
	}
	return u.Login
}
