package com.datacline.mcpgateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.NestedConfigurationProperty;
import org.springframework.context.annotation.Configuration;

import java.util.Optional;

/**
 * Gateway configuration mapped from application.yaml.
 * Equivalent to Python's server/config.py Settings class.
 */
@Configuration
@ConfigurationProperties(prefix = "gateway")
public class GatewayConfig {

    private String host = "0.0.0.0";
    private int port = 8000;

    // Authentication settings
    private boolean authEnabled = false;
    private String keycloakUrl;
    private String keycloakRealm = "mcp-gateway";
    private String jwksUrl;
    private String jwtAlgorithm = "RS256";
    private String jwtAudience = "mcp-gateway-client";
    private int tokenCacheTtl = 300;

    // MCP settings
    private String mcpServersConfig = "mcp_servers.yaml";
    private int proxyTimeout = 60;

    // Nested configurations
    @NestedConfigurationProperty
    private McpAuthConfig mcpAuth = new McpAuthConfig();

    @NestedConfigurationProperty
    private AuditConfig audit = new AuditConfig();

    // Getters and Setters
    public String getHost() {
        return host;
    }

    public void setHost(String host) {
        this.host = host;
    }

    public int getPort() {
        return port;
    }

    public void setPort(int port) {
        this.port = port;
    }

    public boolean isAuthEnabled() {
        return authEnabled;
    }

    public void setAuthEnabled(boolean authEnabled) {
        this.authEnabled = authEnabled;
    }

    public String getKeycloakUrl() {
        return keycloakUrl;
    }

    public void setKeycloakUrl(String keycloakUrl) {
        this.keycloakUrl = keycloakUrl;
    }

    public String getKeycloakRealm() {
        return keycloakRealm;
    }

    public void setKeycloakRealm(String keycloakRealm) {
        this.keycloakRealm = keycloakRealm;
    }

    public String getJwksUrl() {
        return jwksUrl;
    }

    public void setJwksUrl(String jwksUrl) {
        this.jwksUrl = jwksUrl;
    }

    public String getJwtAlgorithm() {
        return jwtAlgorithm;
    }

    public void setJwtAlgorithm(String jwtAlgorithm) {
        this.jwtAlgorithm = jwtAlgorithm;
    }

    public String getJwtAudience() {
        return jwtAudience;
    }

    public void setJwtAudience(String jwtAudience) {
        this.jwtAudience = jwtAudience;
    }

    public int getTokenCacheTtl() {
        return tokenCacheTtl;
    }

    public void setTokenCacheTtl(int tokenCacheTtl) {
        this.tokenCacheTtl = tokenCacheTtl;
    }

    public String getMcpServersConfig() {
        return mcpServersConfig;
    }

    public void setMcpServersConfig(String mcpServersConfig) {
        this.mcpServersConfig = mcpServersConfig;
    }

    public int getProxyTimeout() {
        return proxyTimeout;
    }

    public void setProxyTimeout(int proxyTimeout) {
        this.proxyTimeout = proxyTimeout;
    }

    public McpAuthConfig getMcpAuth() {
        return mcpAuth;
    }

    public void setMcpAuth(McpAuthConfig mcpAuth) {
        this.mcpAuth = mcpAuth;
    }

    public AuditConfig getAudit() {
        return audit;
    }

    public void setAudit(AuditConfig audit) {
        this.audit = audit;
    }

    /**
     * Derives the JWKS URL from Keycloak settings if not explicitly provided.
     */
    public String getEffectiveJwksUrl() {
        return Optional.ofNullable(jwksUrl).orElseGet(() ->
            Optional.ofNullable(keycloakUrl)
                .map(url -> url + "/realms/" + keycloakRealm + "/protocol/openid-connect/certs")
                .orElse(null)
        );
    }

    /**
     * MCP OAuth configuration for VS Code, Claude Desktop, etc.
     */
    public static class McpAuthConfig {
        private boolean enabled = false;
        private String oauthClientId = "tes-mcp-client";
        private String oauthClientSecret;
        private String resourceServerUrl = "http://localhost:8000/mcp";
        private String requiredScopes = "openid,profile";

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getOauthClientId() {
            return oauthClientId;
        }

        public void setOauthClientId(String oauthClientId) {
            this.oauthClientId = oauthClientId;
        }

        public String getOauthClientSecret() {
            return oauthClientSecret;
        }

        public void setOauthClientSecret(String oauthClientSecret) {
            this.oauthClientSecret = oauthClientSecret;
        }

        public String getResourceServerUrl() {
            return resourceServerUrl;
        }

        public void setResourceServerUrl(String resourceServerUrl) {
            this.resourceServerUrl = resourceServerUrl;
        }

        public String getRequiredScopes() {
            return requiredScopes;
        }

        public void setRequiredScopes(String requiredScopes) {
            this.requiredScopes = requiredScopes;
        }
    }

    /**
     * Audit logging configuration.
     */
    public static class AuditConfig {
        private String logFile = "audit.json";
        private boolean toStdout = true;
        private boolean toDatabase = true;

        public String getLogFile() {
            return logFile;
        }

        public void setLogFile(String logFile) {
            this.logFile = logFile;
        }

        public boolean isToStdout() {
            return toStdout;
        }

        public void setToStdout(boolean toStdout) {
            this.toStdout = toStdout;
        }

        public boolean isToDatabase() {
            return toDatabase;
        }

        public void setToDatabase(boolean toDatabase) {
            this.toDatabase = toDatabase;
        }
    }
}
