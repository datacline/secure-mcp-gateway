package com.datacline.mcpgateway.service;

import com.datacline.mcpgateway.entity.McpServerEntity;
import com.datacline.mcpgateway.repository.McpServerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Service for managing MCP server configuration.
 * Uses PostgreSQL for persistent storage.
 */
@Service
public class McpConfigService {

    private static final Logger LOG = LoggerFactory.getLogger(McpConfigService.class);

    private final McpServerRepository repository;
    private final com.datacline.mcpgateway.config.McpServerConfig serverConfig;
    private final PolicyEngineClient policyEngineClient;

    public McpConfigService(
            McpServerRepository repository,
            @org.springframework.context.annotation.Lazy com.datacline.mcpgateway.config.McpServerConfig serverConfig,
            PolicyEngineClient policyEngineClient) {
        this.repository = repository;
        this.serverConfig = serverConfig;
        this.policyEngineClient = policyEngineClient;
        LOG.info("MCP Config Service initialized with PostgreSQL storage");
    }

    /**
     * Get configuration for a specific server
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getServerConfig(String serverName) {
        McpServerEntity entity = repository.findByName(serverName)
                .orElseThrow(() -> new IllegalArgumentException("Server not found: " + serverName));
        
        LOG.debug("Retrieved configuration for server: {}", serverName);
        return entity.toMap();
    }

    /**
     * Update configuration for an existing server
     */
    @Transactional
    public void updateServerConfig(String serverName, Map<String, Object> serverConfig) {
        McpServerEntity entity = repository.findByName(serverName)
                .orElseThrow(() -> new IllegalArgumentException("Server not found: " + serverName));
        
        // Validate configuration
        validateServerConfig(serverConfig);
        
        // Update entity
        entity.updateFromMap(serverConfig);
        repository.save(entity);
        
        // Invalidate cache
        if (this.serverConfig != null) {
            this.serverConfig.invalidateCache(serverName);
        }
        
        LOG.info("Updated configuration for server: {}", serverName);
    }

    /**
     * Create a new MCP server
     */
    @Transactional
    public void createServer(String serverName, Map<String, Object> serverConfig) {
        // Validate server name
        if (serverName == null || serverName.trim().isEmpty()) {
            throw new IllegalArgumentException("Server name cannot be empty");
        }
        
        if (!serverName.matches("^[a-zA-Z0-9_-]+$")) {
            throw new IllegalArgumentException("Server name can only contain alphanumeric characters, hyphens, and underscores");
        }
        
        // Check if server already exists
        if (repository.existsByName(serverName)) {
            throw new IllegalArgumentException("Server already exists: " + serverName);
        }
        
        // Validate configuration
        validateServerConfig(serverConfig);
        
        // Create new entity
        McpServerEntity entity = new McpServerEntity();
        entity.setName(serverName);
        entity.updateFromMap(serverConfig);
        
        repository.save(entity);
        
        // Reload cache to include new server
        if (this.serverConfig != null) {
            this.serverConfig.reload();
        }
        
        LOG.info("Created new server: {}", serverName);
    }

    /**
     * Delete a server and its associated policies
     */
    @Transactional
    public void deleteServer(String serverName) {
        McpServerEntity entity = repository.findByName(serverName)
                .orElseThrow(() -> new IllegalArgumentException("Server not found: " + serverName));

        // Delete the server from database
        repository.delete(entity);

        // Invalidate cache
        if (this.serverConfig != null) {
            this.serverConfig.invalidateCache(serverName);
        }

        LOG.info("Deleted server from database: {}", serverName);

        // Delete associated policies from policy engine (async, non-blocking)
        try {
            policyEngineClient.deletePoliciesForMCPServer(serverName)
                    .subscribe(
                            deletedCount -> {
                                if (deletedCount > 0) {
                                    LOG.info("Deleted {} policies associated with server: {}",
                                            deletedCount, serverName);
                                } else {
                                    LOG.debug("No policies found to delete for server: {}", serverName);
                                }
                            },
                            error -> LOG.error("Failed to delete policies for server {}: {}",
                                    serverName, error.getMessage())
                    );
        } catch (Exception e) {
            // Don't fail server deletion if policy deletion fails
            LOG.warn("Error initiating policy deletion for server {}: {}",
                    serverName, e.getMessage());
        }
    }

