package com.datacline.mcpgateway.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Loads and manages MCP server configurations from mcp_servers.yaml.
 * Equivalent to Python's server/config.py MCPServerConfig class.
 */
@Component
public class McpServerConfig {

    private static final Logger LOG = LoggerFactory.getLogger(McpServerConfig.class);

    @Autowired
    GatewayConfig gatewayConfig;

    private Map<String, McpServerEntry> servers = new HashMap<>();

    @PostConstruct
    void init() {
        loadConfig();
    }

    /**
     * Load MCP server configuration from YAML file.
     */
    public void loadConfig() {
        String configPath = gatewayConfig.getMcpServersConfig();
        LOG.info("Loading MCP server configuration from: {}", configPath);

        try {
            Path path = Paths.get(configPath);
            InputStream inputStream;

            if (Files.exists(path)) {
                inputStream = Files.newInputStream(path);
            } else {
                // Try loading from classpath
                inputStream = getClass().getClassLoader().getResourceAsStream(configPath);
                if (inputStream == null) {
                    LOG.warn("MCP server config file not found: {}", configPath);
                    return;
                }
            }

            Yaml yaml = new Yaml();
            Map<String, Object> config = yaml.load(inputStream);
            inputStream.close();

            if (config == null || !config.containsKey("servers")) {
                LOG.warn("No servers found in MCP configuration");
                return;
            }

            @SuppressWarnings("unchecked")
            Map<String, Map<String, Object>> serversConfig =
                (Map<String, Map<String, Object>>) config.get("servers");

            servers.clear();
            for (Map.Entry<String, Map<String, Object>> entry : serversConfig.entrySet()) {
                String name = entry.getKey();
                Map<String, Object> serverData = entry.getValue();
                McpServerEntry server = parseServerEntry(name, serverData);
                servers.put(name, server);
                LOG.debug("Loaded MCP server: {} -> {}", name, server.url());
            }

            LOG.info("Loaded {} MCP servers", servers.size());

        } catch (IOException e) {
            LOG.error("Failed to load MCP server config: {}", configPath, e);
        }
    }

    @SuppressWarnings("unchecked")
    private McpServerEntry parseServerEntry(String name, Map<String, Object> data) {
        String url = (String) data.get("url");
        String type = (String) data.getOrDefault("type", "http");
        int timeout = ((Number) data.getOrDefault("timeout", 60)).intValue();
        boolean enabled = (boolean) data.getOrDefault("enabled", true);
        String description = (String) data.get("description");

        // Parse tags
        List<String> tags = new ArrayList<>();
        Object tagsObj = data.get("tags");
        if (tagsObj instanceof List) {
            tags = ((List<?>) tagsObj).stream()
                .map(Object::toString)
                .collect(Collectors.toList());
        }

        // Parse tools list
        List<String> tools = new ArrayList<>();
        Object toolsObj = data.get("tools");
        if (toolsObj instanceof List) {
            tools = ((List<?>) toolsObj).stream()
                .map(Object::toString)
                .collect(Collectors.toList());
        }

        // Parse metadata
        Map<String, Object> metadata = new HashMap<>();
        Object metadataObj = data.get("metadata");
        if (metadataObj instanceof Map) {
            metadata = (Map<String, Object>) metadataObj;
        }

        // Parse auth configuration
        McpAuthConfig auth = null;
        Object authObj = data.get("auth");
        if (authObj instanceof Map) {
            auth = parseAuthConfig((Map<String, Object>) authObj);
        }

        return new McpServerEntry(
            name,
            url,
            type,
            timeout,
            enabled,
            description,
            tags,
            tools,
            metadata,
            auth
        );
    }

    private McpAuthConfig parseAuthConfig(Map<String, Object> data) {
        if (data == null || data.isEmpty()) {
            return null;
        }

        String methodStr = (String) data.get("method");
        if (methodStr == null || methodStr.equalsIgnoreCase("none")) {
            return null;
        }

        McpAuthConfig.AuthMethod method = switch (methodStr.toLowerCase()) {
            case "api_key" -> McpAuthConfig.AuthMethod.API_KEY;
            case "bearer" -> McpAuthConfig.AuthMethod.BEARER;
            case "basic" -> McpAuthConfig.AuthMethod.BASIC;
            case "oauth2" -> McpAuthConfig.AuthMethod.OAUTH2;
            case "custom" -> McpAuthConfig.AuthMethod.CUSTOM;
            default -> McpAuthConfig.AuthMethod.NONE;
        };

        String locationStr = (String) data.getOrDefault("location", "header");
        McpAuthConfig.AuthLocation location = switch (locationStr.toLowerCase()) {
            case "query" -> McpAuthConfig.AuthLocation.QUERY;
            case "body" -> McpAuthConfig.AuthLocation.BODY;
            default -> McpAuthConfig.AuthLocation.HEADER;
        };

        String formatStr = (String) data.getOrDefault("format", "raw");
        McpAuthConfig.AuthFormat format = switch (formatStr.toLowerCase()) {
            case "prefix" -> McpAuthConfig.AuthFormat.PREFIX;
            case "template" -> McpAuthConfig.AuthFormat.TEMPLATE;
            default -> McpAuthConfig.AuthFormat.RAW;
        };

        return new McpAuthConfig(
            method,
            location,
            (String) data.get("name"),
            format,
            Optional.ofNullable((String) data.get("prefix")),
            Optional.ofNullable((String) data.get("template")),
            (String) data.get("credential_ref")
        );
    }

    /**
     * Get all configured servers.
     */
    public Map<String, McpServerEntry> getAllServers() {
        return Collections.unmodifiableMap(servers);
    }

    /**
     * Get a specific server by name.
     */
    public Optional<McpServerEntry> getServer(String name) {
        return Optional.ofNullable(servers.get(name));
    }

    /**
     * Get all enabled servers.
     */
    public List<McpServerEntry> getEnabledServers() {
        return servers.values().stream()
            .filter(McpServerEntry::enabled)
            .collect(Collectors.toList());
    }

    /**
     * Get servers by tag.
     */
    public List<McpServerEntry> getServersByTag(String tag) {
        return servers.values().stream()
            .filter(s -> s.enabled() && s.tags().contains(tag))
            .collect(Collectors.toList());
    }

    /**
     * Get servers by multiple tags (any match).
     */
    public List<McpServerEntry> getServersByTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return getEnabledServers();
        }
        return servers.values().stream()
            .filter(s -> s.enabled() && s.tags().stream().anyMatch(tags::contains))
            .collect(Collectors.toList());
    }

    /**
     * Get all unique tags across all servers.
     */
    public Set<String> getAllTags() {
        return servers.values().stream()
            .flatMap(s -> s.tags().stream())
            .collect(Collectors.toSet());
    }

    /**
     * Reload configuration from file.
     */
    public void reload() {
        loadConfig();
    }

    /**
     * MCP Server entry record.
     */
    public record McpServerEntry(
        String name,
        String url,
        String type,
        int timeout,
        boolean enabled,
        String description,
        List<String> tags,
        List<String> tools,
        Map<String, Object> metadata,
        McpAuthConfig auth
    ) {
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
    }
}
