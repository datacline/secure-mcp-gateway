package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/datacline/policy-engine/internal/models"
	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

// UnifiedStorage handles persistence of unified policies
type UnifiedStorage struct {
	policyDir    string
	resourceDir  string
	policies     map[string]*models.UnifiedPolicy
	resourceMap  map[string][]string // resourceKey -> []policyID
	mu           sync.RWMutex
}

// NewUnifiedStorage creates a new unified storage instance
func NewUnifiedStorage(baseDir string) (*UnifiedStorage, error) {
	policyDir := filepath.Join(baseDir, "unified")
	resourceDir := filepath.Join(baseDir, "resources")

	// Create directories if they don't exist
	if err := os.MkdirAll(policyDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create policy directory: %w", err)
	}
	if err := os.MkdirAll(resourceDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create resource directory: %w", err)
	}

	s := &UnifiedStorage{
		policyDir:   policyDir,
		resourceDir: resourceDir,
		policies:    make(map[string]*models.UnifiedPolicy),
		resourceMap: make(map[string][]string),
	}

	if err := s.LoadAll(); err != nil {
		return nil, err
	}

	return s, nil
}

// makeResourceKey creates a key for the resource map
func makeResourceKey(resourceType models.ResourceType, resourceID string) string {
	return fmt.Sprintf("%s:%s", resourceType, resourceID)
}

// LoadAll loads all policies from disk
func (s *UnifiedStorage) LoadAll() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.policies = make(map[string]*models.UnifiedPolicy)
	s.resourceMap = make(map[string][]string)

	// Load policy files
	files, err := filepath.Glob(filepath.Join(s.policyDir, "*.yaml"))
	if err != nil {
		return fmt.Errorf("failed to glob policy files: %w", err)
	}

	ymlFiles, _ := filepath.Glob(filepath.Join(s.policyDir, "*.yml"))
	files = append(files, ymlFiles...)

	for _, file := range files {
		policy, err := s.loadPolicyFile(file)
		if err != nil {
			fmt.Printf("Warning: failed to load policy file %s: %v\n", file, err)
			continue
		}
		s.policies[policy.PolicyID] = policy
		s.indexPolicy(policy)
	}

	return nil
}

func (s *UnifiedStorage) loadPolicyFile(path string) (*models.UnifiedPolicy, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var policy models.UnifiedPolicy
	if err := yaml.Unmarshal(data, &policy); err != nil {
		return nil, err
	}

	return &policy, nil
}

func (s *UnifiedStorage) savePolicyFile(policy *models.UnifiedPolicy) error {
	filename := filepath.Join(s.policyDir, policy.PolicyID+".yaml")
	data, err := yaml.Marshal(policy)
	if err != nil {
		return err
	}
	return os.WriteFile(filename, data, 0644)
}

// indexPolicy updates the resource map for a policy
func (s *UnifiedStorage) indexPolicy(policy *models.UnifiedPolicy) {
	for _, r := range policy.Resources {
		key := makeResourceKey(r.ResourceType, r.ResourceID)
		s.resourceMap[key] = append(s.resourceMap[key], policy.PolicyID)
	}
}

// reindexPolicy removes old index entries and adds new ones
func (s *UnifiedStorage) reindexPolicy(oldPolicy, newPolicy *models.UnifiedPolicy) {
	// Remove old entries
	if oldPolicy != nil {
		for _, r := range oldPolicy.Resources {
			key := makeResourceKey(r.ResourceType, r.ResourceID)
			ids := s.resourceMap[key]
			for i, id := range ids {
				if id == oldPolicy.PolicyID {
					s.resourceMap[key] = append(ids[:i], ids[i+1:]...)
					break
				}
			}
		}
	}
	// Add new entries
	if newPolicy != nil {
		s.indexPolicy(newPolicy)
	}
}

// GetAll returns all policies
func (s *UnifiedStorage) GetAll() []*models.UnifiedPolicy {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*models.UnifiedPolicy, 0, len(s.policies))
	for _, p := range s.policies {
		result = append(result, p)
	}
	return result
}

// GetByID retrieves a policy by ID
func (s *UnifiedStorage) GetByID(id string) (*models.UnifiedPolicy, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	policy, ok := s.policies[id]
	if !ok {
		return nil, fmt.Errorf("policy not found: %s", id)
	}
	return policy, nil
}

// GetByCode retrieves a policy by its human-readable code
func (s *UnifiedStorage) GetByCode(code string) (*models.UnifiedPolicy, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, p := range s.policies {
		if p.PolicyCode == code {
			return p, nil
		}
	}
	return nil, fmt.Errorf("policy not found with code: %s", code)
}

// GetByResource retrieves all policies bound to a specific resource
func (s *UnifiedStorage) GetByResource(resourceType models.ResourceType, resourceID string) ([]*models.UnifiedPolicy, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	key := makeResourceKey(resourceType, resourceID)
	policyIDs, ok := s.resourceMap[key]
	if !ok {
		return []*models.UnifiedPolicy{}, nil
	}

	result := make([]*models.UnifiedPolicy, 0, len(policyIDs))
	for _, id := range policyIDs {
		if policy, ok := s.policies[id]; ok {
			result = append(result, policy)
		}
	}
	return result, nil
}

