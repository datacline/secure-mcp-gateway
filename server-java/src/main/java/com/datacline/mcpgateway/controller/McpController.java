package com.datacline.mcpgateway.controller;

import com.datacline.mcpgateway.config.GatewayConfig;
import com.datacline.mcpgateway.config.McpServerConfig;
import com.datacline.mcpgateway.service.McpConfigService;
import com.datacline.mcpgateway.service.McpProxyService;
import com.datacline.mcpgateway.service.PolicyEngineClient;
import com.datacline.mcpgateway.service.StdioToHttpConversionService;
import com.datacline.mcpgateway.service.auth.AuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

/**
 * MCP REST endpoints.
 * Equivalent to Python's server/routes/mcp.py router.
 */
@RestController
@RequestMapping("/mcp")
public class McpController {

    private static final Logger LOG = LoggerFactory.getLogger(McpController.class);

    @Autowired
    McpProxyService mcpProxyService;

    @Autowired
    AuthService authService;

    @Autowired
    GatewayConfig gatewayConfig;

    @Autowired
    McpConfigService mcpConfigService;

    @Autowired
    McpServerConfig mcpServerConfig;

    @Autowired
    PolicyEngineClient policyEngineClient;

    @Autowired
    StdioToHttpConversionService stdioToHttpConversionService;

    /**
     * List tools from an MCP server.
     */
    @GetMapping("/list-tools")
    public Mono<ResponseEntity<Map<String, Object>>> listTools(@RequestParam("mcp_server") String mcpServer) {
        Map<String, Object> user = authService.getOptionalUser();
        String username = (String) user.getOrDefault("preferred_username", "unknown");

        return mcpProxyService.listTools(mcpServer, username)
                .map(ResponseEntity::ok)
                .onErrorResume(error -> {
                    LOG.error("Failed to list tools from {}", mcpServer, error);
                    return Mono.just(ResponseEntity.internalServerError()
                            .body(Map.of("error", error.getMessage())));
                });
    }

    /**
     * Invoke a tool on an MCP server.
     */
    @PostMapping("/invoke")
    public Mono<ResponseEntity<Map<String, Object>>> invokeTool(
            @RequestParam("mcp_server") String mcpServer,
            @RequestBody Map<String, Object> request
    ) {
        Map<String, Object> user = authService.getOptionalUser();
        String username = (String) user.getOrDefault("preferred_username", "unknown");
        String toolName = (String) request.get("tool_name");
        @SuppressWarnings("unchecked")
        Map<String, Object> parameters = (Map<String, Object>) request.getOrDefault("parameters", Map.of());

        return mcpProxyService.invokeTool(mcpServer, toolName, username, parameters)
                .map(result -> ResponseEntity.ok(Map.of(
                        "success", true,
                        "tool_name", toolName,
                        "mcp_server", mcpServer,
                        "result", result
                )))
                .onErrorResume(error -> {
                    LOG.error("Failed to invoke tool {} on {}", toolName, mcpServer, error);
                    return Mono.just(ResponseEntity.ok(Map.of(
                            "success", false,
                            "tool_name", toolName,
                            "mcp_server", mcpServer,
                            "error", error.getMessage()
                    )));
                });
    }

    /**
     * List resources from an MCP server.
     */
    @GetMapping("/list-resources")
    public Mono<ResponseEntity<Map<String, Object>>> listResources(@RequestParam("mcp_server") String mcpServer) {
        Map<String, Object> user = authService.getOptionalUser();
        String username = (String) user.getOrDefault("preferred_username", "unknown");

        return mcpProxyService.listResources(mcpServer, username)
                .map(ResponseEntity::ok)
                .onErrorResume(error -> {
                    LOG.error("Failed to list resources from {}", mcpServer, error);
                    return Mono.just(ResponseEntity.internalServerError()
                            .body(Map.of("error", error.getMessage())));
                });
    }

    /**
     * Read a resource from an MCP server.
     */
    @GetMapping("/read-resource")
    public Mono<ResponseEntity<Map<String, Object>>> readResource(
            @RequestParam("mcp_server") String mcpServer,
            @RequestParam("uri") String uri
    ) {
        Map<String, Object> user = authService.getOptionalUser();
        String username = (String) user.getOrDefault("preferred_username", "unknown");

        return mcpProxyService.readResource(mcpServer, uri, username)
                .map(result -> ResponseEntity.ok(Map.of(
                        "mcp_server", mcpServer,
                        "uri", uri,
                        "contents", result.get("contents")
                )))
                .onErrorResume(error -> {
                    LOG.error("Failed to read resource {} from {}", uri, mcpServer, error);
                    return Mono.just(ResponseEntity.internalServerError()
                            .body(Map.of("error", error.getMessage())));
                });
    }

