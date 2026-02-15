package com.datacline.mcpgateway.repository;

import com.datacline.mcpgateway.entity.McpServerGroupEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for MCP Server Groups.
 */
@Repository
public interface McpServerGroupRepository extends JpaRepository<McpServerGroupEntity, Long> {

    /**
     * Find a group by its unique name.
     */
    Optional<McpServerGroupEntity> findByName(String name);

    /**
     * Check if a group with the given name exists.
     */
    boolean existsByName(String name);

    /**
     * Delete a group by name.
     */
    void deleteByName(String name);

    /**
     * Find a group by ID string (for convenience)
     */
    default Optional<McpServerGroupEntity> findByIdString(String idString) {
        try {
            Long id = Long.parseLong(idString);
            return findById(id);
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
