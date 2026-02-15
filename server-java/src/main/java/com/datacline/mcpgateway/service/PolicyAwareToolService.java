package com.datacline.mcpgateway.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for policy-aware tool filtering.
 * Ensures that policy restrictions take precedence over group configurations.
 *
 * Key principle: Available Tools = Server Tools ∩ Policy-Allowed Tools ∩ Group-Configured Tools
 */
@Service
public class PolicyAwareToolService {

    private static final Logger LOG = LoggerFactory.getLogger(PolicyAwareToolService.class);

    @Autowired
    private PolicyEngineClient policyEngineClient;

    @Autowired
    private McpProxyService mcpProxyService;

    /**
     * Get policy-allowed tools for a server and user.
     * Returns the list of tool names that the user is allowed to access based on policies.
     *
     * @param serverName The MCP server name
     * @param username The username
     * @return Mono containing list of allowed tool names
     */
    public Mono<List<String>> getPolicyAllowedTools(String serverName, String username) {
        LOG.debug("Fetching policy-allowed tools for server: {}, user: {}", serverName, username);

        // 1. Fetch all tools from the server
        return mcpProxyService.listTools(serverName, username)
            .flatMap(result -> {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> allTools =
                    (List<Map<String, Object>>) result.get("tools");

                LOG.debug("Server {} has {} total tools", serverName, allTools.size());

                // 2. Get policies for this server
                return policyEngineClient.getPoliciesForMCPServer(serverName)
                    .map(policyResponse -> {
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> policies =
                            (List<Map<String, Object>>) policyResponse.getOrDefault("policies", List.of());

                        LOG.debug("Found {} policies for server: {}", policies.size(), serverName);

                        // 3. Extract allowed tools from policy resources (Unified Policy format)
                        // NOTE: Tools should come from resources with resource_type="tool"
                        Set<String> policyAllowedTools = new HashSet<>();
                        boolean hasToolRestrictions = false;
                        boolean hasServerLevelPolicy = false;

                        for (Map<String, Object> policy : policies) {
                            // Check policy status - only process active policies
                            String status = (String) policy.get("status");
                            if (status != null && !"active".equals(status)) {
                                LOG.debug("Skipping policy {} with status: {}", policy.get("name"), status);
                                continue;
                            }

                            // Check policy rules for "allow" action (Unified Policy format)
                            @SuppressWarnings("unchecked")
                            List<Map<String, Object>> policyRules =
                                (List<Map<String, Object>>) policy.get("policy_rules");

                            boolean hasAllowAction = false;
                            if (policyRules != null) {
                                for (Map<String, Object> rule : policyRules) {
                                    @SuppressWarnings("unchecked")
                                    List<Map<String, Object>> actions =
                                        (List<Map<String, Object>>) rule.get("actions");
                                    if (actions != null) {
                                        for (Map<String, Object> action : actions) {
                                            if ("allow".equals(action.get("type"))) {
                                                hasAllowAction = true;
                                                break;
                                            }
                                        }
                                    }
                                    if (hasAllowAction) break;
                                }
                            }

                            if (!hasAllowAction) {
                                LOG.debug("Skipping policy {} - no allow action found", policy.get("name"));
                                continue;
                            }

                            // Extract resources from policy
                            @SuppressWarnings("unchecked")
                            List<Map<String, Object>> resources =
                                (List<Map<String, Object>>) policy.get("resources");

                            if (resources != null) {
                                // Check if this is a server-level policy (has mcp_server resource without tool restrictions)
                                boolean hasToolResources = false;

                                for (Map<String, Object> resource : resources) {
                                    String resourceType = (String) resource.get("resource_type");
                                    String resourceId = (String) resource.get("resource_id");

                                    if ("mcp_server".equals(resourceType) && serverName.equals(resourceId)) {
                                        hasServerLevelPolicy = true;
                                        LOG.debug("Policy {} has server-level resource for {}",
                                                policy.get("name"), serverName);
                                    }

                                    if ("tool".equals(resourceType) && resourceId != null) {
                                        hasToolResources = true;
                                        // Resource ID format: "server_name:tool_name"
                                        String[] parts = resourceId.split(":", 2);
                                        if (parts.length == 2 && serverName.equals(parts[0])) {
                                            String toolName = parts[1];
                                            policyAllowedTools.add(toolName);
                                            LOG.debug("Policy {} allows tool: {}", policy.get("name"), toolName);
                                        }
                                    }
                                }

                                // If policy has tool resources, it's a tool restriction policy
                                if (hasToolResources) {
                                    hasToolRestrictions = true;
                                }
                            }
                        }

                        // 4. If no policy restrictions found, allow all tools
                        if (!hasToolRestrictions) {
                            LOG.debug("No policy tool restrictions found for server: {}. Allowing all {} tools",
                                    serverName, allTools.size());
                            return allTools.stream()
                                .map(tool -> (String) tool.get("name"))
                                .collect(Collectors.toList());
                        }

                        // 5. Return only tools that exist AND are allowed by policy
                        List<String> allowedToolNames = allTools.stream()
                            .map(tool -> (String) tool.get("name"))
                            .filter(policyAllowedTools::contains)
                            .collect(Collectors.toList());

                        LOG.info("Policy filtering for server {}: {} total tools -> {} policy-allowed tools",
                                serverName, allTools.size(), allowedToolNames.size());

                        return allowedToolNames;
                    });
            })
            .onErrorResume(error -> {
                LOG.error("Error fetching policy-allowed tools for server {}: {}",
                        serverName, error.getMessage(), error);
                // On error, fail safe: return empty list (deny all)
                return Mono.just(List.of());
            });
    }