    /**
     * List prompts from an MCP server.
     */
    @GetMapping("/list-prompts")
    public Mono<ResponseEntity<Map<String, Object>>> listPrompts(@RequestParam("mcp_server") String mcpServer) {
        Map<String, Object> user = authService.getOptionalUser();
        String username = (String) user.getOrDefault("preferred_username", "unknown");

        return mcpProxyService.listPrompts(mcpServer, username)
                .map(result -> ResponseEntity.ok(Map.of(
                        "mcp_server", mcpServer,
                        "prompts", result.get("prompts"),
                        "count", ((List<?>) result.get("prompts")).size()
                )))
                .onErrorResume(error -> {
                    LOG.error("Failed to list prompts from {}", mcpServer, error);
                    return Mono.just(ResponseEntity.internalServerError()
                            .body(Map.of("error", error.getMessage())));
                });
    }

    /**
     * Get a prompt from an MCP server.
     */
    @GetMapping("/get-prompt")
    public Mono<ResponseEntity<Map<String, Object>>> getPrompt(
            @RequestParam("mcp_server") String mcpServer,
            @RequestParam("name") String name
    ) {
        Map<String, Object> user = authService.getOptionalUser();
        String username = (String) user.getOrDefault("preferred_username", "unknown");

        return mcpProxyService.getPrompt(mcpServer, name, username, null)
                .map(result -> ResponseEntity.ok(Map.of(
                        "mcp_server", mcpServer,
                        "name", name,
                        "messages", result.get("messages"),
                        "description", result.getOrDefault("description", "")
                )))
                .onErrorResume(error -> {
                    LOG.error("Failed to get prompt {} from {}", name, mcpServer, error);
                    return Mono.just(ResponseEntity.internalServerError()
                            .body(Map.of("error", error.getMessage())));
                });
    }

    /**
     * List all configured MCP servers.
     * Optionally includes associated policies when include_policies=true.
     */
    @GetMapping("/servers")
    public Mono<ResponseEntity<Map<String, Object>>> listServers(
            @RequestParam(value = "include_policies", defaultValue = "false") boolean includePolicies) {
        
        Map<String, Map<String, Object>> servers = mcpProxyService.getAllServers();

        List<Map<String, Object>> serverList = servers.entrySet().stream()
                .map(entry -> {
                    Map<String, Object> serverData = entry.getValue();
                    Map<String, Object> serverInfo = new java.util.HashMap<>();
                    serverInfo.put("name", entry.getKey());
                    serverInfo.put("url", serverData.getOrDefault("url", ""));
                    serverInfo.put("type", serverData.getOrDefault("type", "http"));
                    serverInfo.put("enabled", serverData.getOrDefault("enabled", true));
                    serverInfo.put("description", serverData.getOrDefault("description", ""));
                    serverInfo.put("image_icon", serverData.getOrDefault("image_icon", ""));
                    serverInfo.put("policy_id", serverData.getOrDefault("policy_id", ""));
                    serverInfo.put("tags", serverData.getOrDefault("tags", List.of()));
                    return serverInfo;
                })
                .toList();

        if (!includePolicies) {
            Map<String, Object> response = new java.util.HashMap<>();
            response.put("servers", serverList);
            response.put("count", serverList.size());
            return Mono.just(ResponseEntity.ok(response));
        }

        // Fetch policies for each server in parallel
        return reactor.core.publisher.Flux.fromIterable(serverList)
                .flatMap(serverInfo -> {
                    String serverName = (String) serverInfo.get("name");
                    return policyEngineClient.getPoliciesForMCPServer(serverName)
                            .map(policyResponse -> {
                                @SuppressWarnings("unchecked")
                                List<Map<String, Object>> policies = 
                                        (List<Map<String, Object>>) policyResponse.getOrDefault("policies", List.of());
                                serverInfo.put("policies", policies);
                                serverInfo.put("policy_count", policies.size());
                                return serverInfo;
                            })
                            .onErrorResume(error -> {
                                LOG.warn("Failed to fetch policies for server {}: {}", serverName, error.getMessage());
                                serverInfo.put("policies", List.of());
                                serverInfo.put("policy_count", 0);
                                serverInfo.put("policy_error", error.getMessage());
                                return Mono.just(serverInfo);
                            });
                })
                .collectList()
                .map(enrichedServers -> {
                    Map<String, Object> response = new java.util.HashMap<>();
                    response.put("servers", enrichedServers);
                    response.put("count", enrichedServers.size());
                    return ResponseEntity.ok(response);
                });
    }

