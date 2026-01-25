package com.datacline.mcpgateway.controller;

import com.datacline.mcpgateway.config.GatewayConfig;
import com.datacline.mcpgateway.service.McpProxyService;
import com.datacline.mcpgateway.service.auth.AuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.*;
import java.util.stream.Collectors;

/**
 * MCP Protocol endpoint implementing JSON-RPC over HTTP.
 * 
 * This endpoint allows MCP clients (VS Code, Claude Desktop, etc.) to connect
 * directly to the gateway using the native MCP protocol.
 * 
 * Equivalent to Python's server/routes/mcp_protocol.py
 */
@RestController
public class McpProtocolController {

    private static final Logger LOG = LoggerFactory.getLogger(McpProtocolController.class);

    @Autowired
    private McpProxyService mcpProxyService;

    @Autowired
    private AuthService authService;

    @Autowired
    private GatewayConfig gatewayConfig;

    /**
     * GET /mcp - Discovery endpoint
     * Returns server capabilities and OAuth configuration
     */
    @GetMapping("/mcp")
    public ResponseEntity<Map<String, Object>> mcpDiscovery() {
        LOG.info("MCP discovery endpoint called (GET /mcp)");
        
        Map<String, Object> capabilities = new LinkedHashMap<>();
        capabilities.put("tools", Map.of());
        capabilities.put("resources", Map.of());
        capabilities.put("prompts", Map.of());

        // Add OAuth configuration if auth is enabled
        if (gatewayConfig.isAuthEnabled()) {
            List<String> scopes = new ArrayList<>(List.of("openid", "profile", "email"));
            capabilities.put("oauth", Map.of(
                "authorizationUrl", gatewayConfig.getKeycloakUrl() + "/realms/" + gatewayConfig.getKeycloakRealm() + "/protocol/openid-connect/auth",
                "tokenUrl", gatewayConfig.getKeycloakUrl() + "/realms/" + gatewayConfig.getKeycloakRealm() + "/protocol/openid-connect/token",
                "clientId", "vscode-mcp-client",
                "scopes", scopes
            ));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("protocolVersion", "2024-11-05");
        response.put("capabilities", capabilities);
        response.put("serverInfo", Map.of(
            "name", "secure-mcp-gateway",
            "version", "2.0.0"
        ));

        return ResponseEntity.ok(response);
    }

    /**
     * POST /mcp - Main MCP protocol endpoint
     * Handles JSON-RPC requests from MCP clients
     */
    @PostMapping("/mcp")
    public Mono<ResponseEntity<Map<String, Object>>> mcpProtocol(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        
        String method = (String) body.get("method");
        Object requestId = body.get("id");
        @SuppressWarnings("unchecked")
        Map<String, Object> params = (Map<String, Object>) body.getOrDefault("params", Map.of());

        LOG.info("MCP JSON-RPC request: method={}, id={}", method, requestId);

        // Get user info (if auth enabled)
        Map<String, Object> user = authService.getOptionalUser();
        String username = (String) user.getOrDefault("preferred_username", "anonymous");

        // Handle different MCP methods
        return switch (method) {
            case "initialize" -> handleInitialize(requestId);
            case "tools/list" -> handleListTools(requestId, username);
            case "tools/call" -> handleCallTool(requestId, params, username);
            case "resources/list" -> handleListResources(requestId, username);
            case "resources/read" -> handleReadResource(requestId, params, username);
            case "prompts/list" -> handleListPrompts(requestId, username);
            case "prompts/get" -> handleGetPrompt(requestId, params, username);
            case String s when s.startsWith("notifications/") -> handleNotification(method);
            default -> Mono.just(createErrorResponse(requestId, -32601, "Method not found: " + method));
        };
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleInitialize(Object requestId) {
        LOG.info("Handling initialize request");
        
        Map<String, Object> capabilities = new LinkedHashMap<>();
        capabilities.put("tools", Map.of());
        capabilities.put("resources", Map.of());
        capabilities.put("prompts", Map.of());

        // Add OAuth configuration if auth is enabled
        if (gatewayConfig.isAuthEnabled()) {
            List<String> scopes = new ArrayList<>(List.of("openid", "profile", "email"));
            capabilities.put("oauth", Map.of(
                "authorizationUrl", gatewayConfig.getKeycloakUrl() + "/realms/" + gatewayConfig.getKeycloakRealm() + "/protocol/openid-connect/auth",
                "tokenUrl", gatewayConfig.getKeycloakUrl() + "/realms/" + gatewayConfig.getKeycloakRealm() + "/protocol/openid-connect/token",
                "clientId", "vscode-mcp-client",
                "scopes", scopes
            ));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("protocolVersion", "2024-11-05");
        result.put("capabilities", capabilities);
        result.put("serverInfo", Map.of(
            "name", "secure-mcp-gateway",
            "version", "2.0.0"
        ));

        return Mono.just(createSuccessResponse(requestId, result));
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleListTools(Object requestId, String username) {
        LOG.info("Handling tools/list request for user: {}", username);
        
        // Get all enabled servers and aggregate their tools
        Map<String, Map<String, Object>> servers = mcpProxyService.getAllServers();
        
        return mcpProxyService.listAllTools(username)
                .map(allTools -> {
                    Map<String, Object> result = Map.of("tools", allTools);
                    return createSuccessResponse(requestId, result);
                })
                .onErrorResume(error -> {
                    LOG.error("Failed to list tools", error);
                    return Mono.just(createErrorResponse(requestId, -32603, error.getMessage()));
                });
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleCallTool(
            Object requestId, Map<String, Object> params, String username) {
        
        String toolName = (String) params.get("name");
        @SuppressWarnings("unchecked")
        Map<String, Object> arguments = (Map<String, Object>) params.getOrDefault("arguments", Map.of());

        LOG.info("Handling tools/call request: tool={}, user={}", toolName, username);

        // Find which server provides this tool
        return mcpProxyService.findToolServer(toolName, username)
                .flatMap(mcpServer -> mcpProxyService.invokeTool(mcpServer, toolName, username, arguments))
                .map(result -> {
                    // Format result according to MCP spec
                    List<Map<String, Object>> content = List.of(Map.of(
                        "type", "text",
                        "text", result.toString()
                    ));
                    return createSuccessResponse(requestId, Map.of("content", content));
                })
                .onErrorResume(error -> {
                    LOG.error("Failed to call tool {}", toolName, error);
                    return Mono.just(createErrorResponse(requestId, -32603, error.getMessage()));
                });
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleListResources(Object requestId, String username) {
        LOG.info("Handling resources/list request for user: {}", username);
        
        return mcpProxyService.listAllResources(username)
                .map(resources -> createSuccessResponse(requestId, Map.of("resources", resources)))
                .onErrorResume(error -> {
                    LOG.error("Failed to list resources", error);
                    return Mono.just(createErrorResponse(requestId, -32603, error.getMessage()));
                });
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleReadResource(
            Object requestId, Map<String, Object> params, String username) {
        
        String uri = (String) params.get("uri");
        LOG.info("Handling resources/read request: uri={}, user={}", uri, username);

        // Parse URI to determine which server to use
        // Format: mcp://<server-name>/...
        return mcpProxyService.parseResourceUri(uri)
                .flatMap(parsed -> {
                    String mcpServer = (String) parsed.get("server");
                    String resourceUri = (String) parsed.get("uri");
                    return mcpProxyService.readResource(mcpServer, resourceUri, username);
                })
                .map(result -> createSuccessResponse(requestId, Map.of("contents", result)))
                .onErrorResume(error -> {
                    LOG.error("Failed to read resource {}", uri, error);
                    return Mono.just(createErrorResponse(requestId, -32603, error.getMessage()));
                });
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleListPrompts(Object requestId, String username) {
        LOG.info("Handling prompts/list request for user: {}", username);
        
        return mcpProxyService.listAllPrompts(username)
                .map(prompts -> createSuccessResponse(requestId, Map.of("prompts", prompts)))
                .onErrorResume(error -> {
                    LOG.error("Failed to list prompts", error);
                    return Mono.just(createErrorResponse(requestId, -32603, error.getMessage()));
                });
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleGetPrompt(
            Object requestId, Map<String, Object> params, String username) {
        
        String promptName = (String) params.get("name");
        @SuppressWarnings("unchecked")
        Map<String, Object> arguments = (Map<String, Object>) params.get("arguments");

        LOG.info("Handling prompts/get request: prompt={}, user={}", promptName, username);

        return mcpProxyService.findPromptServer(promptName, username)
                .flatMap(mcpServer -> mcpProxyService.getPrompt(mcpServer, promptName, username, arguments))
                .map(result -> createSuccessResponse(requestId, result))
                .onErrorResume(error -> {
                    LOG.error("Failed to get prompt {}", promptName, error);
                    return Mono.just(createErrorResponse(requestId, -32603, error.getMessage()));
                });
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleNotification(String method) {
        LOG.info("Received notification: {}", method);
        // Notifications don't return results, just acknowledge with 200 OK
        return Mono.just(ResponseEntity.ok(Map.of()));
    }

    private ResponseEntity<Map<String, Object>> createSuccessResponse(Object id, Map<String, Object> result) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.put("result", result);
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<Map<String, Object>> createErrorResponse(Object id, int code, String message) {
        Map<String, Object> error = Map.of(
            "code", code,
            "message", message
        );
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.put("error", error);
        return ResponseEntity.ok(response);
    }
}
