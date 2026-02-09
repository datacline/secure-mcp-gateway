package unified

import (
	"net/http"
	"sort"

	"github.com/datacline/policy-engine/internal/models"
	"github.com/datacline/policy-engine/internal/storage"
	"github.com/gin-gonic/gin"
)

// Handler provides API endpoints for unified policy management
type Handler struct {
	storage *storage.UnifiedStorage
}

// NewHandler creates a new unified policy handler
func NewHandler(storage *storage.UnifiedStorage) *Handler {
	return &Handler{storage: storage}
}

// RegisterRoutes registers all unified policy API routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Policy CRUD
	r.GET("/unified/policies", h.ListPolicies)
	r.GET("/unified/policies/:id", h.GetPolicy)
	r.GET("/unified/policies/code/:code", h.GetPolicyByCode)
	r.POST("/unified/policies", h.CreatePolicy)
	r.PUT("/unified/policies/:id", h.UpdatePolicy)
	r.DELETE("/unified/policies/:id", h.DeletePolicy)

	// Policy lifecycle
	r.POST("/unified/policies/:id/activate", h.ActivatePolicy)
	r.POST("/unified/policies/:id/suspend", h.SuspendPolicy)
	r.POST("/unified/policies/:id/retire", h.RetirePolicy)

	// Resource bindings
	r.GET("/unified/resources/:type/:id/policies", h.GetPoliciesByResource)
	r.POST("/unified/policies/:id/resources", h.AddResourceBinding)
	r.DELETE("/unified/policies/:id/resources/:type/:resourceId", h.RemoveResourceBinding)

	// Reload from disk
	r.POST("/unified/reload", h.Reload)
}

// ListPolicies returns all policies matching optional filters
func (h *Handler) ListPolicies(c *gin.Context) {
	var filter models.UnifiedPolicyListFilter

	// Parse query parameters
	if status := c.Query("status"); status != "" {
		s := models.PolicyStatus(status)
		filter.Status = &s
	}
	filter.OrgID = c.Query("org_id")
	filter.OwnerID = c.Query("owner_id")
	filter.ResourceType = models.ResourceType(c.Query("resource_type"))
	filter.ResourceID = c.Query("resource_id")

	policies := h.storage.List(&filter)

	// Sort by priority (higher first) then by name
	sort.Slice(policies, func(i, j int) bool {
		if policies[i].Priority != policies[j].Priority {
			return policies[i].Priority > policies[j].Priority
		}
		return policies[i].PolicyCode < policies[j].PolicyCode
	})

	c.JSON(http.StatusOK, gin.H{
		"policies": policies,
		"count":    len(policies),
	})
}

// GetPolicy retrieves a policy by ID
func (h *Handler) GetPolicy(c *gin.Context) {
	id := c.Param("id")

	policy, err := h.storage.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, policy)
}

// GetPolicyByCode retrieves a policy by its human-readable code
func (h *Handler) GetPolicyByCode(c *gin.Context) {
	code := c.Param("code")

	policy, err := h.storage.GetByCode(code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, policy)
}

// CreatePolicy creates a new policy
func (h *Handler) CreatePolicy(c *gin.Context) {
	var req models.UnifiedPolicyCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate policy rules
	if err := validatePolicyRules(req.PolicyRules); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	policy, err := h.storage.Create(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, policy)
}

