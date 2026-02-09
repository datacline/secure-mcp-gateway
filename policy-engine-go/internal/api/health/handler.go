package health

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler handles health check requests
type Handler struct {
	serviceName string
}

// NewHandler creates a new health handler
func NewHandler(serviceName string) *Handler {
	return &Handler{
		serviceName: serviceName,
	}
}

// RegisterRoutes registers health routes
func (h *Handler) RegisterRoutes(router *gin.Engine) {
	router.GET("/health", h.HealthCheck)
	router.GET("/ready", h.ReadinessCheck)
	router.GET("/live", h.LivenessCheck)
}

// HealthCheck handles health check requests
func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": h.serviceName,
	})
}

// ReadinessCheck handles readiness check requests
func (h *Handler) ReadinessCheck(c *gin.Context) {
	// Add checks for dependencies (storage, etc.)
	c.JSON(http.StatusOK, gin.H{
		"status":  "ready",
		"service": h.serviceName,
	})
}

// LivenessCheck handles liveness check requests
func (h *Handler) LivenessCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "alive",
		"service": h.serviceName,
	})
}
