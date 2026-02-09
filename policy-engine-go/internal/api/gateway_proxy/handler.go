package gateway_proxy

import (
	"net/http"

	"github.com/datacline/policy-engine/internal/clients/java_gateway"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

// Handler handles proxy requests to the Java MCP Gateway
type Handler struct {
	client *java_gateway.Client
}

// NewHandler creates a new gateway proxy handler
func NewHandler(client *java_gateway.Client) *Handler {
	return &Handler{
		client: client,
	}
}

// RegisterRoutes registers the gateway proxy routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	r.GET("/mcp-servers", h.ListServers)
	r.GET("/mcp-servers/:name/tools", h.GetServerTools)
	r.GET("/mcp-servers/:name/info", h.GetServerInfo)
	
	log.Info("Gateway proxy routes registered")
}

// ListServers lists all MCP servers from the Java gateway
func (h *Handler) ListServers(c *gin.Context) {
	result, err := h.client.ListServers()
	if err != nil {
		log.WithError(err).Error("Failed to fetch servers from Java gateway")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch servers from gateway",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, result)
}

// GetServerTools gets tools for a specific MCP server
func (h *Handler) GetServerTools(c *gin.Context) {
	serverName := c.Param("name")
	
	result, err := h.client.ListTools(serverName)
	if err != nil {
		log.WithError(err).WithField("server", serverName).Error("Failed to fetch tools")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch tools from gateway",
			"server": serverName,
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"server": serverName,
		"tools": result.Tools,
		"count": len(result.Tools),
	})
}

// GetServerInfo gets detailed info for a specific MCP server
func (h *Handler) GetServerInfo(c *gin.Context) {
	serverName := c.Param("name")
	
	result, err := h.client.GetServerInfo(serverName)
	if err != nil {
		log.WithError(err).WithField("server", serverName).Error("Failed to fetch server info")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch server info from gateway",
			"server": serverName,
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, result)
}
