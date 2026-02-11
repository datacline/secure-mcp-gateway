package com.datacline.mcpgateway.service;

import com.datacline.mcpgateway.config.McpAuthConfig;
import com.datacline.mcpgateway.config.McpServer;
import com.datacline.mcpgateway.config.McpServerConfig;
import com.datacline.mcpgateway.entity.McpServerEntity;
import com.datacline.mcpgateway.repository.McpServerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.yaml.snakeyaml.Yaml;

import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.util.*;

/**
 * Service to migrate MCP server configurations from YAML to PostgreSQL.
 * Runs on application startup if the database is empty.
 */
@Service
public class McpConfigMigrationService {

    private static final Logger LOG = LoggerFactory.getLogger(McpConfigMigrationService.class);

    private final McpServerRepository repository;
    private final McpServerConfig mcpServerConfig;
    private final String yamlConfigPath;
    private final boolean migrationEnabled;

    public McpConfigMigrationService(
            McpServerRepository repository,
            McpServerConfig mcpServerConfig,
            @Value("${gateway.mcp-servers-config:mcp_servers.yaml}") String yamlConfigPath,
            @Value("${gateway.migrate-yaml-to-db:true}") boolean migrationEnabled) {
        this.repository = repository;
        this.mcpServerConfig = mcpServerConfig;
        this.yamlConfigPath = yamlConfigPath;
        this.migrationEnabled = migrationEnabled;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void onApplicationReady() {
        if (!migrationEnabled) {
            LOG.info("YAML to DB migration is disabled");
            return;
        }

        long existingCount = repository.count();
        if (existingCount > 0) {
            LOG.info("Database already contains {} MCP server configurations, skipping migration", existingCount);
            return;
        }

        LOG.info("Database is empty, attempting to migrate from YAML: {}", yamlConfigPath);
        migrateFromYaml();
    }

    /**
     * Migrate MCP server configurations from YAML file to PostgreSQL
     */
    @Transactional
    public void migrateFromYaml() {
        try {
            Map<String, Object> yamlConfig = loadYamlConfig();
            if (yamlConfig == null) {
                LOG.warn("No YAML config found or empty, skipping migration");
                return;
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> servers = (Map<String, Object>) yamlConfig.get("servers");
            if (servers == null || servers.isEmpty()) {
                LOG.warn("No servers found in YAML config");
                return;
            }

            int migrated = 0;
            for (Map.Entry<String, Object> entry : servers.entrySet()) {
                String serverName = entry.getKey();
                @SuppressWarnings("unchecked")
                Map<String, Object> serverConfig = (Map<String, Object>) entry.getValue();

                try {
                    McpServerEntity entity = createEntityFromYaml(serverName, serverConfig);
                    repository.save(entity);
                    migrated++;
                    LOG.debug("Migrated server: {}", serverName);
                } catch (Exception e) {
                    LOG.error("Failed to migrate server {}: {}", serverName, e.getMessage());
                }
            }

            LOG.info("Successfully migrated {} MCP server configurations from YAML to PostgreSQL", migrated);

            // Reload the cache to make migrated servers available
            if (migrated > 0) {
                LOG.info("Reloading MCP server cache after migration");
                mcpServerConfig.loadConfig();
            }

        } catch (FileNotFoundException e) {
            LOG.info("No YAML config file found at {}, starting with empty database", yamlConfigPath);
        } catch (Exception e) {
            LOG.error("Failed to migrate from YAML: {}", e.getMessage(), e);
        }
    }

    private Map<String, Object> loadYamlConfig() throws FileNotFoundException {
        Yaml yaml = new Yaml();
        InputStream inputStream = new FileInputStream(yamlConfigPath);
        return yaml.load(inputStream);
    }

    @SuppressWarnings("unchecked")
    private McpServerEntity createEntityFromYaml(String name, Map<String, Object> config) {
        McpServerEntity entity = new McpServerEntity();
        entity.setName(name);
        
        entity.setUrl((String) config.get("url"));
        entity.setType((String) config.getOrDefault("type", "http"));
        
        Object timeout = config.get("timeout");
        if (timeout instanceof Number) {
            entity.setTimeout(((Number) timeout).intValue());
        } else {
            entity.setTimeout(30);
        }
        
        Object enabled = config.get("enabled");
        if (enabled instanceof Boolean) {
            entity.setEnabled((Boolean) enabled);
        } else {
            entity.setEnabled(true);
        }
        
        entity.setDescription((String) config.get("description"));
        entity.setImageIcon((String) config.get("image_icon"));
        
        // Handle policy_id (both snake_case and camelCase)
        String policyId = (String) config.get("policy_id");
        if (policyId == null) {
            policyId = (String) config.get("policyId");
        }
        entity.setPolicyId(policyId);
        
        // Handle tags
        List<String> tags = (List<String>) config.get("tags");
        if (tags != null) {
            entity.setTags(toJsonArray(tags));
        }
        
        // Handle tools
        List<String> tools = (List<String>) config.get("tools");
        if (tools != null) {
            entity.setTools(toJsonArray(tools));
        }
        
        // Handle metadata
        Map<String, Object> metadata = (Map<String, Object>) config.get("metadata");
        if (metadata != null) {
            entity.setMetadata(toJsonObject(metadata));
        }
        
        // Handle auth
        Map<String, Object> auth = (Map<String, Object>) config.get("auth");
        if (auth != null) {
            entity.setAuthMethod((String) auth.get("method"));
            entity.updateFromMap(Map.of("auth", auth));
        }
        
        return entity;
    }

    private String toJsonArray(List<String> list) {
        if (list == null || list.isEmpty()) return null;
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(list.get(i).replace("\"", "\\\"")).append("\"");
        }
        sb.append("]");
        return sb.toString();
    }

    private String toJsonObject(Map<String, Object> map) {
        if (map == null || map.isEmpty()) return null;
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.writeValueAsString(map);
        } catch (Exception e) {
            LOG.warn("Failed to serialize metadata to JSON", e);
            return null;
        }
    }
}
