package com.datacline.mcpgateway.model;

import jakarta.persistence.*;
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
public class Tool {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String description;

    @Lob
    @Column(name = "input_schema", columnDefinition = "CLOB")
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

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getInputSchema() {
        return inputSchema;
    }

    public void setInputSchema(String inputSchema) {
        this.inputSchema = inputSchema;
    }

    public String getMcpServer() {
        return mcpServer;
    }

    public void setMcpServer(String mcpServer) {
        this.mcpServer = mcpServer;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
