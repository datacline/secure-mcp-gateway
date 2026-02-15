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

    @Autowired
    com.datacline.mcpgateway.service.McpGroupService mcpGroupService;

    @Autowired
    com.datacline.mcpgateway.service.PolicyAwareToolService policyAwareToolService;

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
     * Get tools allowed by policy for a specific server and current user.
     * This endpoint is used by the UI to show only valid tools when configuring groups.
     *
     * Returns tools that are:
     * 1. Available on the server
     * 2. Allowed by policies for the current user
     */
    @GetMapping("/servers/{serverName}/policy-allowed-tools")
    public Mono<ResponseEntity<Map<String, Object>>> getPolicyAllowedTools(
            @PathVariable String serverName) {

        Map<String, Object> user = authService.getOptionalUser();
        String username = (String) user.getOrDefault("preferred_username", "unknown");

        LOG.info("Fetching policy-allowed tools for server: {}, user: {}", serverName, username);

        return policyAwareToolService.getPolicyAllowedTools(serverName, username)
            .flatMap(allowedToolNames -> {
                // Fetch full tool details
                return mcpProxyService.listTools(serverName, username)
                    .map(result -> {
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> allTools =
                            (List<Map<String, Object>>) result.get("tools");

                        // Filter to only allowed tools
                        List<Map<String, Object>> allowedTools = allTools.stream()
                            .filter(tool -> allowedToolNames.contains((String) tool.get("name")))
                            .collect(java.util.stream.Collectors.toList());

                        return ResponseEntity.ok(Map.of(
                            "server_name", serverName,
                            "username", username,
                            "tools", allowedTools,
                            "count", allowedTools.size(),
                            "total_server_tools", allTools.size(),
                            "policy_filtered", true
                        ));
                    });
            })
            .onErrorResume(error -> {
                LOG.error("Failed to get policy-allowed tools for {}: {}", serverName, error.getMessage());
                return Mono.just(ResponseEntity.internalServerError()
                    .body(Map.of("error", error.getMessage())));
            });
    }

    /**
     * Get detailed debug information about tool availability.
     * Shows how policy filtering and group filtering affect tool availability.
     *
     * Query params:
     * - group_id (optional): Group ID to check group configuration
     */
    @GetMapping("/servers/{serverName}/tool-availability-debug")
    public Mono<ResponseEntity<Map<String, Object>>> getToolAvailabilityDebugInfo(
            @PathVariable String serverName,
            @RequestParam(value = "group_id", required = false) String groupId) {

        Map<String, Object> user = authService.getOptionalUser();
        String username = (String) user.getOrDefault("preferred_username", "unknown");

        List<String> groupConfiguredTools = null;
        if (groupId != null) {
            try {
                Map<String, Object> group = mcpGroupService.getGroup(groupId);
                @SuppressWarnings("unchecked")
                Map<String, List<String>> toolConfig =
                    (Map<String, List<String>>) group.getOrDefault("tool_config", Map.of());
                groupConfiguredTools = toolConfig.get(serverName);
            } catch (Exception e) {
                LOG.warn("Failed to get group config for debug info: {}", e.getMessage());
            }
        }

        List<String> finalGroupConfig = groupConfiguredTools;
        return policyAwareToolService.getToolAvailabilityDebugInfo(serverName, username, finalGroupConfig)
            .map(ResponseEntity::ok)
            .onErrorResume(error -> {
                LOG.error("Failed to get tool availability debug info: {}", error.getMessage());
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

    // ========================================================================
    // MCP Server Group Endpoints
    // ========================================================================

    /**
     * List all MCP server groups
     */
    @GetMapping("/groups")
    public ResponseEntity<Map<String, Object>> listGroups() {
        try {
            List<Map<String, Object>> groups = mcpGroupService.getAllGroups();
            return ResponseEntity.ok(Map.of(
                    "groups", groups,
                    "count", groups.size()
            ));
        } catch (Exception e) {
            LOG.error("Failed to list groups", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to list groups: " + e.getMessage()));
        }
    }

    /**
     * Get a specific group by ID
     */
    @GetMapping("/groups/{groupId}")
    public ResponseEntity<Map<String, Object>> getGroup(@PathVariable String groupId) {
        try {
            Map<String, Object> group = mcpGroupService.getGroup(groupId);
            return ResponseEntity.ok(group);
        } catch (IllegalArgumentException e) {
            LOG.warn("Group not found: {}", groupId);
            return ResponseEntity.status(404)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            LOG.error("Failed to get group {}", groupId, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to get group: " + e.getMessage()));
        }
    }

    /**
     * Create a new MCP server group
     */
    @PostMapping("/groups")
    public ResponseEntity<Map<String, Object>> createGroup(@RequestBody Map<String, Object> request) {
        try {
            Map<String, Object> group = mcpGroupService.createGroup(request);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Group created successfully",
                    "group", group
            ));
        } catch (IllegalArgumentException e) {
            LOG.warn("Invalid group creation request: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            LOG.error("Failed to create group", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to create group: " + e.getMessage()));
        }
    }

    /**
     * Update an existing group
     */
    @PutMapping("/groups/{groupId}")
    public ResponseEntity<Map<String, Object>> updateGroup(
            @PathVariable String groupId,
            @RequestBody Map<String, Object> request) {
        try {
            Map<String, Object> group = mcpGroupService.updateGroup(groupId, request);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Group updated successfully",
                    "group", group
            ));
        } catch (IllegalArgumentException e) {
            LOG.warn("Invalid group update request for {}: {}", groupId, e.getMessage());
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            LOG.error("Failed to update group {}", groupId, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to update group: " + e.getMessage()));
        }
    }

    /**
     * Delete a group
     */
    @DeleteMapping("/groups/{groupId}")
    public ResponseEntity<Map<String, Object>> deleteGroup(@PathVariable String groupId) {
        try {
            mcpGroupService.deleteGroup(groupId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Group deleted successfully"
            ));
        } catch (IllegalArgumentException e) {
            LOG.warn("Group not found: {}", groupId);
            return ResponseEntity.status(404)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            LOG.error("Failed to delete group {}", groupId, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to delete group: " + e.getMessage()));
        }
    }

    /**
     * Add a server to a group
     */
    @PostMapping("/groups/{groupId}/servers/{serverName}")
    public ResponseEntity<Map<String, Object>> addServerToGroup(
            @PathVariable String groupId,
            @PathVariable String serverName) {
        try {
            Map<String, Object> group = mcpGroupService.addServerToGroup(groupId, serverName);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Server added to group successfully",
                    "group", group
            ));
        } catch (IllegalArgumentException e) {
            LOG.warn("Failed to add server to group: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            LOG.error("Failed to add server {} to group {}", serverName, groupId, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to add server to group: " + e.getMessage()));
        }
    }

    /**
     * Remove a server from a group
     */
    @DeleteMapping("/groups/{groupId}/servers/{serverName}")
    public ResponseEntity<Map<String, Object>> removeServerFromGroup(
            @PathVariable String groupId,
            @PathVariable String serverName) {
        try {
            Map<String, Object> group = mcpGroupService.removeServerFromGroup(groupId, serverName);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Server removed from group successfully",
                    "group", group
            ));
        } catch (IllegalArgumentException e) {
            LOG.warn("Failed to remove server from group: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            LOG.error("Failed to remove server {} from group {}", serverName, groupId, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to remove server from group: " + e.getMessage()));
        }
    }

    /**
     * Add multiple servers to a group
     */
    @PostMapping("/groups/{groupId}/servers")
    public ResponseEntity<Map<String, Object>> addServersToGroup(
            @PathVariable String groupId,
            @RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<String> serverNames = (List<String>) request.get("serverNames");
            
            if (serverNames == null || serverNames.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "serverNames list is required"));
            }
            
            Map<String, Object> group = mcpGroupService.addServersToGroup(groupId, serverNames);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Servers added to group successfully",
                    "group", group
            ));
        } catch (IllegalArgumentException e) {
            LOG.warn("Failed to add servers to group: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            LOG.error("Failed to add servers to group {}", groupId, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to add servers to group: " + e.getMessage()));
        }
    }

    /**
     * Configure allowed tools for a server in a group
     */
    @PutMapping("/groups/{groupId}/servers/{serverName}/tools")
    public ResponseEntity<Map<String, Object>> configureServerTools(
            @PathVariable String groupId,
            @PathVariable String serverName,
            @RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<String> tools = (List<String>) request.get("tools");
            
            if (tools == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "tools list is required"));
            }
            
            Map<String, Object> group = mcpGroupService.configureServerTools(groupId, serverName, tools);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Tool configuration updated successfully",
                    "group", group
            ));
        } catch (IllegalArgumentException e) {
            LOG.warn("Failed to configure server tools: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            LOG.error("Failed to configure server tools for {} in group {}", serverName, groupId, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to configure server tools: " + e.getMessage()));
        }
    }

    // ========================================================================
    // MCP Group Gateway Endpoints (MCP Protocol)
    // ========================================================================

    /**
     * GET /mcp/group/{groupId}/mcp - Discovery endpoint for group gateway
     * Returns server capabilities for this group
     */
    @GetMapping("/group/{groupId}/mcp")
    public ResponseEntity<Map<String, Object>> groupGatewayDiscovery(@PathVariable String groupId) {
        LOG.info("MCP group gateway discovery endpoint called (GET /mcp/group/{}/mcp)", groupId);
        
        try {
            Map<String, Object> group = mcpGroupService.getGroup(groupId);
            
            Map<String, Object> capabilities = new java.util.LinkedHashMap<>();
            capabilities.put("tools", Map.of());
            capabilities.put("resources", Map.of());
            capabilities.put("prompts", Map.of());

            Map<String, Object> response = new java.util.LinkedHashMap<>();
            response.put("protocolVersion", "2024-11-05");
            response.put("capabilities", capabilities);
            response.put("serverInfo", Map.of(
                "name", "secure-mcp-gateway-group-" + groupId,
                "version", "2.0.0",
                "groupId", groupId,
                "groupName", group.getOrDefault("name", "Unnamed Group")
            ));

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            LOG.warn("Group not found: {}", groupId);
            return ResponseEntity.status(404)
                    .body(Map.of("error", "Group not found: " + groupId));
        }
    }

    /**
     * POST /mcp/group/{groupId}/mcp - Main MCP protocol endpoint for group gateway
     * Handles JSON-RPC requests from MCP clients
     */
    @PostMapping("/group/{groupId}/mcp")
    public Mono<ResponseEntity<Map<String, Object>>> groupGatewayProtocol(
            @PathVariable String groupId,
            @RequestBody Map<String, Object> body) {
        
        String method = (String) body.get("method");
        Object requestId = body.get("id");
        @SuppressWarnings("unchecked")
        Map<String, Object> params = (Map<String, Object>) body.getOrDefault("params", Map.of());

        LOG.info("MCP group gateway JSON-RPC request: groupId={}, method={}, id={}", groupId, method, requestId);

        // Get user info (if auth enabled)
        Map<String, Object> user = authService.getOptionalUser();
        String username = (String) user.getOrDefault("preferred_username", "anonymous");

        // Verify group exists
        try {
            mcpGroupService.getGroup(groupId);
        } catch (IllegalArgumentException e) {
            return Mono.just(createGroupErrorResponse(requestId, -32001, "Group not found: " + groupId));
        }

        // Handle different MCP methods
        return switch (method) {
            case "initialize" -> handleGroupInitialize(requestId, groupId);
            case "tools/list" -> handleGroupListTools(requestId, groupId, username);
            case "tools/call" -> handleGroupCallTool(requestId, groupId, params, username);
            case "resources/list" -> handleGroupListResources(requestId, groupId, username);
            case "resources/read" -> handleGroupReadResource(requestId, groupId, params, username);
            case "prompts/list" -> handleGroupListPrompts(requestId, groupId, username);
            case "prompts/get" -> handleGroupGetPrompt(requestId, groupId, params, username);
            case String s when s.startsWith("notifications/") -> handleGroupNotification(method);
            default -> Mono.just(createGroupErrorResponse(requestId, -32601, "Method not found: " + method));
        };
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleGroupInitialize(Object requestId, String groupId) {
        LOG.info("Handling initialize request for group {}", groupId);
        
        try {
            Map<String, Object> group = mcpGroupService.getGroup(groupId);
            
            Map<String, Object> capabilities = new java.util.LinkedHashMap<>();
            capabilities.put("tools", Map.of());
            capabilities.put("resources", Map.of());
            capabilities.put("prompts", Map.of());

            Map<String, Object> result = new java.util.LinkedHashMap<>();
            result.put("protocolVersion", "2024-11-05");
            result.put("capabilities", capabilities);
            result.put("serverInfo", Map.of(
                "name", "secure-mcp-gateway-group-" + groupId,
                "version", "2.0.0",
                "groupId", groupId,
                "groupName", group.getOrDefault("name", "Unnamed Group")
            ));

            return Mono.just(createGroupSuccessResponse(requestId, result));
        } catch (Exception e) {
            return Mono.just(createGroupErrorResponse(requestId, -32603, e.getMessage()));
        }
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleGroupListTools(Object requestId, String groupId, String username) {
        LOG.info("Handling tools/list request for group {} and user: {}", groupId, username);

        try {
            Map<String, Object> group = mcpGroupService.getGroup(groupId);
            @SuppressWarnings("unchecked")
            List<String> serverNames = (List<String>) group.get("serverNames");
            @SuppressWarnings("unchecked")
            Map<String, List<String>> toolConfig = (Map<String, List<String>>) group.getOrDefault("tool_config", Map.of());

            LOG.info("Group {} currently has {} servers: {}", groupId,
                     serverNames != null ? serverNames.size() : 0, serverNames);

            if (serverNames == null || serverNames.isEmpty()) {
                return Mono.just(createGroupSuccessResponse(requestId, Map.of("tools", List.of())));
            }

            // PHASE 1: Use policy-aware tool service for detection and logging
            // Tools are fetched with policy-awareness but filtering is not enforced yet
            return reactor.core.publisher.Flux.fromIterable(serverNames)
                    .flatMap(serverName -> {
                        List<String> groupConfiguredTools = toolConfig.get(serverName);

                        // Use policy-aware service to fetch tools and log any mismatches
                        return policyAwareToolService.getAvailableTools(serverName, username, groupConfiguredTools)
                                .onErrorResume(error -> {
                                    LOG.warn("Failed to fetch tools from server {}: {}", serverName, error.getMessage());
                                    return Mono.just(List.of());
                                });
                    })
                    .collectList()
                    .map(toolLists -> {
                        List<Map<String, Object>> allTools = toolLists.stream()
                                .flatMap(List::stream)
                                .collect(java.util.stream.Collectors.toList());

                        LOG.info("Group {} returning {} tools to client (policy-aware detection enabled)",
                                groupId, allTools.size());

                        return createGroupSuccessResponse(requestId, Map.of("tools", allTools));
                    });
        } catch (Exception e) {
            LOG.error("Failed to list tools for group {}", groupId, e);
            return Mono.just(createGroupErrorResponse(requestId, -32603, e.getMessage()));
        }
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleGroupCallTool(
            Object requestId, String groupId, Map<String, Object> params, String username) {
        
        String toolName = (String) params.get("name");
        @SuppressWarnings("unchecked")
        Map<String, Object> arguments = (Map<String, Object>) params.getOrDefault("arguments", Map.of());

        LOG.info("Handling tools/call request for group {}: tool={}, user={}", groupId, toolName, username);

        try {
            Map<String, Object> group = mcpGroupService.getGroup(groupId);
            @SuppressWarnings("unchecked")
            List<String> serverNames = (List<String>) group.get("serverNames");
            @SuppressWarnings("unchecked")
            Map<String, List<String>> toolConfig = (Map<String, List<String>>) group.getOrDefault("tool_config", Map.of());
            
            LOG.info("Group {} currently has {} servers for tool invocation: {}", groupId, 
                     serverNames != null ? serverNames.size() : 0, serverNames);
            
            if (serverNames == null || serverNames.isEmpty()) {
                return Mono.just(createGroupErrorResponse(requestId, -32602, "Group has no servers"));
            }

            // Try each server until one succeeds, but check if tool is allowed first
            return reactor.core.publisher.Flux.fromIterable(serverNames)
                    .flatMap(serverName -> {
                        // Check if tool is allowed for this server
                        List<String> allowedTools = toolConfig.get(serverName);
                        if (allowedTools != null && !allowedTools.isEmpty() && 
                            !allowedTools.contains("*") && !allowedTools.contains(toolName)) {
                            LOG.debug("Tool {} not allowed for server {} in group {}", toolName, serverName, groupId);
                            return Mono.empty(); // Skip this server
                        }
                        
                        return mcpProxyService.invokeTool(serverName, toolName, username, arguments)
                                .map(result -> {
                                    // Format result according to MCP spec
                                    List<Map<String, Object>> content = List.of(Map.of(
                                        "type", "text",
                                        "text", result.toString()
                                    ));
                                    return createGroupSuccessResponse(requestId, Map.of("content", content));
                                })
                                .onErrorResume(error -> Mono.empty()); // Skip failed servers
                    })
                    .next() // Take the first successful result
                    .switchIfEmpty(Mono.just(createGroupErrorResponse(
                            requestId, -32602, "Tool not found in any server in the group")));
        } catch (Exception e) {
            LOG.error("Failed to call tool in group {}", groupId, e);
            return Mono.just(createGroupErrorResponse(requestId, -32603, e.getMessage()));
        }
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleGroupListResources(
            Object requestId, String groupId, String username) {
        LOG.info("Handling resources/list request for group {} and user: {}", groupId, username);
        
        try {
            Map<String, Object> group = mcpGroupService.getGroup(groupId);
            @SuppressWarnings("unchecked")
            List<String> serverNames = (List<String>) group.get("serverNames");
            
            if (serverNames == null || serverNames.isEmpty()) {
                return Mono.just(createGroupSuccessResponse(requestId, Map.of("resources", List.of())));
            }

            // Fetch resources from all servers in parallel
            return reactor.core.publisher.Flux.fromIterable(serverNames)
                    .flatMap(serverName -> 
                        mcpProxyService.listResources(serverName, username)
                                .map(result -> {
                                    @SuppressWarnings("unchecked")
                                    List<Map<String, Object>> resources = 
                                            (List<Map<String, Object>>) result.getOrDefault("resources", List.of());
                                    return resources;
                                })
                                .onErrorResume(error -> {
                                    LOG.warn("Failed to fetch resources from server {}: {}", serverName, error.getMessage());
                                    return Mono.just(List.of());
                                })
                    )
                    .collectList()
                    .map(resourceLists -> {
                        List<Map<String, Object>> allResources = resourceLists.stream()
                                .flatMap(List::stream)
                                .collect(java.util.stream.Collectors.toList());
                        
                        return createGroupSuccessResponse(requestId, Map.of("resources", allResources));
                    });
        } catch (Exception e) {
            LOG.error("Failed to list resources for group {}", groupId, e);
            return Mono.just(createGroupErrorResponse(requestId, -32603, e.getMessage()));
        }
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleGroupReadResource(
            Object requestId, String groupId, Map<String, Object> params, String username) {
        
        String uri = (String) params.get("uri");
        LOG.info("Handling resources/read request for group {}: uri={}, user={}", groupId, uri, username);

        // Parse URI to determine which server to use
        return mcpProxyService.parseResourceUri(uri)
                .flatMap(parsed -> {
                    String mcpServer = (String) parsed.get("server");
                    String resourceUri = (String) parsed.get("uri");
                    return mcpProxyService.readResource(mcpServer, resourceUri, username);
                })
                .map(result -> createGroupSuccessResponse(requestId, Map.of("contents", result)))
                .onErrorResume(error -> {
                    LOG.error("Failed to read resource {} in group {}", uri, groupId, error);
                    return Mono.just(createGroupErrorResponse(requestId, -32603, error.getMessage()));
                });
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleGroupListPrompts(
            Object requestId, String groupId, String username) {
        LOG.info("Handling prompts/list request for group {} and user: {}", groupId, username);
        
        try {
            Map<String, Object> group = mcpGroupService.getGroup(groupId);
            @SuppressWarnings("unchecked")
            List<String> serverNames = (List<String>) group.get("serverNames");
            
            if (serverNames == null || serverNames.isEmpty()) {
                return Mono.just(createGroupSuccessResponse(requestId, Map.of("prompts", List.of())));
            }

            // Fetch prompts from all servers in parallel
            return reactor.core.publisher.Flux.fromIterable(serverNames)
                    .flatMap(serverName -> 
                        mcpProxyService.listPrompts(serverName, username)
                                .map(result -> {
                                    @SuppressWarnings("unchecked")
                                    List<Map<String, Object>> prompts = 
                                            (List<Map<String, Object>>) result.getOrDefault("prompts", List.of());
                                    return prompts;
                                })
                                .onErrorResume(error -> {
                                    LOG.warn("Failed to fetch prompts from server {}: {}", serverName, error.getMessage());
                                    return Mono.just(List.of());
                                })
                    )
                    .collectList()
                    .map(promptLists -> {
                        List<Map<String, Object>> allPrompts = promptLists.stream()
                                .flatMap(List::stream)
                                .collect(java.util.stream.Collectors.toList());
                        
                        return createGroupSuccessResponse(requestId, Map.of("prompts", allPrompts));
                    });
        } catch (Exception e) {
            LOG.error("Failed to list prompts for group {}", groupId, e);
            return Mono.just(createGroupErrorResponse(requestId, -32603, e.getMessage()));
        }
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleGroupGetPrompt(
            Object requestId, String groupId, Map<String, Object> params, String username) {
        
        String promptName = (String) params.get("name");
        @SuppressWarnings("unchecked")
        Map<String, Object> arguments = (Map<String, Object>) params.get("arguments");

        LOG.info("Handling prompts/get request for group {}: prompt={}, user={}", groupId, promptName, username);

        return mcpProxyService.findPromptServer(promptName, username)
                .flatMap(mcpServer -> mcpProxyService.getPrompt(mcpServer, promptName, username, arguments))
                .map(result -> createGroupSuccessResponse(requestId, result))
                .onErrorResume(error -> {
                    LOG.error("Failed to get prompt {} in group {}", promptName, groupId, error);
                    return Mono.just(createGroupErrorResponse(requestId, -32603, error.getMessage()));
                });
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleGroupNotification(String method) {
        LOG.info("Received notification for group gateway: {}", method);
        // Notifications don't return results, just acknowledge with 200 OK
        return Mono.just(ResponseEntity.ok(Map.of()));
    }

    private ResponseEntity<Map<String, Object>> createGroupSuccessResponse(Object id, Map<String, Object> result) {
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.put("result", result);
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<Map<String, Object>> createGroupErrorResponse(Object id, int code, String message) {
        Map<String, Object> error = Map.of(
            "code", code,
            "message", message
        );
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.put("error", error);
        return ResponseEntity.ok(response);
    }

    /**
     * List tools from all servers in a group (MCP protocol endpoint)
     * PHASE 1: Uses policy-aware tool service for detection and logging
     */
    @GetMapping("/group/{groupId}/mcp/list-tools")
    public Mono<ResponseEntity<Map<String, Object>>> listToolsFromGroup(@PathVariable String groupId) {
        Map<String, Object> user = authService.getOptionalUser();
        String username = (String) user.getOrDefault("preferred_username", "unknown");

        try {
            Map<String, Object> group = mcpGroupService.getGroup(groupId);
            @SuppressWarnings("unchecked")
            List<String> serverNames = (List<String>) group.get("serverNames");
            @SuppressWarnings("unchecked")
            Map<String, List<String>> toolConfig = (Map<String, List<String>>) group.getOrDefault("tool_config", Map.of());

            if (serverNames == null || serverNames.isEmpty()) {
                return Mono.just(ResponseEntity.ok(Map.of(
                        "tools", List.of(),
                        "count", 0,
                        "group_id", groupId
                )));
            }

            // PHASE 1: Fetch tools with policy-awareness for detection and logging
            return reactor.core.publisher.Flux.fromIterable(serverNames)
                    .flatMap(serverName -> {
                        List<String> groupConfiguredTools = toolConfig.get(serverName);

                        // Use policy-aware service to fetch tools and log any mismatches
                        return policyAwareToolService.getAvailableTools(serverName, username, groupConfiguredTools)
                                .map(tools -> {
                                    // Add server name to each tool for reference
                                    tools.forEach(tool -> tool.put("_mcp_server", serverName));
                                    return tools;
                                })
                                .onErrorResume(error -> {
                                    LOG.warn("Failed to fetch tools from server {}: {}", serverName, error.getMessage());
                                    return Mono.just(List.of());
                                });
                    })
                    .collectList()
                    .map(toolLists -> {
                        List<Map<String, Object>> allTools = toolLists.stream()
                                .flatMap(List::stream)
                                .collect(java.util.stream.Collectors.toList());

                        return ResponseEntity.ok(Map.of(
                                "tools", allTools,
                                "count", allTools.size(),
                                "group_id", groupId,
                                "server_count", serverNames.size(),
                                "policy_aware", true  // Indicate policy-awareness is enabled
                        ));
                    });
        } catch (IllegalArgumentException e) {
            LOG.warn("Group not found: {}", groupId);
            return Mono.just(ResponseEntity.status(404)
                    .body(Map.of("error", e.getMessage())));
        } catch (Exception e) {
            LOG.error("Failed to list tools from group {}", groupId, e);
            return Mono.just(ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to list tools from group: " + e.getMessage())));
        }
    }

    /**
     * Invoke a tool on the appropriate server within a group (MCP protocol endpoint)
     */
    @PostMapping("/group/{groupId}/mcp/invoke")
    public Mono<ResponseEntity<Map<String, Object>>> invokeToolInGroup(
            @PathVariable String groupId,
            @RequestBody Map<String, Object> request) {
        Map<String, Object> user = authService.getOptionalUser();
        String username = (String) user.getOrDefault("preferred_username", "unknown");
        String toolName = (String) request.get("tool_name");
        @SuppressWarnings("unchecked")
        Map<String, Object> parameters = (Map<String, Object>) request.getOrDefault("parameters", Map.of());

        try {
            Map<String, Object> group = mcpGroupService.getGroup(groupId);
            @SuppressWarnings("unchecked")
            List<String> serverNames = (List<String>) group.get("serverNames");
            
            if (serverNames == null || serverNames.isEmpty()) {
                return Mono.just(ResponseEntity.badRequest()
                        .body(Map.of("error", "Group has no servers")));
            }

            // Try each server until one succeeds
            return reactor.core.publisher.Flux.fromIterable(serverNames)
                    .flatMap(serverName -> 
                        mcpProxyService.invokeTool(serverName, toolName, username, parameters)
                                .map(result -> Map.of(
                                        "success", true,
                                        "tool_name", toolName,
                                        "mcp_server", serverName,
                                        "group_id", groupId,
                                        "result", result
                                ))
                                .onErrorResume(error -> Mono.empty()) // Skip failed servers
                    )
                    .next() // Take the first successful result
                    .map(ResponseEntity::ok)
                    .switchIfEmpty(Mono.just(ResponseEntity.ok(Map.of(
                            "success", false,
                            "tool_name", toolName,
                            "group_id", groupId,
                            "error", "Tool not found in any server in the group"
                    ))));
        } catch (IllegalArgumentException e) {
            LOG.warn("Group not found: {}", groupId);
            return Mono.just(ResponseEntity.status(404)
                    .body(Map.of("error", e.getMessage())));
        } catch (Exception e) {
            LOG.error("Failed to invoke tool in group {}", groupId, e);
            return Mono.just(ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to invoke tool in group: " + e.getMessage())));
        }
    }
}
