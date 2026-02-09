package enhanced

import (
	"net/http"

	"github.com/datacline/policy-engine/internal/engine"
	"github.com/datacline/policy-engine/internal/models"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

// Handler handles enhanced policy API requests
type Handler struct {
	storage *EnhancedStorage
	engine  *engine.EnhancedEngine
}

// NewHandler creates a new enhanced policy handler
func NewHandler(storage *EnhancedStorage) *Handler {
	// Load all policies into engine
	policies := storage.ListPolicies(models.PolicyListFilter{})
	eng := engine.NewEnhancedEngine(policies)
	
	return &Handler{
		storage: storage,
		engine:  eng,
	}
}

// RegisterRoutes registers the enhanced policy routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Policy management
	r.GET("/enhanced/policies", h.ListPolicies)
	r.GET("/enhanced/policies/:id", h.GetPolicy)
	r.POST("/enhanced/policies", h.CreatePolicy)
	r.PUT("/enhanced/policies/:id", h.UpdatePolicy)
	r.DELETE("/enhanced/policies/:id", h.DeletePolicy)
	r.POST("/enhanced/policies/:id/enable", h.EnablePolicy)
	r.POST("/enhanced/policies/:id/disable", h.DisablePolicy)
	
	// Policy evaluation
	r.POST("/enhanced/evaluate", h.EvaluatePolicy)
	
	log.Info("Enhanced policy routes registered")
}

// ListPolicies lists all policies with optional filters
func (h *Handler) ListPolicies(c *gin.Context) {
	var filter models.PolicyListFilter
	
	// Parse query parameters
	if policyType := c.Query("type"); policyType != "" {
		t := models.PolicyType(policyType)
		filter.Type = &t
	}
	if action := c.Query("action"); action != "" {
		a := models.PolicyAction(action)
		filter.Action = &a
	}
	if enabled := c.Query("enabled"); enabled != "" {
		e := enabled == "true"
		filter.Enabled = &e
	}
	filter.ServerID = c.Query("server_id")
	filter.SubjectID = c.Query("subject_id")
	filter.OrgID = c.Query("org_id")
	
	policies := h.storage.ListPolicies(filter)
	
	c.JSON(http.StatusOK, gin.H{
		"policies": policies,
		"count":    len(policies),
	})
}

// GetPolicy gets a policy by ID
func (h *Handler) GetPolicy(c *gin.Context) {
	id := c.Param("id")
	
	policy, err := h.storage.GetPolicy(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Policy not found"})
		return
	}
	
	c.JSON(http.StatusOK, policy)
}

// CreatePolicy creates a new policy
func (h *Handler) CreatePolicy(c *gin.Context) {
	var policy models.EnhancedPolicy
	
	if err := c.ShouldBindJSON(&policy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	created, err := h.storage.CreatePolicy(&policy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	// Reload engine
	h.reloadEngine()
	
	c.JSON(http.StatusCreated, created)
}

// UpdatePolicy updates an existing policy
func (h *Handler) UpdatePolicy(c *gin.Context) {
	id := c.Param("id")
	
	var policy models.EnhancedPolicy
	if err := c.ShouldBindJSON(&policy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	policy.ID = id
	updated, err := h.storage.UpdatePolicy(&policy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	// Reload engine
	h.reloadEngine()
	
	c.JSON(http.StatusOK, updated)
}

// DeletePolicy deletes a policy
func (h *Handler) DeletePolicy(c *gin.Context) {
	id := c.Param("id")
	
	if err := h.storage.DeletePolicy(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	// Reload engine
	h.reloadEngine()
	
	c.JSON(http.StatusOK, gin.H{"message": "Policy deleted successfully"})
}

// EnablePolicy enables a policy
func (h *Handler) EnablePolicy(c *gin.Context) {
	id := c.Param("id")
	
	if err := h.storage.EnablePolicy(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	// Reload engine
	h.reloadEngine()
	
	c.JSON(http.StatusOK, gin.H{"message": "Policy enabled successfully"})
}

// DisablePolicy disables a policy
func (h *Handler) DisablePolicy(c *gin.Context) {
	id := c.Param("id")
	
	if err := h.storage.DisablePolicy(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	// Reload engine
	h.reloadEngine()
	
	c.JSON(http.StatusOK, gin.H{"message": "Policy disabled successfully"})
}

// EvaluatePolicy evaluates a policy request
func (h *Handler) EvaluatePolicy(c *gin.Context) {
	var req models.EnhancedEvaluationRequest
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	result := h.engine.Evaluate(&req)
	
	log.WithFields(log.Fields{
		"decision": result.Decision,
		"reason":   result.Reason,
		"user":     req.Context.Subject.Email,
		"tool":     req.Context.Tool.Name,
	}).Info("Policy evaluated")
	
	c.JSON(http.StatusOK, result)
}

// reloadEngine reloads the evaluation engine with current policies
func (h *Handler) reloadEngine() {
	policies := h.storage.ListPolicies(models.PolicyListFilter{})
	h.engine.Reload(policies)
	log.WithField("count", len(policies)).Debug("Engine reloaded")
}
