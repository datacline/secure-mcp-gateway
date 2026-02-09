package models

import "time"

// ConditionType represents the type of condition to evaluate
type ConditionType string

const (
	ConditionTypeUser     ConditionType = "user"
	ConditionTypeTime     ConditionType = "time"
	ConditionTypeResource ConditionType = "resource"
	ConditionTypeRate     ConditionType = "rate"
	ConditionTypeData     ConditionType = "data"
	ConditionTypeTool     ConditionType = "tool"
)

// ConditionOperator represents the comparison operator
type ConditionOperator string

const (
	OperatorEq       ConditionOperator = "eq"
	OperatorNeq      ConditionOperator = "neq"
	OperatorIn       ConditionOperator = "in"
	OperatorNotIn    ConditionOperator = "not_in"
	OperatorGt       ConditionOperator = "gt"
	OperatorLt       ConditionOperator = "lt"
	OperatorGte      ConditionOperator = "gte"
	OperatorLte      ConditionOperator = "lte"
	OperatorMatches  ConditionOperator = "matches"
	OperatorContains ConditionOperator = "contains"
)

// ActionType represents the action to take when a policy matches
type ActionType string

const (
	ActionAllow           ActionType = "allow"
	ActionDeny            ActionType = "deny"
	ActionRequireApproval ActionType = "require_approval"
	ActionRedact          ActionType = "redact"
	ActionRateLimit       ActionType = "rate_limit"
	ActionLogOnly         ActionType = "log_only"
	ActionModify          ActionType = "modify"
)

// Condition represents a single policy condition
type Condition struct {
	Type     ConditionType     `json:"type" yaml:"type" binding:"required"`
	Operator ConditionOperator `json:"operator" yaml:"operator" binding:"required"`
	Field    string            `json:"field" yaml:"field" binding:"required"`
	Value    interface{}       `json:"value" yaml:"value" binding:"required"`
}

// Action represents an action to take
type Action struct {
	Type   ActionType             `json:"type" yaml:"type" binding:"required"`
	Params map[string]interface{} `json:"params,omitempty" yaml:"params,omitempty"`
}

// PolicyRule represents a single rule within a policy
type PolicyRule struct {
	ID          string      `json:"id" yaml:"id" binding:"required"`
	Conditions  []Condition `json:"conditions" yaml:"conditions" binding:"required"`
	Actions     []Action    `json:"actions" yaml:"actions" binding:"required"`
	Priority    int         `json:"priority" yaml:"priority"`
	Description string      `json:"description,omitempty" yaml:"description,omitempty"`
}

// Policy represents a complete policy definition
type Policy struct {
	ID          string       `json:"id,omitempty" yaml:"id,omitempty"`
	Name        string       `json:"name" yaml:"name" binding:"required"`
	Description string       `json:"description,omitempty" yaml:"description,omitempty"`
	OrgID       string       `json:"org_id,omitempty" yaml:"org_id,omitempty"`
	Version     int          `json:"version" yaml:"version"`
	Enabled     bool         `json:"enabled" yaml:"enabled"`
	Rules       []PolicyRule `json:"rules" yaml:"rules" binding:"required"`
	Enforcement string       `json:"enforcement" yaml:"enforcement"` // "blocking" or "audit_only"
	CreatedBy   string       `json:"created_by,omitempty" yaml:"created_by,omitempty"`
	CreatedAt   *time.Time   `json:"created_at,omitempty" yaml:"created_at,omitempty"`
	UpdatedAt   *time.Time   `json:"updated_at,omitempty" yaml:"updated_at,omitempty"`
}

// PolicyEvaluationRequest represents a request to evaluate policies
type PolicyEvaluationRequest struct {
	User         string                 `json:"user" binding:"required"`
	Tool         string                 `json:"tool" binding:"required"`
	Resource     string                 `json:"resource,omitempty"`
	Action       string                 `json:"action,omitempty"`
	Parameters   map[string]interface{} `json:"parameters,omitempty"`
	Context      map[string]interface{} `json:"context,omitempty"`
	Timestamp    *time.Time             `json:"timestamp,omitempty"`
	OrgID        string                 `json:"org_id,omitempty"`
	SessionID    string                 `json:"session_id,omitempty"`
	IPAddress    string                 `json:"ip_address,omitempty"`
	UserAgent    string                 `json:"user_agent,omitempty"`
}

// PolicyEvaluationResult represents the result of policy evaluation
type PolicyEvaluationResult struct {
	PolicyID      string                 `json:"policy_id"`
	Matched       bool                   `json:"matched"`
	MatchedRules  []string               `json:"matched_rules"`
	Action        ActionType             `json:"action"`
	Modifications map[string]interface{} `json:"modifications,omitempty"`
	Message       string                 `json:"message,omitempty"`
	ShouldBlock   bool                   `json:"should_block"`
	Timestamp     time.Time              `json:"timestamp"`
}

// BatchEvaluationRequest represents a batch evaluation request
type BatchEvaluationRequest struct {
	Requests []PolicyEvaluationRequest `json:"requests" binding:"required"`
}

// BatchEvaluationResponse represents a batch evaluation response
type BatchEvaluationResponse struct {
	Results []PolicyEvaluationResult `json:"results"`
}
