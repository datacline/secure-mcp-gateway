package models

import "time"

// Unified Policy Model based on authoritative context
// This is the canonical policy system implementation

// PolicyStatus represents the lifecycle state of a policy
type PolicyStatus string

const (
	PolicyStatusDraft     PolicyStatus = "draft"
	PolicyStatusActive    PolicyStatus = "active"
	PolicyStatusSuspended PolicyStatus = "suspended"
	PolicyStatusRetired   PolicyStatus = "retired"
)

// PrincipalType represents who the policy applies to
type PrincipalType string

const (
	PrincipalTypeUser         PrincipalType = "user"
	PrincipalTypeRole         PrincipalType = "role"
	PrincipalTypeOrganization PrincipalType = "organization"
)

// ResourceType represents types of resources policies can bind to
type ResourceType string

const (
	ResourceTypeMCPServer ResourceType = "mcp_server"
	ResourceTypeTool      ResourceType = "tool"
	ResourceTypeResource  ResourceType = "resource"
)

// RuleOperator represents comparison operators in policy rules DSL
type RuleOperator string

const (
	RuleOpEquals      RuleOperator = "equals"
	RuleOpNotEquals   RuleOperator = "not_equals"
	RuleOpContains    RuleOperator = "contains"
	RuleOpNotContains RuleOperator = "not_contains"
	RuleOpMatches     RuleOperator = "matches" // Regex
	RuleOpIn          RuleOperator = "in"
	RuleOpNotIn       RuleOperator = "not_in"
	RuleOpGt          RuleOperator = "gt"
	RuleOpLt          RuleOperator = "lt"
	RuleOpGte         RuleOperator = "gte"
	RuleOpLte         RuleOperator = "lte"
	RuleOpExists      RuleOperator = "exists"
	RuleOpNotExists   RuleOperator = "not_exists"
)

// RuleActionType represents action types in policy rules DSL
type RuleActionType string

const (
	RuleActionAllow     RuleActionType = "allow"
	RuleActionDeny      RuleActionType = "deny"
	RuleActionRedact    RuleActionType = "redact"
	RuleActionTransform RuleActionType = "transform"
	RuleActionAudit     RuleActionType = "audit"
)

// RuleCondition represents a single condition in the policy rules DSL
// Conditions can be nested using "all" (AND) or "any" (OR)
type RuleCondition struct {
	// For leaf conditions
	Field    string       `json:"field,omitempty" yaml:"field,omitempty"`
	Operator RuleOperator `json:"operator,omitempty" yaml:"operator,omitempty"`
	Value    interface{}  `json:"value,omitempty" yaml:"value,omitempty"`

	// For boolean composition
	All []RuleCondition `json:"all,omitempty" yaml:"all,omitempty"` // AND
	Any []RuleCondition `json:"any,omitempty" yaml:"any,omitempty"` // OR
}

// RuleAction represents an action in the policy rules DSL
type RuleAction struct {
	Type   RuleActionType         `json:"type" yaml:"type" binding:"required"`
	Params map[string]interface{} `json:"params,omitempty" yaml:"params,omitempty"`
}

// PolicyRuleDSL represents a single rule in the policy_rules JSONB
// This is the declarative DSL stored in the database
type PolicyRuleDSL struct {
	RuleID      string         `json:"rule_id" yaml:"rule_id" binding:"required"`
	Priority    int            `json:"priority" yaml:"priority"`
	Description string         `json:"description,omitempty" yaml:"description,omitempty"`
	Conditions  *RuleCondition `json:"conditions,omitempty" yaml:"conditions,omitempty"`
	Actions     []RuleAction   `json:"actions" yaml:"actions" binding:"required"`
}