    /**
     * Get information about a specific MCP server.
     */
    @GetMapping("/server/{mcp_server}/info")
    public Mono<ResponseEntity<Map<String, Object>>> getServerInfo(@PathVariable("mcp_server") String mcpServer) {
        Map<String, Object> user = authService.getOptionalUser();
        String username = (String) user.getOrDefault("preferred_username", "unknown");

        return mcpProxyService.getServerInfo(mcpServer, username)
                .map(ResponseEntity::ok)
                .onErrorResume(error -> {
                    LOG.error("Failed to get server info for {}", mcpServer, error);
                    return Mono.just(ResponseEntity.internalServerError()
                            .body(Map.of("error", error.getMessage())));
                });
    }

    /**
     * Invoke a tool on multiple MCP servers (broadcast).
     */
    @PostMapping("/invoke-broadcast")
    public Mono<ResponseEntity<Map<String, Object>>> invokeToolBroadcast(@RequestBody Map<String, Object> request) {
        Map<String, Object> user = authService.getOptionalUser();
        String username = (String) user.getOrDefault("preferred_username", "unknown");
        String toolName = (String) request.get("tool_name");
        @SuppressWarnings("unchecked")
        Map<String, Object> parameters = (Map<String, Object>) request.getOrDefault("parameters", Map.of());
        @SuppressWarnings("unchecked")
        List<String> mcpServers = (List<String>) request.get("mcp_servers");
        @SuppressWarnings("unchecked")
        List<String> tags = (List<String>) request.get("tags");

        return mcpProxyService.invokeToolBroadcast(toolName, username, parameters, mcpServers, tags)
                .map(ResponseEntity::ok)
                .onErrorResume(error -> {
                    LOG.error("Failed to broadcast tool {}", toolName, error);
                    return Mono.just(ResponseEntity.internalServerError()
                            .body(Map.of("error", error.getMessage())));
                });
    }

    // ========================================================================
    // MCP Server Configuration Endpoints
    // ========================================================================

