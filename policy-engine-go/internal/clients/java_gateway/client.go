package java_gateway

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	log "github.com/sirupsen/logrus"
)

// MCPTool represents a tool from the Java gateway
type MCPTool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	InputSchema map[string]interface{} `json:"inputSchema,omitempty"`
}

// MCPServer represents an MCP server from the Java gateway
type MCPServer struct {
	Name        string   `json:"name"`
	URL         string   `json:"url,omitempty"`
	Type        string   `json:"type,omitempty"`
	Enabled     bool     `json:"enabled"`
	Description string   `json:"description,omitempty"`
	Tags        []string `json:"tags,omitempty"`
}

// MCPServersResponse represents the response from /mcp/servers
type MCPServersResponse struct {
	Servers []MCPServer `json:"servers"`
	Count   int         `json:"count"`
}

// MCPToolsResponse represents the response from /mcp/list-tools
type MCPToolsResponse struct {
	Tools []MCPTool `json:"tools"`
}

// Client is a client for the Java MCP Gateway
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new Java gateway client
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ListServers fetches all MCP servers from the Java gateway
func (c *Client) ListServers() (*MCPServersResponse, error) {
	url := fmt.Sprintf("%s/mcp/servers", c.baseURL)
	
	log.WithField("url", url).Debug("Fetching MCP servers from Java gateway")
	
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch servers: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}
	
	var result MCPServersResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	log.WithField("count", result.Count).Info("MCP servers fetched from Java gateway")
	return &result, nil
}

// ListTools fetches tools for a specific MCP server
func (c *Client) ListTools(serverName string) (*MCPToolsResponse, error) {
	url := fmt.Sprintf("%s/mcp/list-tools?mcp_server=%s", c.baseURL, serverName)
	
	log.WithFields(log.Fields{
		"url":    url,
		"server": serverName,
	}).Debug("Fetching tools from Java gateway")
	
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch tools: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}
	
	var result MCPToolsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	log.WithFields(log.Fields{
		"server": serverName,
		"tools":  len(result.Tools),
	}).Info("Tools fetched from Java gateway")
	
	return &result, nil
}

// GetServerInfo fetches detailed info for a specific MCP server
func (c *Client) GetServerInfo(serverName string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/mcp/server/%s/info", c.baseURL, serverName)
	
	log.WithFields(log.Fields{
		"url":    url,
		"server": serverName,
	}).Debug("Fetching server info from Java gateway")
	
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch server info: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}
	
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return result, nil
}

// HealthCheck checks if the Java gateway is reachable
func (c *Client) HealthCheck() error {
	url := fmt.Sprintf("%s/actuator/health", c.baseURL)
	
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check returned status %d", resp.StatusCode)
	}
	
	return nil
}