// UnifiedPolicy represents the authoritative policy entity
// Maps to the `policy` table in the unified context
type UnifiedPolicy struct {
	// Primary identification
	PolicyID   string `json:"policy_id" yaml:"policy_id"` // UUID, immutable
	PolicyCode string `json:"policy_code" yaml:"policy_code" binding:"required"` // Human reference, unique

	// Policy rules (the DSL)
	PolicyRules []PolicyRuleDSL `json:"policy_rules" yaml:"policy_rules"`

	// Lifecycle
	Version int          `json:"version" yaml:"version"` // Monotonically increasing
	Status  PolicyStatus `json:"status" yaml:"status" binding:"required"`

	// Effective period
	EffectiveFrom *time.Time `json:"effective_from,omitempty" yaml:"effective_from,omitempty"`
	EffectiveTo   *time.Time `json:"effective_to,omitempty" yaml:"effective_to,omitempty"`

	// Priority for conflict resolution
	Priority int `json:"priority" yaml:"priority"`

	// Ownership and approval
	OwnerID      string     `json:"owner_id,omitempty" yaml:"owner_id,omitempty"`
	ApprovedByID string     `json:"approved_by_id,omitempty" yaml:"approved_by_id,omitempty"`
	ApprovedAt   *time.Time `json:"approved_at,omitempty" yaml:"approved_at,omitempty"`

	// Timestamps
	CreatedAt *time.Time `json:"created_at,omitempty" yaml:"created_at,omitempty"`
	UpdatedAt *time.Time `json:"updated_at,omitempty" yaml:"updated_at,omitempty"`

	// Display metadata (not in core spec but useful)
	Name        string `json:"name,omitempty" yaml:"name,omitempty"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
	OrgID       string `json:"org_id,omitempty" yaml:"org_id,omitempty"`

	// Related bindings (populated when loading with associations)
	Resources []PolicyResource       `json:"resources,omitempty" yaml:"resources,omitempty"`
	Scopes    []PolicyPrincipalScope `json:"scopes,omitempty" yaml:"scopes,omitempty"`
}

// PolicyResource binds a policy to a governed resource
// Maps to the `policy_resource` table
type PolicyResource struct {
	PolicyID     string       `json:"policy_id" yaml:"policy_id"`
	ResourceType ResourceType `json:"resource_type" yaml:"resource_type" binding:"required"`
	ResourceID   string       `json:"resource_id" yaml:"resource_id" binding:"required"`
}

// PolicyPrincipalScope declares applicability to principals
// Maps to the `policy_scope` table
// A global policy has no rows in this table
type PolicyPrincipalScope struct {
	PolicyID      string        `json:"policy_id" yaml:"policy_id"`
	PrincipalType PrincipalType `json:"principal_type" yaml:"principal_type" binding:"required"`
	PrincipalID   string        `json:"principal_id" yaml:"principal_id" binding:"required"`
}

// PolicyDecision represents the computed decision from policy evaluation
// This is ephemeral and never persisted as authoritative data
type PolicyDecision struct {
	Decision    RuleActionType `json:"decision"` // allow, deny, redact, transform
	PolicyIDs   []string       `json:"policy_ids"`
	MatchedRule string         `json:"matched_rule,omitempty"`
	Reason      string         `json:"reason,omitempty"`
	Timestamp   time.Time      `json:"timestamp"`
}

// PolicyEvaluationInput represents the input tuple for policy evaluation
// (principal, resource, time)
type PolicyEvaluationInput struct {
	// Principal identification
	UserID string   `json:"user_id" binding:"required"`
	Roles  []string `json:"roles,omitempty"`
	OrgIDs []string `json:"org_ids,omitempty"`

	// Resource identification
	ResourceType ResourceType `json:"resource_type" binding:"required"`
	ResourceID   string       `json:"resource_id" binding:"required"`

	// Time context
	Timestamp *time.Time `json:"timestamp,omitempty"`

	// Additional context for condition evaluation
	Context map[string]interface{} `json:"context,omitempty"`
}

// GetPoliciesByResourceRequest for querying policies by resource
type GetPoliciesByResourceRequest struct {
	ResourceType ResourceType `json:"resource_type" binding:"required"`
	ResourceID   string       `json:"resource_id" binding:"required"`
}

// UnifiedPolicyCreateRequest for creating a new unified policy
type UnifiedPolicyCreateRequest struct {
	PolicyCode    string          `json:"policy_code" binding:"required"`
	Name          string          `json:"name,omitempty"`
	Description   string          `json:"description,omitempty"`
	PolicyRules   []PolicyRuleDSL `json:"policy_rules" binding:"required"`
	Status        PolicyStatus    `json:"status"`
	Priority      int             `json:"priority"`
	EffectiveFrom *time.Time      `json:"effective_from,omitempty"`
	EffectiveTo   *time.Time      `json:"effective_to,omitempty"`
	OwnerID       string          `json:"owner_id,omitempty"`
	OrgID         string          `json:"org_id,omitempty"`

	// Resource bindings
	Resources []PolicyResource `json:"resources,omitempty"`
	// Scope bindings (empty = global policy)
	Scopes []PolicyPrincipalScope `json:"scopes,omitempty"`
}

// UnifiedPolicyUpdateRequest for updating an existing policy
type UnifiedPolicyUpdateRequest struct {
	PolicyCode    string          `json:"policy_code,omitempty"`
	Name          string          `json:"name,omitempty"`
	Description   string          `json:"description,omitempty"`
	PolicyRules   []PolicyRuleDSL `json:"policy_rules,omitempty"`
	Status        PolicyStatus    `json:"status,omitempty"`
	Priority      int             `json:"priority,omitempty"`
	EffectiveFrom *time.Time      `json:"effective_from,omitempty"`
	EffectiveTo   *time.Time      `json:"effective_to,omitempty"`

	// Resource bindings (replaces existing)
	Resources []PolicyResource `json:"resources,omitempty"`
	// Scope bindings (replaces existing)
	Scopes []PolicyPrincipalScope `json:"scopes,omitempty"`
}

// UnifiedPolicyListFilter for filtering policies
type UnifiedPolicyListFilter struct {
	Status       *PolicyStatus `json:"status,omitempty"`
	OrgID        string        `json:"org_id,omitempty"`
	OwnerID      string        `json:"owner_id,omitempty"`
	ResourceType ResourceType  `json:"resource_type,omitempty"`
	ResourceID   string        `json:"resource_id,omitempty"`
}

// IsGlobal returns true if the policy has no scope restrictions (applies to all)
func (p *UnifiedPolicy) IsGlobal() bool {
	return len(p.Scopes) == 0
}

// IsActive returns true if the policy is currently active and within effective period
func (p *UnifiedPolicy) IsActive() bool {
	if p.Status != PolicyStatusActive {
		return false
	}
	now := time.Now()
	if p.EffectiveFrom != nil && now.Before(*p.EffectiveFrom) {
		return false
	}
	if p.EffectiveTo != nil && now.After(*p.EffectiveTo) {
		return false
	}
	return true
}

// HasResource checks if the policy binds to a specific resource
func (p *UnifiedPolicy) HasResource(resourceType ResourceType, resourceID string) bool {
	for _, r := range p.Resources {
		if r.ResourceType == resourceType && r.ResourceID == resourceID {
			return true
		}
	}
	return false
}

// AppliesToPrincipal checks if the policy applies to a specific principal
// Returns true for global policies (no scopes) or if principal matches any scope
func (p *UnifiedPolicy) AppliesToPrincipal(principalType PrincipalType, principalID string) bool {
	if p.IsGlobal() {
		return true
	}
	for _, s := range p.Scopes {
		if s.PrincipalType == principalType && s.PrincipalID == principalID {
			return true
		}
	}
	return false
}
