package catalog

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

const (
	postmanAPIBaseURL = "https://api.getpostman.com"
	defaultLimit      = 20
	maxLimit          = 25
	fetchBatchSize    = 25
	// Search terms to fetch all catalog items
	defaultSearchTerms = "mcp,api,database,ai,cloud,browser,file,search,dev,tool"
)

// Handler handles MCP catalog API requests
type Handler struct {
	apiKey     string
	httpClient *http.Client
	cache      *CatalogCache
}

// CatalogCache stores all fetched MCP servers
type CatalogCache struct {
	mu           sync.RWMutex
	servers      []TransformedMCPServer
	serversByID  map[string]TransformedMCPServer
	lastUpdated  time.Time
	isLoading    bool
	loadError    error
	totalFetched int
}

// PostmanMCPServerEntry represents the config for an MCP server
// Can be either flat (per API spec) or nested in a map (observed in some responses)
type PostmanMCPServerEntry struct {
	// For stdio/local servers
	Command string          `json:"command,omitempty"`
	Args    json.RawMessage `json:"args,omitempty"`    // Can be []string or other types
	Env     json.RawMessage `json:"env,omitempty"`     // Can be map[string]string or []interface{}
	// For HTTP/remote servers
	URL     string          `json:"url,omitempty"`
	Headers json.RawMessage `json:"headers,omitempty"` // Can be map[string]string or other types
}

// parseMCPServersField parses the mcpServers field which can be either:
// 1. Flat object: {"command": "npx", "args": [...], "env": {...}} - per API spec
// 2. Map with server name: {"Server Name": {"command": "npx", ...}} - observed in some responses
func parseMCPServersField(raw json.RawMessage) PostmanMCPServerEntry {
	if len(raw) == 0 {
		return PostmanMCPServerEntry{}
	}

	// First, try parsing as a flat object (per API spec)
	var flatEntry PostmanMCPServerEntry
	if err := json.Unmarshal(raw, &flatEntry); err == nil {
		// Check if it has any actual server config
		if flatEntry.Command != "" || flatEntry.URL != "" {
			return flatEntry
		}
	}

	// Try parsing as a map with server name as key
	var serverMap map[string]PostmanMCPServerEntry
	if err := json.Unmarshal(raw, &serverMap); err == nil {
		// Take the first entry from the map
		for _, entry := range serverMap {
			return entry
		}
	}

	// Try parsing as a map of raw JSON (for deeply nested structures)
	var rawMap map[string]json.RawMessage
	if err := json.Unmarshal(raw, &rawMap); err == nil {
		for _, entryRaw := range rawMap {
			var entry PostmanMCPServerEntry
			if err := json.Unmarshal(entryRaw, &entry); err == nil {
				if entry.Command != "" || entry.URL != "" {
					return entry
				}
			}
		}
	}

	return PostmanMCPServerEntry{}
}

// parseEnvMap safely parses the env field which can be a map or an array
func parseEnvMap(raw json.RawMessage) map[string]string {
	if len(raw) == 0 {
		return nil
	}
	
	// Try parsing as map first
	var envMap map[string]string
	if err := json.Unmarshal(raw, &envMap); err == nil {
		return envMap
	}
	
	// Try parsing as array of objects with name/value
	var envArray []map[string]string
	if err := json.Unmarshal(raw, &envArray); err == nil {
		result := make(map[string]string)
		for _, item := range envArray {
			if name, ok := item["name"]; ok {
				if value, ok := item["value"]; ok {
					result[name] = value
				}
			}
		}
		return result
	}
	
	// Try parsing as array of strings (key=value format)
	var stringArray []string
	if err := json.Unmarshal(raw, &stringArray); err == nil {
		result := make(map[string]string)
		for _, s := range stringArray {
			if idx := strings.Index(s, "="); idx > 0 {
				result[s[:idx]] = s[idx+1:]
			}
		}
		return result
	}
	
	return nil
}

// parseArgs safely parses the args field which should be []string
func parseArgs(raw json.RawMessage) []string {
	if len(raw) == 0 {
		return nil
	}
	
	var args []string
	if err := json.Unmarshal(raw, &args); err == nil {
		return args
	}
	
	return nil
}

// parseHeaders safely parses the headers field
func parseHeaders(raw json.RawMessage) map[string]string {
	if len(raw) == 0 {
		return nil
	}
	
	var headers map[string]string
	if err := json.Unmarshal(raw, &headers); err == nil {
		return headers
	}
	
	return nil
}