// GetActiveByResource returns active policies for a resource within effective period
func (s *UnifiedStorage) GetActiveByResource(resourceType models.ResourceType, resourceID string) ([]*models.UnifiedPolicy, error) {
	policies, err := s.GetByResource(resourceType, resourceID)
	if err != nil {
		return nil, err
	}

	result := make([]*models.UnifiedPolicy, 0)
	for _, p := range policies {
		if p.IsActive() {
			result = append(result, p)
		}
	}
	return result, nil
}

// GetGlobalPolicies returns all global policies (no scope restrictions)
func (s *UnifiedStorage) GetGlobalPolicies() []*models.UnifiedPolicy {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*models.UnifiedPolicy, 0)
	for _, p := range s.policies {
		if p.IsGlobal() && p.IsActive() {
			result = append(result, p)
		}
	}
	return result
}

// List returns policies matching the filter
func (s *UnifiedStorage) List(filter *models.UnifiedPolicyListFilter) []*models.UnifiedPolicy {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*models.UnifiedPolicy, 0)

	for _, p := range s.policies {
		if s.matchesFilter(p, filter) {
			result = append(result, p)
		}
	}
	return result
}

func (s *UnifiedStorage) matchesFilter(p *models.UnifiedPolicy, filter *models.UnifiedPolicyListFilter) bool {
	if filter == nil {
		return true
	}
	if filter.Status != nil && p.Status != *filter.Status {
		return false
	}
	if filter.OrgID != "" && p.OrgID != filter.OrgID {
		return false
	}
	if filter.OwnerID != "" && p.OwnerID != filter.OwnerID {
		return false
	}
	if filter.ResourceType != "" && filter.ResourceID != "" {
		if !p.HasResource(filter.ResourceType, filter.ResourceID) {
			return false
		}
	}
	return true
}

// Create creates a new policy
func (s *UnifiedStorage) Create(req *models.UnifiedPolicyCreateRequest) (*models.UnifiedPolicy, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check for duplicate policy_code
	for _, p := range s.policies {
		if strings.EqualFold(p.PolicyCode, req.PolicyCode) {
			return nil, fmt.Errorf("policy with code '%s' already exists", req.PolicyCode)
		}
	}

	now := time.Now()
	policy := &models.UnifiedPolicy{
		PolicyID:      uuid.New().String(),
		PolicyCode:    req.PolicyCode,
		Name:          req.Name,
		Description:   req.Description,
		PolicyRules:   req.PolicyRules,
		Version:       1,
		Status:        req.Status,
		Priority:      req.Priority,
		EffectiveFrom: req.EffectiveFrom,
		EffectiveTo:   req.EffectiveTo,
		OwnerID:       req.OwnerID,
		OrgID:         req.OrgID,
		CreatedAt:     &now,
		UpdatedAt:     &now,
		Resources:     make([]models.PolicyResource, 0),
		Scopes:        make([]models.PolicyPrincipalScope, 0),
	}

	// Set default status if not provided
	if policy.Status == "" {
		policy.Status = models.PolicyStatusDraft
	}

	// Add resources with policy ID
	for _, r := range req.Resources {
		policy.Resources = append(policy.Resources, models.PolicyResource{
			PolicyID:     policy.PolicyID,
			ResourceType: r.ResourceType,
			ResourceID:   r.ResourceID,
		})
	}

	// Add scopes with policy ID
	for _, sc := range req.Scopes {
		policy.Scopes = append(policy.Scopes, models.PolicyPrincipalScope{
			PolicyID:      policy.PolicyID,
			PrincipalType: sc.PrincipalType,
			PrincipalID:   sc.PrincipalID,
		})
	}

	// Save to disk
	if err := s.savePolicyFile(policy); err != nil {
		return nil, fmt.Errorf("failed to save policy: %w", err)
	}

	// Update in-memory cache
	s.policies[policy.PolicyID] = policy
	s.indexPolicy(policy)

	return policy, nil
}

