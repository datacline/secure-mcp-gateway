package com.datacline.mcpgateway.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Entity representing an MCP tool.
 * Maps to the 'tools' table in the database.
 */
@Entity
@Table(name = "tools", indexes = {
    @Index(name = "idx_tools_name", columnList = "name"),
    @Index(name = "idx_tools_mcp_server", columnList = "mcp_server")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Tool {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String description;

    @Lob
    @Column(name = "input_schema", columnDefinition = "TEXT")
    private String inputSchema;

    @Column(name = "mcp_server")
    private String mcpServer;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
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
}
