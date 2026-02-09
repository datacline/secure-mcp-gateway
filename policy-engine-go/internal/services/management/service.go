package management

import (
	"github.com/datacline/policy-engine/internal/models"
	"github.com/datacline/policy-engine/internal/storage"
	log "github.com/sirupsen/logrus"
)

// Service handles policy management operations (CRUD)
type Service struct {
	storage *storage.Storage
}

// NewService creates a new management service
func NewService(policyDir string) (*Service, error) {
	store := storage.NewStorage(policyDir)
	
	// Load initial policies
	if _, err := store.LoadAll(); err != nil {
		return nil, err
	}
	
	return &Service{
		storage: store,
	}, nil
}

// ListPolicies retrieves all policies
func (s *Service) ListPolicies() []*models.Policy {
	return s.storage.GetAll()
}

// GetPolicy retrieves a specific policy by ID
func (s *Service) GetPolicy(id string) (*models.Policy, error) {
	return s.storage.Get(id)
}

// CreatePolicy creates a new policy
func (s *Service) CreatePolicy(policy *models.Policy) error {
	if err := s.storage.Validate(policy); err != nil {
		return err
	}
	
	if err := s.storage.Create(policy); err != nil {
		return err
	}
	
	log.WithFields(log.Fields{
		"id":   policy.ID,
		"name": policy.Name,
	}).Info("Policy created via management service")
	
	return nil
}

// UpdatePolicy updates an existing policy
func (s *Service) UpdatePolicy(id string, policy *models.Policy) error {
	if err := s.storage.Validate(policy); err != nil {
		return err
	}
	
	if err := s.storage.Update(id, policy); err != nil {
		return err
	}
	
	log.WithFields(log.Fields{
		"id":      id,
		"version": policy.Version,
	}).Info("Policy updated via management service")
	
	return nil
}

// DeletePolicy deletes a policy
func (s *Service) DeletePolicy(id string) error {
	if err := s.storage.Delete(id); err != nil {
		return err
	}
	
	log.WithField("id", id).Info("Policy deleted via management service")
	return nil
}

// EnablePolicy enables a policy
func (s *Service) EnablePolicy(id string) error {
	if err := s.storage.Enable(id); err != nil {
		return err
	}
	
	log.WithField("id", id).Info("Policy enabled")
	return nil
}

// DisablePolicy disables a policy
func (s *Service) DisablePolicy(id string) error {
	if err := s.storage.Disable(id); err != nil {
		return err
	}
	
	log.WithField("id", id).Info("Policy disabled")
	return nil
}

// ValidatePolicy validates a policy without saving
func (s *Service) ValidatePolicy(policy *models.Policy) error {
	return s.storage.Validate(policy)
}

// ReloadFromDisk reloads all policies from disk
func (s *Service) ReloadFromDisk() ([]*models.Policy, error) {
	policies, err := s.storage.LoadAll()
	if err != nil {
		return nil, err
	}
	
	log.WithField("count", len(policies)).Info("Policies reloaded from disk")
	return policies, nil
}

// GetStorage returns the underlying storage (for advanced use cases)
func (s *Service) GetStorage() *storage.Storage {
	return s.storage
}
