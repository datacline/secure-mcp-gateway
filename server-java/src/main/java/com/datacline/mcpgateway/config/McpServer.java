package com.datacline.mcpgateway.config;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Dedicated entity for MCP server configuration.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class McpServer {

    private String name;
    private String url;  // For HTTP servers
    private String type;
    private int timeout;
    private boolean enabled;
    private String description;
    private String imageIcon;
    private String policyId;
    private List<String> tags;
    private List<String> tools;
    private Map<String, Object> metadata;
    private McpAuthConfig auth;

    // Stdio server configuration
    private String command;  // For stdio servers (e.g., "npx", "node", "python")
    private List<String> args;  // Command arguments (e.g., ["@modelcontextprotocol/server-playwright"])
    private Map<String, String> env;  // Environment variables for stdio servers

    /**
     * Check if this server supports wildcard tools.
     */
    public boolean supportsWildcardTools() {
        return tools != null && tools.contains("*");
    }

    /**
     * Check if this server has a specific tool.
     */
    public boolean hasTool(String toolName) {
        if (tools == null || tools.isEmpty()) {
            return true; // Assume all tools if not specified
        }
        return tools.contains("*") || tools.contains(toolName);
    }

    /**
     * Check if this is a stdio-based server.
     */
    public boolean isStdio() {
        return "stdio".equalsIgnoreCase(type) || command != null;
    }

    /**
     * Check if this is an HTTP-based server.
     */
    public boolean isHttp() {
        return !isStdio() && url != null;
    }

    /**
     * Validate server configuration.
     */
    public void validate() {
        if (isStdio()) {
            if (command == null || command.trim().isEmpty()) {
                throw new IllegalArgumentException("Stdio server '" + name + "' must have a 'command' field");
            }
        } else {
            if (url == null || url.trim().isEmpty()) {
                throw new IllegalArgumentException("HTTP server '" + name + "' must have a 'url' field");
            }
        }
    }
}
