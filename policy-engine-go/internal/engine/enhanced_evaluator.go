package engine

import (
	"fmt"
	"net"
	"regexp"
	"strings"
	"time"

	"github.com/datacline/policy-engine/internal/models"
	log "github.com/sirupsen/logrus"
)

// EnhancedEngine evaluates Runlayer-style policies
type EnhancedEngine struct {
	policies []*models.EnhancedPolicy
}

// NewEnhancedEngine creates a new enhanced policy engine
func NewEnhancedEngine(policies []*models.EnhancedPolicy) *EnhancedEngine {
	return &EnhancedEngine{
		policies: policies,
	}
}

// Evaluate evaluates a request against all loaded policies
func (e *EnhancedEngine) Evaluate(req *models.EnhancedEvaluationRequest) *models.EnhancedEvaluationResult {
	log.WithFields(log.Fields{
		"user":   req.Context.Subject.Email,
		"tool":   req.Context.Tool.Name,
		"server": req.Context.Server.Name,
	}).Debug("Evaluating enhanced policies")

	// Sort policies by priority (highest first)
	sortedPolicies := e.sortByPriority(e.policies)

	// Default decision: deny (fail-closed)
	result := &models.EnhancedEvaluationResult{
		Decision:  models.PolicyActionDeny,
		Reason:    "No matching policy found - default deny",
		Timestamp: time.Now(),
	}

	// Evaluate global deny policies first
	for _, policy := range sortedPolicies {
		if !policy.Enabled {
			continue
		}

		if policy.Type == models.PolicyTypeGlobal && policy.Action == models.PolicyActionDeny {
			if e.evaluatePolicy(policy, req) {
				result.Decision = models.PolicyActionDeny
				result.MatchedPolicy = policy
				result.Reason = fmt.Sprintf("Denied by global policy: %s", policy.Name)
				
				// Update policy match statistics
				policy.LastMatchedAt = &result.Timestamp
				policy.MatchCount++
				
				log.WithFields(log.Fields{
					"policy": policy.Name,
					"reason": result.Reason,
				}).Info("Global deny policy matched")
				
				return result
			}
		}
	}

	// Evaluate server-level policies
	for _, policy := range sortedPolicies {
		if !policy.Enabled {
			continue
		}

		if policy.Type == models.PolicyTypeServerLevel {
			if e.evaluatePolicy(policy, req) {
				result.Decision = policy.Action
				result.MatchedPolicy = policy
				
				if policy.Action == models.PolicyActionAllow {
					result.Reason = fmt.Sprintf("Allowed by policy: %s", policy.Name)
				} else {
					result.Reason = fmt.Sprintf("Denied by policy: %s", policy.Name)
				}
				
				// Update policy match statistics
				policy.LastMatchedAt = &result.Timestamp
				policy.MatchCount++
				
				log.WithFields(log.Fields{
					"policy":   policy.Name,
					"decision": result.Decision,
					"reason":   result.Reason,
				}).Info("Server-level policy matched")
				
				return result
			}
		}
	}

	// No matching policy - deny by default
	log.WithField("reason", result.Reason).Info("No matching policy")
	return result
}

// evaluatePolicy checks if a policy matches the request
func (e *EnhancedEngine) evaluatePolicy(policy *models.EnhancedPolicy, req *models.EnhancedEvaluationRequest) bool {
	// Check if subject matches
	if !e.evaluateSubject(policy.AppliesTo, req) {
		return false
	}

	// Check if scope matches
	if !e.evaluateScope(policy.Scope, req) {
		return false
	}

	// Check all conditions
	for _, condition := range policy.Conditions {
		if !e.evaluateCondition(condition, req) {
			return false
		}
	}

	return true
}

// evaluateSubject checks if the subject matches
func (e *EnhancedEngine) evaluateSubject(subject models.Subject, req *models.EnhancedEvaluationRequest) bool {
	switch subject.Type {
	case models.SubjectTypeAll:
		return true
	
	case models.SubjectTypeUser:
		// Check if user email matches any in the list
		for _, email := range subject.Values {
			if strings.EqualFold(req.Context.Subject.Email, email) {
				return true
			}
		}
		return false
	
	case models.SubjectTypeGroup:
		// Check if user belongs to any specified group
		for _, group := range subject.Values {
			for _, userGroup := range req.Context.Subject.Groups {
				if strings.EqualFold(userGroup, group) {
					return true
				}
			}
		}
		return false
	
	case models.SubjectTypeRole:
		// Check if user has any specified role
		for _, role := range subject.Values {
			for _, userRole := range req.Context.Subject.Roles {
				if strings.EqualFold(userRole, role) {
					return true
				}
			}
		}
		return false
	
	default:
		return false
	}
}

