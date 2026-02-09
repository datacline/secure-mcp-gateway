package com.datacline.mcpgateway.repository;

import com.datacline.mcpgateway.entity.McpServerEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for MCP Server configurations.
 */
@Repository
public interface McpServerRepository extends JpaRepository<McpServerEntity, Long> {

    /**
     * Find a server by its unique name.
     */
    Optional<McpServerEntity> findByName(String name);

    /**
     * Check if a server with the given name exists.
     */
    boolean existsByName(String name);

    /**
     * Find all enabled servers.
     */
    List<McpServerEntity> findByEnabledTrue();

    /**
     * Find servers by type.
     */
    List<McpServerEntity> findByType(String type);

    /**
     * Find servers by policy ID.
     */
    List<McpServerEntity> findByPolicyId(String policyId);

    /**
     * Delete a server by name.
     */
    void deleteByName(String name);
}
