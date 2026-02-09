package com.datacline.mcpgateway.service;

import com.datacline.mcpgateway.config.GatewayConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Client for fetching policies from the Go policy engine.
 * Supports both legacy enhanced policies and new unified policies.
 */
@Component
public class PolicyEngineClient {

    private static final Logger LOG = LoggerFactory.getLogger(PolicyEngineClient.class);
    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    private final WebClient webClient;

    public PolicyEngineClient(GatewayConfig gatewayConfig, WebClient.Builder builder) {
        String baseUrl = gatewayConfig.getPolicyEngineUrl();
        this.webClient = builder.baseUrl(baseUrl).build();
        LOG.info("Policy Engine client initialized with base URL: {}", baseUrl);
    }

    /**
     * Get a policy by ID (legacy enhanced policy API)
     */
    public Mono<Map<String, Object>> getPolicy(String policyId) {
        if (policyId == null || policyId.isBlank()) {
            return Mono.empty();
        }

        return webClient.get()
                .uri("/api/v1/enhanced/policies/{id}", policyId)
                .exchangeToMono(response -> {
                    if (response.statusCode().is2xxSuccessful()) {
                        return response.bodyToMono(MAP_TYPE);
                    }
                    if (response.statusCode().value() == 404) {
                        return Mono.empty();
                    }
                    return response.bodyToMono(String.class)
                            .defaultIfEmpty("Policy engine error")
                            .flatMap(message -> Mono.error(new RuntimeException(message)));
                });
    }

    /**
     * Get a unified policy by ID
     */
    public Mono<Map<String, Object>> getUnifiedPolicy(String policyId) {
        if (policyId == null || policyId.isBlank()) {
            return Mono.empty();
        }

        return webClient.get()
                .uri("/api/v1/unified/policies/{id}", policyId)
                .exchangeToMono(response -> {
                    if (response.statusCode().is2xxSuccessful()) {
                        return response.bodyToMono(MAP_TYPE);
                    }
                    if (response.statusCode().value() == 404) {
                        return Mono.empty();
                    }
                    return response.bodyToMono(String.class)
                            .defaultIfEmpty("Policy engine error")
                            .flatMap(message -> Mono.error(new RuntimeException(message)));
                });
    }

    /**
     * Get all policies bound to a specific resource (e.g., mcp_server).
     * Uses the unified policy API.
     * 
     * @param resourceType The type of resource (e.g., "mcp_server")
     * @param resourceId The resource identifier (e.g., server name)
     * @param activeOnly Whether to only return active policies
     * @param includeGlobal Whether to include global policies
     * @return A Mono containing the policy list response
     */
    public Mono<Map<String, Object>> getPoliciesByResource(
            String resourceType, 
            String resourceId,
            boolean activeOnly,
            boolean includeGlobal) {
        
        if (resourceType == null || resourceType.isBlank() || 
            resourceId == null || resourceId.isBlank()) {
            return Mono.just(Map.of("policies", Collections.emptyList(), "count", 0));
        }

        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/unified/resources/{type}/{id}/policies")
                        .queryParam("active", activeOnly)
                        .queryParam("include_global", includeGlobal)
                        .build(resourceType, resourceId))
                .exchangeToMono(response -> {
                    if (response.statusCode().is2xxSuccessful()) {
                        return response.bodyToMono(MAP_TYPE);
                    }
                    if (response.statusCode().value() == 404) {
                        return Mono.just(Map.of("policies", Collections.emptyList(), "count", 0));
                    }
                    return response.bodyToMono(String.class)
                            .defaultIfEmpty("Policy engine error")
                            .flatMap(message -> {
                                LOG.warn("Failed to get policies for resource {}/{}: {}", 
                                        resourceType, resourceId, message);
                                return Mono.just(Map.of(
                                        "policies", Collections.emptyList(), 
                                        "count", 0,
                                        "error", message));
                            });
                })
                .onErrorResume(error -> {
                    LOG.warn("Error fetching policies for resource {}/{}: {}", 
                            resourceType, resourceId, error.getMessage());
                    return Mono.just(Map.of(
                            "policies", Collections.emptyList(), 
                            "count", 0,
                            "error", error.getMessage()));
                });
    }

    /**
     * Convenience method to get policies for an MCP server.
     * 
     * @param serverName The MCP server name
     * @return A Mono containing the policy list response
     */
    public Mono<Map<String, Object>> getPoliciesForMCPServer(String serverName) {
        return getPoliciesByResource("mcp_server", serverName, true, true);
    }

    /**
     * Get all unified policies (optionally filtered by status).
     * 
     * @param status Optional status filter (draft, active, suspended, retired)
     * @return A Mono containing the policy list response
     */
    public Mono<Map<String, Object>> listUnifiedPolicies(String status) {
        return webClient.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder.path("/api/v1/unified/policies");
                    if (status != null && !status.isBlank()) {
                        builder.queryParam("status", status);
                    }
                    return builder.build();
                })
                .exchangeToMono(response -> {
                    if (response.statusCode().is2xxSuccessful()) {
                        return response.bodyToMono(MAP_TYPE);
                    }
                    return response.bodyToMono(String.class)
                            .defaultIfEmpty("Policy engine error")
                            .flatMap(message -> Mono.error(new RuntimeException(message)));
                });
    }

    /**
     * Check if policy engine is healthy.
     */
    public Mono<Boolean> healthCheck() {
        return webClient.get()
                .uri("/health")
                .exchangeToMono(response -> Mono.just(response.statusCode().is2xxSuccessful()))
                .onErrorResume(error -> Mono.just(false));
    }
}
