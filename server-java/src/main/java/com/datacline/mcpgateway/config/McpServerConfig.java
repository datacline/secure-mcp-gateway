package com.datacline.mcpgateway.config;

import com.datacline.mcpgateway.entity.McpServerEntity;
import com.datacline.mcpgateway.repository.McpServerRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Loads and manages MCP server configurations from PostgreSQL database.
 * Provides in-memory caching with reload capability.
 */
@Component
public class McpServerConfig {

    private static final Logger LOG = LoggerFactory.getLogger(McpServerConfig.class);

    @Autowired
    private McpServerRepository repository;

    private Map<String, McpServer> servers = new ConcurrentHashMap<>();

    @PostConstruct
    void init() {
        loadConfig();
    }

    /**
     * Load MCP server configuration from database.
     */
    public void loadConfig() {
        LOG.info("Loading MCP server configuration from database");

        try {
            List<McpServerEntity> entities = repository.findAll();
            
            Map<String, McpServer> newServers = new ConcurrentHashMap<>();
            for (McpServerEntity entity : entities) {
                McpServer server = entity.toMcpServer();
                newServers.put(entity.getName(), server);
                LOG.debug("Loaded MCP server: {} -> {}", entity.getName(), entity.getUrl());
            }

            servers = newServers;
            LOG.info("Loaded {} MCP servers from database", servers.size());

        } catch (Exception e) {
            LOG.error("Failed to load MCP server config from database", e);
        }
    }

    /**
     * Get all configured servers.
     */
    public Map<String, McpServer> getAllServers() {
        return Collections.unmodifiableMap(servers);
    }

    /**
     * Get a specific server by name.
     */
    public Optional<McpServer> getServer(String name) {
        // First try cache
        McpServer cached = servers.get(name);
        if (cached != null) {
            return Optional.of(cached);
        }
        
        // If not in cache, try database
        return repository.findByName(name)
                .map(entity -> {
                    McpServer server = entity.toMcpServer();
                    servers.put(name, server); // Update cache
                    return server;
                });
    }

    /**
     * Get all enabled servers.
     */
    public List<McpServer> getEnabledServers() {
        return servers.values().stream()
            .filter(McpServer::isEnabled)
            .collect(Collectors.toList());
    }

    /**
     * Get servers by tag.
     */
    public List<McpServer> getServersByTag(String tag) {
        return servers.values().stream()
            .filter(s -> s.isEnabled() && s.getTags() != null && s.getTags().contains(tag))
            .collect(Collectors.toList());
    }

    /**
     * Get servers by multiple tags (any match).
     */
    public List<McpServer> getServersByTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return getEnabledServers();
        }
        return servers.values().stream()
            .filter(s -> s.isEnabled() && s.getTags() != null && s.getTags().stream().anyMatch(tags::contains))
            .collect(Collectors.toList());
    }

    /**
     * Get all unique tags across all servers.
     */
    public Set<String> getAllTags() {
        return servers.values().stream()
            .filter(s -> s.getTags() != null)
            .flatMap(s -> s.getTags().stream())
            .collect(Collectors.toSet());
    }

    /**
     * Reload configuration from database.
     */
    public void reload() {
        loadConfig();
    }

    /**
     * Invalidate cache for a specific server (called after updates).
     * Reloads the server from database if it still exists, or removes it if deleted.
     */
    public void invalidateCache(String serverName) {
        // Try to reload the server from database
        Optional<McpServerEntity> entity = repository.findByName(serverName);
        if (entity.isPresent()) {
            // Server exists, reload it into cache
            McpServer server = entity.get().toMcpServer();
            servers.put(serverName, server);
            LOG.debug("Reloaded server into cache: {}", serverName);
        } else {
            // Server was deleted, remove from cache
            servers.remove(serverName);
            LOG.debug("Removed deleted server from cache: {}", serverName);
        }
    }

    /**
     * Check if server exists.
     */
    public boolean serverExists(String name) {
        return servers.containsKey(name) || repository.existsByName(name);
    }
}
