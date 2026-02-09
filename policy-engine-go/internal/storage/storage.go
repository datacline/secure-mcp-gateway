package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/datacline/policy-engine/internal/models"
	log "github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
)

// Storage handles policy persistence
type Storage struct {
	policies  map[string]*models.Policy
	policyDir string
	mu        sync.RWMutex
}

// NewStorage creates a new storage instance
func NewStorage(policyDir string) *Storage {
	return &Storage{
		policies:  make(map[string]*models.Policy),
		policyDir: policyDir,
	}
}

// LoadAll loads all policies from disk
func (s *Storage) LoadAll() ([]*models.Policy, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	files, err := os.ReadDir(s.policyDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read policy directory: %w", err)
	}

	s.policies = make(map[string]*models.Policy)

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		name := file.Name()
		if filepath.Ext(name) != ".yaml" && filepath.Ext(name) != ".yml" {
			continue
		}

		policyPath := filepath.Join(s.policyDir, name)
		policy, err := s.loadPolicyFromFile(policyPath)
		if err != nil {
			log.WithError(err).WithField("file", name).Warn("Failed to load policy")
			continue
		}

		s.policies[policy.ID] = policy
	}

	policies := make([]*models.Policy, 0, len(s.policies))
	for _, p := range s.policies {
		policies = append(policies, p)
	}

	return policies, nil
}

// GetAll returns all policies
func (s *Storage) GetAll() []*models.Policy {
	s.mu.RLock()
	defer s.mu.RUnlock()

	policies := make([]*models.Policy, 0, len(s.policies))
	for _, p := range s.policies {
		policies = append(policies, p)
	}
	return policies
}

// Get returns a policy by ID
func (s *Storage) Get(id string) (*models.Policy, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	policy, exists := s.policies[id]
	if !exists {
		return nil, fmt.Errorf("policy not found: %s", id)
	}
	return policy, nil
}

// Create creates a new policy
func (s *Storage) Create(policy *models.Policy) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Generate ID if not provided
	if policy.ID == "" {
		policy.ID = generateID(policy.Name)
	}

	// Check if policy already exists
	if _, exists := s.policies[policy.ID]; exists {
		return fmt.Errorf("policy already exists: %s", policy.ID)
	}

	// Set timestamps
	now := time.Now()
	policy.CreatedAt = &now
	policy.UpdatedAt = &now

	// Set defaults
	if policy.Version == 0 {
		policy.Version = 1
	}
	if policy.Enforcement == "" {
		policy.Enforcement = "blocking"
	}

	// Save to disk
	if err := s.savePolicyToFile(policy); err != nil {
		return fmt.Errorf("failed to save policy: %w", err)
	}

	// Add to memory
	s.policies[policy.ID] = policy

	log.WithFields(log.Fields{
		"id":   policy.ID,
		"name": policy.Name,
	}).Info("Policy created")

	return nil
}

// Update updates an existing policy
func (s *Storage) Update(id string, policy *models.Policy) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if policy exists
	existing, exists := s.policies[id]
	if !exists {
		return fmt.Errorf("policy not found: %s", id)
	}

	// Preserve ID and created timestamp
	policy.ID = id
	policy.CreatedAt = existing.CreatedAt
	
	// Update timestamp
	now := time.Now()
	policy.UpdatedAt = &now

	// Increment version
	policy.Version = existing.Version + 1

	// Save to disk
	if err := s.savePolicyToFile(policy); err != nil {
		return fmt.Errorf("failed to save policy: %w", err)
	}

	// Update in memory
	s.policies[id] = policy

	log.WithFields(log.Fields{
		"id":      policy.ID,
		"name":    policy.Name,
		"version": policy.Version,
	}).Info("Policy updated")

	return nil
}

// Delete deletes a policy
func (s *Storage) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if policy exists
	policy, exists := s.policies[id]
	if !exists {
		return fmt.Errorf("policy not found: %s", id)
	}

	// Delete file
	filename := filepath.Join(s.policyDir, fmt.Sprintf("%s.yaml", id))
	if err := os.Remove(filename); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete policy file: %w", err)
	}

	// Remove from memory
	delete(s.policies, id)

	log.WithFields(log.Fields{
		"id":   policy.ID,
		"name": policy.Name,
	}).Info("Policy deleted")

	return nil
}

// Enable enables a policy
func (s *Storage) Enable(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	policy, exists := s.policies[id]
	if !exists {
		return fmt.Errorf("policy not found: %s", id)
	}

	policy.Enabled = true
	now := time.Now()
	policy.UpdatedAt = &now

	if err := s.savePolicyToFile(policy); err != nil {
		return fmt.Errorf("failed to save policy: %w", err)
	}

	log.WithField("id", id).Info("Policy enabled")
	return nil
}

// Disable disables a policy
func (s *Storage) Disable(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	policy, exists := s.policies[id]
	if !exists {
		return fmt.Errorf("policy not found: %s", id)
	}

	policy.Enabled = false
	now := time.Now()
	policy.UpdatedAt = &now

	if err := s.savePolicyToFile(policy); err != nil {
		return fmt.Errorf("failed to save policy: %w", err)
	}

	log.WithField("id", id).Info("Policy disabled")
	return nil
}

// Validate validates a policy without saving
func (s *Storage) Validate(policy *models.Policy) error {
	if policy.Name == "" {
		return fmt.Errorf("policy name is required")
	}
	if len(policy.Rules) == 0 {
		return fmt.Errorf("policy must have at least one rule")
	}
	for i, rule := range policy.Rules {
		if rule.ID == "" {
			return fmt.Errorf("rule %d: id is required", i)
		}
		if len(rule.Conditions) == 0 {
			return fmt.Errorf("rule %s: must have at least one condition", rule.ID)
		}
		if len(rule.Actions) == 0 {
			return fmt.Errorf("rule %s: must have at least one action", rule.ID)
		}
	}
	return nil
}

// Helper functions

func (s *Storage) loadPolicyFromFile(path string) (*models.Policy, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var policy models.Policy
	if err := yaml.Unmarshal(data, &policy); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	// Set defaults
	if policy.Version == 0 {
		policy.Version = 1
	}
	if policy.Enforcement == "" {
		policy.Enforcement = "blocking"
	}
	for i := range policy.Rules {
		if policy.Rules[i].Priority == 0 {
			policy.Rules[i].Priority = 100
		}
	}

	return &policy, nil
}

func (s *Storage) savePolicyToFile(policy *models.Policy) error {
	filename := filepath.Join(s.policyDir, fmt.Sprintf("%s.yaml", policy.ID))

	data, err := yaml.Marshal(policy)
	if err != nil {
		return fmt.Errorf("failed to marshal YAML: %w", err)
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	return nil
}

func generateID(name string) string {
	// Simple ID generation from name
	id := name
	id = filepath.Base(id)
	id = filepath.Clean(id)
	// Remove special characters and convert to lowercase
	result := ""
	for _, c := range id {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			result += string(c)
		} else if c == ' ' {
			result += "-"
		}
	}
	return result
}
