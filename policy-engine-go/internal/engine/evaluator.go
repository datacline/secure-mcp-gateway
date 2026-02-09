package engine

import (
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"time"

	"github.com/datacline/policy-engine/internal/models"
	log "github.com/sirupsen/logrus"
)

// Engine is the policy evaluation engine
type Engine struct {
	policies []*models.Policy
}

// NewEngine creates a new policy engine
func NewEngine(policies []*models.Policy) *Engine {
	return &Engine{
		policies: policies,
	}
}

// Evaluate evaluates a request against all loaded policies
func (e *Engine) Evaluate(req *models.PolicyEvaluationRequest) *models.PolicyEvaluationResult {
	log.WithFields(log.Fields{
		"user": req.User,
		"tool": req.Tool,
	}).Debug("Evaluating policies")

	// Default result - allow if no policies match
	result := &models.PolicyEvaluationResult{
		Matched:      false,
		MatchedRules: []string{},
		Action:       models.ActionAllow,
		ShouldBlock:  false,
		Timestamp:    time.Now(),
	}

	var highestPriorityPolicy *models.Policy
	var matchedRules []string
	highestPriority := -1

	// Evaluate each policy
	for _, policy := range e.policies {
		if !policy.Enabled {
			continue
		}

		policyMatched, rules := e.evaluatePolicy(policy, req)
		if policyMatched {
			log.WithFields(log.Fields{
				"policy": policy.Name,
				"rules":  rules,
			}).Info("Policy matched")

			// Track matched rules
			matchedRules = append(matchedRules, rules...)

			// Get highest priority action
			for _, rule := range policy.Rules {
				if rule.Priority > highestPriority && containsRule(rules, rule.ID) {
					highestPriority = rule.Priority
					highestPriorityPolicy = policy
				}
			}
		}
	}

	// Apply action from highest priority policy
	if highestPriorityPolicy != nil {
		result.PolicyID = highestPriorityPolicy.ID
		result.Matched = true
		result.MatchedRules = matchedRules
		
		// Get the action from the highest priority rule
		action, modifications := e.getActionFromPolicy(highestPriorityPolicy, matchedRules)
		result.Action = action
		result.Modifications = modifications

		// Determine if should block
		result.ShouldBlock = (action == models.ActionDeny || action == models.ActionRequireApproval)
		
		// Set message
		if result.ShouldBlock {
			result.Message = fmt.Sprintf("Request blocked by policy: %s", highestPriorityPolicy.Name)
		} else if action == models.ActionModify {
			result.Message = "Request modified by policy"
		} else if action == models.ActionRedact {
			result.Message = "Response will be redacted"
		}

		// Handle enforcement mode
		if highestPriorityPolicy.Enforcement == "audit_only" {
			result.ShouldBlock = false
			result.Message = fmt.Sprintf("Audit only - would have been %s", action)
		}
	}

	return result
}

// evaluatePolicy evaluates a single policy against the request
func (e *Engine) evaluatePolicy(policy *models.Policy, req *models.PolicyEvaluationRequest) (bool, []string) {
	matchedRules := []string{}

	for _, rule := range policy.Rules {
		if e.evaluateRule(&rule, req) {
			matchedRules = append(matchedRules, rule.ID)
		}
	}

	return len(matchedRules) > 0, matchedRules
}

// evaluateRule evaluates a single rule against the request
func (e *Engine) evaluateRule(rule *models.PolicyRule, req *models.PolicyEvaluationRequest) bool {
	// All conditions must match for the rule to match
	for _, condition := range rule.Conditions {
		if !e.evaluateCondition(&condition, req) {
			return false
		}
	}
	return true
}

// evaluateCondition evaluates a single condition
func (e *Engine) evaluateCondition(cond *models.Condition, req *models.PolicyEvaluationRequest) bool {
	var actualValue interface{}

	// Extract actual value based on condition type
	switch cond.Type {
	case models.ConditionTypeUser:
		actualValue = e.getFieldValue(req.User, cond.Field, req.Context)
	case models.ConditionTypeTool:
		actualValue = e.getFieldValue(req.Tool, cond.Field, req.Context)
	case models.ConditionTypeResource:
		actualValue = e.getFieldValue(req.Resource, cond.Field, req.Context)
	case models.ConditionTypeTime:
		if req.Timestamp != nil {
			actualValue = *req.Timestamp
		} else {
			actualValue = time.Now()
		}
	case models.ConditionTypeData:
		if req.Parameters != nil {
			actualValue = req.Parameters[cond.Field]
		}
	case models.ConditionTypeRate:
		// Rate limiting would need external state - placeholder
		actualValue = 0
	default:
		log.WithField("type", cond.Type).Warn("Unknown condition type")
		return false
	}

	// Compare using operator
	return e.compareValues(actualValue, cond.Value, cond.Operator)
}

