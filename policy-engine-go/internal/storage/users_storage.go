package storage

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/datacline/policy-engine/internal/models"
	log "github.com/sirupsen/logrus"
)

// UsersStorage handles loading and querying users data
type UsersStorage struct {
	dataDir string
	data    *models.UsersData
	mu      sync.RWMutex
}

// NewUsersStorage creates a new users storage instance
func NewUsersStorage(dataDir string) (*UsersStorage, error) {
	s := &UsersStorage{
		dataDir: dataDir,
		data:    &models.UsersData{},
	}

	if err := s.LoadAll(); err != nil {
		return nil, err
	}

	return s, nil
}

// LoadAll loads the users data from JSON file
func (s *UsersStorage) LoadAll() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	usersFile := filepath.Join(s.dataDir, "users.json")

	// Check if file exists
	if _, err := os.Stat(usersFile); os.IsNotExist(err) {
		log.WithField("file", usersFile).Warn("Users data file not found, using empty data")
		s.data = &models.UsersData{
			Users:  []models.User{},
			Groups: []models.UserGroup{},
			Roles:  []models.UserRole{},
		}
		return nil
	}

	// Read file
	content, err := os.ReadFile(usersFile)
	if err != nil {
		return err
	}

	// Parse JSON
	var data models.UsersData
	if err := json.Unmarshal(content, &data); err != nil {
		return err
	}

	s.data = &data
	log.WithFields(log.Fields{
		"users":  len(data.Users),
		"groups": len(data.Groups),
		"roles":  len(data.Roles),
	}).Info("Loaded users data")

	return nil
}

// GetAllUsers returns all users
func (s *UsersStorage) GetAllUsers() []models.User {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]models.User, len(s.data.Users))
	copy(result, s.data.Users)
	return result
}

// GetAllGroups returns all groups
func (s *UsersStorage) GetAllGroups() []models.UserGroup {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]models.UserGroup, len(s.data.Groups))
	copy(result, s.data.Groups)
	return result
}

// GetAllRoles returns all roles
func (s *UsersStorage) GetAllRoles() []models.UserRole {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]models.UserRole, len(s.data.Roles))
	copy(result, s.data.Roles)
	return result
}

// GetAllData returns all users, groups, and roles
func (s *UsersStorage) GetAllData() *models.UsersData {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return &models.UsersData{
		Users:  s.GetAllUsers(),
		Groups: s.GetAllGroups(),
		Roles:  s.GetAllRoles(),
	}
}

// GetUserByID returns a user by ID
func (s *UsersStorage) GetUserByID(id string) *models.User {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, u := range s.data.Users {
		if u.ID == id {
			user := u
			return &user
		}
	}
	return nil
}

// GetUserByEmail returns a user by email
func (s *UsersStorage) GetUserByEmail(email string) *models.User {
	s.mu.RLock()
	defer s.mu.RUnlock()

	emailLower := strings.ToLower(email)
	for _, u := range s.data.Users {
		if strings.ToLower(u.Email) == emailLower {
			user := u
			return &user
		}
	}
	return nil
}

// GetGroupByID returns a group by ID
func (s *UsersStorage) GetGroupByID(id string) *models.UserGroup {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, g := range s.data.Groups {
		if g.ID == id {
			group := g
			return &group
		}
	}
	return nil
}

// GetRoleByID returns a role by ID
func (s *UsersStorage) GetRoleByID(id string) *models.UserRole {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, r := range s.data.Roles {
		if r.ID == id {
			role := r
			return &role
		}
	}
	return nil
}

// SearchUsers searches users by name, email, or department
func (s *UsersStorage) SearchUsers(query string) []models.User {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if query == "" {
		return s.GetAllUsers()
	}

	queryLower := strings.ToLower(query)
	var result []models.User

	for _, u := range s.data.Users {
		if strings.Contains(strings.ToLower(u.Name), queryLower) ||
			strings.Contains(strings.ToLower(u.Email), queryLower) ||
			strings.Contains(strings.ToLower(u.Department), queryLower) {
			result = append(result, u)
		}
	}

	return result
}

// SearchGroups searches groups by name or description
func (s *UsersStorage) SearchGroups(query string) []models.UserGroup {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if query == "" {
		return s.GetAllGroups()
	}

	queryLower := strings.ToLower(query)
	var result []models.UserGroup

	for _, g := range s.data.Groups {
		if strings.Contains(strings.ToLower(g.Name), queryLower) ||
			strings.Contains(strings.ToLower(g.Description), queryLower) {
			result = append(result, g)
		}
	}

	return result
}

// SearchRoles searches roles by name or description
func (s *UsersStorage) SearchRoles(query string) []models.UserRole {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if query == "" {
		return s.GetAllRoles()
	}

	queryLower := strings.ToLower(query)
	var result []models.UserRole

	for _, r := range s.data.Roles {
		if strings.Contains(strings.ToLower(r.Name), queryLower) ||
			strings.Contains(strings.ToLower(r.Description), queryLower) {
			result = append(result, r)
		}
	}

	return result
}

// GetUsersByRole returns users with a specific role
func (s *UsersStorage) GetUsersByRole(role string) []models.User {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.User
	for _, u := range s.data.Users {
		if u.Role == role {
			result = append(result, u)
		}
	}
	return result
}

// GetUsersByGroup returns users in a specific group
func (s *UsersStorage) GetUsersByGroup(groupID string) []models.User {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.User
	for _, u := range s.data.Users {
		for _, g := range u.Groups {
			if g == groupID {
				result = append(result, u)
				break
			}
		}
	}
	return result
}

// GetActiveUsers returns only active users
func (s *UsersStorage) GetActiveUsers() []models.User {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.User
	for _, u := range s.data.Users {
		if u.Status == "active" {
			result = append(result, u)
		}
	}
	return result
}