// UpdatePolicy updates an existing policy
func (h *Handler) UpdatePolicy(c *gin.Context) {
	id := c.Param("id")

	var req models.UnifiedPolicyUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate policy rules if provided
	if req.PolicyRules != nil {
		if err := validatePolicyRules(req.PolicyRules); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	policy, err := h.storage.Update(id, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, policy)
}

// DeletePolicy removes a policy
func (h *Handler) DeletePolicy(c *gin.Context) {
	id := c.Param("id")

	if err := h.storage.Delete(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Policy deleted"})
}

// ActivatePolicy activates a policy
func (h *Handler) ActivatePolicy(c *gin.Context) {
	id := c.Param("id")

	if err := h.storage.Activate(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	policy, _ := h.storage.GetByID(id)
	c.JSON(http.StatusOK, policy)
}

// SuspendPolicy suspends a policy
func (h *Handler) SuspendPolicy(c *gin.Context) {
	id := c.Param("id")

	if err := h.storage.Suspend(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	policy, _ := h.storage.GetByID(id)
	c.JSON(http.StatusOK, policy)
}

// RetirePolicy retires a policy
func (h *Handler) RetirePolicy(c *gin.Context) {
	id := c.Param("id")

	if err := h.storage.Retire(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	policy, _ := h.storage.GetByID(id)
	c.JSON(http.StatusOK, policy)
}

// GetPoliciesByResource returns all policies bound to a specific resource
func (h *Handler) GetPoliciesByResource(c *gin.Context) {
	resourceType := models.ResourceType(c.Param("type"))
	resourceID := c.Param("id")

	// Validate resource type
	if resourceType != models.ResourceTypeMCPServer &&
		resourceType != models.ResourceTypeTool &&
		resourceType != models.ResourceTypeResource {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid resource type"})
		return
	}

	activeOnly := c.Query("active") == "true"

	var policies []*models.UnifiedPolicy
	var err error

	if activeOnly {
		policies, err = h.storage.GetActiveByResource(resourceType, resourceID)
	} else {
		policies, err = h.storage.GetByResource(resourceType, resourceID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Include global policies if requested
	includeGlobal := c.Query("include_global") == "true"
	if includeGlobal {
		globalPolicies := h.storage.GetGlobalPolicies()
		policies = append(policies, globalPolicies...)
	}

	// Sort by priority (higher first)
	sort.Slice(policies, func(i, j int) bool {
		return policies[i].Priority > policies[j].Priority
	})

	c.JSON(http.StatusOK, gin.H{
		"policies":      policies,
		"count":         len(policies),
		"resource_type": resourceType,
		"resource_id":   resourceID,
	})
}

// AddResourceBinding adds a resource binding to a policy
func (h *Handler) AddResourceBinding(c *gin.Context) {
	policyID := c.Param("id")

	var req struct {
		ResourceType models.ResourceType `json:"resource_type" binding:"required"`
		ResourceID   string              `json:"resource_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.storage.AddResource(policyID, req.ResourceType, req.ResourceID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	policy, _ := h.storage.GetByID(policyID)
	c.JSON(http.StatusOK, policy)
}

// RemoveResourceBinding removes a resource binding from a policy
func (h *Handler) RemoveResourceBinding(c *gin.Context) {
	policyID := c.Param("id")
	resourceType := models.ResourceType(c.Param("type"))
	resourceID := c.Param("resourceId")

	if err := h.storage.RemoveResource(policyID, resourceType, resourceID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	policy, _ := h.storage.GetByID(policyID)
	c.JSON(http.StatusOK, policy)
}

// Reload reloads all policies from disk
func (h *Handler) Reload(c *gin.Context) {
	if err := h.storage.LoadAll(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	policies := h.storage.GetAll()
	c.JSON(http.StatusOK, gin.H{
		"message": "Policies reloaded",
		"count":   len(policies),
	})
}

// validatePolicyRules validates the policy rules DSL
func validatePolicyRules(rules []models.PolicyRuleDSL) error {
	for _, rule := range rules {
		if rule.RuleID == "" {
			return &ValidationError{Field: "rule_id", Message: "rule_id is required"}
		}
		if len(rule.Actions) == 0 {
			return &ValidationError{Field: "actions", Message: "at least one action is required"}
		}
		for _, action := range rule.Actions {
			if !isValidActionType(action.Type) {
				return &ValidationError{Field: "action.type", Message: "invalid action type: " + string(action.Type)}
			}
		}
		if rule.Conditions != nil {
			if err := validateCondition(rule.Conditions); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateCondition(cond *models.RuleCondition) error {
	// Check if it's a boolean composition
	if len(cond.All) > 0 || len(cond.Any) > 0 {
		for _, c := range cond.All {
			if err := validateCondition(&c); err != nil {
				return err
			}
		}
		for _, c := range cond.Any {
			if err := validateCondition(&c); err != nil {
				return err
			}
		}
		return nil
	}

	// It's a leaf condition
	if cond.Field == "" {
		return &ValidationError{Field: "field", Message: "field is required in condition"}
	}
	if !isValidOperator(cond.Operator) {
		return &ValidationError{Field: "operator", Message: "invalid operator: " + string(cond.Operator)}
	}
	return nil
}

func isValidActionType(t models.RuleActionType) bool {
	switch t {
	case models.RuleActionAllow, models.RuleActionDeny, models.RuleActionRedact,
		models.RuleActionTransform, models.RuleActionAudit:
		return true
	}
	return false
}

func isValidOperator(op models.RuleOperator) bool {
	switch op {
	case models.RuleOpEquals, models.RuleOpNotEquals, models.RuleOpContains,
		models.RuleOpNotContains, models.RuleOpMatches, models.RuleOpIn,
		models.RuleOpNotIn, models.RuleOpGt, models.RuleOpLt,
		models.RuleOpGte, models.RuleOpLte, models.RuleOpExists, models.RuleOpNotExists:
		return true
	}
	return false
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return e.Field + ": " + e.Message
}
