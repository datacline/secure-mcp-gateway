package com.datacline.mcpgateway.service;

import com.datacline.mcpgateway.client.McpHttpClient;
import com.datacline.mcpgateway.config.GatewayConfig;
import com.datacline.mcpgateway.config.McpAuthConfig;
import com.datacline.mcpgateway.config.McpServerConfig;
import com.datacline.mcpgateway.service.audit.AuditLogger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.*;

/**
 * MCP Proxy service for forwarding requests to MCP servers.
 * Equivalent to Python's server/mcp_proxy.py MCPProxy class.
 */
@Service
public class McpProxyService {

    private static final Logger LOG = LoggerFactory.getLogger(McpProxyService.class);

    @Autowired
    McpServerConfig mcpServerConfig;

    @Autowired
    McpHttpClient mcpHttpClient;

    @Autowired
    GatewayConfig gatewayConfig;

    @Autowired
    AuditLogger auditLogger;

    /**
     * Resolve credential reference to actual value.
     * Supports env://, file://, and vault:// (placeholder).
     */
    private String resolveCredential(String credentialRef) {
        if (credentialRef == null) {
            return null;
        }

        if (credentialRef.startsWith("env://")) {
            String varName = credentialRef.substring(6);
            String value = System.getenv(varName);
            if (value == null) {
                throw new IllegalArgumentException("Environment variable '" + varName + "' not found");
            }
            return value;
        } else if (credentialRef.startsWith("file://")) {
            String filePath = credentialRef.substring(7);
            try {
                return Files.readString(Paths.get(filePath)).trim();
            } catch (IOException e) {
                throw new IllegalArgumentException("Failed to read credential from file '" + filePath + "': " + e.getMessage());
            }
        } else if (credentialRef.startsWith("vault://")) {
            throw new IllegalArgumentException("Vault integration not yet implemented. Use env:// or file:// for now.");
        } else {
            throw new IllegalArgumentException("Unknown credential reference format: " + credentialRef);
        }
    }

    /**
     * Format credential based on auth configuration.
     */
    private String formatCredential(McpAuthConfig authConfig, String credential) {
        if (authConfig == null || credential == null) {
            return credential;
        }

        return switch (authConfig.format()) {
            case RAW -> credential;
            case PREFIX -> authConfig.prefix().orElse("") + credential;
            case TEMPLATE -> {
                String template = authConfig.template().orElseThrow(
                        () -> new IllegalArgumentException("Template format requires 'template' field")
                );
                yield template.replace("{credential}", credential);
            }
        };
    }

    /**
     * Apply authentication to request headers.
     */
    private Map<String, String> applyAuthentication(
            McpServerConfig.McpServerEntry serverEntry
    ) {
        Map<String, String> headers = new HashMap<>();
        
        McpAuthConfig authConfig = serverEntry.auth();
        if (authConfig == null || !authConfig.requiresAuth()) {
            LOG.debug("No authentication required for server: {}", serverEntry.name());
            return headers;
        }

        LOG.debug("Applying authentication for server: {}, method: {}", 
                  serverEntry.name(), authConfig.method());

        try {
            String credential = resolveCredential(authConfig.credentialRef());
            if (credential == null) {
                LOG.warn("Credential resolved to null for server: {}", serverEntry.name());
                return headers;
            }

            String formattedCredential = formatCredential(authConfig, credential);
            LOG.debug("Formatted credential for server: {}, header: {}, value length: {}", 
                      serverEntry.name(), authConfig.name(), 
                      formattedCredential != null ? formattedCredential.length() : 0);

            if (authConfig.location() == McpAuthConfig.AuthLocation.HEADER) {
                headers.put(authConfig.name(), formattedCredential);
                LOG.debug("Added auth header: {} for server: {}", authConfig.name(), serverEntry.name());
            }
        } catch (Exception e) {
            LOG.error("Failed to apply authentication for server: {}", serverEntry.name(), e);
            throw e;
        }

        return headers;
    }

