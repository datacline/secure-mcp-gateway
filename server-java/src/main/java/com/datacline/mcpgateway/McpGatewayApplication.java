package com.datacline.mcpgateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Main Spring Boot application class for the MCP Gateway.
 *
 * Enables:
 * - JPA Repositories for database access (auto-configured by Spring Boot)
 * - Caching with Caffeine
 * - Async processing for audit logging
 * - Configuration properties scanning
 */
@SpringBootApplication
@EnableCaching
@EnableAsync
@ConfigurationPropertiesScan
public class McpGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(McpGatewayApplication.class, args);
    }
}
