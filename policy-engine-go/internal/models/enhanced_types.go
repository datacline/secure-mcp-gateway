package models

import "time"

// Enhanced Policy Model based on Runlayer architecture

// SubjectType represents who the policy applies to
type SubjectType string

const (
	SubjectTypeUser  SubjectType = "user"
	SubjectTypeGroup SubjectType = "group"
	SubjectTypeRole  SubjectType = "role"
	SubjectTypeAll   SubjectType = "all" // Everyone
)

// PolicyScope represents what the policy applies to
type PolicyScope string

const (
	PolicyScopeEntireServer PolicyScope = "entire_server"
	PolicyScopeSpecificTools PolicyScope = "specific_tools"
	PolicyScopeAllServers    PolicyScope = "all_servers" // For global policies
)

// PolicyType distinguishes between server-level and global policies
type PolicyType string

const (
	PolicyTypeServerLevel PolicyType = "server_level"
	PolicyTypeGlobal      PolicyType = "global"
)

// PolicyAction represents the action to take
type PolicyAction string

const (
	PolicyActionAllow PolicyAction = "allow"
	PolicyActionDeny  PolicyAction = "deny"
)

// MetadataConditionField represents available metadata for conditions
type MetadataConditionField string

const (
	// Payload fields (tool arguments)
	MetadataPayload MetadataConditionField = "payload"
	
	// Request metadata
	MetadataRequestIP        MetadataConditionField = "meta.request.ip"
	MetadataRequestUserAgent MetadataConditionField = "meta.request.user_agent"
	
	// Subject metadata
	MetadataSubjectEmail  MetadataConditionField = "meta.subject.email"
	MetadataSubjectRoles  MetadataConditionField = "meta.subject.roles"
	MetadataSubjectGroups MetadataConditionField = "meta.subject.groups"
	MetadataSubjectType   MetadataConditionField = "meta.subject.type"
	
	// OAuth metadata
	MetadataOAuthProvider  MetadataConditionField = "meta.oauth.provider"
	MetadataOAuthScopes    MetadataConditionField = "meta.oauth.scopes"
	MetadataOAuthVerified  MetadataConditionField = "meta.oauth.verified"
	
	// Server metadata
	MetadataServerName MetadataConditionField = "meta.server.name"
	MetadataServerAuth MetadataConditionField = "meta.server.auth_type"
)

// ConditionOperatorEnhanced includes additional operators for metadata
type ConditionOperatorEnhanced string

const (
	ConditionOpEquals          ConditionOperatorEnhanced = "eq"
	ConditionOpNotEquals       ConditionOperatorEnhanced = "neq"
	ConditionOpIn              ConditionOperatorEnhanced = "in"
	ConditionOpNotIn           ConditionOperatorEnhanced = "not_in"
	ConditionOpBeginsWith      ConditionOperatorEnhanced = "begins_with"
	ConditionOpEndsWith        ConditionOperatorEnhanced = "ends_with"
	ConditionOpContains        ConditionOperatorEnhanced = "contains"
	ConditionOpNotContains     ConditionOperatorEnhanced = "not_contains"
	ConditionOpMatches         ConditionOperatorEnhanced = "matches" // Regex
	ConditionOpInIPRange       ConditionOperatorEnhanced = "in_ip_range"
	ConditionOpNotInIPRange    ConditionOperatorEnhanced = "not_in_ip_range"
	ConditionOpGreaterThan     ConditionOperatorEnhanced = "gt"
	ConditionOpLessThan        ConditionOperatorEnhanced = "lt"
	ConditionOpGreaterOrEqual  ConditionOperatorEnhanced = "gte"
	ConditionOpLessOrEqual     ConditionOperatorEnhanced = "lte"
)

// Subject represents who the policy applies to
type Subject struct {
	Type   SubjectType `json:"type" yaml:"type" binding:"required"`
	Values []string    `json:"values" yaml:"values"` // User emails, group names, or role names
}

// AccessScope defines what resources the policy grants access to
type AccessScope struct {
	Type      PolicyScope `json:"type" yaml:"type" binding:"required"`
	ServerIDs []string    `json:"server_ids,omitempty" yaml:"server_ids,omitempty"` // Empty for global
	ToolNames []string    `json:"tool_names,omitempty" yaml:"tool_names,omitempty"` // Empty for entire server
	Resources []string    `json:"resources,omitempty" yaml:"resources,omitempty"`   // Specific resources
}