    /**
     * List tools from an MCP server.
     */
    public Mono<Map<String, Object>> listTools(String mcpServer, String user) {
        long startTime = System.currentTimeMillis();

        return Mono.fromCallable(() -> mcpServerConfig.getServer(mcpServer)
                .orElseThrow(() -> {
                    long durationMs = System.currentTimeMillis() - startTime;
                    String errorMsg = "MCP server '" + mcpServer + "' not configured";

                    auditLogger.logMcpRequest(
                            user, "list_tools", mcpServer, null, null,
                            "error", null, (int) durationMs, null, errorMsg
                    );

                    return new IllegalArgumentException(errorMsg);
                }))
                .flatMap(serverEntry -> {
                    if (!serverEntry.enabled()) {
                        return Mono.error(new IllegalArgumentException("MCP server '" + mcpServer + "' is disabled"));
                    }

                    Map<String, String> authHeaders = applyAuthentication(serverEntry);
                    Duration timeout = Duration.ofSeconds(serverEntry.timeout());

                    return Mono.fromCompletionStage(
                            mcpHttpClient.listTools(serverEntry.url(), authHeaders, timeout))
                            .map(tools -> {
                                long durationMs = System.currentTimeMillis() - startTime;

                                auditLogger.logMcpRequest(
                                        user, "list_tools", mcpServer, null, null,
                                        "success", null, (int) durationMs, 200, null
                                );

                                return Map.<String, Object>of("tools", tools);
                            })
                            .onErrorMap(error -> {
                                long durationMs = System.currentTimeMillis() - startTime;
                                String errorMsg = error.getMessage();
                                
                                // Provide more helpful error messages
                                if (errorMsg != null && errorMsg.contains("Unauthorized")) {
                                    errorMsg = "Authentication failed for MCP server '" + mcpServer + 
                                            "'. Check if the authentication token is set correctly (e.g., NOTION_MCP_BEARER_TOKEN)";
                                } else if (errorMsg != null && errorMsg.contains("Connection refused")) {
                                    errorMsg = "MCP server '" + mcpServer + "' is not running or not accessible at " + 
                                            serverEntry.url();
                                } else if (errorMsg == null) {
                                    errorMsg = "Unknown error occurred";
                                }

                                auditLogger.logMcpRequest(
                                        user, "list_tools", mcpServer, null, null,
                                        "error", null, (int) durationMs, null, errorMsg
                                );

                                return new RuntimeException("Failed to list tools from '" + mcpServer + "': " + errorMsg, error);
                            });
                });
    }

    /**
     * Invoke a tool on an MCP server.
     */
    public Mono<Map<String, Object>> invokeTool(
            String mcpServer,
            String toolName,
            String user,
            Map<String, Object> parameters
    ) {
        long startTime = System.currentTimeMillis();

        return Mono.fromCallable(() -> mcpServerConfig.getServer(mcpServer)
                .orElseThrow(() -> {
                    long durationMs = System.currentTimeMillis() - startTime;
                    String errorMsg = "MCP server '" + mcpServer + "' not configured";

                    auditLogger.logMcpRequest(
                            user, "invoke_tool", mcpServer, toolName, parameters,
                            "error", null, (int) durationMs, null, errorMsg
                    );

                    return new IllegalArgumentException(errorMsg);
                }))
                .flatMap(serverEntry -> {
                    if (!serverEntry.enabled()) {
                        return Mono.error(new IllegalArgumentException("MCP server '" + mcpServer + "' is disabled"));
                    }

                    Map<String, String> authHeaders = applyAuthentication(serverEntry);
                    Duration timeout = Duration.ofSeconds(serverEntry.timeout());

                    return Mono.fromCompletionStage(
                            mcpHttpClient.callTool(serverEntry.url(), authHeaders, timeout, toolName, parameters))
                            .map(result -> {
                                long durationMs = System.currentTimeMillis() - startTime;

                                auditLogger.logMcpRequest(
                                        user, "invoke_tool", mcpServer, toolName, parameters,
                                        "success", null, (int) durationMs, 200, null
                                );

                                return result;
                            })
                            .onErrorMap(error -> {
                                long durationMs = System.currentTimeMillis() - startTime;
                                String errorMsg = error.getMessage();

                                auditLogger.logMcpRequest(
                                        user, "invoke_tool", mcpServer, toolName, parameters,
                                        "error", null, (int) durationMs, null, errorMsg
                                );

                                return new RuntimeException("Failed to invoke tool: " + errorMsg, error);
                            });
                });
    }

