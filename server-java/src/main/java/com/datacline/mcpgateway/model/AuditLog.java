package com.datacline.mcpgateway.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Entity representing an audit log entry.
 * Maps to the 'audit_logs' table in the database.
 */
@Entity
@Table(name = "audit_logs", indexes = {
    @Index(name = "idx_audit_logs_timestamp", columnList = "timestamp"),
    @Index(name = "idx_audit_logs_username", columnList = "username"),
    @Index(name = "idx_audit_logs_action", columnList = "action")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    private String username;

    @Column(length = 100)
    private String action;

    @Column(name = "tool_name")
    private String toolName;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String parameters;

    @Column(length = 50)
    private String status;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String error;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String output;

    @Column(name = "execution_time")
    private Integer executionTime;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
        createdAt = LocalDateTime.now();
    }
}