// PolicyConditionEnhanced represents runtime conditions
type PolicyConditionEnhanced struct {
	Field    MetadataConditionField    `json:"field" yaml:"field" binding:"required"`
	Operator ConditionOperatorEnhanced `json:"operator" yaml:"operator" binding:"required"`
	Value    interface{}               `json:"value" yaml:"value" binding:"required"`
}

// EnhancedPolicy represents a Runlayer-style access policy
type EnhancedPolicy struct {
	// Basic info
	ID          string     `json:"id,omitempty" yaml:"id,omitempty"`
	Name        string     `json:"name" yaml:"name" binding:"required"`
	Description string     `json:"description,omitempty" yaml:"description,omitempty"`
	Type        PolicyType `json:"type" yaml:"type" binding:"required"`
	
	// Policy definition
	Action     PolicyAction              `json:"action" yaml:"action" binding:"required"`
	Priority   int                       `json:"priority" yaml:"priority"` // Higher = evaluated first
	AppliesTo  Subject                   `json:"applies_to" yaml:"applies_to" binding:"required"`
	Scope      AccessScope               `json:"scope" yaml:"scope" binding:"required"`
	Conditions []PolicyConditionEnhanced `json:"conditions,omitempty" yaml:"conditions,omitempty"`
	
	// Metadata
	Enabled   bool       `json:"enabled" yaml:"enabled"`
	OrgID     string     `json:"org_id,omitempty" yaml:"org_id,omitempty"`
	Version   int        `json:"version" yaml:"version"`
	CreatedBy string     `json:"created_by,omitempty" yaml:"created_by,omitempty"`
	CreatedAt *time.Time `json:"created_at,omitempty" yaml:"created_at,omitempty"`
	UpdatedAt *time.Time `json:"updated_at,omitempty" yaml:"updated_at,omitempty"`
	
	// Audit trail
	LastMatchedAt *time.Time `json:"last_matched_at,omitempty" yaml:"last_matched_at,omitempty"`
	MatchCount    int64      `json:"match_count" yaml:"match_count"`
}

// PolicyEvaluationContext contains all metadata for policy evaluation
type PolicyEvaluationContext struct {
	// Subject information
	Subject struct {
		Email  string   `json:"email"`
		Type   string   `json:"type"` // "user" or "agent"
		Roles  []string `json:"roles"`
		Groups []string `json:"groups"`
	} `json:"subject"`
	
	// Request information
	Request struct {
		IP        string `json:"ip"`
		UserAgent string `json:"user_agent"`
		Timestamp string `json:"timestamp"`
	} `json:"request"`
	
	// OAuth information
	OAuth struct {
		Provider string   `json:"provider"`
		Scopes   []string `json:"scopes"`
		Verified bool     `json:"verified"`
	} `json:"oauth"`
	
	// Server information
	Server struct {
		Name     string `json:"name"`
		AuthType string `json:"auth_type"`
		Mode     string `json:"mode"` // "prod", "staging", "dev"
	} `json:"server"`
	
	// Tool invocation
	Tool struct {
		Name      string                 `json:"name"`
		Arguments map[string]interface{} `json:"arguments"`
	} `json:"tool"`
	
	// Additional context
	OrgID     string `json:"org_id,omitempty"`
	SessionID string `json:"session_id,omitempty"`
}

// EnhancedEvaluationRequest represents a request to evaluate enhanced policies
type EnhancedEvaluationRequest struct {
	Context PolicyEvaluationContext `json:"context" binding:"required"`
	
	// For backward compatibility
	User     string                 `json:"user,omitempty"`
	Tool     string                 `json:"tool,omitempty"`
	Resource string                 `json:"resource,omitempty"`
	Payload  map[string]interface{} `json:"payload,omitempty"`
}

// EnhancedEvaluationResult represents the result of enhanced policy evaluation
type EnhancedEvaluationResult struct {
	Decision      PolicyAction           `json:"decision"`       // "allow" or "deny"
	MatchedPolicy *EnhancedPolicy        `json:"matched_policy"` // The policy that made the decision
	Reason        string                 `json:"reason"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	Timestamp     time.Time              `json:"timestamp"`
}

// PolicyListFilter for filtering policies
type PolicyListFilter struct {
	Type      *PolicyType   `json:"type,omitempty"`
	Action    *PolicyAction `json:"action,omitempty"`
	Enabled   *bool         `json:"enabled,omitempty"`
	ServerID  string        `json:"server_id,omitempty"`
	SubjectID string        `json:"subject_id,omitempty"`
	OrgID     string        `json:"org_id,omitempty"`
}
