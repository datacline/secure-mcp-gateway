package com.datacline.mcpgateway.repository;

import com.datacline.mcpgateway.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository for AuditLog entities.
 */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    
    /**
     * Find audit logs for a specific username.
     */
    List<AuditLog> findByUsername(String username);
    
    /**
     * Find audit logs by action.
     */
    List<AuditLog> findByAction(String action);
    
    /**
     * Find audit logs within a time range.
     */
    List<AuditLog> findByTimestampBetween(LocalDateTime start, LocalDateTime end);
    
    /**
     * Find recent audit logs, ordered by timestamp descending.
     */
    List<AuditLog> findTop100ByOrderByTimestampDesc();
}