    /**
     * Get configuration for a specific MCP server.
     * Includes all policies associated with this server via the unified policy API.
     */
    @GetMapping("/servers/{serverName}/config")
    public Mono<ResponseEntity<Map<String, Object>>> getServerConfig(@PathVariable String serverName) {
        try {
            Map<String, Object> config = mcpConfigService.getServerConfig(serverName);

            // Fetch all policies associated with this MCP server
            return policyEngineClient.getPoliciesForMCPServer(serverName)
                    .map(policyResponse -> {
                        Map<String, Object> enriched = new java.util.HashMap<>(config);
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> policies = 
                                (List<Map<String, Object>>) policyResponse.getOrDefault("policies", List.of());
                        enriched.put("policies", policies);
                        enriched.put("policy_count", policies.size());
                        
                        // Also include error if any
                        Object error = policyResponse.get("error");
                        if (error != null) {
                            enriched.put("policy_error", error);
                        }
                        
                        return ResponseEntity.ok(enriched);
                    })
                    .onErrorResume(error -> {
                        LOG.warn("Failed to fetch policies for server {}: {}", serverName, error.getMessage());
                        Map<String, Object> enriched = new java.util.HashMap<>(config);
                        enriched.put("policies", List.of());
                        enriched.put("policy_count", 0);
                        enriched.put("policy_error", error.getMessage());
                        return Mono.just(ResponseEntity.ok(enriched));
                    });
        } catch (IllegalArgumentException e) {
            LOG.warn("Server not found: {}", serverName);
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage())));
        } catch (Exception e) {
            LOG.error("Failed to read configuration for {}", serverName, e);
            return Mono.just(ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to read configuration: " + e.getMessage())));
        }
    }

    /**
     * Update configuration for an existing MCP server
     */
    @PutMapping("/servers/{serverName}/config")
    public ResponseEntity<Map<String, Object>> updateServerConfig(
            @PathVariable String serverName,
            @RequestBody Map<String, Object> config) {
        try {
            mcpConfigService.updateServerConfig(serverName, config);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Server configuration updated successfully",
                    "server_name", serverName
            ));
        } catch (IllegalArgumentException e) {
            LOG.warn("Invalid configuration for {}: {}", serverName, e.getMessage());
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            LOG.error("Failed to update configuration for {}", serverName, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to update configuration: " + e.getMessage()));
        }
    }

    /**
     * Create a new MCP server
     */
    @PostMapping("/servers")
    public ResponseEntity<Map<String, Object>> createServer(@RequestBody Map<String, Object> request) {
        try {
            String serverName = (String) request.get("name");
            if (serverName == null || serverName.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Server name is required"));
            }

            // Remove name from config as it's stored as the key
            Map<String, Object> serverConfig = new java.util.HashMap<>(request);
            serverConfig.remove("name");

            mcpConfigService.createServer(serverName, serverConfig);
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Server created successfully",
                    "server_name", serverName
            ));
        } catch (IllegalArgumentException e) {
            LOG.warn("Invalid server creation request: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            LOG.error("Failed to create server", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to create server: " + e.getMessage()));
        }
    }

    /**
     * Delete an MCP server
     */
    @DeleteMapping("/servers/{serverName}")
    public ResponseEntity<Map<String, Object>> deleteServer(@PathVariable String serverName) {
        try {
            mcpConfigService.deleteServer(serverName);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Server deleted successfully",
                    "server_name", serverName
            ));
        } catch (IllegalArgumentException e) {
            LOG.warn("Server not found: {}", serverName);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            LOG.error("Failed to delete server {}", serverName, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to delete server: " + e.getMessage()));
        }
    }

    /**
     * Convert a STDIO MCP server to HTTP.
     * This spawns an mcp-proxy process (or uses external proxy service) to wrap the stdio server.
     */
    @PostMapping("/servers/{serverName}/convert")
    public ResponseEntity<Map<String, Object>> convertStdioToHttp(@PathVariable String serverName) {
        try {
            Map<String, Object> result = stdioToHttpConversionService.convert(serverName);
            return ResponseEntity.ok(result);
        } catch (org.springframework.web.server.ResponseStatusException e) {
            LOG.warn("Failed to convert server {}: {}", serverName, e.getReason());
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason()));
        } catch (Exception e) {
            LOG.error("Failed to convert server {} to HTTP", serverName, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to convert server: " + e.getMessage()));
        }
    }

    /**
     * Reload MCP server configuration
     */
    @PostMapping("/servers/reload")
    public ResponseEntity<Map<String, Object>> reloadConfiguration() {
        try {
            Map<String, Map<String, Object>> servers = mcpConfigService.getAllServers();
            
            // Reload the in-memory cache
            mcpServerConfig.reload();
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Configuration reloaded successfully",
                    "server_count", servers.size()
            ));
        } catch (Exception e) {
            LOG.error("Failed to reload configuration", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to reload configuration: " + e.getMessage()));
        }
    }

    // ========================================================================
    // MCP Server Policy Endpoints
    // ========================================================================

    /**
     * Get all policies associated with an MCP server.
     * Uses the unified policy API to fetch policies bound to this resource.
     */
    @GetMapping("/servers/{serverName}/policies")
    public Mono<ResponseEntity<Map<String, Object>>> getServerPolicies(
            @PathVariable String serverName,
            @RequestParam(value = "active_only", defaultValue = "true") boolean activeOnly,
            @RequestParam(value = "include_global", defaultValue = "true") boolean includeGlobal) {
        
        return policyEngineClient.getPoliciesByResource("mcp_server", serverName, activeOnly, includeGlobal)
                .map(response -> {
                    response.put("server_name", serverName);
                    return ResponseEntity.ok(response);
                })
                .onErrorResume(error -> {
                    LOG.error("Failed to fetch policies for server {}: {}", serverName, error.getMessage());
                    return Mono.just(ResponseEntity.internalServerError()
                            .body(Map.of(
                                    "error", error.getMessage(),
                                    "server_name", serverName,
                                    "policies", List.of(),
                                    "count", 0
                            )));
                });
    }

    /**
     * List all unified policies.
     * Proxy to the policy engine's unified policy list endpoint.
     */
    @GetMapping("/policies")
    public Mono<ResponseEntity<Map<String, Object>>> listPolicies(
            @RequestParam(value = "status", required = false) String status) {
        
        return policyEngineClient.listUnifiedPolicies(status)
                .map(ResponseEntity::ok)
                .onErrorResume(error -> {
                    LOG.error("Failed to list policies: {}", error.getMessage());
                    return Mono.just(ResponseEntity.internalServerError()
                            .body(Map.of("error", error.getMessage())));
                });
    }

    /**
     * Get a specific unified policy by ID.
     */
    @GetMapping("/policies/{policyId}")
    public Mono<ResponseEntity<Map<String, Object>>> getPolicy(@PathVariable String policyId) {
        return policyEngineClient.getUnifiedPolicy(policyId)
                .map(ResponseEntity::ok)
                .switchIfEmpty(Mono.just(ResponseEntity.notFound().build()))
                .onErrorResume(error -> {
                    LOG.error("Failed to get policy {}: {}", policyId, error.getMessage());
                    return Mono.just(ResponseEntity.internalServerError()
                            .body(Map.of("error", error.getMessage())));
                });
    }
}
