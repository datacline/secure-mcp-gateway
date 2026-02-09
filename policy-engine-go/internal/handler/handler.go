package handler

import (
	"net/http"
	"sync"

	"github.com/datacline/policy-engine/internal/engine"
	"github.com/datacline/policy-engine/internal/models"
	"github.com/datacline/policy-engine/internal/storage"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

// Handler handles HTTP requests for policy evaluation and management
type Handler struct {
	engine  *engine.Engine
	storage *storage.Storage
	mu      sync.RWMutex
}

// NewHandler creates a new handler
func NewHandler(policyDir string) (*Handler, error) {
	// Initialize storage
	store := storage.NewStorage(policyDir)
	
	// Load all policies
	policies, err := store.LoadAll()
	if err != nil {
		return nil, err
	}

	return &Handler{
		engine:  engine.NewEngine(policies),
		storage: store,
	}, nil
}

// Evaluate handles policy evaluation requests
func (h *Handler) Evaluate(c *gin.Context) {
	var req models.PolicyEvaluationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.mu.RLock()
	result := h.engine.Evaluate(&req)
	h.mu.RUnlock()

	c.JSON(http.StatusOK, result)
}

// BatchEvaluate handles batch policy evaluation requests
func (h *Handler) BatchEvaluate(c *gin.Context) {
	var req models.BatchEvaluationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	results := make([]models.PolicyEvaluationResult, len(req.Requests))
	
	h.mu.RLock()
	for i, r := range req.Requests {
		results[i] = *h.engine.Evaluate(&r)
	}
	h.mu.RUnlock()

	c.JSON(http.StatusOK, models.BatchEvaluationResponse{
		Results: results,
	})
}

// HealthCheck handles health check requests
func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "policy-engine",
	})
}

// Reload reloads policies from disk
func (h *Handler) Reload(c *gin.Context) {
	policies, err := h.storage.LoadAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.mu.Lock()
	h.engine = engine.NewEngine(policies)
	h.mu.Unlock()

	log.WithField("count", len(policies)).Info("Policies reloaded")
	c.JSON(http.StatusOK, gin.H{
		"status": "reloaded",
		"count":  len(policies),
	})
}

// ============================================================================
// CRUD Operations for Policy Management
// ============================================================================

// ListPolicies returns all policies
func (h *Handler) ListPolicies(c *gin.Context) {
	policies := h.storage.GetAll()
	
	c.JSON(http.StatusOK, gin.H{
		"policies": policies,
		"count":    len(policies),
	})
}

// GetPolicy returns a specific policy by ID
func (h *Handler) GetPolicy(c *gin.Context) {
	id := c.Param("id")
	
	policy, err := h.storage.Get(id)
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

	// Validate policy
	if err := h.storage.Validate(&policy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create policy
	if err := h.storage.Create(&policy); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	// Reload engine with new policy
	h.reloadEngine()

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

	// Validate policy
	if err := h.storage.Validate(&policy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update policy
	if err := h.storage.Update(id, &policy); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Reload engine with updated policy
	h.reloadEngine()

	c.JSON(http.StatusOK, policy)
}

// DeletePolicy deletes a policy
func (h *Handler) DeletePolicy(c *gin.Context) {
	id := c.Param("id")
	
	if err := h.storage.Delete(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Reload engine without deleted policy
	h.reloadEngine()

	c.JSON(http.StatusOK, gin.H{
		"status":  "deleted",
		"policy_id": id,
	})
}

// EnablePolicy enables a policy
func (h *Handler) EnablePolicy(c *gin.Context) {
	id := c.Param("id")
	
	if err := h.storage.Enable(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Reload engine
	h.reloadEngine()

	c.JSON(http.StatusOK, gin.H{
		"status":    "enabled",
		"policy_id": id,
	})
}

// DisablePolicy disables a policy
func (h *Handler) DisablePolicy(c *gin.Context) {
	id := c.Param("id")
	
	if err := h.storage.Disable(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Reload engine
	h.reloadEngine()

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

	if err := h.storage.Validate(&policy); err != nil {
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

// Helper to reload engine
func (h *Handler) reloadEngine() {
	policies := h.storage.GetAll()
	
	h.mu.Lock()
	h.engine = engine.NewEngine(policies)
	h.mu.Unlock()
	
	log.WithField("count", len(policies)).Debug("Engine reloaded after policy change")
}
