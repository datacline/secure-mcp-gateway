package enhanced

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/datacline/policy-engine/internal/models"
	"github.com/google/uuid"
	log "github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
)

// EnhancedStorage handles persistence of enhanced policies
type EnhancedStorage struct {
	policyDir string
	policies  map[string]*models.EnhancedPolicy
	mu        sync.RWMutex
}

// NewEnhancedStorage creates a new enhanced storage
func NewEnhancedStorage(policyDir string) (*EnhancedStorage, error) {
	storage := &EnhancedStorage{
		policyDir: policyDir,
		policies:  make(map[string]*models.EnhancedPolicy),
	}
	
	// Ensure policy directory exists
	if err := os.MkdirAll(policyDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create policy directory: %w", err)
	}
	
	// Load all policies
	if err := storage.LoadAll(); err != nil {
		return nil, err
	}
	
	return storage, nil
}

// LoadAll loads all policies from disk
func (s *EnhancedStorage) LoadAll() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	// Clear current policies
	s.policies = make(map[string]*models.EnhancedPolicy)
	
	// Read all YAML files
	files, err := filepath.Glob(filepath.Join(s.policyDir, "*.yaml"))
	if err != nil {
		return err
	}
	
	for _, file := range files {
		policy, err := s.loadPolicyFile(file)
		if err != nil {
			log.WithError(err).WithField("file", file).Warn("Failed to load policy")
			continue
		}
		s.policies[policy.ID] = policy
	}
	
	log.WithField("count", len(s.policies)).Info("Enhanced policies loaded")
	return nil
}

// loadPolicyFile loads a policy from a file
func (s *EnhancedStorage) loadPolicyFile(filepath string) (*models.EnhancedPolicy, error) {
	data, err := os.ReadFile(filepath)
	if err != nil {
		return nil, err
	}
	
	var policy models.EnhancedPolicy
	if err := yaml.Unmarshal(data, &policy); err != nil {
		return nil, err
	}
	
	return &policy, nil
}

// ListPolicies lists all policies with optional filtering
func (s *EnhancedStorage) ListPolicies(filter models.PolicyListFilter) []*models.EnhancedPolicy {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	var result []*models.EnhancedPolicy
	
	for _, policy := range s.policies {
		// Apply filters
		if filter.Type != nil && policy.Type != *filter.Type {
			continue
		}
		if filter.Action != nil && policy.Action != *filter.Action {
			continue
		}
		if filter.Enabled != nil && policy.Enabled != *filter.Enabled {
			continue
		}
		if filter.OrgID != "" && policy.OrgID != filter.OrgID {
			continue
		}
		if filter.ServerID != "" {
			// Check if policy applies to this server
			if policy.Scope.Type == models.PolicyScopeAllServers {
				// Global policy applies to all servers
			} else {
				found := false
				for _, serverID := range policy.Scope.ServerIDs {
					if serverID == filter.ServerID {
						found = true
						break
					}
				}
				if !found {
					continue
				}
			}
		}
		if filter.SubjectID != "" {
			// Check if policy applies to this subject
			found := false
			for _, value := range policy.AppliesTo.Values {
				if strings.EqualFold(value, filter.SubjectID) {
					found = true
					break
				}
			}
			if !found && policy.AppliesTo.Type != models.SubjectTypeAll {
				continue
			}
		}
		
		result = append(result, policy)
	}
	
	return result
}

// GetPolicy gets a policy by ID
func (s *EnhancedStorage) GetPolicy(id string) (*models.EnhancedPolicy, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	policy, exists := s.policies[id]
	if !exists {
		return nil, fmt.Errorf("policy not found")
	}
	
	return policy, nil
}

