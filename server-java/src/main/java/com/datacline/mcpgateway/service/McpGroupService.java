package com.datacline.mcpgateway.service;

import com.datacline.mcpgateway.entity.McpServerGroupEntity;
import com.datacline.mcpgateway.repository.McpServerGroupRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for managing MCP Server Groups.
 * Each group acts as a sub-gateway with its own MCP-compliant HTTP endpoint.
 */
@Service
public class McpGroupService {

    private static final Logger LOG = LoggerFactory.getLogger(McpGroupService.class);
    
    private final McpServerGroupRepository repository;
    private final McpProxyService mcpProxyService;
    
    @Value("${server.port:8000}")
    private int serverPort;
    
    @Value("${gateway.host:localhost}")
    private String gatewayHost;

    public McpGroupService(
            McpServerGroupRepository repository,
            @Autowired McpProxyService mcpProxyService) {
        this.repository = repository;
        this.mcpProxyService = mcpProxyService;
        LOG.info("MCP Group Service initialized");
    }
    
    /**
     * Validate that all servers in the list are HTTP type.
     * STDIO servers must be converted to HTTP before adding to a group.
     */
    private void validateServersAreHttp(List<String> serverNames) {
        Map<String, Map<String, Object>> allServers = mcpProxyService.getAllServers();
        
        List<String> stdioServers = new ArrayList<>();
        List<String> notFoundServers = new ArrayList<>();
        
        for (String serverName : serverNames) {
            Map<String, Object> serverConfig = allServers.get(serverName);
            
            if (serverConfig == null) {
                notFoundServers.add(serverName);
                continue;
            }
            
            String serverType = (String) serverConfig.getOrDefault("type", "http");
            if ("stdio".equalsIgnoreCase(serverType)) {
                stdioServers.add(serverName);
            }
        }
        
        if (!notFoundServers.isEmpty()) {
            throw new IllegalArgumentException(
                "Servers not found: " + String.join(", ", notFoundServers)
            );
        }
        
        if (!stdioServers.isEmpty()) {
            throw new IllegalArgumentException(
                "The following servers must be converted to HTTP before adding to a group: " + 
                String.join(", ", stdioServers) + 
                ". Please convert them using the 'Convert to HTTP' action first."
            );
        }
    }
    
    /**
     * Generate a gateway URL for the group
     * Format: http://{host}:{port}/mcp/group/{id}/mcp
     * The trailing /mcp is required for MCP protocol compliance
     */
    private String generateGatewayUrl(String groupId) {
        return String.format("http://%s:%d/mcp/group/%s/mcp", gatewayHost, serverPort, groupId);
    }

    /**
     * Get all groups
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllGroups() {
        return repository.findAll().stream()
                .map(McpServerGroupEntity::toMap)
                .collect(Collectors.toList());
    }

    /**
     * Get a specific group by ID
     * Always fetches fresh data from database (no caching)
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getGroup(String groupId) {
        McpServerGroupEntity entity = repository.findByIdString(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
        
        // Force refresh from database to ensure we get the latest data
        entity = repository.findById(entity.getId())
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
        
        LOG.debug("Fetched group {} with {} servers", entity.getName(), entity.getServerNamesList().size());
        return entity.toMap();
    }

    /**
     * Get a specific group by name
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getGroupByName(String name) {
        McpServerGroupEntity entity = repository.findByName(name)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + name));
        
        return entity.toMap();
    }

    /**
     * Create a new group
     */
    @Transactional
    public Map<String, Object> createGroup(Map<String, Object> groupData) {
        String name = (String) groupData.get("name");
        
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Group name is required");
        }
        
        // Validate group name format
        if (!name.matches("^[a-zA-Z0-9_\\s-]+$")) {
            throw new IllegalArgumentException("Group name can only contain alphanumeric characters, spaces, hyphens, and underscores");
        }
        
        // Check if group already exists
        if (repository.existsByName(name)) {
            throw new IllegalArgumentException("Group already exists: " + name);
        }
        
        @SuppressWarnings("unchecked")
        List<String> serverNames = (List<String>) groupData.get("serverNames");
        if (serverNames == null) {
            serverNames = new ArrayList<>();
        }
        
        // Validate that all servers are HTTP type
        if (!serverNames.isEmpty()) {
            validateServersAreHttp(serverNames);
        }
        
