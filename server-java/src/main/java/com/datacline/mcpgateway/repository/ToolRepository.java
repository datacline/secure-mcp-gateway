package com.datacline.mcpgateway.repository;

import com.datacline.mcpgateway.model.Tool;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Tool entities.
 */
@Repository
public interface ToolRepository extends JpaRepository<Tool, Long> {
    
    /**
     * Find a tool by its name.
     */
    Optional<Tool> findByName(String name);
    
    /**
     * Find all tools for a specific MCP server.
     */
    List<Tool> findByMcpServer(String mcpServer);
    
    /**
     * Check if a tool with the given name exists.
     */
    boolean existsByName(String name);
}