    /**
     * List resources from an MCP server.
     */
    public Mono<Map<String, Object>> listResources(String mcpServer, String user) {
        return Mono.fromCallable(() -> mcpServerConfig.getServer(mcpServer)
                .orElseThrow(() -> new IllegalArgumentException("MCP server '" + mcpServer + "' not configured")))
                .flatMap(serverEntry -> {
                    if (!serverEntry.enabled()) {
                        return Mono.error(new IllegalArgumentException("MCP server '" + mcpServer + "' is disabled"));
                    }

                    Map<String, String> authHeaders = applyAuthentication(serverEntry);
                    Duration timeout = Duration.ofSeconds(serverEntry.timeout());

                    return Mono.fromCompletionStage(
                            mcpHttpClient.listResources(serverEntry.url(), authHeaders, timeout))
                            .map(resources -> Map.<String, Object>of("resources", resources));
                });
    }

    /**
     * Read a resource from an MCP server.
     */
    public Mono<Map<String, Object>> readResource(String mcpServer, String uri, String user) {
        return Mono.fromCallable(() -> mcpServerConfig.getServer(mcpServer)
                .orElseThrow(() -> new IllegalArgumentException("MCP server '" + mcpServer + "' not configured")))
                .flatMap(serverEntry -> {
                    if (!serverEntry.enabled()) {
                        return Mono.error(new IllegalArgumentException("MCP server '" + mcpServer + "' is disabled"));
                    }

                    Map<String, String> authHeaders = applyAuthentication(serverEntry);
                    Duration timeout = Duration.ofSeconds(serverEntry.timeout());

                    return Mono.fromCompletionStage(
                            mcpHttpClient.readResource(serverEntry.url(), authHeaders, timeout, uri));
                });
    }

    /**
     * List prompts from an MCP server.
     */
    public Mono<Map<String, Object>> listPrompts(String mcpServer, String user) {
        return Mono.fromCallable(() -> mcpServerConfig.getServer(mcpServer)
                .orElseThrow(() -> new IllegalArgumentException("MCP server '" + mcpServer + "' not configured")))
                .flatMap(serverEntry -> {
                    if (!serverEntry.enabled()) {
                        return Mono.error(new IllegalArgumentException("MCP server '" + mcpServer + "' is disabled"));
                    }

                    Map<String, String> authHeaders = applyAuthentication(serverEntry);
                    Duration timeout = Duration.ofSeconds(serverEntry.timeout());

                    return Mono.fromCompletionStage(
                            mcpHttpClient.listPrompts(serverEntry.url(), authHeaders, timeout))
                            .map(prompts -> Map.<String, Object>of("prompts", prompts));
                });
    }

    /**
     * Get a prompt from an MCP server.
     */
    public Mono<Map<String, Object>> getPrompt(
            String mcpServer,
            String name,
            String user,
            Map<String, Object> arguments
    ) {
        return Mono.fromCallable(() -> mcpServerConfig.getServer(mcpServer)
                .orElseThrow(() -> new IllegalArgumentException("MCP server '" + mcpServer + "' not configured")))
                .flatMap(serverEntry -> {
                    if (!serverEntry.enabled()) {
                        return Mono.error(new IllegalArgumentException("MCP server '" + mcpServer + "' is disabled"));
                    }

                    Map<String, String> authHeaders = applyAuthentication(serverEntry);
                    Duration timeout = Duration.ofSeconds(serverEntry.timeout());

                    return Mono.fromCompletionStage(
                            mcpHttpClient.getPrompt(serverEntry.url(), authHeaders, timeout, name, arguments));
                });
    }

