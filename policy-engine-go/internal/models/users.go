package models

// User represents a user in the system
type User struct {
	ID         string   `json:"id" yaml:"id"`
	Email      string   `json:"email" yaml:"email"`
	Name       string   `json:"name" yaml:"name"`
	FirstName  string   `json:"first_name" yaml:"first_name"`
	LastName   string   `json:"last_name" yaml:"last_name"`
	Role       string   `json:"role" yaml:"role"`
	Department string   `json:"department" yaml:"department"`
	Title      string   `json:"title" yaml:"title"`
	Groups     []string `json:"groups" yaml:"groups"`
	Status     string   `json:"status" yaml:"status"` // active, inactive, pending
	MFAEnabled bool     `json:"mfa_enabled" yaml:"mfa_enabled"`
	CreatedAt  string   `json:"created_at" yaml:"created_at"`
	LastLogin  string   `json:"last_login,omitempty" yaml:"last_login,omitempty"`
}

// UserGroup represents a group of users
type UserGroup struct {
	ID          string `json:"id" yaml:"id"`
	Name        string `json:"name" yaml:"name"`
	Description string `json:"description" yaml:"description"`
	MemberCount int    `json:"member_count" yaml:"member_count"`
}

// UserRole represents a role that can be assigned to users
type UserRole struct {
	ID          string   `json:"id" yaml:"id"`
	Name        string   `json:"name" yaml:"name"`
	Description string   `json:"description" yaml:"description"`
	Permissions []string `json:"permissions" yaml:"permissions"`
}

// UsersData represents the complete users dataset
type UsersData struct {
	Users  []User      `json:"users" yaml:"users"`
	Groups []UserGroup `json:"groups" yaml:"groups"`
	Roles  []UserRole  `json:"roles" yaml:"roles"`
}

// UsersResponse is the API response for listing users
type UsersResponse struct {
	Users []User `json:"users"`
	Count int    `json:"count"`
}

// GroupsResponse is the API response for listing groups
type GroupsResponse struct {
	Groups []UserGroup `json:"groups"`
	Count  int         `json:"count"`
}

// RolesResponse is the API response for listing roles
type RolesResponse struct {
	Roles []UserRole `json:"roles"`
	Count int        `json:"count"`
}

// AllPrincipalsResponse is the API response for getting all principals (users, groups, roles)
type AllPrincipalsResponse struct {
	Users  []User      `json:"users"`
	Groups []UserGroup `json:"groups"`
	Roles  []UserRole  `json:"roles"`
}
