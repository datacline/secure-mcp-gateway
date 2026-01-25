package com.datacline.mcpgateway.controller;

import com.datacline.mcpgateway.config.GatewayConfig;
import com.datacline.mcpgateway.service.McpProxyService;
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
     */
    @GetMapping("/servers")
    public ResponseEntity<Map<String, Object>> listServers() {
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
                    serverInfo.put("tags", serverData.getOrDefault("tags", List.of()));
                    return serverInfo;
                })
                .toList();

        Map<String, Object> response = new java.util.HashMap<>();
        response.put("servers", serverList);
        response.put("count", serverList.size());
        return ResponseEntity.ok(response);
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
}