    /**
     * Invoke a tool on multiple MCP servers (broadcast).
     */
    public Mono<Map<String, Object>> invokeToolBroadcast(
            String toolName,
            String user,
            Map<String, Object> parameters,
            List<String> mcpServers,
            List<String> tags
    ) {
        long startTime = System.currentTimeMillis();

        // Determine target servers
        List<String> targetServers = new ArrayList<>();
        if (mcpServers != null && !mcpServers.isEmpty()) {
            targetServers.addAll(mcpServers);
        } else if (tags != null && !tags.isEmpty()) {
            targetServers.addAll(mcpServerConfig.getServersByTags(tags).stream()
                    .map(McpServerConfig.McpServerEntry::name)
                    .toList());
        } else {
            // Get all enabled servers that have this tool
            targetServers.addAll(mcpServerConfig.getEnabledServers().stream()
                    .filter(s -> s.hasTool(toolName))
                    .map(McpServerConfig.McpServerEntry::name)
                    .toList());
        }

        if (targetServers.isEmpty()) {
            return Mono.error(new IllegalArgumentException("No MCP servers available for broadcast"));
        }

        // Execute requests concurrently
        Map<String, Object> results = new HashMap<>();
        Map<String, String> errors = new HashMap<>();

        return Flux.fromIterable(targetServers)
                .flatMap(serverName -> invokeTool(serverName, toolName, user, parameters)
                        .doOnNext(result -> results.put(serverName, result))
                        .onErrorResume(error -> {
                            errors.put(serverName, error.getMessage());
                            return Mono.empty();
                        }))
                .then(Mono.fromCallable(() -> {
                    long durationMs = System.currentTimeMillis() - startTime;

                    auditLogger.logMcpRequest(
                            user, "invoke_tool_broadcast", "*", toolName, parameters,
                            results.isEmpty() ? "error" : "success", null,
                            (int) durationMs, null, null
                    );

                    return Map.<String, Object>of(
                            "tool_name", toolName,
                            "total_servers", targetServers.size(),
                            "successful", results.size(),
                            "failed", errors.size(),
                            "results", results,
                            "errors", errors,
                            "execution_time_ms", durationMs
                    );
                }));
    }

    /**
     * Get all configured servers.
     */
    public Map<String, Map<String, Object>> getAllServers() {
        Map<String, Map<String, Object>> servers = new HashMap<>();
        mcpServerConfig.getAllServers().forEach((name, entry) -> {
            Map<String, Object> serverInfo = new HashMap<>();
            serverInfo.put("url", entry.url());
            serverInfo.put("type", entry.type());
            serverInfo.put("enabled", entry.enabled());
            serverInfo.put("description", entry.description());
            serverInfo.put("tags", entry.tags());
            servers.put(name, serverInfo);
        });
        return servers;
    }

    /**
     * Get server info.
     */
    public Mono<Map<String, Object>> getServerInfo(String mcpServer, String user) {
        return Mono.fromCallable(() -> mcpServerConfig.getServer(mcpServer)
                .orElseThrow(() -> new IllegalArgumentException("MCP server '" + mcpServer + "' not configured")))
                .map(serverEntry -> {
                    Map<String, Object> info = new HashMap<>();
                    info.put("name", serverEntry.name());
                    info.put("url", serverEntry.url());
                    info.put("type", serverEntry.type());
                    info.put("enabled", serverEntry.enabled());
                    info.put("description", serverEntry.description());
                    info.put("tags", serverEntry.tags());
                    return info;
                });
    }

    /**
     * List all tools from all enabled servers (for MCP protocol endpoint).
     */
    public Mono<List<Map<String, Object>>> listAllTools(String user) {
        Map<String, McpServerConfig.McpServerEntry> servers = mcpServerConfig.getAllServers();
        
        List<Mono<List<Map<String, Object>>>> toolMonos = servers.entrySet().stream()
                .filter(entry -> entry.getValue().enabled())
                .map(entry -> {
                    String serverName = entry.getKey();
                    return listTools(serverName, user)
                            .map(result -> {
                                @SuppressWarnings("unchecked")
                                List<Map<String, Object>> tools = (List<Map<String, Object>>) result.get("tools");
                                // Add server metadata to each tool
                                tools.forEach(tool -> tool.put("_server", serverName));
                                return tools;
                            })
                            .onErrorResume(error -> {
                                LOG.warn("Failed to list tools from {}: {}", serverName, error.getMessage());
                                return Mono.just(List.of());
                            });
                })
                .toList();

        return Flux.merge(toolMonos)
                .collectList()
                .map(lists -> lists.stream()
                        .flatMap(List::stream)
                        .toList());
    }