// MCPServerConfig represents the parsed and normalized config for an MCP server
type MCPServerConfig struct {
	// Type is "stdio" or "http" based on the config
	Type string `json:"type"`
	// For stdio servers
	Command string            `json:"command,omitempty"`
	Args    []string          `json:"args,omitempty"`
	Env     map[string]string `json:"env,omitempty"`
	// For HTTP/SSE servers
	URL     string            `json:"url,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
	// Auth info extracted from headers/env
	AuthMethod      string `json:"auth_method,omitempty"`       // "bearer", "api_key", "none"
	AuthHeaderName  string `json:"auth_header_name,omitempty"`  // e.g., "Authorization", "X-API-Key"
	AuthEnvVar      string `json:"auth_env_var,omitempty"`      // Environment variable for credentials
}

// PostmanPublisher represents publisher info
type PostmanPublisher struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Logo     string `json:"logo,omitempty"`
	Verified bool   `json:"verified"`
}

// PostmanWorkspace represents workspace info
type PostmanWorkspace struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// PostmanMCPCatalogItem represents an item from Postman MCP catalog
type PostmanMCPCatalogItem struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	ElementType string           `json:"elementType"`
	Description string           `json:"description"`
	Publisher   PostmanPublisher `json:"publisher"`
	Workspace   PostmanWorkspace `json:"workspace"`
	// MCPServers can be either:
	// 1. Flat object: {"command": "npx", "args": [...]} - per API spec
	// 2. Map with server name: {"Server Name": {"command": "npx", ...}}
	MCPServers json.RawMessage `json:"mcpServers"`
}

// PostmanMCPCatalogMeta represents metadata from response
type PostmanMCPCatalogMeta struct {
	Count  int    `json:"count"`
	Action string `json:"action"`
}

// PostmanMCPCatalogResponse represents the Postman API response
type PostmanMCPCatalogResponse struct {
	Data []PostmanMCPCatalogItem `json:"data"`
	Meta PostmanMCPCatalogMeta   `json:"meta"`
}

// TransformedMCPServer represents the transformed server for frontend
type TransformedMCPServer struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Publisher   PostmanPublisher `json:"publisher"`
	Type        string          `json:"type"`        // "stdio" or "http"
	ServerType  string          `json:"server_type"` // Alias for backward compat: "stdio" or "sse"
	Config      MCPServerConfig `json:"config"`
	Tags        []string        `json:"tags"`
	Category    string          `json:"category"`
	Official    bool            `json:"official"`
	Featured    bool            `json:"featured"`
}

// CatalogSearchResponse is the response sent to frontend
type CatalogSearchResponse struct {
	Servers       []TransformedMCPServer `json:"servers"`
	TotalCount    int                    `json:"total_count"`
	ReturnedCount int                    `json:"returned_count"`
	Query         string                 `json:"query"`
	Limit         int                    `json:"limit"`
	Offset        int                    `json:"offset"`
	Page          int                    `json:"page"`
	TotalPages    int                    `json:"total_pages"`
	HasMore       bool                   `json:"has_more"`
	CacheStatus   string                 `json:"cache_status"`
}

// CatalogStatusResponse provides cache status info
type CatalogStatusResponse struct {
	TotalServers int       `json:"total_servers"`
	LastUpdated  time.Time `json:"last_updated"`
	IsLoading    bool      `json:"is_loading"`
	Error        string    `json:"error,omitempty"`
}

// NewHandler creates a new catalog handler
func NewHandler() *Handler {
	apiKey := os.Getenv("POSTMAN_API_KEY")

	if apiKey == "" {
		log.Warn("POSTMAN_API_KEY not set - MCP Catalog search will be unavailable")
	} else {
		// Log that we have an API key (mask it for security)
		maskedKey := apiKey
		if len(apiKey) > 8 {
			maskedKey = apiKey[:4] + "..." + apiKey[len(apiKey)-4:]
		}
		log.WithField("api_key", maskedKey).Info("Postman API key configured")
	}

	h := &Handler{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
		cache: &CatalogCache{
			servers:     make([]TransformedMCPServer, 0),
			serversByID: make(map[string]TransformedMCPServer),
		},
	}

	// Start background fetch if API key is configured
	if apiKey != "" {
		go h.fetchAllCatalogItems()
	}

	return h
}

// RegisterRoutes registers the catalog routes
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	catalog := router.Group("/mcp-catalog")
	{
		catalog.GET("/search", h.SearchCatalog)
		catalog.GET("/categories", h.GetCategories)
		catalog.GET("/status", h.GetCacheStatus)
		catalog.POST("/refresh", h.RefreshCache)
	}
}

// fetchAllCatalogItems fetches all MCP servers from Postman API at startup
func (h *Handler) fetchAllCatalogItems() {
	h.cache.mu.Lock()
	h.cache.isLoading = true
	h.cache.loadError = nil
	h.cache.mu.Unlock()

	log.Info("Starting MCP Catalog fetch from Postman API...")

	allServers := make(map[string]TransformedMCPServer)
	searchTerms := strings.Split(defaultSearchTerms, ",")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	for _, term := range searchTerms {
		term = strings.TrimSpace(term)
		if term == "" {
			continue
		}

		offset := 0
		for {
			servers, hasMore, err := h.fetchPage(ctx, term, fetchBatchSize, offset)
			if err != nil {
				log.WithError(err).WithField("term", term).Warn("Failed to fetch catalog page")
				break
			}

			for _, server := range servers {
				allServers[server.ID] = server
			}

			log.WithFields(log.Fields{
				"term":       term,
				"offset":     offset,
				"fetched":    len(servers),
				"total_so_far": len(allServers),
			}).Debug("Fetched catalog page")

			if !hasMore {
				break
			}
			offset += fetchBatchSize

			// Rate limiting - be nice to the API
			time.Sleep(200 * time.Millisecond)
		}
	}

	// Convert map to slice and sort by name
	serverList := make([]TransformedMCPServer, 0, len(allServers))
	for _, server := range allServers {
		serverList = append(serverList, server)
	}
	sort.Slice(serverList, func(i, j int) bool {
		return strings.ToLower(serverList[i].Name) < strings.ToLower(serverList[j].Name)
	})

	// Update cache
	h.cache.mu.Lock()
	h.cache.servers = serverList
	h.cache.serversByID = allServers
	h.cache.lastUpdated = time.Now()
	h.cache.isLoading = false
	h.cache.totalFetched = len(serverList)
	h.cache.mu.Unlock()

	log.WithFields(log.Fields{
		"total_servers": len(serverList),
		"search_terms":  len(searchTerms),
	}).Info("MCP Catalog cache populated")
}

// fetchPage fetches a single page from Postman API
func (h *Handler) fetchPage(ctx context.Context, query string, limit, offset int) ([]TransformedMCPServer, bool, error) {
	apiURL, err := url.Parse(postmanAPIBaseURL + "/mcp-servers")
	if err != nil {
		return nil, false, err
	}

	params := url.Values{}
	params.Set("q", query)
	params.Set("limit", strconv.Itoa(limit))
	params.Set("offset", strconv.Itoa(offset))
	apiURL.RawQuery = params.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL.String(), nil)
	if err != nil {
		return nil, false, err
	}

	req.Header.Set("x-api-key", h.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, false, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, false, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, false, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Log raw response for debugging (first request only)
	if offset == 0 && len(body) > 0 {
		// Try to parse as generic JSON to see the structure
		var rawResp map[string]interface{}
		if err := json.Unmarshal(body, &rawResp); err == nil {
			if data, ok := rawResp["data"].([]interface{}); ok && len(data) > 0 {
				if firstItem, ok := data[0].(map[string]interface{}); ok {
					mcpServersRaw := firstItem["mcpServers"]
					mcpServersJSON, _ := json.Marshal(mcpServersRaw)
					log.WithFields(log.Fields{
						"query":           query,
						"first_item_name": firstItem["name"],
						"mcpServers_raw":  string(mcpServersJSON),
						"mcpServers_type": fmt.Sprintf("%T", mcpServersRaw),
					}).Info("Postman API first item structure")
				}
			}
		}
	}

	var postmanResp PostmanMCPCatalogResponse
	if err := json.Unmarshal(body, &postmanResp); err != nil {
		return nil, false, err
	}

	servers := make([]TransformedMCPServer, 0, len(postmanResp.Data))
	httpCount := 0
	stdioCount := 0
	for _, item := range postmanResp.Data {
		transformed := transformMCPServer(item)
		if transformed.Type == "http" {
			httpCount++
		} else {
			stdioCount++
		}
		// Log first few items for debugging
		if len(servers) < 5 {
			log.WithFields(log.Fields{
				"name":        item.Name,
				"parsed_type": transformed.Type,
				"config_url":  transformed.Config.URL,
				"config_cmd":  transformed.Config.Command,
			}).Info("Transformed MCP server")
		}
		servers = append(servers, transformed)
	}
	if len(servers) > 0 {
		log.WithFields(log.Fields{
			"query":       query,
			"total":       len(servers),
			"http_count":  httpCount,
			"stdio_count": stdioCount,
		}).Info("Batch type distribution")
	}

	hasMore := len(servers) >= limit
	return servers, hasMore, nil
}

// SearchCatalog searches the cached MCP catalog
func (h *Handler) SearchCatalog(c *gin.Context) {
	query := strings.ToLower(strings.TrimSpace(c.DefaultQuery("q", "")))

	limitStr := c.DefaultQuery("limit", strconv.Itoa(defaultLimit))
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 {
		limit = defaultLimit
	}
	if limit > 100 {
		limit = 100
	}

	offsetStr := c.DefaultQuery("offset", "0")
	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	// Check if API key is configured
	if h.apiKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Postman API key not configured",
			"message": "Set POSTMAN_API_KEY environment variable to enable catalog search",
		})
		return
	}

	h.cache.mu.RLock()
	isLoading := h.cache.isLoading
	allServers := h.cache.servers
	lastUpdated := h.cache.lastUpdated
	h.cache.mu.RUnlock()

	cacheStatus := "ready"
	if isLoading {
		cacheStatus = "loading"
	}
	if lastUpdated.IsZero() {
		cacheStatus = "empty"
	}

	// Filter servers based on query
	// Initialize as empty slice to ensure JSON marshals as [] not null
	filtered := make([]TransformedMCPServer, 0)
	if query == "" {
		filtered = allServers
	} else {
		for _, server := range allServers {
			if matchesQuery(server, query) {
				filtered = append(filtered, server)
			}
		}
	}

	totalCount := len(filtered)
	totalPages := (totalCount + limit - 1) / limit
	currentPage := (offset / limit) + 1

	// Apply pagination
	start := offset
	if start > totalCount {
		start = totalCount
	}
	end := start + limit
	if end > totalCount {
		end = totalCount
	}

	paginated := filtered[start:end]
	hasMore := end < totalCount

	c.JSON(http.StatusOK, CatalogSearchResponse{
		Servers:       paginated,
		TotalCount:    totalCount,
		ReturnedCount: len(paginated),
		Query:         query,
		Limit:         limit,
		Offset:        offset,
		Page:          currentPage,
		TotalPages:    totalPages,
		HasMore:       hasMore,
		CacheStatus:   cacheStatus,
	})
}

// matchesQuery checks if a server matches the search query
func matchesQuery(server TransformedMCPServer, query string) bool {
	// Check name
	if strings.Contains(strings.ToLower(server.Name), query) {
		return true
	}
	// Check description
	if strings.Contains(strings.ToLower(server.Description), query) {
		return true
	}
	// Check category
	if strings.Contains(strings.ToLower(server.Category), query) {
		return true
	}
	// Check publisher name
	if strings.Contains(strings.ToLower(server.Publisher.Name), query) {
		return true
	}
	// Check tags
	for _, tag := range server.Tags {
		if strings.Contains(strings.ToLower(tag), query) {
			return true
		}
	}
	return false
}

// GetCacheStatus returns the current cache status
func (h *Handler) GetCacheStatus(c *gin.Context) {
	h.cache.mu.RLock()
	defer h.cache.mu.RUnlock()

	errMsg := ""
	if h.cache.loadError != nil {
		errMsg = h.cache.loadError.Error()
	}

	c.JSON(http.StatusOK, CatalogStatusResponse{
		TotalServers: len(h.cache.servers),
		LastUpdated:  h.cache.lastUpdated,
		IsLoading:    h.cache.isLoading,
		Error:        errMsg,
	})
}

// RefreshCache triggers a cache refresh
func (h *Handler) RefreshCache(c *gin.Context) {
	if h.apiKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Postman API key not configured",
		})
		return
	}

	h.cache.mu.RLock()
	isLoading := h.cache.isLoading
	h.cache.mu.RUnlock()

	if isLoading {
		c.JSON(http.StatusConflict, gin.H{
			"message": "Cache refresh already in progress",
		})
		return
	}

	go h.fetchAllCatalogItems()

	c.JSON(http.StatusAccepted, gin.H{
		"message": "Cache refresh started",
	})
}

// GetCategories returns available search categories
func (h *Handler) GetCategories(c *gin.Context) {
	categories := []map[string]string{
		{"id": "database", "name": "Database", "icon": "🗄️"},
		{"id": "api", "name": "API", "icon": "🔌"},
		{"id": "ai-ml", "name": "AI & ML", "icon": "🤖"},
		{"id": "web-scraping", "name": "Web Scraping", "icon": "🕷️"},
		{"id": "productivity", "name": "Productivity", "icon": "📋"},
		{"id": "cloud", "name": "Cloud Services", "icon": "☁️"},
		{"id": "development", "name": "Development", "icon": "💻"},
		{"id": "file-system", "name": "File System", "icon": "📁"},
		{"id": "communication", "name": "Communication", "icon": "💬"},
		{"id": "search", "name": "Search", "icon": "🔍"},
	}
	c.JSON(http.StatusOK, gin.H{"categories": categories})
}

// transformMCPServer transforms a Postman catalog item to our format
func transformMCPServer(item PostmanMCPCatalogItem) TransformedMCPServer {
	// Parse mcpServers field which can be flat or map format
	serverEntry := parseMCPServersField(item.MCPServers)

	// Parse the extracted config to determine type
	config := parseMCPServerConfig(serverEntry)

	// Log for debugging
	log.WithFields(log.Fields{
		"item_name":   item.Name,
		"has_url":     serverEntry.URL != "",
		"has_command": serverEntry.Command != "",
		"parsed_type": config.Type,
	}).Debug("Parsed MCP server")

	// Generate tags from name and description
	tags := generateTags(item.Name, item.Description)

	// Infer category from name/description
	category := inferCategory(item.Name, item.Description)

	// ServerType for backward compatibility (sse = http)
	serverType := config.Type
	if serverType == "http" {
		serverType = "sse"
	}

	return TransformedMCPServer{
		ID:          item.ID,
		Name:        item.Name,
		Description: item.Description,
		Publisher:   item.Publisher,
		Type:        config.Type,
		ServerType:  serverType,
		Config:      config,
		Tags:        tags,
		Category:    category,
		Official:    item.Publisher.Verified,
		Featured:    item.Publisher.Verified,
	}
}

// parseMCPServerConfig parses a single server entry and returns a normalized config
func parseMCPServerConfig(raw PostmanMCPServerEntry) MCPServerConfig {
	config := MCPServerConfig{}

	// Parse flexible fields using helper functions
	parsedArgs := parseArgs(raw.Args)
	parsedEnv := parseEnvMap(raw.Env)
	parsedHeaders := parseHeaders(raw.Headers)

	// Log what we received for debugging
	hasURL := raw.URL != ""
	hasCommand := raw.Command != ""
	
	// Determine type based on presence of url vs command
	if hasURL {
		// HTTP/SSE based server
		config.Type = "http"
		config.URL = raw.URL
		config.Headers = parsedHeaders

		// Parse auth from headers
		for headerName, headerValue := range parsedHeaders {
			lowerName := strings.ToLower(headerName)
			if lowerName == "authorization" {
				config.AuthHeaderName = headerName
				// Check if it's Bearer token
				if strings.HasPrefix(strings.ToLower(headerValue), "bearer ") {
					config.AuthMethod = "bearer"
				} else {
					config.AuthMethod = "api_key"
				}
				// Check if value references an env var (common patterns)
				if strings.Contains(headerValue, "${") || strings.Contains(headerValue, "$") {
					config.AuthEnvVar = extractEnvVarName(headerValue)
				}
			} else if lowerName == "x-api-key" || strings.Contains(lowerName, "api-key") || strings.Contains(lowerName, "apikey") {
				config.AuthMethod = "api_key"
				config.AuthHeaderName = headerName
				if strings.Contains(headerValue, "${") || strings.Contains(headerValue, "$") {
					config.AuthEnvVar = extractEnvVarName(headerValue)
				}
			}
		}
	} else if hasCommand {
		// STDIO based server
		config.Type = "stdio"
		config.Command = raw.Command
		config.Args = parsedArgs
		config.Env = parsedEnv

		// Parse auth from env variables
		for envName := range parsedEnv {
			lowerName := strings.ToLower(envName)
			if strings.Contains(lowerName, "token") || strings.Contains(lowerName, "key") || strings.Contains(lowerName, "secret") || strings.Contains(lowerName, "api") {
				config.AuthMethod = "env_var"
				config.AuthEnvVar = envName
				break
			}
		}
	} else {
		// Unknown or empty - try to infer from other fields
		// Default to stdio as most MCP servers are command-based
		config.Type = "stdio"
		log.WithFields(log.Fields{
			"hasURL":     hasURL,
			"hasCommand": hasCommand,
		}).Debug("MCP server config has no URL or command, defaulting to stdio")
	}

	// If no auth detected, mark as none
	if config.AuthMethod == "" {
		config.AuthMethod = "none"
	}

	return config
}

// extractEnvVarName extracts environment variable name from patterns like ${VAR} or $VAR
func extractEnvVarName(value string) string {
	// Handle ${VAR_NAME} pattern
	if idx := strings.Index(value, "${"); idx != -1 {
		end := strings.Index(value[idx:], "}")
		if end != -1 {
			return value[idx+2 : idx+end]
		}
	}
	// Handle $VAR_NAME pattern (simple)
	if idx := strings.Index(value, "$"); idx != -1 && idx < len(value)-1 {
		// Extract until non-alphanumeric/underscore
		rest := value[idx+1:]
		end := 0
		for i, c := range rest {
			if !((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_') {
				break
			}
			end = i + 1
		}
		if end > 0 {
			return rest[:end]
		}
	}
	return ""
}

// generateTags extracts tags from name and description
func generateTags(name, description string) []string {
	tags := []string{}

	keywords := map[string]string{
		"database":   "database",
		"sql":        "sql",
		"postgres":   "postgres",
		"mysql":      "mysql",
		"mongodb":    "mongodb",
		"redis":      "redis",
		"api":        "api",
		"rest":       "rest",
		"graphql":    "graphql",
		"stripe":     "payments",
		"slack":      "messaging",
		"github":     "git",
		"gitlab":     "git",
		"docker":     "containers",
		"kubernetes": "k8s",
		"aws":        "aws",
		"azure":      "azure",
		"gcp":        "gcp",
		"google":     "google",
		"openai":     "ai",
		"anthropic":  "ai",
		"claude":     "ai",
		"llm":        "ai",
		"notion":     "productivity",
		"jira":       "project-management",
		"confluence": "documentation",
		"figma":      "design",
		"browser":    "browser",
		"playwright": "automation",
		"puppeteer":  "automation",
		"scrape":     "scraping",
		"crawl":      "scraping",
		"search":     "search",
		"file":       "files",
		"storage":    "storage",
		"s3":         "storage",
	}

	combined := fmt.Sprintf("%s %s", name, description)
	for keyword, tag := range keywords {
		if containsIgnoreCase(combined, keyword) {
			tags = append(tags, tag)
		}
	}

	if len(tags) == 0 {
		tags = append(tags, "mcp")
	}

	// Dedupe and limit tags
	seen := make(map[string]bool)
	uniqueTags := []string{}
	for _, tag := range tags {
		if !seen[tag] && len(uniqueTags) < 5 {
			seen[tag] = true
			uniqueTags = append(uniqueTags, tag)
		}
	}

	return uniqueTags
}

// inferCategory infers a category from name and description
func inferCategory(name, description string) string {
	combined := fmt.Sprintf("%s %s", name, description)

	categoryPatterns := map[string][]string{
		"database":     {"database", "sql", "postgres", "mysql", "mongodb", "redis", "dynamodb"},
		"ai-ml":        {"openai", "anthropic", "claude", "llm", "ai", "ml", "gpt"},
		"cloud":        {"aws", "azure", "gcp", "cloudflare", "vercel", "netlify"},
		"productivity": {"notion", "slack", "email", "calendar", "todo", "task"},
		"development":  {"github", "gitlab", "code", "build", "deploy", "ci/cd"},
		"web-scraping": {"browser", "scrape", "crawl", "playwright", "puppeteer"},
		"search":       {"search", "elasticsearch", "algolia"},
		"file-system":  {"file", "storage", "s3", "drive"},
		"communication": {"slack", "discord", "teams", "chat", "message"},
	}

	for category, patterns := range categoryPatterns {
		for _, pattern := range patterns {
			if containsIgnoreCase(combined, pattern) {
				return category
			}
		}
	}

	return "other"
}

// containsIgnoreCase checks if s contains substr (case-insensitive)
func containsIgnoreCase(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}
