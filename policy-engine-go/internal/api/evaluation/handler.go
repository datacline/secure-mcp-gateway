package evaluation

import (
	"net/http"

	"github.com/datacline/policy-engine/internal/models"
	"github.com/datacline/policy-engine/internal/services/evaluation"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

// Handler handles HTTP requests for policy evaluation
type Handler struct {
	service *evaluation.Service
}

// NewHandler creates a new evaluation handler
func NewHandler(service *evaluation.Service) *Handler {
	return &Handler{
		service: service,
	}
}

// RegisterRoutes registers evaluation routes
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	router.POST("/evaluate", h.Evaluate)
	router.POST("/evaluate/batch", h.BatchEvaluate)
}

// Evaluate handles single policy evaluation
func (h *Handler) Evaluate(c *gin.Context) {
	var req models.PolicyEvaluationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.Evaluate(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// BatchEvaluate handles batch policy evaluation
func (h *Handler) BatchEvaluate(c *gin.Context) {
	var req models.BatchEvaluationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.service.BatchEvaluate(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// HealthCheck handles health check requests
func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "policy-evaluation",
	})
}

// LogEvaluation logs evaluation details (can be used as middleware)
func LogEvaluation(c *gin.Context) {
	log.WithFields(log.Fields{
		"method": c.Request.Method,
		"path":   c.Request.URL.Path,
		"ip":     c.ClientIP(),
	}).Debug("Evaluation request received")
	c.Next()
}