    /**
     * Apply both policy and group filtering to determine available tools.
     * This is the AUTHORITATIVE method for determining which tools a user can access.
     *
     * PHASE 2: ACTIVE - Filters tools based on policy AND group configuration.
     *
     * @param serverName The MCP server name
     * @param username The username
     * @param groupConfiguredTools The tools configured in the group (can be null/empty for no restriction)
     * @return Mono containing list of available tool objects
     */
    public Mono<List<Map<String, Object>>> getAvailableTools(
            String serverName,
            String username,
            List<String> groupConfiguredTools) {

        return getPolicyAllowedTools(serverName, username)
            .flatMap(policyAllowedTools -> {
                // Fetch full tool details
                return mcpProxyService.listTools(serverName, username)
                    .map(result -> {
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> allTools =
                            (List<Map<String, Object>>) result.get("tools");

                        // Still detect and log mismatches for monitoring
                        detectPolicyGroupMismatches(serverName, username, allTools,
                                                   policyAllowedTools, groupConfiguredTools);

                        // PHASE 2: ENFORCEMENT - Actually filter tools
                        List<Map<String, Object>> filteredTools = allTools.stream()
                            .filter(tool -> {
                                String toolName = (String) tool.get("name");

                                // 1. Must be allowed by policy
                                boolean allowedByPolicy = policyAllowedTools.contains(toolName);

                                // 2. Must be in group config (if configured)
                                boolean allowedByGroup = groupConfiguredTools == null
                                    || groupConfiguredTools.isEmpty()
                                    || groupConfiguredTools.contains("*")
                                    || groupConfiguredTools.contains(toolName);

                                return allowedByPolicy && allowedByGroup;
                            })
                            .collect(Collectors.toList());

                        LOG.info("PHASE 2: Filtered tools for server {}: {} total -> {} after policy+group filtering",
                                serverName, allTools.size(), filteredTools.size());

                        return filteredTools;
                    });
            });
    }