// CreatePolicy creates a new policy
func (s *EnhancedStorage) CreatePolicy(policy *models.EnhancedPolicy) (*models.EnhancedPolicy, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	// Generate ID if not provided
	if policy.ID == "" {
		policy.ID = s.generateID(policy.Name)
	}
	
	// Check if policy already exists
	if _, exists := s.policies[policy.ID]; exists {
		return nil, fmt.Errorf("policy already exists")
	}
	
	// Set metadata
	now := time.Now()
	policy.CreatedAt = &now
	policy.UpdatedAt = &now
	policy.Version = 1
	
	// Save to disk
	if err := s.savePolicyFile(policy); err != nil {
		return nil, err
	}
	
	// Store in memory
	s.policies[policy.ID] = policy
	
	log.WithFields(log.Fields{
		"id":   policy.ID,
		"name": policy.Name,
	}).Info("Enhanced policy created")
	
	return policy, nil
}

// UpdatePolicy updates an existing policy
func (s *EnhancedStorage) UpdatePolicy(policy *models.EnhancedPolicy) (*models.EnhancedPolicy, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	// Check if policy exists
	existing, exists := s.policies[policy.ID]
	if !exists {
		return nil, fmt.Errorf("policy not found")
	}
	
	// Update metadata
	now := time.Now()
	policy.UpdatedAt = &now
	policy.Version = existing.Version + 1
	policy.CreatedAt = existing.CreatedAt
	policy.CreatedBy = existing.CreatedBy
	
	// Save to disk
	if err := s.savePolicyFile(policy); err != nil {
		return nil, err
	}
	
	// Update in memory
	s.policies[policy.ID] = policy
	
	log.WithFields(log.Fields{
		"id":      policy.ID,
		"name":    policy.Name,
		"version": policy.Version,
	}).Info("Enhanced policy updated")
	
	return policy, nil
}

// DeletePolicy deletes a policy
func (s *EnhancedStorage) DeletePolicy(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	// Check if policy exists
	_, exists := s.policies[id]
	if !exists {
		return fmt.Errorf("policy not found")
	}
	
	// Delete file
	filename := filepath.Join(s.policyDir, id+".yaml")
	if err := os.Remove(filename); err != nil {
		return err
	}
	
	// Remove from memory
	delete(s.policies, id)
	
	log.WithField("id", id).Info("Enhanced policy deleted")
	return nil
}

// EnablePolicy enables a policy
func (s *EnhancedStorage) EnablePolicy(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	policy, exists := s.policies[id]
	if !exists {
		return fmt.Errorf("policy not found")
	}
	
	policy.Enabled = true
	now := time.Now()
	policy.UpdatedAt = &now
	
	// Save to disk
	if err := s.savePolicyFile(policy); err != nil {
		return err
	}
	
	log.WithField("id", id).Info("Enhanced policy enabled")
	return nil
}

// DisablePolicy disables a policy
func (s *EnhancedStorage) DisablePolicy(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	policy, exists := s.policies[id]
	if !exists {
		return fmt.Errorf("policy not found")
	}
	
	policy.Enabled = false
	now := time.Now()
	policy.UpdatedAt = &now
	
	// Save to disk
	if err := s.savePolicyFile(policy); err != nil {
		return err
	}
	
	log.WithField("id", id).Info("Enhanced policy disabled")
	return nil
}

// savePolicyFile saves a policy to disk
func (s *EnhancedStorage) savePolicyFile(policy *models.EnhancedPolicy) error {
	filename := filepath.Join(s.policyDir, policy.ID+".yaml")
	
	data, err := yaml.Marshal(policy)
	if err != nil {
		return err
	}
	
	return os.WriteFile(filename, data, 0644)
}

// generateID generates a unique ID for a policy
func (s *EnhancedStorage) generateID(name string) string {
	// Create slug from name
	slug := strings.ToLower(name)
	slug = strings.ReplaceAll(slug, " ", "-")
	slug = strings.ReplaceAll(slug, "_", "-")
	
	// Add short UUID
	id := uuid.New().String()[:8]
	
	return fmt.Sprintf("%s-%s", slug, id)
}
