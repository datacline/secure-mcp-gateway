package com.datacline.mcpgateway.entity;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDateTime;
import java.util.*;

/**
 * JPA Entity for MCP Server Groups.
 * A group is a collection of MCP servers that can be managed together.
 * Cache is disabled to ensure real-time updates when servers are added/removed.
 */
@Entity
@Table(name = "mcp_server_groups")
@Getter
@Setter
@NoArgsConstructor
@Slf4j
@org.hibernate.annotations.Cache(usage = org.hibernate.annotations.CacheConcurrencyStrategy.NONE)
public class McpServerGroupEntity {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "server_names", columnDefinition = "TEXT")
    private String serverNames; // JSON array of server names

    @Column(name = "tool_config", columnDefinition = "TEXT")
    private String toolConfig; // JSON object mapping server names to allowed tools

    @Column(name = "gateway_url", length = 1024)
    private String gatewayUrl; // MCP-compliant HTTP endpoint for this group

    @Column(name = "gateway_port")
    private Integer gatewayPort; // Port for the group's gateway endpoint

    @Column(nullable = false)
    private Boolean enabled = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /**
     * Get server names as a list
     */
    public List<String> getServerNamesList() {
        if (serverNames == null || serverNames.isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(serverNames, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            log.error("Failed to parse server names JSON: {}", serverNames, e);
            return new ArrayList<>();
        }
    }

    /**
     * Set server names from a list
     */
    public void setServerNamesList(List<String> names) {
        try {
            this.serverNames = objectMapper.writeValueAsString(names != null ? names : new ArrayList<>());
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize server names list", e);
            this.serverNames = "[]";
        }
    }

    /**
     * Add a server to the group
     */
    public void addServer(String serverName) {
        List<String> names = getServerNamesList();
        if (!names.contains(serverName)) {
            names.add(serverName);
            setServerNamesList(names);
        }
    }

    /**
     * Remove a server from the group
     */
    public void removeServer(String serverName) {
        List<String> names = getServerNamesList();
        names.remove(serverName);
        setServerNamesList(names);
        
        // Also remove from tool config
        Map<String, List<String>> config = getToolConfig();
        config.remove(serverName);
        setToolConfig(config);
    }

    /**
     * Get tool configuration as a map
     * Returns a map of server name -> list of allowed tool names
     */
    public Map<String, List<String>> getToolConfig() {
        if (toolConfig == null || toolConfig.isEmpty()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(toolConfig, new TypeReference<Map<String, List<String>>>() {});
        } catch (JsonProcessingException e) {
            log.error("Failed to parse tool config JSON: {}", toolConfig, e);
            return new HashMap<>();
        }
    }

    /**
     * Set tool configuration from a map
     */
    public void setToolConfig(Map<String, List<String>> config) {
        try {
            this.toolConfig = objectMapper.writeValueAsString(config != null ? config : new HashMap<>());
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize tool config", e);
            this.toolConfig = "{}";
        }
    }

    /**
     * Get allowed tools for a specific server
     * Returns null if all tools are allowed, or a list of specific tool names
     */
    public List<String> getAllowedToolsForServer(String serverName) {
        Map<String, List<String>> config = getToolConfig();
        return config.get(serverName);
    }

    /**
     * Set allowed tools for a specific server
     * Pass null or empty list to allow all tools
     * Pass ["*"] to explicitly allow all tools
     */
    public void setAllowedToolsForServer(String serverName, List<String> tools) {
        Map<String, List<String>> config = getToolConfig();
        if (tools == null || tools.isEmpty()) {
            config.remove(serverName);
        } else {
            config.put(serverName, new ArrayList<>(tools));
        }
        setToolConfig(config);
    }

    /**
     * Check if a specific tool is allowed for a server
     */
    public boolean isToolAllowed(String serverName, String toolName) {
        List<String> allowedTools = getAllowedToolsForServer(serverName);
        
        // If no config exists for this server, allow all tools
        if (allowedTools == null || allowedTools.isEmpty()) {
            return true;
        }
        
        // Check for wildcard
        if (allowedTools.contains("*")) {
            return true;
        }
        
        // Check if tool is in the allowed list
        return allowedTools.contains(toolName);
    }

    /**
     * Convert entity to map for API responses
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("id", id != null ? id.toString() : null);
        map.put("name", name);
        map.put("description", description);
        map.put("serverNames", getServerNamesList());
        map.put("server_count", getServerNamesList().size());
        map.put("tool_config", getToolConfig());
        map.put("gateway_url", gatewayUrl);
        map.put("gateway_port", gatewayPort);
        map.put("enabled", enabled);
        map.put("created_at", createdAt != null ? createdAt.toString() : null);
        map.put("updated_at", updatedAt != null ? updatedAt.toString() : null);
        return map;
    }

    /**
     * Update entity from map
     */
    public void updateFromMap(Map<String, Object> map) {
        if (map.containsKey("name")) {
            this.name = (String) map.get("name");
        }
        if (map.containsKey("description")) {
            this.description = (String) map.get("description");
        }
        if (map.containsKey("serverNames")) {
            @SuppressWarnings("unchecked")
            List<String> names = (List<String>) map.get("serverNames");
            setServerNamesList(names);
        }
        if (map.containsKey("tool_config")) {
            @SuppressWarnings("unchecked")
            Map<String, List<String>> config = (Map<String, List<String>>) map.get("tool_config");
            setToolConfig(config);
        }
        if (map.containsKey("gateway_url")) {
            this.gatewayUrl = (String) map.get("gateway_url");
        }
        if (map.containsKey("gateway_port")) {
            Object port = map.get("gateway_port");
            this.gatewayPort = port instanceof Integer ? (Integer) port : null;
        }
        if (map.containsKey("enabled")) {
            this.enabled = (Boolean) map.get("enabled");
        }
    }
}
