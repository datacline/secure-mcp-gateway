package management

import (
	"net/http"

	"github.com/datacline/policy-engine/internal/models"
	"github.com/datacline/policy-engine/internal/services/evaluation"
	"github.com/datacline/policy-engine/internal/services/management"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

// Handler handles HTTP requests for policy management (CRUD)
type Handler struct {
	managementService *management.Service
	evaluationService *evaluation.Service
}

// NewHandler creates a new management handler
func NewHandler(managementService *management.Service, evaluationService *evaluation.Service) *Handler {
	return &Handler{
		managementService: managementService,
		evaluationService: evaluationService,
	}
}

// RegisterRoutes registers management routes
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	// CRUD operations
	router.GET("/policies", h.ListPolicies)
	router.GET("/policies/:id", h.GetPolicy)
	router.POST("/policies", h.CreatePolicy)
	router.PUT("/policies/:id", h.UpdatePolicy)
	router.DELETE("/policies/:id", h.DeletePolicy)
	
	// Policy operations
	router.POST("/policies/:id/enable", h.EnablePolicy)
	router.POST("/policies/:id/disable", h.DisablePolicy)
	router.POST("/policies/validate", h.ValidatePolicy)
	
	// Reload
	router.POST("/reload", h.Reload)
}

// ListPolicies returns all policies
func (h *Handler) ListPolicies(c *gin.Context) {
	policies := h.managementService.ListPolicies()
	
	c.JSON(http.StatusOK, gin.H{
		"policies": policies,
		"count":    len(policies),
	})
}

// GetPolicy returns a specific policy by ID
func (h *Handler) GetPolicy(c *gin.Context) {
	id := c.Param("id")
	
	policy, err := h.managementService.GetPolicy(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, policy)
}

// CreatePolicy creates a new policy
func (h *Handler) CreatePolicy(c *gin.Context) {
	var policy models.Policy
	if err := c.ShouldBindJSON(&policy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.managementService.CreatePolicy(&policy); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	// Reload evaluation engine
	h.reloadEvaluationEngine()

	c.JSON(http.StatusCreated, policy)
}

// UpdatePolicy updates an existing policy
func (h *Handler) UpdatePolicy(c *gin.Context) {
	id := c.Param("id")
	
	var policy models.Policy
	if err := c.ShouldBindJSON(&policy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.managementService.UpdatePolicy(id, &policy); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Reload evaluation engine
	h.reloadEvaluationEngine()

	c.JSON(http.StatusOK, policy)
}

// DeletePolicy deletes a policy
func (h *Handler) DeletePolicy(c *gin.Context) {
	id := c.Param("id")
	
	if err := h.managementService.DeletePolicy(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Reload evaluation engine
	h.reloadEvaluationEngine()

	c.JSON(http.StatusOK, gin.H{
		"status":    "deleted",
		"policy_id": id,
	})
}

// EnablePolicy enables a policy
func (h *Handler) EnablePolicy(c *gin.Context) {
	id := c.Param("id")
	
	if err := h.managementService.EnablePolicy(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Reload evaluation engine
	h.reloadEvaluationEngine()

	c.JSON(http.StatusOK, gin.H{
		"status":    "enabled",
		"policy_id": id,
	})
}

// DisablePolicy disables a policy
func (h *Handler) DisablePolicy(c *gin.Context) {
	id := c.Param("id")
	
	if err := h.managementService.DisablePolicy(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Reload evaluation engine
	h.reloadEvaluationEngine()

	c.JSON(http.StatusOK, gin.H{
		"status":    "disabled",
		"policy_id": id,
	})
}

// ValidatePolicy validates a policy without saving it
func (h *Handler) ValidatePolicy(c *gin.Context) {
	var policy models.Policy
	if err := c.ShouldBindJSON(&policy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.managementService.ValidatePolicy(&policy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"valid": false,
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":   true,
		"message": "Policy is valid",
	})
}

// Reload reloads policies from disk
func (h *Handler) Reload(c *gin.Context) {
	policies, err := h.managementService.ReloadFromDisk()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload evaluation engine
	h.evaluationService.Reload(policies)

	log.WithField("count", len(policies)).Info("Policies reloaded")
	c.JSON(http.StatusOK, gin.H{
		"status": "reloaded",
		"count":  len(policies),
	})
}

// HealthCheck handles health check requests
func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "policy-management",
	})
}

// Helper to reload evaluation engine
func (h *Handler) reloadEvaluationEngine() {
	policies := h.managementService.ListPolicies()
	h.evaluationService.Reload(policies)
	log.WithField("count", len(policies)).Debug("Evaluation engine reloaded after management operation")
}

// LogManagement logs management operations (can be used as middleware)
func LogManagement(c *gin.Context) {
	log.WithFields(log.Fields{
		"method": c.Request.Method,
		"path":   c.Request.URL.Path,
		"ip":     c.ClientIP(),
	}).Info("Management operation")
	c.Next()
}
