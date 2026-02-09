// Policy Types - matching Go Policy Engine schema

export type ConditionType = 'user' | 'time' | 'resource' | 'rate' | 'data' | 'tool';

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'not_in'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'matches'
  | 'contains';

export type ActionType =
  | 'allow'
  | 'deny'
  | 'require_approval'
  | 'redact'
  | 'rate_limit'
  | 'log_only'
  | 'modify';

export type EnforcementMode = 'blocking' | 'audit_only';

export interface Condition {
  type: ConditionType;
  operator: ConditionOperator;
  field: string;
  value: any;
}

export interface Action {
  type: ActionType;
  params?: Record<string, any>;
}

export interface PolicyRule {
  id: string;
  description?: string;
  priority: number;
  conditions: Condition[];
  actions: Action[];
}

export interface Policy {
  id?: string;
  name: string;
  description?: string;
  org_id?: string;
  version?: number;
  enabled: boolean;
  enforcement: EnforcementMode;
  rules: PolicyRule[];
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PolicyListResponse {
  policies: Policy[];
  count: number;
}

export interface PolicyValidationError {
  valid: false;
  error: string;
}

export interface PolicyValidationSuccess {
  valid: true;
  message: string;
}

export type PolicyValidationResponse = PolicyValidationError | PolicyValidationSuccess;

// ============================================================================
// Unified Policy Types - Based on Authoritative Context
// ============================================================================

export type PolicyStatus = 'draft' | 'active' | 'suspended' | 'retired';
export type PrincipalType = 'user' | 'role' | 'organization';
export type ResourceType = 'mcp_server' | 'tool' | 'resource';

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'matches'
  | 'in'
  | 'not_in'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'exists'
  | 'not_exists';

export type RuleActionType = 'allow' | 'deny' | 'redact' | 'transform' | 'audit';

// Rule condition with support for boolean composition (all/any)
export interface RuleCondition {
  field?: string;
  operator?: RuleOperator;
  value?: any;
  all?: RuleCondition[];
  any?: RuleCondition[];
}

// Rule action in DSL
export interface RuleAction {
  type: RuleActionType;
  params?: Record<string, any>;
}

// Policy rule in DSL format
export interface PolicyRuleDSL {
  rule_id: string;
  priority: number;
  description?: string;
  conditions?: RuleCondition;
  actions: RuleAction[];
}

// Resource binding
export interface PolicyResource {
  policy_id: string;
  resource_type: ResourceType;
  resource_id: string;
}

// Scope binding (principal applicability)
export interface PolicyPrincipalScope {
  policy_id: string;
  principal_type: PrincipalType;
  principal_id: string;
}

// Unified Policy entity
export interface UnifiedPolicy {
  policy_id: string;
  policy_code: string;
  name?: string;
  description?: string;
  policy_rules: PolicyRuleDSL[];
  version: number;
  status: PolicyStatus;
  priority: number;
  effective_from?: string;
  effective_to?: string;
  owner_id?: string;
  approved_by_id?: string;
  approved_at?: string;
  org_id?: string;
  created_at?: string;
  updated_at?: string;
  resources?: PolicyResource[];
  scopes?: PolicyPrincipalScope[];
}

export interface UnifiedPolicyListResponse {
  policies: UnifiedPolicy[];
  count: number;
}

export interface ResourcePoliciesResponse {
  policies: UnifiedPolicy[];
  count: number;
  resource_type: ResourceType;
  resource_id: string;
}

// Request types for creating/updating unified policies
export interface UnifiedPolicyCreateRequest {
  policy_code: string;
  name?: string;
  description?: string;
  policy_rules: PolicyRuleDSL[];
  status?: PolicyStatus;
  priority?: number;
  effective_from?: string;
  effective_to?: string;
  owner_id?: string;
  org_id?: string;
  resources?: Omit<PolicyResource, 'policy_id'>[];
  scopes?: Omit<PolicyPrincipalScope, 'policy_id'>[];
}

export interface UnifiedPolicyUpdateRequest {
  policy_code?: string;
  name?: string;
  description?: string;
  policy_rules?: PolicyRuleDSL[];
  status?: PolicyStatus;
  priority?: number;
  effective_from?: string;
  effective_to?: string;
  resources?: Omit<PolicyResource, 'policy_id'>[];
  scopes?: Omit<PolicyPrincipalScope, 'policy_id'>[];
}