// evaluateScope checks if the scope matches
func (e *EnhancedEngine) evaluateScope(scope models.AccessScope, req *models.EnhancedEvaluationRequest) bool {
	switch scope.Type {
	case models.PolicyScopeAllServers:
		// Global policies apply to all servers
		return true
	
	case models.PolicyScopeEntireServer:
		// Check if server matches
		for _, serverID := range scope.ServerIDs {
			if strings.EqualFold(req.Context.Server.Name, serverID) {
				return true
			}
		}
		return false
	
	case models.PolicyScopeSpecificTools:
		// Check if server matches first
		serverMatches := false
		for _, serverID := range scope.ServerIDs {
			if strings.EqualFold(req.Context.Server.Name, serverID) {
				serverMatches = true
				break
			}
		}
		if !serverMatches {
			return false
		}
		
		// Then check if tool matches
		for _, toolName := range scope.ToolNames {
			if strings.EqualFold(req.Context.Tool.Name, toolName) {
				return true
			}
		}
		return false
	
	default:
		return false
	}
}

// evaluateCondition checks if a condition matches
func (e *EnhancedEngine) evaluateCondition(condition models.PolicyConditionEnhanced, req *models.EnhancedEvaluationRequest) bool {
	// Get the field value from context
	fieldValue := e.getFieldValue(condition.Field, req)
	
	// Evaluate based on operator
	switch condition.Operator {
	case models.ConditionOpEquals:
		return e.compareEquals(fieldValue, condition.Value)
	
	case models.ConditionOpNotEquals:
		return !e.compareEquals(fieldValue, condition.Value)
	
	case models.ConditionOpIn:
		return e.compareIn(fieldValue, condition.Value)
	
	case models.ConditionOpNotIn:
		return !e.compareIn(fieldValue, condition.Value)
	
	case models.ConditionOpBeginsWith:
		return e.compareBeginsWith(fieldValue, condition.Value)
	
	case models.ConditionOpEndsWith:
		return e.compareEndsWith(fieldValue, condition.Value)
	
	case models.ConditionOpContains:
		return e.compareContains(fieldValue, condition.Value)
	
	case models.ConditionOpNotContains:
		return !e.compareContains(fieldValue, condition.Value)
	
	case models.ConditionOpMatches:
		return e.compareMatches(fieldValue, condition.Value)
	
	case models.ConditionOpInIPRange:
		return e.compareInIPRange(fieldValue, condition.Value)
	
	case models.ConditionOpNotInIPRange:
		return !e.compareInIPRange(fieldValue, condition.Value)
	
	case models.ConditionOpGreaterThan:
		return e.compareGreaterThan(fieldValue, condition.Value)
	
	case models.ConditionOpLessThan:
		return e.compareLessThan(fieldValue, condition.Value)
	
	case models.ConditionOpGreaterOrEqual:
		return e.compareGreaterOrEqual(fieldValue, condition.Value)
	
	case models.ConditionOpLessOrEqual:
		return e.compareLessOrEqual(fieldValue, condition.Value)
	
	default:
		log.WithField("operator", condition.Operator).Warn("Unknown operator")
		return false
	}
}

// getFieldValue extracts the field value from the request context
func (e *EnhancedEngine) getFieldValue(field models.MetadataConditionField, req *models.EnhancedEvaluationRequest) interface{} {
	fieldStr := string(field)
	
	// Handle payload fields (e.g., "payload.table", "payload.to")
	if strings.HasPrefix(fieldStr, "payload.") {
		key := strings.TrimPrefix(fieldStr, "payload.")
		if req.Context.Tool.Arguments != nil {
			return req.Context.Tool.Arguments[key]
		}
		return nil
	}
	
	// Handle metadata fields
	switch field {
	case models.MetadataRequestIP:
		return req.Context.Request.IP
	case models.MetadataRequestUserAgent:
		return req.Context.Request.UserAgent
	case models.MetadataSubjectEmail:
		return req.Context.Subject.Email
	case models.MetadataSubjectRoles:
		return req.Context.Subject.Roles
	case models.MetadataSubjectGroups:
		return req.Context.Subject.Groups
	case models.MetadataSubjectType:
		return req.Context.Subject.Type
	case models.MetadataOAuthProvider:
		return req.Context.OAuth.Provider
	case models.MetadataOAuthScopes:
		return req.Context.OAuth.Scopes
	case models.MetadataOAuthVerified:
		return req.Context.OAuth.Verified
	case models.MetadataServerName:
		return req.Context.Server.Name
	case models.MetadataServerAuth:
		return req.Context.Server.AuthType
	default:
		return nil
	}
}

// Comparison functions

func (e *EnhancedEngine) compareEquals(fieldValue, conditionValue interface{}) bool {
	return fmt.Sprintf("%v", fieldValue) == fmt.Sprintf("%v", conditionValue)
}

