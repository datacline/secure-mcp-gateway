package com.datacline.mcpgateway.entity;

import com.datacline.mcpgateway.config.McpAuthConfig;
import com.datacline.mcpgateway.config.McpServer;
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
 * JPA Entity for MCP Server configurations.
 * Replaces YAML-based storage with PostgreSQL.
 */
@Entity
@Table(name = "mcp_servers")
@Getter
@Setter
@NoArgsConstructor
@Slf4j
public class McpServerEntity {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false, length = 1024)
    private String url;

    @Column(nullable = false, length = 50)
    private String type = "http";

    @Column(nullable = false)
    private Integer timeout = 30;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_icon", length = 512)
    private String imageIcon;

    @Column(name = "policy_id")
    private String policyId;

    @Column(columnDefinition = "TEXT")
    private String tags; // JSON array

    @Column(columnDefinition = "TEXT")
    private String tools; // JSON array

    @Column(columnDefinition = "TEXT")
    private String metadata; // JSON object

    // Auth fields - flattened for simplicity
    @Column(name = "auth_method", length = 50)
    private String authMethod;

    @Column(name = "auth_location", length = 50)
    private String authLocation;

    @Column(name = "auth_name")
    private String authName;

    @Column(name = "auth_format")
    private String authFormat;

    @Column(name = "auth_prefix")
    private String authPrefix;

    @Column(name = "auth_credential_ref")
    private String authCredentialRef;

    @Column(name = "auth_credential", length = 1024)
    private String authCredential;

    @Column(name = "auth_client_id")
    private String authClientId;

    @Column(name = "auth_client_secret", length = 512)
    private String authClientSecret;

    @Column(name = "auth_token_url", length = 1024)
    private String authTokenUrl;

    @Column(name = "auth_scopes", columnDefinition = "TEXT")
    private String authScopes;

    @Column(name = "auth_audience", length = 512)
    private String authAudience;

    @Column(name = "created_at")
    @Setter(lombok.AccessLevel.NONE)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @Setter(lombok.AccessLevel.NONE)
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

    // Constructor from McpServer config object
    public McpServerEntity(String name, McpServer server) {
        this.name = name;
        updateFromMcpServer(server);
    }

    /**
     * Update entity fields from McpServer object
     */
    public void updateFromMcpServer(McpServer server) {
        this.url = server.getUrl();
        this.type = server.getType() != null ? server.getType() : "http";
        this.timeout = server.getTimeout() > 0 ? server.getTimeout() : 30;
        this.enabled = server.isEnabled();
        this.description = server.getDescription();
        this.imageIcon = server.getImageIcon();
        this.policyId = server.getPolicyId();

        // Convert lists to JSON
        this.tags = toJson(server.getTags());
        this.tools = toJson(server.getTools());
        this.metadata = toJson(server.getMetadata());

        // Flatten auth config (McpAuthConfig is a record, use field accessors)
        McpAuthConfig auth = server.getAuth();
        if (auth != null) {
            this.authMethod = auth.method() != null ? auth.method().name().toLowerCase() : null;
            this.authLocation = auth.location() != null ? auth.location().name().toLowerCase() : null;
            this.authName = auth.name();
            this.authFormat = auth.format() != null ? auth.format().name().toLowerCase() : null;
            this.authPrefix = auth.prefix() != null ? auth.prefix().orElse(null) : null;
            this.authCredentialRef = auth.credentialRef();
            this.authCredential = auth.credential();  // Store direct credential
        }
    }

    /**
     * Convert entity to McpServer object
     */
    public McpServer toMcpServer() {
        McpServer server = new McpServer();
        server.setName(this.name);
        server.setUrl(this.url);
        server.setType(this.type);
        server.setTimeout(this.timeout != null ? this.timeout : 30);
        server.setEnabled(this.enabled != null ? this.enabled : true);
        server.setDescription(this.description);
        server.setImageIcon(this.imageIcon);
        server.setPolicyId(this.policyId);

        // Parse JSON lists
        server.setTags(fromJsonList(this.tags));
        server.setTools(fromJsonList(this.tools));
        server.setMetadata(fromJsonMap(this.metadata));

        // Reconstruct auth config (McpAuthConfig is an immutable record)
        if (this.authMethod != null && !this.authMethod.isEmpty()) {
            McpAuthConfig.AuthMethod method = parseAuthMethod(this.authMethod);
            McpAuthConfig.AuthLocation location = parseAuthLocation(this.authLocation);
            McpAuthConfig.AuthFormat format = parseAuthFormat(this.authFormat);
            
            McpAuthConfig auth = new McpAuthConfig(
                method,
                location,
                this.authName,
                format,
                Optional.ofNullable(this.authPrefix),
                Optional.empty(), // template not stored separately
                this.authCredentialRef,
                this.authCredential  // Include direct credential
            );
            server.setAuth(auth);
        }

        return server;
    }

    /**
     * Convert to Map for API responses
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("name", name);
        map.put("url", url);
        map.put("type", type);
        map.put("timeout", timeout);
        map.put("enabled", enabled);
        map.put("description", description);
        map.put("image_icon", imageIcon);
        map.put("policy_id", policyId);
        map.put("tags", fromJsonList(tags));
        map.put("tools", fromJsonList(tools));
        map.put("metadata", fromJsonMap(metadata));

        if (authMethod != null) {
            Map<String, Object> auth = new LinkedHashMap<>();
            auth.put("method", authMethod);
            if (authLocation != null) auth.put("location", authLocation);
            if (authName != null) auth.put("name", authName);
            if (authFormat != null) auth.put("format", authFormat);
            if (authPrefix != null) auth.put("prefix", authPrefix);
            if (authCredentialRef != null) auth.put("credential_ref", authCredentialRef);
            if (authClientId != null) auth.put("client_id", authClientId);
            if (authTokenUrl != null) auth.put("token_url", authTokenUrl);
            if (authScopes != null) auth.put("scopes", Arrays.asList(authScopes.split(",")));
            if (authAudience != null) auth.put("audience", authAudience);
            // Return masked indicator if credential exists (don't expose actual value)
            if (authCredential != null && !authCredential.isEmpty()) {
                auth.put("has_credential", true);
                // Return masked version for UI display
                String masked = authCredential.length() <= 8 
                    ? "••••••••" 
                    : authCredential.substring(0, 4) + "••••••••" + authCredential.substring(authCredential.length() - 4);
                auth.put("credential_masked", masked);
            }
            map.put("auth", auth);
        }

        return map;
    }

    /**
     * Update from Map (from API requests)
     */
    @SuppressWarnings("unchecked")
    public void updateFromMap(Map<String, Object> config) {
        if (config.containsKey("url")) this.url = (String) config.get("url");
        if (config.containsKey("type")) this.type = (String) config.get("type");
        if (config.containsKey("timeout")) {
            Object t = config.get("timeout");
            this.timeout = t instanceof Integer ? (Integer) t : Integer.parseInt(t.toString());
        }
        if (config.containsKey("enabled")) {
            Object e = config.get("enabled");
            this.enabled = e instanceof Boolean ? (Boolean) e : Boolean.parseBoolean(e.toString());
        }
        if (config.containsKey("description")) this.description = (String) config.get("description");
        if (config.containsKey("image_icon")) this.imageIcon = (String) config.get("image_icon");
        if (config.containsKey("policy_id")) this.policyId = (String) config.get("policy_id");
        if (config.containsKey("tags")) this.tags = toJson(config.get("tags"));
        if (config.containsKey("tools")) this.tools = toJson(config.get("tools"));
        if (config.containsKey("metadata")) this.metadata = toJson(config.get("metadata"));

        // Handle auth
        if (config.containsKey("auth")) {
            Map<String, Object> auth = (Map<String, Object>) config.get("auth");
            if (auth != null) {
                this.authMethod = (String) auth.get("method");
                this.authLocation = (String) auth.get("location");
                this.authName = (String) auth.get("name");
                this.authFormat = (String) auth.get("format");
                this.authPrefix = (String) auth.get("prefix");
                this.authCredentialRef = (String) auth.get("credential_ref");
                if (auth.containsKey("credential")) {
                    this.authCredential = (String) auth.get("credential");
                }
                this.authClientId = (String) auth.get("client_id");
                if (auth.containsKey("client_secret")) {
                    this.authClientSecret = (String) auth.get("client_secret");
                }
                this.authTokenUrl = (String) auth.get("token_url");
                Object scopes = auth.get("scopes");
                if (scopes instanceof List) {
                    this.authScopes = String.join(",", (List<String>) scopes);
                } else if (scopes instanceof String) {
                    this.authScopes = (String) scopes;
                }
                this.authAudience = (String) auth.get("audience");
            }
        }
    }

    // JSON utility methods
    private String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize to JSON", e);
            return null;
        }
    }

    private List<String> fromJsonList(String json) {
        if (json == null || json.isEmpty()) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse JSON list", e);
            return new ArrayList<>();
        }
    }

    private Map<String, Object> fromJsonMap(String json) {
        if (json == null || json.isEmpty()) return new HashMap<>();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse JSON map", e);
            return new HashMap<>();
        }
    }

    // Auth enum parsing helpers
    private McpAuthConfig.AuthMethod parseAuthMethod(String method) {
        if (method == null) return McpAuthConfig.AuthMethod.NONE;
        return switch (method.toLowerCase()) {
            case "api_key" -> McpAuthConfig.AuthMethod.API_KEY;
            case "bearer" -> McpAuthConfig.AuthMethod.BEARER;
            case "basic" -> McpAuthConfig.AuthMethod.BASIC;
            case "oauth2" -> McpAuthConfig.AuthMethod.OAUTH2;
            case "custom" -> McpAuthConfig.AuthMethod.CUSTOM;
            default -> McpAuthConfig.AuthMethod.NONE;
        };
    }

    private McpAuthConfig.AuthLocation parseAuthLocation(String location) {
        if (location == null) return McpAuthConfig.AuthLocation.HEADER;
        return switch (location.toLowerCase()) {
            case "query" -> McpAuthConfig.AuthLocation.QUERY;
            case "body" -> McpAuthConfig.AuthLocation.BODY;
            default -> McpAuthConfig.AuthLocation.HEADER;
        };
    }

    private McpAuthConfig.AuthFormat parseAuthFormat(String format) {
        if (format == null) return McpAuthConfig.AuthFormat.RAW;
        return switch (format.toLowerCase()) {
            case "prefix" -> McpAuthConfig.AuthFormat.PREFIX;
            case "template" -> McpAuthConfig.AuthFormat.TEMPLATE;
            default -> McpAuthConfig.AuthFormat.RAW;
        };
    }
}