// Update updates an existing policy
func (s *UnifiedStorage) Update(id string, req *models.UnifiedPolicyUpdateRequest) (*models.UnifiedPolicy, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	policy, ok := s.policies[id]
	if !ok {
		return nil, fmt.Errorf("policy not found: %s", id)
	}

	// Check for duplicate policy_code if changing
	if req.PolicyCode != "" && req.PolicyCode != policy.PolicyCode {
		for _, p := range s.policies {
			if p.PolicyID != id && strings.EqualFold(p.PolicyCode, req.PolicyCode) {
				return nil, fmt.Errorf("policy with code '%s' already exists", req.PolicyCode)
			}
		}
		policy.PolicyCode = req.PolicyCode
	}

	// Update fields
	if req.Name != "" {
		policy.Name = req.Name
	}
	if req.Description != "" {
		policy.Description = req.Description
	}
	if req.PolicyRules != nil {
		policy.PolicyRules = req.PolicyRules
	}
	if req.Status != "" {
		policy.Status = req.Status
	}
	if req.Priority != 0 {
		policy.Priority = req.Priority
	}
	if req.EffectiveFrom != nil {
		policy.EffectiveFrom = req.EffectiveFrom
	}
	if req.EffectiveTo != nil {
		policy.EffectiveTo = req.EffectiveTo
	}

	// Update resources if provided
	if req.Resources != nil {
		oldPolicy := *policy // Copy for reindexing
		policy.Resources = make([]models.PolicyResource, 0)
		for _, r := range req.Resources {
			policy.Resources = append(policy.Resources, models.PolicyResource{
				PolicyID:     policy.PolicyID,
				ResourceType: r.ResourceType,
				ResourceID:   r.ResourceID,
			})
		}
		s.reindexPolicy(&oldPolicy, policy)
	}

	// Update scopes if provided
	if req.Scopes != nil {
		policy.Scopes = make([]models.PolicyPrincipalScope, 0)
		for _, sc := range req.Scopes {
			policy.Scopes = append(policy.Scopes, models.PolicyPrincipalScope{
				PolicyID:      policy.PolicyID,
				PrincipalType: sc.PrincipalType,
				PrincipalID:   sc.PrincipalID,
			})
		}
	}

	// Increment version
	policy.Version++
	now := time.Now()
	policy.UpdatedAt = &now

	// Save to disk
	if err := s.savePolicyFile(policy); err != nil {
		return nil, fmt.Errorf("failed to save policy: %w", err)
	}

	return policy, nil
}

// Delete removes a policy
func (s *UnifiedStorage) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	policy, ok := s.policies[id]
	if !ok {
		return fmt.Errorf("policy not found: %s", id)
	}

	// Remove from resource index
	s.reindexPolicy(policy, nil)

	// Delete file
	filename := filepath.Join(s.policyDir, id+".yaml")
	if err := os.Remove(filename); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete policy file: %w", err)
	}

	// Remove from cache
	delete(s.policies, id)

	return nil
}

// Activate activates a policy
func (s *UnifiedStorage) Activate(id string) error {
	return s.setStatus(id, models.PolicyStatusActive)
}

// Suspend suspends a policy
func (s *UnifiedStorage) Suspend(id string) error {
	return s.setStatus(id, models.PolicyStatusSuspended)
}

// Retire retires a policy
func (s *UnifiedStorage) Retire(id string) error {
	return s.setStatus(id, models.PolicyStatusRetired)
}

func (s *UnifiedStorage) setStatus(id string, status models.PolicyStatus) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	policy, ok := s.policies[id]
	if !ok {
		return fmt.Errorf("policy not found: %s", id)
	}

	policy.Status = status
	policy.Version++
	now := time.Now()
	policy.UpdatedAt = &now

	return s.savePolicyFile(policy)
}

// AddResource adds a resource binding to a policy
func (s *UnifiedStorage) AddResource(policyID string, resourceType models.ResourceType, resourceID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	policy, ok := s.policies[policyID]
	if !ok {
		return fmt.Errorf("policy not found: %s", policyID)
	}

	// Check if already exists
	for _, r := range policy.Resources {
		if r.ResourceType == resourceType && r.ResourceID == resourceID {
			return nil // Already exists
		}
	}

	policy.Resources = append(policy.Resources, models.PolicyResource{
		PolicyID:     policyID,
		ResourceType: resourceType,
		ResourceID:   resourceID,
	})

	key := makeResourceKey(resourceType, resourceID)
	s.resourceMap[key] = append(s.resourceMap[key], policyID)

	now := time.Now()
	policy.UpdatedAt = &now

	return s.savePolicyFile(policy)
}

// RemoveResource removes a resource binding from a policy
func (s *UnifiedStorage) RemoveResource(policyID string, resourceType models.ResourceType, resourceID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	policy, ok := s.policies[policyID]
	if !ok {
		return fmt.Errorf("policy not found: %s", policyID)
	}

	// Remove from policy's resources
	for i, r := range policy.Resources {
		if r.ResourceType == resourceType && r.ResourceID == resourceID {
			policy.Resources = append(policy.Resources[:i], policy.Resources[i+1:]...)
			break
		}
	}

	// Remove from resource map
	key := makeResourceKey(resourceType, resourceID)
	ids := s.resourceMap[key]
	for i, id := range ids {
		if id == policyID {
			s.resourceMap[key] = append(ids[:i], ids[i+1:]...)
			break
		}
	}

	now := time.Now()
	policy.UpdatedAt = &now

	return s.savePolicyFile(policy)
}

// GetResourcePolicies is an alias for GetByResource for clarity
func (s *UnifiedStorage) GetResourcePolicies(resourceType models.ResourceType, resourceID string) ([]*models.UnifiedPolicy, error) {
	return s.GetByResource(resourceType, resourceID)
}