        // Create new entity
        McpServerGroupEntity entity = new McpServerGroupEntity();
        entity.setName(name);
        entity.setDescription((String) groupData.get("description"));
        entity.setServerNamesList(serverNames);
        entity.setEnabled(true);
        
        // Save to get ID first
        entity = repository.save(entity);
        
        // Generate and set gateway URL
        String gatewayUrl = generateGatewayUrl(entity.getId().toString());
        entity.setGatewayUrl(gatewayUrl);
        entity.setGatewayPort(serverPort);
        
        entity = repository.save(entity);
        LOG.info("Created group: {} with {} servers and gateway URL: {}", 
                 name, entity.getServerNamesList().size(), gatewayUrl);
        
        return entity.toMap();
    }

    /**
     * Update an existing group
     */
    @Transactional
    public Map<String, Object> updateGroup(String groupId, Map<String, Object> groupData) {
        McpServerGroupEntity entity = repository.findByIdString(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
        
        // Update fields
        if (groupData.containsKey("name")) {
            String newName = (String) groupData.get("name");
            if (!newName.equals(entity.getName()) && repository.existsByName(newName)) {
                throw new IllegalArgumentException("Group name already exists: " + newName);
            }
            entity.setName(newName);
        }
        
        if (groupData.containsKey("description")) {
            entity.setDescription((String) groupData.get("description"));
        }
        
        if (groupData.containsKey("serverNames")) {
            @SuppressWarnings("unchecked")
            List<String> serverNames = (List<String>) groupData.get("serverNames");
            entity.setServerNamesList(serverNames);
        }
        
        entity = repository.save(entity);
        LOG.info("Updated group: {}", entity.getName());
        
        return entity.toMap();
    }

    /**
     * Delete a group
     */
    @Transactional
    public void deleteGroup(String groupId) {
        McpServerGroupEntity entity = repository.findByIdString(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
        
        String groupName = entity.getName();
        repository.delete(entity);
        
        LOG.info("Deleted group: {}", groupName);
    }

    /**
     * Add a server to a group
     */
    @Transactional
    public Map<String, Object> addServerToGroup(String groupId, String serverName) {
        McpServerGroupEntity entity = repository.findByIdString(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
        
        // Validate that the server is HTTP type
        validateServersAreHttp(List.of(serverName));
        
        entity.addServer(serverName);
        entity = repository.saveAndFlush(entity);
        
        LOG.info("Added server {} to group {} (now has {} servers)", 
                 serverName, entity.getName(), entity.getServerNamesList().size());
        return entity.toMap();
    }

    /**
     * Remove a server from a group
     */
    @Transactional
    public Map<String, Object> removeServerFromGroup(String groupId, String serverName) {
        McpServerGroupEntity entity = repository.findByIdString(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
        
        entity.removeServer(serverName);
        entity = repository.saveAndFlush(entity);
        
        LOG.info("Removed server {} from group {} (now has {} servers)", 
                 serverName, entity.getName(), entity.getServerNamesList().size());
        return entity.toMap();
    }

    /**
     * Add multiple servers to a group
     */
    @Transactional
    public Map<String, Object> addServersToGroup(String groupId, List<String> serverNames) {
        McpServerGroupEntity entity = repository.findByIdString(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
        
        // Validate that all servers are HTTP type
        validateServersAreHttp(serverNames);
        
        for (String serverName : serverNames) {
            entity.addServer(serverName);
        }
        
        entity = repository.saveAndFlush(entity);
        LOG.info("Added {} servers to group {} (now has {} servers)", 
                 serverNames.size(), entity.getName(), entity.getServerNamesList().size());
        
        return entity.toMap();
    }

    /**
     * Configure which tools from a server are exposed through the group gateway
     * @param tools List of tool names to allow, or empty/null to allow all, or ["*"] for explicit all
     */
    @Transactional
    public Map<String, Object> configureServerTools(String groupId, String serverName, List<String> tools) {
        McpServerGroupEntity entity = repository.findByIdString(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
        
        // Verify server is in the group
        if (!entity.getServerNamesList().contains(serverName)) {
            throw new IllegalArgumentException("Server " + serverName + " is not in group " + groupId);
        }
        
        entity.setAllowedToolsForServer(serverName, tools);
        entity = repository.saveAndFlush(entity);
        
        LOG.info("Configured tools for server {} in group {}: {}", 
                 serverName, entity.getName(), tools != null ? tools.size() + " tools" : "all tools");
        
        return entity.toMap();
    }
}