    /**
     * PHASE 1: Detect and log mismatches between policy-allowed tools and group-configured tools.
     * This helps identify existing issues without breaking current functionality.
     */
    private void detectPolicyGroupMismatches(
            String serverName,
            String username,
            List<Map<String, Object>> allTools,
            List<String> policyAllowedTools,
            List<String> groupConfiguredTools) {

        // Skip if no group configuration
        if (groupConfiguredTools == null || groupConfiguredTools.isEmpty() ||
            groupConfiguredTools.contains("*")) {
            LOG.debug("No group tool restrictions for server: {}", serverName);
            return;
        }

        // Find tools that are configured in group but NOT allowed by policy
        List<String> invalidTools = groupConfiguredTools.stream()
            .filter(tool -> !"*".equals(tool) && !policyAllowedTools.contains(tool))
            .collect(Collectors.toList());

        if (!invalidTools.isEmpty()) {
            LOG.warn("⚠️  POLICY-GROUP MISMATCH DETECTED for server: {}, user: {}", serverName, username);
            LOG.warn("    Group configured tools: {}", groupConfiguredTools);
            LOG.warn("    Policy allowed tools: {}", policyAllowedTools);
            LOG.warn("    ❌ Tools in group config but NOT allowed by policy: {}", invalidTools);
            LOG.warn("    ⚠️  This is a potential security issue - these tools will be blocked in Phase 2");
        }

        // Find tools that are allowed by policy but not in group config
        List<String> missingTools = policyAllowedTools.stream()
            .filter(tool -> !groupConfiguredTools.contains(tool) && !groupConfiguredTools.contains("*"))
            .collect(Collectors.toList());

        if (!missingTools.isEmpty()) {
            LOG.info("ℹ️  Group configuration is more restrictive than policy for server: {}", serverName);
            LOG.info("    Policy allows these tools but group doesn't expose them: {}", missingTools);
        }

        // Perfect match
        Set<String> groupSet = new HashSet<>(groupConfiguredTools);
        groupSet.remove("*");
        Set<String> policySet = new HashSet<>(policyAllowedTools);

        if (groupSet.equals(policySet)) {
            LOG.debug("✅ Perfect match: Group config aligns with policy for server: {}", serverName);
        }
    }

    /**
     * Get detailed tool availability information for debugging.
     * Returns information about policy filtering, group filtering, and final availability.
     *
     * @param serverName The MCP server name
     * @param username The username
     * @param groupConfiguredTools The tools configured in the group
     * @return Mono containing detailed availability information
     */
    public Mono<Map<String, Object>> getToolAvailabilityDebugInfo(
            String serverName,
            String username,
            List<String> groupConfiguredTools) {

        return getPolicyAllowedTools(serverName, username)
            .flatMap(policyAllowedTools -> {
                return mcpProxyService.listTools(serverName, username)
                    .map(result -> {
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> allTools =
                            (List<Map<String, Object>>) result.get("tools");

                        List<String> allToolNames = allTools.stream()
                            .map(tool -> (String) tool.get("name"))
                            .collect(Collectors.toList());

                        // Tools that pass policy filter
                        List<String> policyFiltered = allToolNames.stream()
                            .filter(policyAllowedTools::contains)
                            .collect(Collectors.toList());

                        // Tools that pass group filter
                        final List<String> groupFiltered;
                        if (groupConfiguredTools != null && !groupConfiguredTools.isEmpty() &&
                            !groupConfiguredTools.contains("*")) {
                            groupFiltered = allToolNames.stream()
                                .filter(groupConfiguredTools::contains)
                                .collect(Collectors.toList());
                        } else {
                            groupFiltered = new ArrayList<>(allToolNames);
                        }

                        // Tools that pass both filters (intersection)
                        List<String> finalAvailable = policyFiltered.stream()
                            .filter(tool -> groupFiltered.contains(tool))
                            .collect(Collectors.toList());

                        // Tools blocked by policy
                        List<String> blockedByPolicy = allToolNames.stream()
                            .filter(tool -> !policyAllowedTools.contains(tool))
                            .collect(Collectors.toList());

                        // Tools blocked by group
                        List<String> blockedByGroup = allToolNames.stream()
                            .filter(tool -> !groupFiltered.contains(tool))
                            .collect(Collectors.toList());

                        Map<String, Object> debugInfo = new HashMap<>();
                        debugInfo.put("server_name", serverName);
                        debugInfo.put("username", username);
                        debugInfo.put("total_tools", allToolNames.size());
                        debugInfo.put("all_tool_names", allToolNames);
                        debugInfo.put("policy_allowed_tools", policyAllowedTools);
                        debugInfo.put("group_configured_tools", groupConfiguredTools);
                        debugInfo.put("policy_filtered_count", policyFiltered.size());
                        debugInfo.put("group_filtered_count", groupFiltered.size());
                        debugInfo.put("final_available_count", finalAvailable.size());
                        debugInfo.put("final_available_tools", finalAvailable);
                        debugInfo.put("blocked_by_policy", blockedByPolicy);
                        debugInfo.put("blocked_by_group", blockedByGroup);

                        return debugInfo;
                    });
            });
    }
}
