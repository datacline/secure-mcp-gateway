package com.datacline.mcpgateway.service.audit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Stub audit logger for MCP requests.
 * Currently logs to SLF4J only.
 */
@Service
public class AuditLogger {

    private static final Logger LOG = LoggerFactory.getLogger(AuditLogger.class);

    /**
     * Log MCP request.
     */
    public void logMcpRequest(
            String user,
            String operation,
            String mcpServer,
            String toolName,
            Map<String, Object> parameters,
            String status,
            Object result,
            int durationMs,
            Integer httpStatus,
            String errorMsg
    ) {
        if ("success".equals(status)) {
            LOG.info("MCP {} on {} by {} - {} ({}ms)",
                    operation, mcpServer, user, status, durationMs);
        } else {
            LOG.error("MCP {} on {} by {} - {} ({}ms): {}",
                    operation, mcpServer, user, status, durationMs, errorMsg);
        }
    }
}