// getFieldValue extracts a field value (supports dot notation)
func (e *Engine) getFieldValue(base interface{}, field string, context map[string]interface{}) interface{} {
	// If field is empty, return base
	if field == "" {
		return base
	}

	// Check context first
	if context != nil {
		if val, ok := context[field]; ok {
			return val
		}
	}

	// Handle dot notation for nested fields
	if strings.Contains(field, ".") {
		parts := strings.Split(field, ".")
		current := base
		for _, part := range parts {
			if m, ok := current.(map[string]interface{}); ok {
				current = m[part]
			} else {
				return nil
			}
		}
		return current
	}

	return base
}

// compareValues compares two values using the specified operator
func (e *Engine) compareValues(actual, expected interface{}, op models.ConditionOperator) bool {
	switch op {
	case models.OperatorEq:
		return reflect.DeepEqual(actual, expected)
		
	case models.OperatorNeq:
		return !reflect.DeepEqual(actual, expected)
		
	case models.OperatorIn:
		if expectedSlice, ok := expected.([]interface{}); ok {
			for _, v := range expectedSlice {
				if reflect.DeepEqual(actual, v) {
					return true
				}
			}
		}
		return false
		
	case models.OperatorNotIn:
		if expectedSlice, ok := expected.([]interface{}); ok {
			for _, v := range expectedSlice {
				if reflect.DeepEqual(actual, v) {
					return false
				}
			}
			return true
		}
		return false
		
	case models.OperatorGt, models.OperatorLt, models.OperatorGte, models.OperatorLte:
		return e.compareNumeric(actual, expected, op)
		
	case models.OperatorMatches:
		if actualStr, ok := actual.(string); ok {
			if pattern, ok := expected.(string); ok {
				matched, err := regexp.MatchString(pattern, actualStr)
				return err == nil && matched
			}
		}
		return false
		
	case models.OperatorContains:
		if actualStr, ok := actual.(string); ok {
			if substr, ok := expected.(string); ok {
				return strings.Contains(actualStr, substr)
			}
		}
		return false
		
	default:
		log.WithField("operator", op).Warn("Unknown operator")
		return false
	}
}

// compareNumeric compares numeric values
func (e *Engine) compareNumeric(actual, expected interface{}, op models.ConditionOperator) bool {
	actualFloat, actualOk := toFloat64(actual)
	expectedFloat, expectedOk := toFloat64(expected)
	
	if !actualOk || !expectedOk {
		return false
	}
	
	switch op {
	case models.OperatorGt:
		return actualFloat > expectedFloat
	case models.OperatorLt:
		return actualFloat < expectedFloat
	case models.OperatorGte:
		return actualFloat >= expectedFloat
	case models.OperatorLte:
		return actualFloat <= expectedFloat
	default:
		return false
	}
}

// getActionFromPolicy gets the action from matched rules
func (e *Engine) getActionFromPolicy(policy *models.Policy, matchedRules []string) (models.ActionType, map[string]interface{}) {
	var highestPriorityRule *models.PolicyRule
	highestPriority := -1
	
	for _, rule := range policy.Rules {
		if containsRule(matchedRules, rule.ID) && rule.Priority > highestPriority {
			highestPriority = rule.Priority
			highestPriorityRule = &rule
		}
	}
	
	if highestPriorityRule != nil && len(highestPriorityRule.Actions) > 0 {
		action := highestPriorityRule.Actions[0]
		return action.Type, action.Params
	}
	
	return models.ActionAllow, nil
}

// Helper functions

func containsRule(rules []string, ruleID string) bool {
	for _, r := range rules {
		if r == ruleID {
			return true
		}
	}
	return false
}

func toFloat64(v interface{}) (float64, bool) {
	switch val := v.(type) {
	case float64:
		return val, true
	case float32:
		return float64(val), true
	case int:
		return float64(val), true
	case int32:
		return float64(val), true
	case int64:
		return float64(val), true
	default:
		return 0, false
	}
}