func (e *EnhancedEngine) compareIn(fieldValue, conditionValue interface{}) bool {
	// conditionValue should be a slice
	values, ok := conditionValue.([]interface{})
	if !ok {
		return false
	}
	
	fieldStr := fmt.Sprintf("%v", fieldValue)
	for _, v := range values {
		if fieldStr == fmt.Sprintf("%v", v) {
			return true
		}
	}
	return false
}

func (e *EnhancedEngine) compareBeginsWith(fieldValue, conditionValue interface{}) bool {
	// conditionValue can be a string or array of strings
	fieldStr := fmt.Sprintf("%v", fieldValue)
	
	switch v := conditionValue.(type) {
	case string:
		return strings.HasPrefix(fieldStr, v)
	case []interface{}:
		for _, prefix := range v {
			if strings.HasPrefix(fieldStr, fmt.Sprintf("%v", prefix)) {
				return true
			}
		}
	}
	return false
}

func (e *EnhancedEngine) compareEndsWith(fieldValue, conditionValue interface{}) bool {
	fieldStr := fmt.Sprintf("%v", fieldValue)
	
	switch v := conditionValue.(type) {
	case string:
		return strings.HasSuffix(fieldStr, v)
	case []interface{}:
		for _, suffix := range v {
			if strings.HasSuffix(fieldStr, fmt.Sprintf("%v", suffix)) {
				return true
			}
		}
	}
	return false
}

func (e *EnhancedEngine) compareContains(fieldValue, conditionValue interface{}) bool {
	fieldStr := fmt.Sprintf("%v", fieldValue)
	condStr := fmt.Sprintf("%v", conditionValue)
	return strings.Contains(fieldStr, condStr)
}

func (e *EnhancedEngine) compareMatches(fieldValue, conditionValue interface{}) bool {
	fieldStr := fmt.Sprintf("%v", fieldValue)
	pattern := fmt.Sprintf("%v", conditionValue)
	
	matched, err := regexp.MatchString(pattern, fieldStr)
	if err != nil {
		log.WithError(err).Warn("Regex match error")
		return false
	}
	return matched
}

func (e *EnhancedEngine) compareInIPRange(fieldValue, conditionValue interface{}) bool {
	ip := fmt.Sprintf("%v", fieldValue)
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return false
	}
	
	// conditionValue should be an array of CIDR ranges
	ranges, ok := conditionValue.([]interface{})
	if !ok {
		return false
	}
	
	for _, r := range ranges {
		cidr := fmt.Sprintf("%v", r)
		_, ipNet, err := net.ParseCIDR(cidr)
		if err != nil {
			continue
		}
		if ipNet.Contains(parsedIP) {
			return true
		}
	}
	return false
}

func (e *EnhancedEngine) compareGreaterThan(fieldValue, conditionValue interface{}) bool {
	// Simple numeric comparison
	fv, ok1 := fieldValue.(float64)
	cv, ok2 := conditionValue.(float64)
	if ok1 && ok2 {
		return fv > cv
	}
	return false
}

func (e *EnhancedEngine) compareLessThan(fieldValue, conditionValue interface{}) bool {
	fv, ok1 := fieldValue.(float64)
	cv, ok2 := conditionValue.(float64)
	if ok1 && ok2 {
		return fv < cv
	}
	return false
}

func (e *EnhancedEngine) compareGreaterOrEqual(fieldValue, conditionValue interface{}) bool {
	fv, ok1 := fieldValue.(float64)
	cv, ok2 := conditionValue.(float64)
	if ok1 && ok2 {
		return fv >= cv
	}
	return false
}

func (e *EnhancedEngine) compareLessOrEqual(fieldValue, conditionValue interface{}) bool {
	fv, ok1 := fieldValue.(float64)
	cv, ok2 := conditionValue.(float64)
	if ok1 && ok2 {
		return fv <= cv
	}
	return false
}

// sortByPriority sorts policies by priority (highest first)
func (e *EnhancedEngine) sortByPriority(policies []*models.EnhancedPolicy) []*models.EnhancedPolicy {
	sorted := make([]*models.EnhancedPolicy, len(policies))
	copy(sorted, policies)
	
	// Simple bubble sort by priority
	for i := 0; i < len(sorted)-1; i++ {
		for j := 0; j < len(sorted)-i-1; j++ {
			if sorted[j].Priority < sorted[j+1].Priority {
				sorted[j], sorted[j+1] = sorted[j+1], sorted[j]
			}
		}
	}
	
	return sorted
}

// Reload reloads the engine with new policies
func (e *EnhancedEngine) Reload(policies []*models.EnhancedPolicy) {
	e.policies = policies
	log.WithField("count", len(policies)).Info("Enhanced engine reloaded")
}