    /**
     * Get all servers
     */
    @Transactional(readOnly = true)
    public Map<String, Map<String, Object>> getAllServers() {
        List<McpServerEntity> entities = repository.findAll();
        
        Map<String, Map<String, Object>> servers = new LinkedHashMap<>();
        for (McpServerEntity entity : entities) {
            servers.put(entity.getName(), entity.toMap());
        }
        
        return servers;
    }

    /**
     * Get all enabled servers
     */
    @Transactional(readOnly = true)
    public Map<String, Map<String, Object>> getEnabledServers() {
        List<McpServerEntity> entities = repository.findByEnabledTrue();
        
        Map<String, Map<String, Object>> servers = new LinkedHashMap<>();
        for (McpServerEntity entity : entities) {
            servers.put(entity.getName(), entity.toMap());
        }
        
        return servers;
    }

    /**
     * Check if a server exists
     */
    @Transactional(readOnly = true)
    public boolean serverExists(String serverName) {
        return repository.existsByName(serverName);
    }

    /**
     * Get server entity (for internal use)
     */
    @Transactional(readOnly = true)
    public Optional<McpServerEntity> getServerEntity(String serverName) {
        return repository.findByName(serverName);
    }

    /**
     * Validate server configuration
     */
    private void validateServerConfig(Map<String, Object> config) {
        // Validate type first
        String type = (String) config.get("type");
        if (type == null || type.trim().isEmpty()) {
            type = "http"; // Default to http
        }
        
        List<String> validTypes = Arrays.asList("http", "stdio", "sse", "websocket");
        if (!validTypes.contains(type.toLowerCase())) {
            throw new IllegalArgumentException("Invalid server type: " + type + ". Must be one of: " + validTypes);
        }
        
        // Validate URL or command based on type
        if ("stdio".equalsIgnoreCase(type)) {
            // For stdio servers, command is required (but we can get it from metadata)
            // URL is optional for stdio servers
            @SuppressWarnings("unchecked")
            Map<String, Object> metadata = (Map<String, Object>) config.get("metadata");
            String command = null;
            if (metadata != null) {
                command = (String) metadata.get("command");
            }
            // We don't require command here as it might be configured later
        } else {
            // For http/sse/websocket servers, URL is required
            String url = (String) config.get("url");
            if (url == null || url.trim().isEmpty()) {
                throw new IllegalArgumentException("Server URL is required for HTTP/SSE servers");
            }
        }
        
        // Validate timeout
        Object timeoutObj = config.get("timeout");
        if (timeoutObj != null) {
            int timeout;
            if (timeoutObj instanceof Integer) {
                timeout = (Integer) timeoutObj;
            } else if (timeoutObj instanceof String) {
                try {
                    timeout = Integer.parseInt((String) timeoutObj);
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("Invalid timeout value: " + timeoutObj);
                }
            } else if (timeoutObj instanceof Number) {
                timeout = ((Number) timeoutObj).intValue();
            } else {
                throw new IllegalArgumentException("Invalid timeout type: " + timeoutObj.getClass());
            }
            
            if (timeout < 1 || timeout > 300) {
                throw new IllegalArgumentException("Timeout must be between 1 and 300 seconds");
            }
        }
        
        // Validate auth method if present
        @SuppressWarnings("unchecked")
        Map<String, Object> auth = (Map<String, Object>) config.get("auth");
        if (auth != null) {
            String method = (String) auth.get("method");
            if (method != null) {
                List<String> validMethods = Arrays.asList("bearer", "api_key", "basic", "oauth2", "custom");
                if (!validMethods.contains(method.toLowerCase())) {
                    throw new IllegalArgumentException("Invalid auth method: " + method + ". Must be one of: " + validMethods);
                }
            }
        }
        
        LOG.debug("Server configuration validated successfully");
    }
}
