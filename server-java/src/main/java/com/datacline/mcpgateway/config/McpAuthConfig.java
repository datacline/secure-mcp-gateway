package com.datacline.mcpgateway.config;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Optional;

/**
 * Authentication configuration for an MCP server.
 * Equivalent to Python's server/config.py MCPAuthConfig class.
 */
public record McpAuthConfig(
    /**
     * Authentication method: api_key, bearer, basic, oauth2, custom, none
     */
    @JsonProperty("method")
    AuthMethod method,

    /**
     * Where to place the auth credential: header, query, body
     */
    @JsonProperty("location")
    AuthLocation location,

    /**
     * Name of the header/parameter (e.g., "Authorization", "X-API-Key")
     */
    @JsonProperty("name")
    String name,

    /**
     * Format of the credential: raw, prefix, template
     */
    @JsonProperty("format")
    AuthFormat format,

    /**
     * Prefix for the credential (e.g., "Bearer ", "ApiKey ")
     */
    @JsonProperty("prefix")
    Optional<String> prefix,

    /**
     * Template string with {credential} placeholder
     */
    @JsonProperty("template")
    Optional<String> template,

    /**
     * Reference to the credential: env://VAR_NAME, file:///path, vault://path
     */
    @JsonProperty("credential_ref")
    String credentialRef,

    /**
     * Direct credential value (used when credential_ref is not set)
     */
    @JsonProperty("credential")
    String credential
) {
    /**
     * Authentication methods supported by MCP servers.
     */
    public enum AuthMethod {
        @JsonProperty("api_key")
        API_KEY,

        @JsonProperty("bearer")
        BEARER,

        @JsonProperty("basic")
        BASIC,

        @JsonProperty("oauth2")
        OAUTH2,

        @JsonProperty("custom")
        CUSTOM,

        @JsonProperty("none")
        NONE
    }

    /**
     * Location where the credential should be placed.
     */
    public enum AuthLocation {
        @JsonProperty("header")
        HEADER,

        @JsonProperty("query")
        QUERY,

        @JsonProperty("body")
        BODY
    }

    /**
     * Format of the credential value.
     */
    public enum AuthFormat {
        @JsonProperty("raw")
        RAW,

        @JsonProperty("prefix")
        PREFIX,

        @JsonProperty("template")
        TEMPLATE
    }

    /**
     * Create a default no-auth configuration.
     */
    public static McpAuthConfig none() {
        return new McpAuthConfig(
            AuthMethod.NONE,
            AuthLocation.HEADER,
            null,
            AuthFormat.RAW,
            Optional.empty(),
            Optional.empty(),
            null,
            null
        );
    }

    /**
     * Create a bearer token configuration with credential reference.
     */
    public static McpAuthConfig bearer(String credentialRef) {
        return new McpAuthConfig(
            AuthMethod.BEARER,
            AuthLocation.HEADER,
            "Authorization",
            AuthFormat.PREFIX,
            Optional.of("Bearer "),
            Optional.empty(),
            credentialRef,
            null
        );
    }

    /**
     * Create a bearer token configuration with direct credential.
     */
    public static McpAuthConfig bearerWithCredential(String credential) {
        return new McpAuthConfig(
            AuthMethod.BEARER,
            AuthLocation.HEADER,
            "Authorization",
            AuthFormat.PREFIX,
            Optional.of("Bearer "),
            Optional.empty(),
            null,
            credential
        );
    }

    /**
     * Create an API key configuration with credential reference.
     */
    public static McpAuthConfig apiKey(String headerName, String credentialRef) {
        return new McpAuthConfig(
            AuthMethod.API_KEY,
            AuthLocation.HEADER,
            headerName,
            AuthFormat.RAW,
            Optional.empty(),
            Optional.empty(),
            credentialRef,
            null
        );
    }

    /**
     * Create an API key configuration with direct credential.
     */
    public static McpAuthConfig apiKeyWithCredential(String headerName, String credential) {
        return new McpAuthConfig(
            AuthMethod.API_KEY,
            AuthLocation.HEADER,
            headerName,
            AuthFormat.RAW,
            Optional.empty(),
            Optional.empty(),
            null,
            credential
        );
    }

    /**
     * Check if authentication is required.
     */
    public boolean requiresAuth() {
        return method != null && method != AuthMethod.NONE;
    }

    /**
     * Check if a direct credential is available (not just a reference).
     */
    public boolean hasDirectCredential() {
        return credential != null && !credential.isEmpty();
    }

    /**
     * Get the effective credential: use direct credential if available, otherwise null.
     * Caller should resolve credentialRef separately if this returns null.
     */
    public String getEffectiveCredential() {
        if (hasDirectCredential()) {
            return credential;
        }
        return null;
    }
}