    /**
     * List all resources from all enabled servers (for MCP protocol endpoint).
     */
    public Mono<List<Map<String, Object>>> listAllResources(String user) {
        Map<String, McpServerConfig.McpServerEntry> servers = mcpServerConfig.getAllServers();
        
        List<Mono<List<Map<String, Object>>>> resourceMonos = servers.entrySet().stream()
                .filter(entry -> entry.getValue().enabled())
                .map(entry -> {
                    String serverName = entry.getKey();
                    return listResources(serverName, user)
                            .map(result -> {
                                @SuppressWarnings("unchecked")
                                List<Map<String, Object>> resources = (List<Map<String, Object>>) result.get("resources");
                                // Add server metadata to each resource
                                resources.forEach(resource -> resource.put("_server", serverName));
                                return resources;
                            })
                            .onErrorResume(error -> {
                                LOG.warn("Failed to list resources from {}: {}", serverName, error.getMessage());
                                return Mono.just(List.of());
                            });
                })
                .toList();

        return Flux.merge(resourceMonos)
                .collectList()
                .map(lists -> lists.stream()
                        .flatMap(List::stream)
                        .toList());
    }

    /**
     * List all prompts from all enabled servers (for MCP protocol endpoint).
     */
    public Mono<List<Map<String, Object>>> listAllPrompts(String user) {
        Map<String, McpServerConfig.McpServerEntry> servers = mcpServerConfig.getAllServers();
        
        List<Mono<List<Map<String, Object>>>> promptMonos = servers.entrySet().stream()
                .filter(entry -> entry.getValue().enabled())
                .map(entry -> {
                    String serverName = entry.getKey();
                    return listPrompts(serverName, user)
                            .map(result -> {
                                @SuppressWarnings("unchecked")
                                List<Map<String, Object>> prompts = (List<Map<String, Object>>) result.get("prompts");
                                // Add server metadata to each prompt
                                prompts.forEach(prompt -> prompt.put("_server", serverName));
                                return prompts;
                            })
                            .onErrorResume(error -> {
                                LOG.warn("Failed to list prompts from {}: {}", serverName, error.getMessage());
                                return Mono.just(List.of());
                            });
                })
                .toList();

        return Flux.merge(promptMonos)
                .collectList()
                .map(lists -> lists.stream()
                        .flatMap(List::stream)
                        .toList());
    }

    /**
     * Find which server provides a specific tool.
     */
    public Mono<String> findToolServer(String toolName, String user) {
        return listAllTools(user)
                .flatMap(tools -> {
                    Optional<String> server = tools.stream()
                            .filter(tool -> toolName.equals(tool.get("name")))
                            .map(tool -> (String) tool.get("_server"))
                            .findFirst();
                    
                    return server
                            .map(Mono::just)
                            .orElseGet(() -> Mono.error(new IllegalArgumentException("Tool '" + toolName + "' not found")));
                });
    }

    /**
     * Find which server provides a specific prompt.
     */
    public Mono<String> findPromptServer(String promptName, String user) {
        return listAllPrompts(user)
                .flatMap(prompts -> {
                    Optional<String> server = prompts.stream()
                            .filter(prompt -> promptName.equals(prompt.get("name")))
                            .map(prompt -> (String) prompt.get("_server"))
                            .findFirst();
                    
                    return server
                            .map(Mono::just)
                            .orElseGet(() -> Mono.error(new IllegalArgumentException("Prompt '" + promptName + "' not found")));
                });
    }

    /**
     * Parse resource URI to extract server and resource path.
     * Format: mcp://<server-name>/path/to/resource
     */
    public Mono<Map<String, String>> parseResourceUri(String uri) {
        if (!uri.startsWith("mcp://")) {
            return Mono.error(new IllegalArgumentException("Resource URI must start with 'mcp://'"));
        }

        String withoutProtocol = uri.substring(6); // Remove "mcp://"
        int slashIndex = withoutProtocol.indexOf('/');
        
        if (slashIndex == -1) {
            return Mono.error(new IllegalArgumentException("Invalid resource URI format. Expected: mcp://<server>/path"));
        }

        String serverName = withoutProtocol.substring(0, slashIndex);
        String resourcePath = withoutProtocol.substring(slashIndex);

        return Mono.just(Map.of(
                "server", serverName,
                "uri", resourcePath
        ));
    }
}
